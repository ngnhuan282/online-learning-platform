import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Opt-in faults only on the documented disposable stack. No deletes or volume resets.
assert.ok(process.argv.includes('--isolated'), 'Use --isolated only for auth-integration test containers.');
const envFile = process.env.SMOKE_ENV_FILE || '.tmp/a8-a9.env';
const compose = ['compose', '--env-file', envFile, '-p', 'auth-integration', '--profile', 'backend'];
const base = process.env.SMOKE_BASE_URL || 'http://localhost:18080';
function docker(...args) {
  return execFileSync('docker', [...compose, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    windowsHide: true,
  });
}
async function probe(path) {
  const response = await fetch(`${base}/actuator/health/${path}`, { signal: AbortSignal.timeout(5000) });
  const body = await response.json();
  assert.equal(body.components, undefined, 'Health details must remain hidden');
  return response.status;
}
async function waitReady() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await probe('readiness')) === 200) return;
    } catch {
      /* Dependency recovery. */
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Core readiness did not recover');
}
function counts() {
  const query =
    'SELECT (SELECT COUNT(*) FROM auth_db.users), (SELECT COUNT(*) FROM learning_db.enrollments), ' +
    '(SELECT COUNT(*) FROM learning_db.lesson_progress), (SELECT COUNT(*) FROM payment_db.orders), ' +
    '(SELECT COUNT(*) FROM payment_db.payment_transactions), ' +
    '(SELECT COALESCE(SUM(progress_percent), 0) FROM learning_db.lesson_progress)';
  return docker(
    'exec',
    '-T',
    'mysql',
    'sh',
    '-c',
    `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -Nse "${query}"`,
  ).trim();
}

let paymentStopped = false;
let mysqlStopped = false;
try {
  await waitReady();
  paymentStopped = true;
  docker('stop', 'payment-service');
  assert.equal(await probe('readiness'), 503);
  assert.equal(await probe('liveness'), 200);
  docker('up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'payment-service');
  paymentStopped = false;
  await waitReady();
  console.log('PASS: Payment unavailable -> Gateway readiness 503, liveness 200, recovery 200.');

  const before = counts();
  mysqlStopped = true;
  docker('stop', 'mysql');
  assert.equal(await probe('readiness'), 503);
  const authReadiness = docker(
    'exec',
    '-T',
    'auth-service',
    'curl',
    '--silent',
    '--max-time',
    '40',
    '--output',
    '/dev/null',
    '--write-out',
    '%{http_code}',
    'http://127.0.0.1:8081/actuator/health/readiness',
  );
  assert.equal(authReadiness.trim(), '503');
  assert.equal(await probe('liveness'), 200);
  docker('up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'mysql');
  mysqlStopped = false;
  await waitReady();
  assert.equal(counts(), before, 'Persistent business data changed across MySQL stop/start');
  console.log(
    'PASS: MySQL unavailable -> Auth/Gateway readiness 503; restart preserves users, enrollments, progress, orders and transactions.',
  );
} finally {
  if (mysqlStopped) docker('up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'mysql');
  if (paymentStopped) docker('up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'payment-service');
}
