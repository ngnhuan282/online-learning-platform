import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-notifications' });
const { default: Notifications } = await env.load('features/learning/pages/AdminNotificationsPage.jsx');
const { learningApi } = await env.load('features/learning/api/learningApi.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');

afterEach(env.unmount);
after(env.close);

const render = () =>
  env.render(
    h(
      AuthContext.Provider,
      { value: { user: { id: 1, roles: ['ADMIN'], permissions: ['NOTIFICATION_MANAGE'] } } },
      h(Notifications),
    ),
  );
const notice = {
  id: 2,
  userId: 42,
  title: 'Course reminder',
  body: 'Meet the instructor',
  category: 'SYSTEM',
  read: false,
  createdAt: '2026-10-15T00:00:00Z',
};

test('history retries a failed query, validates recipient filters and displays the selected notification', async t => {
  let requests = 0;
  const read = t.mock.method(learningApi, 'getAdminNotifications', async () => {
    if (++requests === 1) throw new Error('History unavailable');
    return { data: { content: [notice], totalPages: 1, totalElements: 1 } };
  });
  await render();
  assert.match(document.body.textContent, /History unavailable/);
  await env.click(env.button('Thử lại'));
  const filter = '.notification-filters';
  const recipient = `${filter} input[inputmode="numeric"]`;
  await env.setInputValue(recipient, '-2');
  assert.match(document.body.textContent, /số nguyên dương/);
  assert.equal(read.mock.callCount(), 2);
  await env.setInputValue(recipient, '42');
  await env.setInputValue(`${filter} select`, 'SYSTEM');
  await env.click(`${filter} input[type="checkbox"]`);
  assert.deepEqual(read.mock.calls.at(-1).arguments[0], {
    page: 0,
    size: 20,
    userId: 42,
    category: 'SYSTEM',
    unreadOnly: true,
  });
  await env.click('button[aria-label="Xem chi tiết"]');
  assert.match(document.querySelector('[role="dialog"]').textContent, /Meet the instructor/);
  await env.click(env.button('Đóng', document.querySelector('[role="dialog"]')));
});

test('compose rejects invalid recipients and preserves the event identity after a failed delivery', async t => {
  t.mock.method(learningApi, 'getAdminNotifications', async () => ({ data: { content: [], totalPages: 1 } }));
  let attempts = 0;
  const send = t.mock.method(learningApi, 'sendSystemNotification', async () => {
    if (++attempts === 1) throw new Error('Delivery unavailable');
  });
  await render();
  const form = document.querySelector('.notification-compose');
  await env.setInputValue(form.querySelector('input'), '-2');
  await env.setInputValue(form.querySelectorAll('input')[1], ' Course reminder ');
  await env.setInputValue(form.querySelector('textarea'), ' Meet the instructor ');
  await env.click(form.querySelector('button[type="submit"]'));
  assert.match(form.textContent, /Nhập ID người nhận hợp lệ/);
  assert.equal(send.mock.callCount(), 0);
  await env.setInputValue(form.querySelector('input'), '42');
  await env.click(form.querySelector('button[type="submit"]'));
  assert.match(form.textContent, /Delivery unavailable/);
  await env.click(form.querySelector('button[type="submit"]'));
  const [first, retry] = send.mock.calls.map(call => call.arguments[0]);
  assert.deepEqual(retry, first);
  assert.equal(retry.userId, 42);
  assert.equal(retry.title, 'Course reminder');
  assert.equal(retry.body, 'Meet the instructor');
  assert.equal(form.querySelector('textarea').value, '');
});
