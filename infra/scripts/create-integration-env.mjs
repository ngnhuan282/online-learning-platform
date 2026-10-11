import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('.tmp', { recursive: true });
const keys = ['MYSQL_ROOT_PASSWORD', 'AUTH_DB_PASSWORD', 'COURSE_DB_PASSWORD',
  'LEARNING_DB_PASSWORD', 'PAYMENT_DB_PASSWORD', 'AI_DB_PASSWORD', 'JWT_SECRET', 'INTERNAL_SERVICE_TOKEN'];
const lines = keys.map(key => `${key}=${randomBytes(32).toString('hex')}`);
lines.push('CORS_ALLOWED_ORIGINS=http://localhost:5173', 'STAGING_ORIGIN=https://staging.example.test',
  'MYSQL_PORT=13306', 'GATEWAY_PORT=18080', 'STAGING_WEB_PORT=18088', 'STORAGE_TYPE=local', 'REFRESH_COOKIE_SECURE=false');
// Credentials exist only in this ignored file; never print the resolved Compose configuration.
await writeFile('.tmp/integration.env', `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
console.log('Created .tmp/integration.env for an isolated integration stack.');
