import { Redis } from '@upstash/redis';
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv({
        retry: { retries: 0 },
        signal: () => AbortSignal.timeout(1500),
      })
    : null;
const key = 'rubricops:open:v1';
// Redis is a candidate index. PostgreSQL always arbitrates ownership and expiry.
export async function queueCandidates(): Promise<string[]> {
  if (!redis) return [];
  try {
    return await redis.zrange<string[]>(key, 0, 49);
  } catch {
    console.warn('Redis unavailable; using PostgreSQL queue.');
    return [];
  }
}
export async function indexTasks(ids: string[]) {
  if (!redis || !ids.length) return;
  try {
    const pipeline = redis.pipeline();
    for (const id of ids) pipeline.zadd(key, { score: Date.now(), member: id });
    await pipeline.exec();
  } catch {
    console.warn(
      'Redis index unavailable; PostgreSQL queue remains available.',
    );
  }
}
export async function removeCandidate(id: string) {
  if (!redis) return;
  try {
    await redis.zrem(key, id);
  } catch {
    /* stale entries are verified in SQL */
  }
}
