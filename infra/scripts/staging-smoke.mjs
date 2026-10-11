import assert from 'node:assert/strict';

const base = process.env.STAGING_SMOKE_BASE_URL || 'http://localhost:18088';
const origin = process.env.STAGING_ORIGIN || 'https://staging.example.test';
const get = (path, options = {}) => fetch(`${base}${path}`, {
  ...options, signal: AbortSignal.timeout(15000),
});
for (const path of ['/healthz', '/courses', '/actuator/health/readiness', '/api/v1/courses']) {
  const response = await get(path);
  assert.equal(response.status, 200, `Staging ${path}`);
  if (path === '/courses') assert.match(await response.text(), /id="root"/);
}
const denied = await get('/api/v1/payments/history', { headers: { Origin: origin } });
assert.equal(denied.status, 401);
assert.equal(denied.headers.get('access-control-allow-origin'), origin);
assert.ok(denied.headers.get('x-request-id'));
assert.equal((await denied.json()).code, 'UNAUTHORIZED');
if (process.argv.includes('--demo')) {
  const login = await get('/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email: 'demo.admin@example.com', password: 'Admin123' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().find(cookie => cookie.startsWith('refresh_token='));
  assert.match(cookie, /; Secure(?:;|$)/i);
  assert.match(cookie, /; HttpOnly(?:;|$)/i);
  assert.match(cookie, /SameSite=Lax/i);
  await get('/api/v1/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie.split(';')[0] } });
}
console.log('PASS: staging web health, SPA routing, Gateway proxy/readiness, CORS on 401 and Secure refresh cookie.');
