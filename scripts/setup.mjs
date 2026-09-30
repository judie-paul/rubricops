import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    `DATABASE_URL="postgresql://rubricops:rubricops-local@127.0.0.1:55432/rubricops?schema=public"\nAUTH_SECRET="${randomBytes(32).toString('hex')}"\nAUTH_URL="http://localhost:3001"\nAUTH_TRUST_HOST="true"\nDEMO_MODE="true"\nDEMO_PASSWORD="rubricops-demo"\n`,
    { mode: 0o600 },
  );
  console.log(
    'Created local .env. Demo password: rubricops-demo (local use only).',
  );
} else console.log('Keeping existing .env.');
