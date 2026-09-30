import { Prisma, type TaskStatus, type Role } from '@prisma/client';
import { db } from './db';
import { agreementByRaterPair, median, rate, sampled } from './metrics';
import {
  evaluationSchema,
  reviewSchema,
  rubricSchema,
  validateScores,
  type Criterion,
  type TaskInput,
} from './validation';
import { indexTasks, queueCandidates, removeCandidate } from './queue';
export type Actor = { id: string; role: Role };
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role))
    throw new AppError('This action is not available for your role.', 403);
}
async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: 'Serializable',
        timeout: 10000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034' &&
        n < 4
      )
        continue;
      throw e;
    }
  }
}
function event(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entityId: string,
  detail: Prisma.InputJsonValue = {},
) {
  return tx.auditEvent.create({
    data: { actorId: actor.id, action, entityId, detail },
  });
}
const taskInclude = {
  rubric: true,
  evaluations: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  reviews: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};
export async function claimTask(actor: Actor) {
  requireRole(actor, ['EVALUATOR']);
  const preferred = await queueCandidates();
  return transaction(async (tx) => {
    const now = new Date();
    const active = await tx.assignment.findFirst({
      where: {
        userId: actor.id,
        completed: false,
        expiresAt: { gt: now },
        task: { status: 'OPEN' },
      },
      include: { task: { include: taskInclude } },
    });
    if (active)
      return { ...active.task, evaluations: [], reviews: [], lease: active };
    // Scan the SQL queue even when Redis is empty or stale. No task is lost.
    const tasks = await tx.task.findMany({
      where: { status: 'OPEN', evaluations: { none: { userId: actor.id } } },
      include: {
        ...taskInclude,
        assignments: { where: { completed: false, expiresAt: { gt: now } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    tasks.sort(
      (a, b) =>
        Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)),
    );
    const task = tasks.find(
      (t) => t.evaluations.length + t.assignments.length < 2,
    );
    if (!task) return null;
    const lease = await tx.assignment.upsert({
      where: { taskId_userId: { taskId: task.id, userId: actor.id } },
      create: {
        taskId: task.id,
        userId: actor.id,
        expiresAt: new Date(now.getTime() + 20 * 60000),
      },
      update: {
        startedAt: now,
        expiresAt: new Date(now.getTime() + 20 * 60000),
        completed: false,
      },
    });
    await event(tx, actor, 'TASK_CLAIMED', task.id);
    return { ...task, evaluations: [], reviews: [], assignments: [], lease };
  });
}
export async function submitEvaluation(actor: Actor, input: unknown) {
  requireRole(actor, ['EVALUATOR']);
  const data = evaluationSchema.parse(input);
  const result = await transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: data.taskId },
      include: taskInclude,
    });
    if (!task) throw new AppError('Task not found.', 404);
    const lease = await tx.assignment.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: actor.id } },
    });
    if (
      task.status !== 'OPEN' ||
      !lease ||
      lease.completed ||
      lease.expiresAt <= new Date()
    )
      throw new AppError(
        'The lease expired or this task is already submitted. Claim another task.',
        409,
      );
    validateScores(data.scores, task.rubric.criteria as Criterion[]);
    await tx.evaluation.create({
      data: {
        ...data,
        userId: actor.id,
        durationMs: Math.max(0, Date.now() - lease.startedAt.getTime()),
      },
    });
    await tx.assignment.update({
      where: { id: lease.id },
      data: { completed: true },
    });
    let status: TaskStatus = task.status;
    if (task.evaluations.length === 1) {
      const first = task.evaluations[0].scores as Record<string, number>;
      const disagreement = Object.keys(first).some(
        (key) => first[key] !== data.scores[key],
      );
      status = disagreement
        ? 'ADJUDICATION'
        : task.auditSelected
          ? 'REVIEW'
          : 'DONE';
      await tx.task.update({ where: { id: task.id }, data: { status } });
    }
    await event(tx, actor, 'EVALUATION_SUBMITTED', task.id, { status });
    return { id: task.id, status };
  });
  if (result.status !== 'OPEN') await removeCandidate(result.id);
  return result;
}
export async function releaseTask(actor: Actor, taskId: string) {
  requireRole(actor, ['EVALUATOR']);
  await db.assignment.updateMany({
    where: { taskId, userId: actor.id, completed: false },
    data: { expiresAt: new Date(0) },
  });
}
export async function submitReview(actor: Actor, input: unknown) {
  const data = reviewSchema.parse(input);
  return transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: data.taskId },
      include: taskInclude,
    });
    if (!task) throw new AppError('Task not found.', 404);
    const adjudication = task.status === 'ADJUDICATION';
    requireRole(actor, adjudication ? ['ADMIN'] : ['REVIEWER', 'ADMIN']);
    if (!['REVIEW', 'ADJUDICATION'].includes(task.status))
      throw new AppError('This task is no longer awaiting a decision.', 409);
    if (task.evaluations.some((e) => e.userId === actor.id))
      throw new AppError('You cannot review your own evaluation.', 403);
    if (adjudication !== (data.decision === 'RESOLVE'))
      throw new AppError('Choose a decision appropriate for this queue.');
    validateScores(data.scores, task.rubric.criteria as Criterion[]);
    const first = task.evaluations[0].scores as Record<string, number>;
    const changed = Object.keys(first).some(
      (key) => first[key] !== data.scores[key],
    );
    if (data.decision === 'CONFIRM' && changed)
      throw new AppError(
        'Confirm must retain the original scores. Choose overturn to change them.',
      );
    if (data.decision === 'OVERTURN' && !changed)
      throw new AppError('Overturn requires at least one changed score.');
    await tx.review.create({
      data: {
        ...data,
        userId: actor.id,
        kind: adjudication ? 'ADJUDICATION' : 'AUDIT',
      },
    });
    const status = data.decision === 'ESCALATE' ? 'ADJUDICATION' : 'DONE';
    await tx.task.update({ where: { id: task.id }, data: { status } });
    await event(tx, actor, adjudication ? 'ADJUDICATED' : 'REVIEWED', task.id, {
      decision: data.decision,
    });
    return { id: task.id, status };
  });
}
export async function publishRubric(actor: Actor, input: unknown) {
  requireRole(actor, ['ADMIN']);
  const data = rubricSchema.parse(input);
  return transaction(async (tx) => {
    const latest = await tx.rubric.findFirst({ orderBy: { version: 'desc' } });
    const rubric = await tx.rubric.create({
      data: { ...data, version: (latest?.version ?? 0) + 1 },
    });
    await event(tx, actor, 'RUBRIC_PUBLISHED', rubric.id, {
      version: rubric.version,
    });
    return rubric;
  });
}
export async function importTasks(
  actor: Actor,
  tasks: TaskInput[],
  rubricId: string,
) {
  requireRole(actor, ['ADMIN']);
  const ids = await transaction(async (tx) => {
    if (!(await tx.rubric.findUnique({ where: { id: rubricId } })))
      throw new AppError('Rubric not found.', 404);
    const existing = await tx.task.count({
      where: { externalId: { in: tasks.map((t) => t.externalId) } },
    });
    if (existing)
      throw new AppError(
        'One or more external IDs already exist. Nothing was imported.',
        409,
      );
    const ids: string[] = [];
    for (const task of tasks) {
      const created = await tx.task.create({
        data: { ...task, rubricId, auditSelected: sampled(task.externalId) },
      });
      ids.push(created.id);
    }
    await event(tx, actor, 'TASKS_IMPORTED', rubricId, { count: ids.length });
    return ids;
  });
  await indexTasks(ids);
  return { count: ids.length };
}
export async function snapshot(actor: Actor) {
  const [tasks, rubrics, events] = await Promise.all([
    db.task.findMany({ include: taskInclude, orderBy: { createdAt: 'desc' } }),
    db.rubric.findMany({ orderBy: { version: 'desc' } }),
    actor.role === 'ADMIN'
      ? db.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 30 })
      : [],
  ]);
  const paired = tasks.filter((t) => t.evaluations.length === 2);
  const names = new Map(
    tasks.flatMap((t) =>
      t.evaluations.map((e) => [e.userId, e.user.name] as const),
    ),
  );
  const criteria = rubrics.flatMap((r) =>
    (r.criteria as Criterion[]).flatMap((c) => {
      const observations = paired
        .filter((t) => t.rubricId === r.id)
        .map((t) =>
          t.evaluations.map((e) => ({
            userId: e.userId,
            scores: e.scores as Record<string, number>,
          })),
        );
      const groups = agreementByRaterPair(observations, c.id);
      const rows = groups.length
        ? groups
        : [{ raterIds: [], pairs: 0, kappa: null, agreement: null }];
      return rows.map((group) => ({
        id: JSON.stringify([r.id, c.id, ...group.raterIds]),
        name: c.name,
        version: r.version,
        ...group,
        raters: group.raterIds.map((id) => names.get(id) ?? id),
      }));
    }),
  );
  const audits = tasks
    .flatMap((t) => t.reviews)
    .filter(
      (r) => r.kind === 'AUDIT' && ['CONFIRM', 'OVERTURN'].includes(r.decision),
    );
  const evaluations = tasks.flatMap((t) => t.evaluations);
  return {
    user: await db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { id: true, name: true, email: true, role: true },
    }),
    tasks: tasks.map((t) =>
      actor.role === 'EVALUATOR' ? { ...t, evaluations: [], reviews: [] } : t,
    ),
    rubrics,
    events,
    metrics: {
      total: tasks.length,
      paired: paired.length,
      evaluations: evaluations.length,
      completed: tasks.filter((t) => t.status === 'DONE').length,
      audits: audits.length,
      overturnRate: rate(
        audits.filter((r) => r.decision === 'OVERTURN').length,
        audits.length,
      ),
      medianSeconds: median(evaluations.map((e) => e.durationMs / 1000)),
      criteria,
    },
  };
}
