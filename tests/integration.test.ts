import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import {
  claimTask,
  importTasks,
  publishRubric,
  releaseTask,
  snapshot,
  submitEvaluation,
  submitReview,
  type Actor,
} from '../src/lib/service';
// Run only against the isolated rubricops_test database.
const safe = process.env.DATABASE_URL?.includes('/rubricops_test');
const admin: Actor = { id: 'test-admin', role: 'ADMIN' },
  reviewer: Actor = { id: 'test-reviewer', role: 'REVIEWER' };
const users: Actor[] = [1, 2, 3].map((i) => ({
  id: `test-evaluator-${i}`,
  role: 'EVALUATOR',
}));
let rubricId = '';
const scores = { accuracy: 4 };
const rationale = 'The claims are supported and directly address the prompt.';
beforeAll(async () => {
  if (!safe)
    throw new Error(
      'Integration tests require DATABASE_URL pointing to rubricops_test.',
    );
  await db.auditEvent.deleteMany();
  await db.review.deleteMany();
  await db.evaluation.deleteMany();
  await db.assignment.deleteMany();
  await db.task.deleteMany();
  await db.rubric.deleteMany();
  await db.user.deleteMany();
  for (const user of [admin, reviewer, ...users])
    await db.user.create({
      data: { ...user, email: `${user.id}@test.local`, name: user.id },
    });
  rubricId = (
    await publishRubric(admin, {
      name: 'Test rubric',
      criteria: [
        {
          id: 'accuracy',
          name: 'Accuracy',
          description: 'Use 1 to 5 based on factual accuracy.',
        },
      ],
    })
  ).id;
});
afterAll(async () => db.$disconnect());
describe.sequential('transactional evaluation workflow', () => {
  it('rejects non-admin imports and rubric publication', async () => {
    await expect(importTasks(users[0], [], rubricId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(publishRubric(reviewer, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it('imports atomically and rejects repeated IDs', async () => {
    const task = {
      externalId: 'test-task',
      prompt: 'What is 2+2?',
      response: '4',
      source: 'test',
    };
    await importTasks(admin, [task], rubricId);
    await expect(
      importTasks(admin, [{ ...task, externalId: 'new' }, task], rubricId),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.task.count()).toBe(1);
  });
  it('limits concurrent claims to two distinct evaluators', async () => {
    const claims = await Promise.all(users.map((u) => claimTask(u)));
    expect(claims.filter(Boolean)).toHaveLength(2);
    const leases = await db.assignment.findMany({
      where: { completed: false },
    });
    expect(leases).toHaveLength(2);
    expect(
      claims.filter(Boolean).every((t) => t!.evaluations.length === 0),
    ).toBe(true);
  });
  it('rejects expired leases and allows release/reclaim', async () => {
    const assignment = await db.assignment.findFirstOrThrow();
    const user = users.find((u) => u.id === assignment.userId)!;
    await db.assignment.update({
      where: { id: assignment.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      submitEvaluation(user, { taskId: assignment.taskId, scores, rationale }),
    ).rejects.toMatchObject({ status: 409 });
    const task = await claimTask(user);
    expect(task?.id).toBe(assignment.taskId);
    await releaseTask(user, assignment.taskId);
    expect((await claimTask(user))?.id).toBe(assignment.taskId);
  });
  it('routes differing scores to adjudication and prevents duplicate scoring', async () => {
    const leases = await db.assignment.findMany();
    const first = users.find((u) => u.id === leases[0].userId)!;
    const second = users.find((u) => u.id === leases[1].userId)!;
    const taskId = leases[0].taskId;
    await submitEvaluation(first, { taskId, scores, rationale });
    await expect(
      submitEvaluation(first, { taskId, scores, rationale }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await submitEvaluation(second, {
          taskId,
          scores: { accuracy: 2 },
          rationale,
        })
      ).status,
    ).toBe('ADJUDICATION');
    await expect(
      submitReview(reviewer, {
        taskId,
        scores,
        rationale,
        decision: 'RESOLVE',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await submitReview(admin, {
      taskId,
      scores,
      rationale,
      decision: 'RESOLVE',
    });
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: taskId } })).status,
    ).toBe('DONE');
    expect((await snapshot(users[0])).tasks[0].evaluations).toEqual([]);
  });
  it('preserves historical rubric versions when a new version is published', async () => {
    const newer = await publishRubric(admin, {
      name: 'Second rubric',
      criteria: [
        { id: 'clarity', name: 'Clarity', description: 'Clear explanations.' },
      ],
    });
    expect(newer.version).toBe(2);
    expect((await db.task.findFirstOrThrow()).rubricId).toBe(rubricId);
  });
  it('requires an actual score change for overturn, and records the audit', async () => {
    await importTasks(
      admin,
      [
        {
          externalId: 'audit-task',
          prompt: 'Define a unit test',
          response: 'An isolated check',
          source: 'test',
        },
      ],
      rubricId,
    );
    const task = await db.task.findUniqueOrThrow({
      where: { externalId: 'audit-task' },
    });
    await db.task.update({
      where: { id: task.id },
      data: { auditSelected: true },
    });
    await claimTask(users[0]);
    await submitEvaluation(users[0], { taskId: task.id, scores, rationale });
    await claimTask(users[1]);
    await submitEvaluation(users[1], { taskId: task.id, scores, rationale });
    await expect(
      submitReview(reviewer, {
        taskId: task.id,
        scores,
        rationale,
        decision: 'OVERTURN',
      }),
    ).rejects.toThrow('changed score');
    await expect(
      submitReview(reviewer, {
        taskId: task.id,
        scores: { accuracy: 1 },
        rationale,
        decision: 'CONFIRM',
      }),
    ).rejects.toThrow('original scores');
    await submitReview(reviewer, {
      taskId: task.id,
      scores: { accuracy: 3 },
      rationale,
      decision: 'OVERTURN',
    });
    const report = await snapshot(admin);
    expect(report.metrics.overturnRate).toBe(1);
    expect(report.metrics.audits).toBe(1);
    expect(await db.auditEvent.count({ where: { action: 'REVIEWED' } })).toBe(
      1,
    );
  });
});
