import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Creates disposable accounts, courses and MOCK payments. Run against a test stack only.
const base = process.env.SMOKE_BASE_URL || 'http://localhost:18080';
const allowedOrigin = process.env.SMOKE_ORIGIN || 'http://localhost:5173';
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
  const safePath = path.split('?')[0];
  assert.equal(response.status, status, `${method} ${safePath}: unexpected HTTP status`);
  assert.ok(response.headers.get('x-request-id'), `${safePath}: missing request correlation`);
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
    Origin: allowedOrigin, 'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);
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
const draft = (await request('/api/v1/admin/courses', { method: 'POST', token: admin, body: {
  title: `Draft ${suffix}`, description: 'Draft must not be public', categoryId: categories[0].id,
  price: 0, level: 'BEGINNER', status: 'DRAFT',
} })).data;
await request(`/api/v1/courses/${draft.id}`, { status: 404 });
await request(`/api/v1/courses/${draft.id}/sections`, { status: 404 });
await request(`/api/v1/courses/${draft.id}/reviews`, { status: 404 });
const section = (await request(`/api/v1/admin/courses/${free.id}/sections`, {
  method: 'POST', token: admin, body: { title: 'Integration chapter', orderIndex: 0 },
})).data;
const lesson = (await request(`/api/v1/admin/sections/${section.id}/lessons`, {
  method: 'POST', token: admin, body: { title: 'Real private lesson', lessonType: 'TEXT',
    content: `Private-${suffix}`, duration: 60, orderIndex: 0, preview: false },
})).data;
const preview = (await request(`/api/v1/admin/sections/${section.id}/lessons`, {
  method: 'POST', token: admin, body: { title: 'Public preview', lessonType: 'TEXT',
    content: 'Allowed preview', duration: 60, orderIndex: 1, preview: true },
})).data;
const publicSections = (await request(`/api/v1/courses/${free.id}/sections`)).data;
assert.equal(publicSections[0].lessons.find(item => item.id === lesson.id).content, null);
assert.equal(publicSections[0].lessons.find(item => item.id === lesson.id).videoUrl, null);
assert.equal(publicSections[0].lessons.find(item => item.id === preview.id).content, 'Allowed preview');
await request(`/api/v1/lessons/${lesson.id}/resources`, { token: userToken, status: 403 });
await request(`/api/v1/courses/${free.id}/reviews`, { method: 'POST', token: userToken,
  body: { rating: 5, comment: 'Must require enrollment' }, status: 403 });
await request(`/api/v1/learning/progress/courses/${free.id}`, { token: userToken, status: 403 });
await request('/api/v1/learning/enrollments', { method: 'POST', token: userToken, body: { courseId: paid.id }, status: 403 });
const firstEnrollment = (await request('/api/v1/learning/enrollments', { method: 'POST', token: userToken,
  body: { courseId: free.id, userId: 999999, role: 'ADMIN' } })).data;
const repeatedEnrollment = (await request('/api/v1/learning/enrollments', { method: 'POST', token: userToken,
  body: { courseId: free.id } })).data;
assert.equal(firstEnrollment.id, repeatedEnrollment.id);
const ownedEnrollments = (await request('/api/v1/learning/enrollments/me', { token: userToken })).data;
assert.ok(ownedEnrollments.some(item => item.id === firstEnrollment.id));
const privateSections = (await request(`/api/v1/courses/${free.id}/sections`, { token: userToken })).data;
assert.equal(privateSections[0].lessons.find(item => item.id === lesson.id).content, `Private-${suffix}`);
await request(`/api/v1/learning/progress/courses/${free.id}/lessons/${lesson.id}/access`, {
  method: 'POST', token: userToken,
});
const completed = (await request(`/api/v1/learning/progress/courses/${free.id}/lessons/${lesson.id}/complete`, {
  method: 'PATCH', token: userToken,
})).data;
assert.equal(completed.courseId, free.id);
assert.equal(completed.status, 'COMPLETED');
const savedProgress = (await request(`/api/v1/learning/progress/courses/${free.id}`, { token: userToken })).data;
assert.ok(savedProgress.some(item => item.lessonId === lesson.id && item.status === 'COMPLETED'));

