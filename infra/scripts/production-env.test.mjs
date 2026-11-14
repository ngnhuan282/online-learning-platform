import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { parseEnv, validateProductionEnv } from './production-env.mjs';

function fixture() {
  const env = Object.fromEntries(
    [
      'MYSQL_ROOT_PASSWORD',
      'AUTH_DB_PASSWORD',
      'COURSE_DB_PASSWORD',
      'LEARNING_DB_PASSWORD',
      'PAYMENT_DB_PASSWORD',
      'AI_DB_PASSWORD',
      'JWT_SECRET',
      'INTERNAL_SERVICE_TOKEN',
    ].map(key => [key, randomBytes(32).toString('hex')]),
  );
  return {
    ...env,
    PRODUCTION_ORIGIN: 'https://learn.integration.test',
    RELEASE_TAG: 'release-0123456',
    TRUSTED_PROXY_CIDR: '172.18.0.1/32',
    PAYMENT_MOCK_ENABLED: 'false',
    STORAGE_TYPE: 's3',
    AWS_REGION: 'ap-southeast-1',
    AWS_S3_BUCKET: 'private-media',
    MAIL_ENABLED: 'true',
    MAIL_HOST: 'smtp.integration.test',
    MAIL_PORT: '587',
    MAIL_USERNAME: 'sender',
    MAIL_PASSWORD: 'mail-test-value',
    MAIL_FROM: 'sender@integration.test',
  };
}

test('portable production configuration accepts IAM credentials and optional providers disabled', () => {
  assert.deepEqual(validateProductionEnv(fixture()), []);
});
test('production preflight rejects shared/weak secrets, mock payments, insecure origins and untrusted proxy ranges without exposing values', () => {
  const env = fixture();
  env.AUTH_DB_PASSWORD = env.JWT_SECRET;
  env.PAYMENT_MOCK_ENABLED = 'true';
  env.PRODUCTION_ORIGIN = 'http://localhost:5173';
  env.TRUSTED_PROXY_CIDR = '0.0.0.0/0';
  env.STORAGE_TYPE = 'local';
  const errors = validateProductionEnv(env).join('\n');
  for (const text of [
    'independent',
    'PAYMENT_MOCK_ENABLED',
    'PRODUCTION_ORIGIN',
    'TRUSTED_PROXY_CIDR',
    'STORAGE_TYPE',
  ])
    assert.ok(errors.includes(text));
  assert.ok(!errors.includes(env.JWT_SECRET));
});
test('enabled integrations require complete configuration and production VNPay cannot use a sandbox URL', () => {
  const env = {
    ...fixture(),
    GOOGLE_LOGIN_ENABLED: 'true',
    AI_API_KEY: 'private-ai-key',
    VNPAY_TMN_CODE: 'TEST0001',
    VNPAY_HASH_SECRET: 'private-signing-key',
    VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  };
  const errors = validateProductionEnv(env).join('\n');
  assert.match(errors, /GOOGLE_CLIENT_ID/);
  assert.match(errors, /AI_MODEL/);
  assert.match(errors, /sandbox payments/);
  assert.ok(!errors.includes('private-ai-key'));
  assert.ok(!errors.includes('private-signing-key'));
});
test('dotenv parser never executes input and rejects expansion, duplicate keys and malformed quotes', () => {
  assert.deepEqual(parseEnv("# ignored\nMAIL_FROM='sender@integration.test'\nJWT_ISSUER=sgedu # comment"), {
    MAIL_FROM: 'sender@integration.test',
    JWT_ISSUER: 'sgedu',
  });
  assert.throws(() => parseEnv('A=first\nA=second'));
  assert.throws(() => parseEnv('A=${JWT_SECRET}'));
  assert.throws(() => parseEnv("A='unterminated"));
});
