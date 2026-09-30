import { writeFileSync } from 'node:fs';
import { snapshot } from '../src/lib/service';
import { db } from '../src/lib/db';
async function main() {
  const result = await snapshot({ id: 'admin', role: 'ADMIN' });
  writeFileSync(
    'docs/results.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        command: 'npm run results',
        source:
          'Current local database; seed 42 synthetic demo, plus any locally submitted records',
        metrics: result.metrics,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(result.metrics, null, 2));
}
main().finally(() => db.$disconnect());