// Real local storage: the raw URL cannot bypass enrollment, but authorized URLs work in media tags.
const mediaContent = `Integration-media-${suffix}`;
const uploadForm = new FormData();
uploadForm.set('folder', 'documents');
uploadForm.set('file', new Blob([mediaContent], { type: 'text/plain' }), 'integration.txt');
const upload = await fetch(`${base}/api/v1/admin/media/upload`, {
  method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: uploadForm,
  signal: AbortSignal.timeout(15000),
});
assert.equal(upload.status, 200);
const media = (await upload.json()).data;
await request(`/api/v1/admin/lessons/${lesson.id}/resources`, { method: 'POST', token: admin,
  body: { resourceType: 'DOCUMENT', title: 'Private document', fileName: media.fileName,
    fileSize: media.fileSize, contentType: media.contentType, objectKey: media.objectKey },
});
await request(`/api/v1/media/download/${media.objectKey}`, { status: 403 });
const resources = (await request(`/api/v1/lessons/${lesson.id}/resources`, { token: userToken })).data;
const signed = resources[0].downloadUrl;
const downloaded = await fetch(`${base}${signed}`, { signal: AbortSignal.timeout(15000) });
assert.equal(downloaded.status, 200);
assert.equal(await downloaded.text(), mediaContent);
const tampered = new URL(signed, base);
tampered.searchParams.set('signature', 'tampered');
await request(tampered.pathname + tampered.search, { status: 403 });

const outsiderEmail = `outsider-${suffix}@example.test`;
await request('/api/v1/auth/register', { method: 'POST', status: 201,
  body: { email: outsiderEmail, password, fullName: 'Other Learner' } });
const outsiderLogin = await request('/api/v1/auth/login', { method: 'POST', body: { email: outsiderEmail, password } });
const outsider = outsiderLogin.data.accessToken;
const otherEnrollments = (await request('/api/v1/learning/enrollments/me', { token: outsider })).data;
assert.ok(!otherEnrollments.some(item => item.id === firstEnrollment.id));
await request(`/api/v1/lessons/${lesson.id}/resources`, { token: outsider, status: 403,
  headers: { 'X-User-Id': String(userId), 'X-User-Role': 'ADMIN' } });
await request(`/api/v1/learning/progress/courses/${free.id}`, { token: outsider, status: 403 });
await request('/internal/v1/learning/enrollments', { method: 'POST', token: userToken,
  body: { orderCode: 'forged', userId, courseId: paid.id }, status: 404 });
await request('/api/v1/payments/checkout', { method: 'POST', token: userToken, status: 503,
  body: { courseId: paid.id, provider: 'VNPAY', idempotencyKey: randomUUID() } });
const checkoutBody = { courseId: paid.id, provider: 'MOCK', idempotencyKey: randomUUID(),
  amount: 1, status: 'SUCCESS', userId: 999999 };
const checkout = (await request('/api/v1/payments/checkout', { method: 'POST', token: userToken, body: checkoutBody })).data;
const replay = (await request('/api/v1/payments/checkout', { method: 'POST', token: userToken, body: checkoutBody })).data;
assert.equal(replay.orderCode, checkout.orderCode);
assert.equal(checkout.payment.amount, 100000);
await request(`/api/v1/payments/orders/${checkout.orderCode}`, { token: outsider, status: 403 });
await request(`/api/v1/payments/mock/orders/${checkout.orderCode}/complete`, { method: 'POST', token: outsider,
  body: { status: 'SUCCESS' }, status: 403 });
await request(`/api/v1/payments/mock/orders/${checkout.orderCode}/complete`, { method: 'POST', token: userToken,
  body: { status: 'SUCCESS', providerTransactionCode: randomUUID() } });
const notificationsBefore = (await request('/api/v1/learning/notifications', { token: userToken })).data;
await request(`/api/v1/payments/mock/orders/${checkout.orderCode}/complete`, { method: 'POST', token: userToken,
  body: { status: 'SUCCESS', providerTransactionCode: randomUUID() } });
const notificationsAfter = (await request('/api/v1/learning/notifications', { token: userToken })).data;
assert.equal(notificationsAfter.length, notificationsBefore.length);
const enrollments = (await request('/api/v1/learning/enrollments/me', { token: userToken })).data;
assert.ok(enrollments.some(item => item.courseId === free.id));
assert.ok(enrollments.some(item => item.courseId === paid.id));
assert.equal(enrollments.filter(item => item.courseId === paid.id).length, 1);
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
await request('/api/v1/auth/logout', { method: 'POST', body: {}, cookie: cookieFrom(outsiderLogin.headers) });
console.log('PASS: CORS/JWT/RBAC, Published/preview/private content, signed local media, ownership, free enrollment/progress, MOCK payment -> Learning, replay without duplicate notification/enrollment, refresh/logout. VNPay E2E is not implemented.');
