import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProductionEnv, validateProductionEnv } from './production-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const command = process.argv[2];
const options = {};
for (let index = 3; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!['--env-file', '--project', '--file', '--confirm-project'].includes(key) || !process.argv[index + 1])
    throw new Error(
      'Use --env-file, --project and (for backups) --file; restore also requires --confirm-project',
    );
  options[key.slice(2)] = process.argv[index + 1];
}
const project = options.project || 'sgsphere-production';
if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error('Invalid Compose project name');
const envFile = resolve(root, options['env-file'] || '.env.production');
const compose = [
  'compose',
  '--parallel',
  '1',
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
const databases = ['auth_db', 'course_db', 'learning_db', 'payment_db', 'ai_db'];

function start(args, pipes = false) {
  const child = spawn('docker', [...compose, ...args], {
    cwd: root,
    env: { ...process.env, COMPOSE_BAKE: 'false' },
    windowsHide: true,
    stdio: pipes ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
  let errorText = '';
  if (pipes)
    child.stderr.on('data', chunk => {
      errorText = (errorText + chunk).slice(-8192);
    });
  const done = new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('close', code =>
      code === 0
        ? accept()
        : reject(new Error(`Docker operation failed (${code})${errorText ? ': ' + errorText.trim() : ''}`)),
    );
  });
  return { child, done };
}
async function docker(...args) {
  await start(args).done;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function requireFile() {
  if (!options.file) throw new Error('Specify an explicit --file path for the backup archive');
  return resolve(options.file);
}

try {
  const env = await loadProductionEnv(envFile);
  if (['check', 'up'].includes(command)) {
    const errors = validateProductionEnv(env);
    if (errors.length) throw new Error(errors.join('\n'));
    await docker('config', '-q');
    if (command === 'up') {
      await docker('build');
      await docker('up', '-d', '--wait', '--wait-timeout', '300');
    }
    console.log(
      command === 'check'
        ? 'PASS: production preflight.'
        : 'Production services are healthy. Verify the external HTTPS origin before routing users.',
    );
  } else if (command === 'status') {
    await docker('ps', '-a');
  } else if (command === 'backup') {
    const file = requireFile();
    for (const path of [file, file + '.json']) {
      try {
        await stat(path);
        throw new Error('Backup destination already exists; choose a new filename');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    const { child, done } = start(
      [
        'exec',
        '-T',
        'mysql',
        'sh',
        '-c',
        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -uroot --single-transaction --routines --triggers --events --hex-blob --no-tablespaces --databases auth_db course_db learning_db payment_db ai_db',
      ],
      true,
    );
    child.stdin.end();
    try {
      await Promise.all([
        pipeline(child.stdout, createGzip(), createWriteStream(file, { flags: 'wx', mode: 0o600 })),
        done,
      ]);
    } catch (error) {
      child.kill();
      throw error;
    }
    const manifest = {
      format: 1,
      project,
      release: env.RELEASE_TAG,
      createdAt: new Date().toISOString(),
      databases,
      sha256: await digest(file),
    };
    await writeFile(file + '.json', JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(
      'Backup and checksum manifest written. Store both securely outside this host; S3 media needs its own versioning/backup policy.',
    );
  } else if (command === 'restore') {
    const file = requireFile();
    if (options['confirm-project'] !== project)
      throw new Error(
        'Restore replaces database contents. Pass --confirm-project with the exact target project name',
      );
    const manifest = JSON.parse(await readFile(file + '.json', 'utf8'));
    if (
      manifest.format !== 1 ||
      JSON.stringify(manifest.databases) !== JSON.stringify(databases) ||
      manifest.sha256 !== (await digest(file))
    )
      throw new Error('Invalid backup manifest or checksum; no services were stopped');
    await docker(
      'stop',
      'web',
      'api-gateway',
      'auth-service',
      'course-service',
      'learning-service',
      'payment-service',
      'ai-service',
    );
    await docker('up', '-d', '--wait', '--wait-timeout', '120', 'mysql');
    const { child, done } = start(
      [
        'exec',
        '-T',
        'mysql',
        'sh',
        '-c',
        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --default-character-set=utf8mb4 -uroot',
      ],
      true,
    );
    child.stdout.resume();
    try {
      await Promise.all([pipeline(createReadStream(file), createGunzip(), child.stdin), done]);
    } catch (error) {
      child.kill();
      throw new Error(`Restore failed; application services remain stopped. ${error.message}`);
    }
    await docker('up', '-d', '--wait', '--wait-timeout', '300');
    console.log(
      'Restore complete; services are healthy. Verify login, course access and payment records before reopening traffic.',
    );
  } else
    throw new Error(
      'Usage: node infra/scripts/production.mjs check|up|status|backup|restore --env-file .env.production --project sgsphere-production [--file backup.sql.gz] [--confirm-project sgsphere-production]',
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
