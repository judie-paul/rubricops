import { actor, failure, readBody } from '@/lib/http';
import {
  AppError,
  claimTask,
  importTasks,
  publishRubric,
  releaseTask,
  submitEvaluation,
  submitReview,
} from '@/lib/service';
import { normalize } from '@/lib/ingest';
import { z } from 'zod';
export async function POST(request: Request) {
  try {
    const user = await actor();
    const body = z
      .object({ action: z.string(), data: z.unknown().optional() })
      .parse(await readBody(request));
    switch (body.action) {
      case 'claim':
        return Response.json({ task: await claimTask(user) });
      case 'evaluate':
        return Response.json(await submitEvaluation(user, body.data));
      case 'review':
        return Response.json(await submitReview(user, body.data));
      case 'release':
        await releaseTask(
          user,
          z.object({ taskId: z.string() }).parse(body.data).taskId,
        );
        return Response.json({ ok: true });
      case 'publish':
        return Response.json(await publishRubric(user, body.data));
      case 'import': {
        if (user.role !== 'ADMIN')
          throw new AppError('Admin access required.', 403);
        const input = z
          .object({
            rows: z.array(z.unknown()),
            format: z.enum(['normalized', 'hh', 'arena']),
            rubricId: z.string(),
          })
          .parse(body.data);
        let rows;
        try {
          rows = normalize(input.rows, input.format);
        } catch (e) {
          throw new AppError(e instanceof Error ? e.message : 'Invalid import');
        }
        return Response.json(await importTasks(user, rows, input.rubricId));
      }
      default:
        throw new AppError('Unknown action.');
    }
  } catch (e) {
    return failure(e);
  }
}
