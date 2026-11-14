import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadProductionEnv } from './production-env.mjs';

assert.ok(
  process.argv.includes('--test-stack'),
  'This scenario creates test accounts/courses. Use --test-stack on a disposable stack only.',
);
const base = process.env.PRODUCTION_SMOKE_URL || 'http://localhost:18088';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'This fixture driver is restricted to a local disposable stack',
);
const env = await loadProductionEnv(
  process.env.PRODUCTION_SMOKE_ENV_FILE || '.tmp/production-integration.env',
);
const report = { checkedAt: new Date().toISOString(), checks: [] };
async function api(path, { method = 'GET', token, body, cookie, status = 200 } = {}) {
  const response = await fetch(base + '/api/v1' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, `${method} ${path.split('?')[0]}: unexpected HTTP status`);
  const envelope = await response.json();
  assert.equal(envelope.success, status < 400);
  return { data: envelope.data, headers: response.headers, code: envelope.code };
}
for (const path of ['/healthz', '/courses', '/account']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(response.headers.get('strict-transport-security'), /max-age=/);
}
for (const path of [
  '/internal/v1/learning/enrollments',
  '/v3/api-docs',
  '/swagger-ui/index.html',
  '/assets/does-not-exist.js',
]) {
  assert.equal((await fetch(base + path)).status, 404);
}
assert.equal((await fetch(base + '/actuator/health/readiness')).status, 200);
report.checks.push(
  'Production Nginx: SPA, health, CSP/HSTS/security headers, private/OpenAPI paths blocked, missing JS returns 404.',
);

const adminLogin = await api('/auth/login', {
  method: 'POST',
  body: { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD, rememberMe: false },
});
const admin = adminLogin.data.accessToken;
assert.ok(adminLogin.data.user.roles.includes('ADMIN'));
assert.match(adminLogin.headers.get('set-cookie'), /Secure/);
assert.doesNotMatch(adminLogin.headers.get('set-cookie'), /Max-Age/);
const marker = randomUUID();
const email = `production-${marker}@integration.test`;
const password = 'ProdLearnerTest123!';
await api('/auth/register', {
  method: 'POST',
  status: 201,
  body: { email, password, fullName: 'Production Learner' },
});
const login = await api('/auth/login', { method: 'POST', body: { email, password, rememberMe: true } });
const learner = login.data.accessToken;
assert.match(login.headers.get('set-cookie'), /Max-Age=604800/);
assert.match(login.headers.get('set-cookie'), /HttpOnly/);
let cookie = login.headers.get('set-cookie').split(';')[0];
const refreshed = await api('/auth/refresh', { method: 'POST', body: {}, cookie });
assert.match(refreshed.headers.get('set-cookie'), /Max-Age=604800/);
cookie = refreshed.headers.get('set-cookie').split(';')[0];
await api('/users/me', {
  method: 'PUT',
  token: learner,
  body: {
    fullName: 'Production Learner',
    phone: '+84 912345678',
    dateOfBirth: '2000-01-02',
    biography: 'Production fixture',
    avatarUrl: '',
  },
});
assert.equal((await api('/users/me', { token: learner })).data.biography, 'Production fixture');
await api('/users/me', {
  method: 'PUT',
  token: learner,
  status: 400,
  body: { fullName: 'Invalid', avatarUrl: 'javascript:alert(1)' },
});
await api('/admin/categories', { token: learner, status: 403 });
report.checks.push(
  'Explicit admin bootstrap, learner RBAC, persistent HttpOnly/Secure refresh rotation, profile persistence and server validation.',
);

const category = (
  await api('/admin/categories', {
    method: 'POST',
    token: admin,
    body: { name: 'Production ' + marker, description: 'Disposable fixture' },
  })
).data;
const courses = [];
for (const price of [0, 100, 200]) {
  courses.push(
    (
      await api('/admin/courses', {
        method: 'POST',
        token: admin,
        body: {
          title: marker + '-' + price,
          description: 'Production fixture',
          categoryId: category.id,
          price,
          level: 'BEGINNER',
          status: 'PUBLISHED',
        },
      })
    ).data,
  );
}
const [free, paid] = courses;
const results = (
  await api(`/courses?keyword=${marker}&pricing=paid&minPrice=100&maxPrice=200&size=1&page=1&sort=price_asc`)
).data;
assert.equal(results.totalElements, 2);
assert.equal(results.totalPages, 2);
assert.equal(Number(results.content[0].price), 200);
const section = (
  await api(`/admin/courses/${free.id}/sections`, {
    method: 'POST',
    token: admin,
    body: { title: 'Preserved section', orderIndex: 0 },
  })
).data;
const lesson = (
  await api(`/admin/sections/${section.id}/lessons`, {
    method: 'POST',
    token: admin,
    body: {
      title: 'Preserved lesson',
      content: 'Private archived course content',
      lessonType: 'TEXT',
      orderIndex: 0,
      duration: 60,
      preview: false,
    },
  })
).data;
await api('/learning/enrollments', { method: 'POST', token: learner, body: { courseId: free.id } });
await api(`/admin/courses/${free.id}`, { method: 'DELETE', token: admin });
await api(`/courses/${free.id}`, { status: 404 });
assert.equal(
  (await api(`/learning/courses/${free.id}`, { token: learner })).data.sections[0].lessons[0].content,
  'Private archived course content',
);
await api(`/learning/progress/courses/${free.id}/lessons/${lesson.id}/complete`, {
  method: 'PATCH',
  token: learner,
});
await api(`/admin/categories/${category.id}`, { method: 'DELETE', token: admin });
assert.ok(!(await api('/categories')).data.some(item => item.id === category.id));
assert.ok(
  (await api('/admin/categories', { token: admin })).data.some(
    item => item.id === category.id && item.active === false,
  ),
);
await api(`/admin/categories/${category.id}`, {
  method: 'PUT',
  token: admin,
  body: { name: category.name, description: category.description, active: true },
});
assert.ok((await api('/categories')).data.some(item => item.id === category.id));
await api('/payments/checkout', {
  method: 'POST',
  token: learner,
  status: 403,
  body: { courseId: paid.id, provider: 'MOCK', idempotencyKey: randomUUID() },
});
report.checks.push(
  'Database search pagination/price filters, soft category hide/reactivate, archive preserves enrollment/content/progress, production MOCK rejected.',
);

await api('/auth/logout', { method: 'POST', body: {}, cookie });
await api('/auth/refresh', { method: 'POST', body: {}, cookie, status: 401 });
const bursts = await Promise.all(
  Array.from({ length: 25 }, (_, index) =>
    fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Real-IP': `203.0.113.${index + 1}` },
      body: '{}',
    }),
  ),
);
const limited = bursts.find(response => response.status === 429);
assert.ok(limited, 'Auth burst must be limited even when an untrusted caller forges X-Real-IP');
assert.equal(limited.headers.get('retry-after'), '60');
assert.equal((await limited.json()).code, 'RATE_LIMITED');
report.checks.push(
  'Logout revocation; authentication burst returns 429/Retry-After and ignores untrusted client-IP headers.',
);
Object.assign(report, {
  learnerEmail: email,
  courseId: free.id,
  lessonId: lesson.id,
  categoryId: category.id,
});
await mkdir('.tmp', { recursive: true });
await writeFile('.tmp/production-smoke.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  'PASS: production overlay smoke; details in .tmp/production-smoke.json. No external payments, mail, S3 or AI were invoked.',
);
