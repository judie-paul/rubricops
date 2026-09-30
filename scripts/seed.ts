import { PrismaClient } from '@prisma/client';
import { sampled } from '../src/lib/metrics';
const db = new PrismaClient();
const criteria = [
  {
    id: 'accuracy',
    name: 'Accuracy',
    description:
      'Are claims correct and supported? 1: major errors · 3: mostly correct · 5: fully correct.',
  },
  {
    id: 'helpfulness',
    name: 'Helpfulness',
    description:
      'Does the answer address the request? 1: misses the request · 3: partial help · 5: directly useful.',
  },
  {
    id: 'clarity',
    name: 'Clarity',
    description:
      'Is the response clear and well organized? 1: hard to follow · 3: understandable · 5: concise and clear.',
  },
];
const examples = [
  [
    'Explain why the sky appears blue in two sentences.',
    'Air molecules scatter shorter blue wavelengths of sunlight more strongly than longer red wavelengths. That scattered blue light reaches your eyes from across the sky.',
  ],
  [
    'Write a Python function that returns the largest number in a nonempty list.',
    'def largest(numbers):\n    return max(numbers)\n\nThis accepts a nonempty iterable of comparable numbers. An empty input raises ValueError.',
  ],
  [
    'Give me three ways to make a meeting more useful.',
    'Share an agenda beforehand, invite only people who need to contribute, and end by assigning clear actions with owners and deadlines.',
  ],
  [
    'What is the difference between weather and climate?',
    'Weather describes short-term atmospheric conditions. Climate describes long-term patterns in those conditions, typically measured over decades.',
  ],
  [
    'Summarize: The team delayed the launch after testing found a login bug. A fix is planned for Friday.',
    'The launch is delayed by a login bug; the team plans to fix it on Friday.',
  ],
  [
    'Explain a database transaction to a beginner.',
    'A transaction groups changes so they succeed or fail together. For a bank transfer, subtracting money from one account and adding it to another must both happen, or neither should.',
  ],
  [
    'How many minutes are in two and a half hours?',
    'Two and a half hours contain 150 minutes: 2.5 × 60 = 150.',
  ],
  [
    'Write a polite message declining an invitation.',
    'Thank you for thinking of me. I’m sorry I can’t make it this time, but I hope you have a wonderful event.',
  ],
];
async function main() {
  const users = [
    {
      id: 'admin',
      email: 'admin@rubricops.local',
      name: 'Amara Okafor',
      role: 'ADMIN' as const,
    },
    {
      id: 'reviewer',
      email: 'reviewer@rubricops.local',
      name: 'Noah Kimani',
      role: 'REVIEWER' as const,
    },
    {
      id: 'evaluator',
      email: 'evaluator@rubricops.local',
      name: 'Maya Chen',
      role: 'EVALUATOR' as const,
    },
    {
      id: 'evaluator2',
      email: 'evaluator2@rubricops.local',
      name: 'Leo Mwangi',
      role: 'EVALUATOR' as const,
    },
  ];
  for (const user of users)
    await db.user.upsert({ where: { id: user.id }, create: user, update: {} });
  const rubric = await db.rubric.upsert({
    where: { version: 1 },
    create: {
      id: 'rubric-v1',
      version: 1,
      name: 'General response quality',
      criteria,
    },
    update: {},
  });
  for (let i = 0; i < 32; i++) {
    const id = `synthetic-42-${String(i + 1).padStart(3, '0')}`;
    if (await db.task.findUnique({ where: { externalId: id } })) continue;
    const [prompt, response] = examples[i % examples.length];
    const scores = {
      accuracy: 3 + (i % 3),
      helpfulness: 3 + ((i + 1) % 3),
      clarity: 3 + ((i + 2) % 3),
    };
    const second = {
      ...scores,
      accuracy:
        i % 4 === 0 ? Math.max(1, scores.accuracy - 1) : scores.accuracy,
    };
    const auditSelected = sampled(id);
    const status =
      i < 16 ? 'DONE' : i < 20 ? 'ADJUDICATION' : i < 24 ? 'REVIEW' : 'OPEN';
    const disagree = i % 4 === 0;
    // Seed historical review examples explicitly; all values are synthetic.
    await db.task.create({
      data: {
        id,
        externalId: id,
        prompt,
        response,
        source: 'synthetic · seed 42',
        rubricId: rubric.id,
        status,
        auditSelected: i >= 20 && i < 24 ? true : auditSelected,
        createdAt: new Date(Date.UTC(2026, 8, 28, 8, i * 5)),
        ...(i < 24
          ? {
              evaluations: {
                create: [
                  {
                    userId: 'evaluator',
                    scores,
                    rationale:
                      'Synthetic evaluation: checks factual support, relevance, and organization.',
                    durationMs: (55 + i * 7) * 1000,
                    createdAt: new Date(Date.UTC(2026, 8, 28, 9, i * 5)),
                  },
                  {
                    userId: 'evaluator2',
                    scores:
                      i >= 16 && i < 20
                        ? {
                            ...scores,
                            accuracy: Math.max(1, scores.accuracy - 1),
                          }
                        : i >= 20
                          ? scores
                          : second,
                    rationale:
                      'Synthetic independent evaluation for agreement measurement.',
                    durationMs: (68 + i * 5) * 1000,
                    createdAt: new Date(Date.UTC(2026, 8, 28, 9, i * 5 + 2)),
                  },
                ],
              },
            }
          : {}),
        ...(i < 16 && (disagree || auditSelected)
          ? {
              reviews: {
                create: {
                  userId: disagree ? 'admin' : 'reviewer',
                  kind: disagree ? 'ADJUDICATION' : 'AUDIT',
                  decision: disagree
                    ? 'RESOLVE'
                    : i % 3 === 0
                      ? 'OVERTURN'
                      : 'CONFIRM',
                  scores:
                    !disagree && i % 3 === 0
                      ? { ...scores, clarity: 2 }
                      : scores,
                  rationale:
                    'Seeded historical decision for the offline demonstration.',
                },
              },
            }
          : {}),
      },
    });
  }
  console.log(
    'Seed 42 ready: 32 synthetic tasks, four local users, rubric v1. Existing records preserved.',
  );
}
main().finally(() => db.$disconnect());
