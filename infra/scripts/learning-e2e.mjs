import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { consumeNotificationStream } from '../../frontend/web/src/features/learning/utils/notificationStream.js';

// This scenario creates disposable Course/Learning/Payment fixtures in an isolated test stack.
assert.ok(
  process.argv.includes('--test-stack'),
  'Run only against a disposable test stack with --test-stack.',
);
const base = process.env.LEARNING_E2E_BASE_URL || 'http://localhost:18080';
const demo = process.argv.includes('--demo');
const email = process.env.LEARNING_E2E_ADMIN_EMAIL || (demo ? 'demo.admin@example.com' : null);
const password = process.env.LEARNING_E2E_ADMIN_PASSWORD || (demo ? 'Admin123' : null);
assert.ok(email && password, 'Set LEARNING_E2E_ADMIN_EMAIL/PASSWORD or seed the test stack and use --demo.');
const marker = randomUUID();
const report = { checkedAt: new Date().toISOString(), checks: [], courses: [], orders: [] };

async function api(path, { method = 'GET', token, body, status = 200 } = {}) {
  const response = await fetch(base + '/api/v1' + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, method + ' ' + path + ': unexpected status');
  const envelope = await response.json();
  assert.equal(envelope.success, status < 400, path + ': invalid response envelope');
  return envelope.data;
}

const admin = (await api('/auth/login', { method: 'POST', body: { email, password } })).accessToken;
async function learner(name) {
  const account = {
    email: 'learning-' + name + '-' + marker + '@example.test',
    fullName: 'Learning E2E ' + name,
    password: 'Test9!' + randomUUID(),
  };
  await api('/auth/register', { method: 'POST', body: account, status: 201 });
  return (await api('/auth/login', { method: 'POST', body: account })).accessToken;
}
const user = await learner('owner');
const stranger = await learner('stranger');
const categories = await api('/categories');
assert.ok(categories.length, 'Seed categories before running this scenario.');

async function fixture(price) {
  const course = await api('/admin/courses', {
    method: 'POST',
    token: admin,
    body: {
      title: 'Learning W8 W9 ' + price + ' ' + marker,
      description: 'Disposable learning integration fixture',
      categoryId: categories[0].id,
      price,
      level: 'BEGINNER',
      status: 'PUBLISHED',
    },
  });
  const section = await api('/admin/courses/' + course.id + '/sections', {
    method: 'POST',
    token: admin,
    body: { title: 'Learning E2E curriculum', orderIndex: 0 },
  });
  const lessons = [];
  for (let index = 0; index < 2; index++) {
    lessons.push(
      await api('/admin/sections/' + section.id + '/lessons', {
        method: 'POST',
        token: admin,
        body: {
          title: 'Bài học ' + (index + 1),
          lessonType: 'TEXT',
          content: 'Nội dung kiểm thử',
          orderIndex: index,
          preview: false,
        },
      }),
    );
  }
  report.courses.push(course.id);
  return { course, lessons };
}

const free = await fixture(0);
const paid = await fixture(100000);
const freeId = free.course.id;
await api('/learning/courses/' + freeId, { token: stranger, status: 403 });
const enrollments = await Promise.all(
  Array.from({ length: 4 }, () =>
    api('/learning/enrollments', {
      method: 'POST',
      token: user,
      body: { courseId: freeId },
    }),
  ),
);
assert.equal(new Set(enrollments.map(item => item.id)).size, 1);
const firstLesson = free.lessons[0].id;
await api('/learning/progress/courses/' + freeId + '/lessons/' + firstLesson + '/access', {
  method: 'POST',
  token: user,
});
await api('/learning/progress/courses/' + freeId + '/lessons/' + paid.lessons[0].id + '/complete', {
  method: 'PATCH',
  token: user,
  status: 404,
});
for (const lesson of free.lessons) {
  const path = '/learning/progress/courses/' + freeId + '/lessons/' + lesson.id + '/complete';
  const responses = await Promise.all([
    api(path, { method: 'PATCH', token: user }),
    api(path, { method: 'PATCH', token: user }),
  ]);
  assert.equal(responses[0].completedAt, responses[1].completedAt);
}
const learned = await api('/learning/courses/' + freeId, { token: user });
assert.equal(learned.totalLessons, 2);
assert.equal(learned.progressPercent, 100);
const my = await api('/learning/enrollments/me', { token: user });
assert.equal(my.find(item => item.courseId === freeId).status, 'COMPLETED');
report.checks.push(
  'Actual Course curriculum, enrollment ownership, concurrent free retry, lesson membership, complete 100%.',
);

