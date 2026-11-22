import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h, useContext } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'notifications-provider' });
const { NotificationsContext, NotificationsProvider } = await env.load(
  'features/learning/context/NotificationsContext.jsx',
);
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

let latest;
function Probe() {
  latest = useContext(NotificationsContext);
  return h('output', null, latest.error ? latest.error.message : latest.summary.unreadCount);
}

const render = () =>
  env.render(
    h(AuthContext.Provider, { value: { user: { id: 42 } } }, h(NotificationsProvider, null, h(Probe))),
  );
const tick = (t, ms) => act(async () => t.mock.timers.tick(ms));

test('a disconnected stream retries, focus refreshes counts and mark-all updates the current account', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let opens = 0;
  const open = t.mock.method(learningApi, 'openNotificationStream', async () => {
    if (++opens === 1) throw new Error('Stream disconnected');
    return new ReadableStream();
  });
  let unreadCount = 3;
  const loads = t.mock.method(learningApi, 'getNotificationSummary', async () => ({
    data: { unreadCount, notifications: [] },
  }));
  t.mock.method(learningApi, 'markAllNotificationsRead', async () => {
    unreadCount = 0;
    return { data: { unreadCount, notifications: [] } };
  });
  await render();
  await tick(t, 100);
  assert.equal(document.querySelector('output').textContent, '3');
  await tick(t, 900);
  assert.equal(open.mock.callCount(), 2);
  unreadCount = 4;
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  await tick(t, 100);
  assert.equal(document.querySelector('output').textContent, '4');
  const priorRevision = latest.revision;
  await act(async () => latest.markAllRead());
  assert.equal(document.querySelector('output').textContent, '0');
  assert.equal(latest.revision, priorRevision + 1);
  await tick(t, 100);
  assert.equal(loads.mock.callCount(), 3);
});

test('unauthorized summary and stream failures are reported without scheduling reconnects', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const unauthorized = Object.assign(new Error('Sign in again'), { status: 401 });
  const open = t.mock.method(learningApi, 'openNotificationStream', async () => {
    throw unauthorized;
  });
  const loads = t.mock.method(learningApi, 'getNotificationSummary', async () => {
    throw unauthorized;
  });
  await render();
  await tick(t, 100);
  assert.equal(document.querySelector('output').textContent, 'Sign in again');
  await tick(t, 30000);
  assert.equal(open.mock.callCount(), 1);
  assert.equal(loads.mock.callCount(), 1);
  assert.equal(latest.loading, false);
});
