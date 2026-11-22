import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'notifications-page' });
const { default: Notifications } = await env.load('features/learning/pages/NotificationsPage.jsx');
const { NotificationsContext } = await env.load('features/learning/context/NotificationsContext.jsx');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

test('notification feed returns to a valid page when data shrinks and retries a failed mark-all action', async t => {
  let shrink = false;
  const loads = t.mock.method(learningApi, 'getNotificationFeed', async ({ page }) => ({
    data: {
      content:
        page === 0
          ? []
          : [
              {
                id: 2,
                title: 'Reminder',
                body: 'Read the new chapter',
                category: 'SYSTEM',
                read: false,
              },
            ],
      totalPages: shrink ? 1 : 2,
      totalElements: shrink ? 0 : 22,
      last: shrink || page === 1,
    },
  }));
  const refresh = t.mock.fn();
  let attempts = 0;
  const markAllRead = t.mock.fn(async () => {
    if (++attempts === 1) throw new Error('Could not mark notifications');
  });
  const value = { userId: 7, summary: { unreadCount: 5 }, markAllRead, refresh };
  await env.render(h(MemoryRouter, null, h(NotificationsContext.Provider, { value }, h(Notifications))));
  await env.click(env.button('Trang sau'));
  assert.match(document.body.textContent, /Reminder/);
  await env.click(env.button('Trang trước'));
  assert.equal(loads.mock.calls.at(-1).arguments[0].page, 0);
  await env.click(env.button('Trang sau'));
  shrink = true;
  await env.click(env.button('Tải lại'));
  assert.equal(refresh.mock.callCount(), 1);
  assert.equal(loads.mock.calls.at(-1).arguments[0].page, 0);
  await env.click(env.button('Đánh dấu tất cả đã đọc'));
  assert.match(document.body.textContent, /Could not mark notifications/);
  await env.click(env.button('Thử lại'));
  assert.equal(markAllRead.mock.callCount(), 2);
  assert.doesNotMatch(document.body.textContent, /Could not mark notifications/);
});