const quiz = await api('/learning/admin/quizzes', {
  method: 'POST',
  token: admin,
  status: 201,
  body: {
    courseId: freeId,
    title: 'Learning E2E quiz ' + marker,
    passingScore: 70,
    questions: [
      {
        questionText: 'Chọn đáp án đúng',
        questionType: 'SINGLE_CHOICE',
        points: 1,
        options: [
          { optionText: 'Đúng', correct: true },
          { optionText: 'Sai', correct: false },
        ],
      },
    ],
  },
});
await api('/learning/admin/quizzes/' + quiz.id + '/publish', { method: 'PATCH', token: admin });
await api('/learning/quizzes/' + quiz.id, { token: stranger, status: 403 });
const published = await api('/learning/quizzes/' + quiz.id, { token: user });
const attempt = await api('/learning/quizzes/' + quiz.id + '/attempts', { method: 'POST', token: user });
const answers = {
  answers: [{ questionId: published.questions[0].id, optionIds: [published.questions[0].options[0].id] }],
};
const result = await api('/learning/quizzes/attempts/' + attempt.attemptId + '/submit', {
  method: 'POST',
  token: user,
  body: answers,
});
assert.equal(result.score, 100);
assert.equal(result.passed, true);
await api('/learning/quizzes/attempts/' + attempt.attemptId + '/submit', {
  method: 'POST',
  token: user,
  body: answers,
  status: 409,
});
await api('/learning/quizzes/attempts/' + attempt.attemptId + '/review', { token: stranger, status: 404 });
const review = await api('/learning/quizzes/attempts/' + attempt.attemptId + '/review', { token: user });
assert.equal(review.questions[0].correct, true);
const dashboard = await api('/learning/dashboard', { token: user });
assert.equal(dashboard.completedEnrollments, 1);
assert.equal(dashboard.completedLessons, 2);
report.checks.push(
  'Published quiz -> graded attempt -> owned review -> dashboard; duplicate submission rejected.',
);

const controller = new AbortController();
const events = [];
let streamTask;
async function waitEvent(name, from = 0) {
  const deadline = Date.now() + 8000;
  while (!events.slice(from).some(event => event.event === name)) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for SSE ' + name);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}
try {
  const stream = await fetch(base + '/api/v1/learning/notifications/stream', {
    headers: { Authorization: 'Bearer ' + user, Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  streamTask = consumeNotificationStream(stream.body, event => events.push(event), controller.signal);
  // Attach a rejection handler immediately; cancellation during cleanup is expected.
  streamTask.catch(() => {});
  await waitEvent('connected');
  await api('/learning/enrollments', {
    method: 'POST',
    token: user,
    body: { courseId: paid.course.id },
    status: 403,
  });
  const checkout = await api('/payments/checkout', {
    method: 'POST',
    token: user,
    body: { courseId: paid.course.id, provider: 'MOCK', idempotencyKey: randomUUID() },
  });
  report.orders.push(checkout.orderCode);
  const index = events.length;
  const complete = () =>
    api('/payments/mock/orders/' + checkout.orderCode + '/complete', {
      method: 'POST',
      token: user,
      body: { status: 'SUCCESS', providerTransactionCode: 'E2E-' + marker },
    });
  await complete();
  await complete();
  await waitEvent('notifications-changed', index);
  const owned = await api('/learning/enrollments/me', { token: user });
  assert.equal(owned.filter(item => item.courseId === paid.course.id).length, 1);
  await api('/learning/courses/' + paid.course.id, { token: user });
  await api('/learning/courses/' + paid.course.id, { token: stranger, status: 403 });
  const payments = await api('/learning/notifications/feed?category=PAYMENT', { token: user });
  assert.equal(payments.totalElements, 1);
  assert.equal(payments.content[0].type, 'PAYMENT_SUCCESS');
  assert.equal(
    payments.content[0].actionUrl,
    '/payment/result?orderCode=' + encodeURIComponent(checkout.orderCode),
  );
  const courseNotifications = await api('/learning/notifications/feed?category=COURSE', { token: user });
  assert.equal(courseNotifications.totalElements, 2);
  const outsider = await api('/learning/notifications/summary', { token: stranger });
  assert.equal(outsider.unreadCount, 0);
  await api('/learning/notifications/read-all', { method: 'PATCH', token: user });
  assert.equal((await api('/learning/notifications/summary', { token: user })).unreadCount, 0);
  report.checks.push(
    'MOCK SUCCESS -> paid enrollment + one payment notification despite replay; SSE via Gateway; recipient isolation/read-all.',
  );
} finally {
  controller.abort();
  await streamTask?.catch(error => {
    if (error.name !== 'AbortError') throw error;
  });
}
await mkdir('.tmp/learning-e2e', { recursive: true });
await writeFile('.tmp/learning-e2e/results.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  'PASS: Learning weeks 8-9 through Gateway; report .tmp/learning-e2e/results.json (MOCK provider).',
);
