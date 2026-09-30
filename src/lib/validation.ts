import { z } from 'zod';
export const criterionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
});
export const rubricSchema = z.object({
  name: z.string().trim().min(1).max(120),
  criteria: z
    .array(criterionSchema)
    .min(1)
    .max(12)
    .refine(
      (c) => new Set(c.map((x) => x.id)).size === c.length,
      'Criterion IDs must be unique',
    ),
});
export type Criterion = z.infer<typeof criterionSchema>;
export const scoresSchema = z.record(
  z.string(),
  z.number().int().min(1).max(5),
);
export const evaluationSchema = z.object({
  taskId: z.string().min(1),
  scores: scoresSchema,
  rationale: z.string().trim().min(12).max(4000),
});
export const reviewSchema = evaluationSchema.extend({
  decision: z.enum(['CONFIRM', 'OVERTURN', 'ESCALATE', 'RESOLVE']),
});
export const taskSchema = z.object({
  externalId: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(20000),
  response: z.string().trim().min(1).max(40000),
  source: z.string().trim().min(1).max(120),
});
export type TaskInput = z.infer<typeof taskSchema>;
export function validateScores(
  scores: Record<string, number>,
  criteria: Criterion[],
) {
  scoresSchema.parse(scores);
  if (
    Object.keys(scores).length !== criteria.length ||
    criteria.some((c) => scores[c.id] === undefined)
  ) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['scores'],
        message:
          'Score every criterion in the assigned rubric, and only those criteria.',
      },
    ]);
  }
}
