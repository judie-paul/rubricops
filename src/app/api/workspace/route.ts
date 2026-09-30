import { actor, failure } from '@/lib/http';
import { snapshot } from '@/lib/service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await snapshot(await actor()), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
