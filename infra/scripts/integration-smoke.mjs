import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Creates disposable accounts, courses and MOCK payments. Run against a test stack only.
const base = process.env.SMOKE_BASE_URL || 'http://localhost:18080';
const demo = process.argv.includes('--demo');
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || (demo ? 'demo.admin@example.com' : null);
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || (demo ? 'Admin123' : null);
assert.ok(adminEmail && adminPassword, 'Set SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD or seed the isolated stack and use --demo.');

async function request(path, { method = 'GET', body, token, cookie, headers = {}, status = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, `${method} ${path}: unexpected HTTP status`);
  assert.ok(response.headers.get('x-request-id'), `${path}: missing request correlation`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (status >= 400) assert.equal(json?.success, false);
  return { data: json?.data ?? json, headers: response.headers };
}

function cookieFrom(headers) {
  const value = headers.getSetCookie().find(value => value.startsWith('refresh_token='));
  assert.ok(value, 'Missing refresh cookie');
  assert.match(value, /HttpOnly/i);
  assert.match(value, /SameSite=Lax/i);
  return value.split(';')[0];
}

await request('/actuator/health/readiness');
for (const path of ['/api/v1/users/me', '/api/v1/learning/enrollments/me', '/api/v1/payments/history']) {
  await request(path, { status: 401 });
  await request(path, { token: 'invalid-jwt', status: 401 });
  const preflight = await request(path, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
}
await request('/api/v1/payments/history', { method: 'OPTIONS', status: 403, headers: {
  Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET',
} });
const admin = (await request('/api/v1/auth/login', { method: 'POST',
  body: { email: adminEmail, password: adminPassword } })).data.accessToken;
const suffix = randomUUID();
const email = `integration-${suffix}@example.test`;
const password = `Test9!${randomUUID()}`;
await request('/api/v1/auth/register', { method: 'POST', body: { email, password, fullName: 'Integration Learner' }, status: 201 });
const login = await request('/api/v1/auth/login', { method: 'POST', body: { email, password } });
const userToken = login.data.accessToken;
const userId = login.data.user.id;
let cookie = cookieFrom(login.headers);
const me = await request('/api/v1/users/me', { token: userToken, headers: { 'X-User-Id': '999999', 'X-User-Role': 'ADMIN' } });
assert.equal(me.data.id, userId);
for (const path of ['/api/v1/admin/courses', '/api/v1/learning/admin/quizzes', '/api/v1/payments/admin/orders']) {
  await request(path, { token: userToken, status: 403 });
  await request(path, { token: admin });
}
const categories = (await request('/api/v1/categories')).data;
assert.ok(categories.length, 'Seed categories before running the smoke test.');
const courses = [];
for (const price of [0, 100000]) {
  courses.push((await request('/api/v1/admin/courses', { method: 'POST', token: admin, body: {
    title: `Integration ${price} ${suffix}`, description: 'Disposable integration course',
    categoryId: categories[0].id, price, level: 'BEGINNER', status: 'PUBLISHED',
  } })).data);
}
const [free, paid] = courses;
await request('/api/v1/learning/enrollments', { method: 'POST', token: userToken, body: { courseId: paid.id }, status: 403 });
await request('/api/v1/learning/enrollments', { method: 'POST', token: userToken, body: { courseId: free.id } });
const checkoutBody = { courseId: paid.id, provider: 'MOCK', idempotencyKey: randomUUID() };
const checkout = (await request('/api/v1/payments/checkout', { method: 'POST', token: userToken, body: checkoutBody })).data;
const replay = (await request('/api/v1/payments/checkout', { method: 'POST', token: userToken, body: checkoutBody })).data;
assert.equal(replay.orderCode, checkout.orderCode);
await request(`/api/v1/payments/mock/orders/${checkout.orderCode}/complete`, { method: 'POST', token: userToken,
  body: { status: 'SUCCESS', providerTransactionCode: randomUUID() } });
const enrollments = (await request('/api/v1/learning/enrollments/me', { token: userToken })).data;
assert.ok(enrollments.some(item => item.courseId === free.id));
assert.ok(enrollments.some(item => item.courseId === paid.id));
await request('/api/v1/payments/history', { token: userToken });
await request('/api/v1/learning/dashboard', { token: userToken });
const refreshed = await request('/api/v1/auth/refresh', { method: 'POST', body: {}, cookie });
const rotated = cookieFrom(refreshed.headers);
assert.notEqual(rotated, cookie);
cookie = rotated;
for (const path of ['/api/v1/users/me', '/api/v1/learning/enrollments/me', '/api/v1/payments/history', `/api/v1/courses/${paid.id}`]) {
  await request(path, { token: refreshed.data.accessToken });
}
await request('/api/v1/auth/logout', { method: 'POST', body: {}, cookie });
await request('/api/v1/auth/refresh', { method: 'POST', body: {}, cookie, status: 401 });
console.log('PASS: CORS, JWT, roles, identity protection, free enrollment, MOCK payment -> Learning, idempotency, refresh rotation, logout.');
