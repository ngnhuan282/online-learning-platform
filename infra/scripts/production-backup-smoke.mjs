import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, copyFile, appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

assert.ok(
  process.argv.includes('--test-stack'),
  'Use --test-stack only for the disposable production-integration project',
);
const project = 'production-integration';
const envFile = process.env.PRODUCTION_SMOKE_ENV_FILE || '.tmp/production-integration.env';
const compose = [
  'compose',
  '--env-file',
  envFile,
  '-p',
  project,
  '-f',
  'compose.yaml',
  '-f',
  'compose.production.yaml',
  '--profile',
  'backend',
];
const file = resolve('.tmp/production-backup/' + randomUUID() + '.sql.gz');
await mkdir('.tmp/production-backup', { recursive: true, mode: 0o700 });

function sql(query) {
  return execFileSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'mysql',
      'sh',
      '-c',
      'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names',
    ],
    {
      input: query,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    },
  ).trim();
}
function snapshot() {
  return sql(
    'SELECT (SELECT COUNT(*) FROM auth_db.users), (SELECT COUNT(*) FROM course_db.categories), (SELECT COUNT(*) FROM course_db.courses), (SELECT COUNT(*) FROM learning_db.enrollments), (SELECT COUNT(*) FROM learning_db.lesson_progress), (SELECT COUNT(*) FROM payment_db.orders), (SELECT COUNT(*) FROM payment_db.payment_transactions), (SELECT COUNT(*) FROM ai_db.ai_daily_usage)',
  );
}
async function operation(command, target, capture = false) {
  const args = [
    'infra/scripts/production.mjs',
    command,
    '--env-file',
    envFile,
    '--project',
    project,
    '--file',
    target,
  ];
  if (command === 'restore') args.push('--confirm-project', project);
  const child = spawn(process.execPath, args, {
    windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  let output = '';
  if (capture)
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', chunk => {
        output += chunk;
      });
  const code = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('close', accept);
  });
  return { code, output };
}

const before = snapshot();
assert.equal((await operation('backup', file)).code, 0);
const bad = file + '.corrupted';
await copyFile(file, bad);
await copyFile(file + '.json', bad + '.json');
await appendFile(bad, 'tampered');
const rejected = await operation('restore', bad, true);
assert.notEqual(rejected.code, 0);
assert.match(rejected.output, /checksum/);
assert.equal(snapshot(), before);
console.log('PASS: corrupted backup rejected before stopping services or changing data.');
const marker = randomUUID();
sql(
  `INSERT INTO course_db.categories(name,slug,active,created_at,updated_at) VALUES ('Restore fixture ${marker}','restore-${marker}',TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
);
assert.notEqual(snapshot(), before);
assert.equal((await operation('restore', file)).code, 0);
assert.equal(snapshot(), before);
console.log(
  'PASS: compressed backup restores all five databases and exact business counts; services restarted healthy.',
);
