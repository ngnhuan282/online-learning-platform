import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from './production-env.mjs';

// Derive only from the disposable integration fixture, never from the real .env.
const env = parseEnv(await readFile(process.argv[2] || '.tmp/integration.env', 'utf8'));
Object.assign(env, {
  PRODUCTION_ORIGIN: 'https://learn.integration.test',
  RELEASE_TAG: 'ci-production-fixture',
  TRUSTED_PROXY_CIDR: '127.0.0.1/32',
  PRODUCTION_WEB_PORT: '18088',
  PAYMENT_MOCK_ENABLED: 'false',
  BOOTSTRAP_ADMIN_ENABLED: 'true',
  BOOTSTRAP_ADMIN_EMAIL: 'production-admin@integration.test',
  BOOTSTRAP_ADMIN_PASSWORD: 'InitialProductionTest123!',
  MAIL_ENABLED: 'false',
  STORAGE_TYPE: 'local',
  AI_DAILY_REQUEST_LIMIT: '3',
});
await writeFile(
  process.argv[3] || '.tmp/production-integration.env',
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Prepared disposable production-overlay fixture. External SMTP/S3/AI/payment services are not used.',
);
