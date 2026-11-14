import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isIP } from 'node:net';

export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.hasOwn(result, match[1]))
      throw new Error('Invalid or duplicate environment variable assignment');
    let value = match[2];
    if (/^["']/.test(value)) {
      if (value.at(-1) !== value[0]) throw new Error('Unclosed environment value');
      value = value.slice(1, -1);
    } else value = value.replace(/\s+#.*$/, '');
    // Compose expands dollar signs in env files. Reject ambiguity rather than validating a different secret.
    if (value.includes('$') || /[\r\n\0]/.test(value))
      throw new Error(`Use a literal value without dollar expansion for ${match[1]}`);
    result[match[1]] = value;
  }
  return result;
}

export async function loadProductionEnv(file) {
  const parsed = parseEnv(await readFile(file, 'utf8'));
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, process.env[key] ?? value]));
}

export function validateProductionEnv(env) {
  const errors = [];
  const required = key => {
    if (!env[key]?.trim()) errors.push(`${key} is required`);
  };
  const secrets = [
    'MYSQL_ROOT_PASSWORD',
    'AUTH_DB_PASSWORD',
    'COURSE_DB_PASSWORD',
    'LEARNING_DB_PASSWORD',
    'PAYMENT_DB_PASSWORD',
    'AI_DB_PASSWORD',
    'JWT_SECRET',
    'INTERNAL_SERVICE_TOKEN',
  ];
  for (const key of secrets) {
    required(key);
    if (
      env[key] &&
      (Buffer.byteLength(env[key]) < 32 || /change.?me|example|test-secret|<|>/i.test(env[key]))
    )
      errors.push(`${key} must contain at least 32 random UTF-8 bytes`);
    if (env[key] && key.includes('DB_PASSWORD') && !/^[A-Za-z0-9_+=/@.-]+$/.test(env[key]))
      errors.push(`${key} must use the characters supported by MySQL initialization (use random hex)`);
  }
  const values = secrets.map(key => env[key]).filter(Boolean);
  if (new Set(values).size !== values.length)
    errors.push('Database passwords, JWT_SECRET and INTERNAL_SERVICE_TOKEN must be independent');
  let origin;
  try {
    origin = new URL(env.PRODUCTION_ORIGIN);
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== env.PRODUCTION_ORIGIN ||
      origin.username ||
      origin.password ||
      (origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost') || isIP(origin.hostname.replace(/^\[|\]$/g, ''))) ||
      origin.hostname.endsWith('.example.com')
    )
      throw new Error();
  } catch {
    errors.push(
      'PRODUCTION_ORIGIN must be the actual HTTPS origin, without a trailing slash, path or credentials',
    );
  }
  required('RELEASE_TAG');
  if (
    env.RELEASE_TAG &&
    (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(env.RELEASE_TAG) ||
      ['latest', 'main', 'develop'].includes(env.RELEASE_TAG))
  )
    errors.push('RELEASE_TAG must identify a fixed release (for example a Git commit SHA)');
  const [address, prefix] = (env.TRUSTED_PROXY_CIDR || '').split('/');
  const version = isIP(address);
  if (
    !version ||
    (prefix != null &&
      (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))
  )
    errors.push(
      'TRUSTED_PROXY_CIDR must be the actual reverse proxy IP or a bounded CIDR, never a catch-all',
    );
  for (const key of [
    'PAYMENT_MOCK_ENABLED',
    'BOOTSTRAP_ADMIN_ENABLED',
    'MAIL_ENABLED',
    'GOOGLE_LOGIN_ENABLED',
  ]) {
    if (env[key] != null && !['true', 'false'].includes(env[key]))
      errors.push(`${key} must be true or false`);
  }
  if (env.PAYMENT_MOCK_ENABLED !== 'false') errors.push('PAYMENT_MOCK_ENABLED must be false for production');
  if (env.STORAGE_TYPE !== 's3')
    errors.push('STORAGE_TYPE must be s3 for portable, durable production media');
  required('AWS_REGION');
  required('AWS_S3_BUCKET');
  if (Boolean(env.AWS_ACCESS_KEY_ID) !== Boolean(env.AWS_SECRET_ACCESS_KEY))
    errors.push('Configure both AWS credentials or leave both empty to use an IAM role');
  for (const key of ['AWS_ENDPOINT_URL', 'AWS_PUBLIC_ENDPOINT_URL']) {
    if (env[key]) {
      try {
        const url = new URL(env[key]);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
          throw new Error();
      } catch {
        errors.push(`${key} must be an HTTPS storage endpoint without credentials or query parameters`);
      }
    }
  }
  if (env.MAIL_ENABLED !== 'true') errors.push('MAIL_ENABLED must be true so password recovery is available');
  if (env.MAIL_ENABLED === 'true')
    for (const key of ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM'])
      required(key);
  if (env.GOOGLE_LOGIN_ENABLED === 'true')
    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) required(key);
  if (Boolean(env.AI_API_KEY) !== Boolean(env.AI_MODEL))
    errors.push('Configure both AI_API_KEY and AI_MODEL, or leave both empty to disable generation');
  const limit = Number(env.AI_DAILY_REQUEST_LIMIT || 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    errors.push('AI_DAILY_REQUEST_LIMIT must be between 1 and 10000');
  if (Boolean(env.VNPAY_TMN_CODE) !== Boolean(env.VNPAY_HASH_SECRET))
    errors.push('Configure both VNPay merchant credentials or leave both empty to disable payments');
  if (env.VNPAY_TMN_CODE && !/^[A-Za-z0-9]{8}$/.test(env.VNPAY_TMN_CODE))
    errors.push('VNPAY_TMN_CODE must have 8 alphanumeric characters');
  if (env.VNPAY_TMN_CODE && env.VNPAY_PAYMENT_URL !== 'https://pay.vnpay.vn/vpcpay.html')
    errors.push(
      'Production VNPay credentials require the approved production payment URL; sandbox payments cannot be deployed as live payments',
    );
  if (env.BOOTSTRAP_ADMIN_ENABLED === 'true') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BOOTSTRAP_ADMIN_EMAIL || ''))
      errors.push('BOOTSTRAP_ADMIN_EMAIL must be valid');
    const password = env.BOOTSTRAP_ADMIN_PASSWORD || '';
    if (
      password.length < 12 ||
      Buffer.byteLength(password) > 72 ||
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/s.test(password)
    )
      errors.push(
        'BOOTSTRAP_ADMIN_PASSWORD must contain upper/lowercase and digits, at least 12 characters and at most 72 UTF-8 bytes',
      );
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const env = await loadProductionEnv(process.argv[2] || '.env.production');
    const errors = validateProductionEnv(env);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('PASS: production environment validation (secret values are not displayed).');
    for (const [key, label] of [
      ['VNPAY_TMN_CODE', 'VNPay checkout'],
      ['AI_API_KEY', 'AI generation'],
      ['GOOGLE_CLIENT_ID', 'Google login'],
    ]) {
      console.log(`${label}: ${env[key] ? 'configured; requires live acceptance' : 'disabled'}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
