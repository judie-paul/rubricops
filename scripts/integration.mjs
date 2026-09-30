import { spawnSync } from 'node:child_process';
const url =
  process.env.TEST_DATABASE_URL ||
  'postgresql://rubricops:rubricops-local@127.0.0.1:55432/rubricops_test?schema=public';
if (!new URL(url).pathname.endsWith('/rubricops_test'))
  throw new Error('Use an isolated rubricops_test database.');
const env = { ...process.env, DATABASE_URL: url };
for (const args of [
  ['prisma', 'migrate', 'deploy'],
  ['vitest', 'run', 'tests/integration.test.ts'],
]) {
  const result = spawnSync('npx', args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
