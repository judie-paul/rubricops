import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  zrange: vi.fn(),
  zrem: vi.fn(),
  zadd: vi.fn(),
  exec: vi.fn(),
  pipeline: vi.fn(),
  fromEnv: vi.fn(),
}));
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: mock.fromEnv } }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});
async function configured() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.invalid');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'mock-token');
  mock.fromEnv.mockReturnValue(mock);
  mock.pipeline.mockReturnValue(mock);
  return import('../src/lib/queue');
}
describe('optional queue index', () => {
  it('works without a hosted Redis account', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const queue = await import('../src/lib/queue');
    expect(await queue.queueCandidates()).toEqual([]);
    await queue.indexTasks(['one']);
    await queue.removeCandidate('one');
    expect(mock.fromEnv).not.toHaveBeenCalled();
  });
  it('indexes and removes candidates using bounded requests', async () => {
    const queue = await configured();
    mock.zrange.mockResolvedValue(['one']);
    expect(await queue.queueCandidates()).toEqual(['one']);
    await queue.indexTasks(['one', 'two']);
    await queue.removeCandidate('one');
    expect(mock.zadd).toHaveBeenCalledTimes(2);
    expect(mock.exec).toHaveBeenCalledOnce();
    expect(mock.zrem).toHaveBeenCalledWith('rubricops:open:v1', 'one');
    expect(mock.fromEnv).toHaveBeenCalledWith({
      retry: { retries: 0 },
      signal: expect.any(Function),
    });
  });
  it('falls back to SQL when the provider fails', async () => {
    const queue = await configured();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mock.zrange.mockRejectedValue(new Error('timeout'));
    mock.exec.mockRejectedValue(new Error('offline'));
    mock.zrem.mockRejectedValue(new Error('offline'));
    expect(await queue.queueCandidates()).toEqual([]);
    await expect(queue.indexTasks(['one'])).resolves.toBeUndefined();
    await expect(queue.removeCandidate('one')).resolves.toBeUndefined();
  });
});
