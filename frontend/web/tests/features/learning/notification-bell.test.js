import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'notification-bell' });
const { default: Bell } = await env.load('features/learning/components/NotificationBell.jsx');
const { NotificationsContext } = await env.load('features/learning/context/NotificationsContext.jsx');

afterEach(env.unmount);
after(env.close);

function Location() {
  return h('output', null, useLocation().pathname);
}

test('bell dismisses on Escape and outside clicks, retries mark-read and closes when following a notification', async t => {
  const refresh = t.mock.fn();
  let attempts = 0;
  const markRead = t.mock.fn(async () => {
    if (++attempts === 1) throw new Error('Could not mark as read');
  });
  const value = {
    userId: 42,
    refresh,
    markRead,
    summary: {
      unreadCount: 101,
      notifications: [
        {
          id: 5,
          title: 'Study reminder',
          body: 'Read chapter one',
          actionUrl: '/courses/7',
          read: false,
          type: 'COURSE',
        },
      ],
    },
  };
  await env.render(h(MemoryRouter, null, h(NotificationsContext.Provider, { value }, h(Bell), h(Location))));
  const button = '.notification-button';
  const panel = () => document.querySelector('.notification-panel');
  assert.equal(document.querySelector('.notification-badge').textContent, '99+');
  await env.click(button);
  await act(async () =>
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  assert.equal(panel(), null);
  await env.click(button);
  await act(async () => document.body.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true })));
  assert.equal(panel(), null);
  await env.click(button);
  await env.click(env.button('Đánh dấu đã đọc'));
  assert.match(panel().textContent, /Could not mark as read/);
  await env.click('.notification-item a');
  assert.deepEqual(
    markRead.mock.calls.map(call => call.arguments),
    [[5], [5]],
  );
  assert.equal(document.querySelector('output').textContent, '/courses/7');
  assert.equal(panel(), null);
  await env.click(button);
  await env.click('a[href="/notifications"]');
  assert.equal(panel(), null);
  assert.equal(refresh.mock.callCount(), 4);
});
