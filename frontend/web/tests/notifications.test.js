import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, StrictMode, useContext } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import {
  consumeNotificationStream,
  notificationActionUrl,
  notificationCategory,
} from '../src/features/learning/utils/notificationStream.js';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { learningApi } = await load('features/learning/api/learningApi.js');
const tokens = await load('shared/utils/tokenUtils.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { NotificationsProvider, NotificationsContext } = await load(
  'features/learning/context/NotificationsContext.jsx',
);
const { default: NotificationBell } = await load('features/learning/components/NotificationBell.jsx');
const { default: NotificationsPage } = await load('features/learning/pages/NotificationsPage.jsx');
const { default: AdminNotificationsPage } = await load('features/learning/pages/AdminNotificationsPage.jsx');
const originals = { ...learningApi };
const cache = createCache({ key: 'notifications-test' });
let root;
let snapshot;

const notification = (id = 1, read = false) => ({
  id,
  type: 'SYSTEM',
  category: 'SYSTEM',
  title: 'Thông báo thật ' + id,
  body: 'Nội dung hệ thống',
  actionUrl: '/notifications',
  read,
  readAt: read ? '2026-10-21T05:00:00Z' : null,
  createdAt: '2026-10-21T04:00:00Z',
});
const summary = () => ({ unreadCount: 1, notifications: [notification()] });
const pageData = items => ({
  content: items,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  last: true,
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settle(ms = 130) {
  await act(async () => delay(ms));
}

function Probe() {
  snapshot = useContext(NotificationsContext);
  return null;
}

async function renderProvider(auth = { user: { id: 1 } }, strict = false) {
  root ??= createRoot(document.getElementById('root'));
  let content = h(NotificationsProvider, null, h(Probe), h(NotificationBell));
  if (strict) content = h(StrictMode, null, content);
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(AuthContext.Provider, { value: auth }, h(MemoryRouter, null, content)),
      ),
    ),
  );
}

async function renderPage(Page, context, auth = { user: { id: 1, roles: ['ADMIN'] } }) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: auth },
          h(NotificationsContext.Provider, { value: context }, h(MemoryRouter, null, h(Page))),
        ),
      ),
    ),
  );
}

function openStream() {
  let source;
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      source = controller;
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    stream,
    get cancelled() {
      return cancelled;
    },
    emit(event) {
      if (!cancelled) source.enqueue(new TextEncoder().encode('event: ' + event + '\ndata: {}\n\n'));
    },
  };
}

function button(text) {
  const found = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(found, 'Missing button: ' + text);
  return found;
}

async function input(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(
    element.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype,
    'value',
  );
  await act(async () => {
    descriptor.set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  snapshot = null;
  tokens.clearTokens();
  Object.assign(learningApi, originals);
});
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Event;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('SSE parser handles split UTF-8, CRLF, heartbeat and multiple data lines', async () => {
  const bytes = new TextEncoder().encode(
    ':heartbeat\r\n\r\nevent: notifications-changed\r\ndata: tiếng Việt\r\ndata: dòng hai\r\n\r\nevent: connected\ndata: {}\n\n',
  );
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  const events = [];
  await consumeNotificationStream(stream, event => events.push(event));
  assert.deepEqual(events, [
    { event: 'notifications-changed', data: 'tiếng Việt\ndòng hai' },
    { event: 'connected', data: '{}' },
  ]);
  assert.equal(stream.locked, false);
});

test('SSE parser cancels pending readers on abort and rejects oversized frames', async () => {
  const live = openStream();
  const controller = new AbortController();
  const consuming = consumeNotificationStream(
    live.stream,
    () => assert.fail('No event expected'),
    controller.signal,
  );
  controller.abort();
  await consuming;
  assert.equal(live.cancelled, true);
  assert.equal(live.stream.locked, false);
  const oversized = new ReadableStream({
    start(source) {
      source.enqueue(new TextEncoder().encode('data: ' + 'x'.repeat(65537) + '\n\n'));
    },
  });
  await assert.rejects(
    consumeNotificationStream(oversized, () => {}),
    /kích thước/,
  );
  assert.equal(oversized.locked, false);
});

test('legacy categories remain visible and unsafe action URLs cannot navigate outside the app', () => {
  assert.equal(notificationCategory({ type: 'ENROLLMENT' }), 'COURSE');
  assert.equal(notificationCategory({ type: 'QUIZ' }), 'LEARNING');
  assert.equal(notificationCategory({ type: 'PAYMENT_REFUNDED' }), 'PAYMENT');
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/\nevil',
    'javascript:alert(1)',
  ]) {
    assert.equal(notificationActionUrl(value), null);
  }
  assert.equal(notificationActionUrl('/quizzes/attempts/42/result'), '/quizzes/attempts/42/result');
});

test('provider coalesces realtime bursts and StrictMode leaves one stream with logout cleanup', async () => {
  const streams = [];
  let loads = 0;
  learningApi.openNotificationStream = async () => {
    const live = openStream();
    streams.push(live);
    return live.stream;
  };
  learningApi.getNotificationSummary = async () => {
    loads++;
    return { data: summary() };
  };
  await renderProvider({ user: { id: 1 } }, true);
  assert.equal(streams.filter(stream => !stream.cancelled).length, 1);
  const live = streams.at(-1);
  await act(async () => {
    live.emit('connected');
    live.emit('notifications-changed');
    live.emit('notifications-changed');
  });
  await settle();
  assert.equal(loads, 1);
  assert.equal(snapshot.summary.unreadCount, 1);
  assert.equal(document.querySelector('.notification-badge').textContent, '1');
  await renderProvider({ user: { id: 1 }, isLoggingOut: true }, true);
  assert.equal(streams.filter(stream => !stream.cancelled).length, 0);
  assert.equal(snapshot.userId, null);
  assert.equal(snapshot.summary.notifications.length, 0);
  assert.equal(document.querySelector('.notification-wrap'), null);
});

test('same-user login replaces the stale stream while token refresh keeps its active session', async () => {
  const token = id =>
    `h.${Buffer.from(
      JSON.stringify({
        sub: '1',
        jti: id,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString('base64url')}.s`;
  const streams = [];
  let unreadCount = 1;
  learningApi.openNotificationStream = async () => {
    const live = openStream();
    streams.push(live);
    return live.stream;
  };
  learningApi.getNotificationSummary = async () => ({ data: { ...summary(), unreadCount } });
  tokens.setAccessToken(token('first-login'));
  await renderProvider();
  await settle();
  assert.equal(snapshot.summary.unreadCount, 1);
  assert.equal(streams.length, 1);

  unreadCount = 2;
  await act(async () => tokens.setAccessToken(token('same-user-new-login')));
  await settle();
  assert.equal(streams[0].cancelled, true);
  assert.equal(streams.filter(stream => !stream.cancelled).length, 1);
  assert.equal(streams.length, 2);
  assert.equal(snapshot.summary.unreadCount, 2);

  await act(async () => tokens.setAccessToken(token('refreshed'), { preserveSession: true }));
  assert.equal(streams.length, 2);
  unreadCount = 3;
  await act(async () => streams[1].emit('notifications-changed'));
  await settle();
  assert.equal(snapshot.summary.unreadCount, 3);
  assert.equal(document.querySelector('.notification-badge').textContent, '3');
});

test('mark read updates badge immediately and older summary requests cannot restore unread state', async () => {
  let loads = 0;
  let finishOld;
  const live = openStream();
  learningApi.openNotificationStream = async () => live.stream;
  learningApi.getNotificationSummary = async () => {
    if (++loads === 1) return { data: summary() };
    return new Promise(resolve => {
      finishOld = resolve;
    });
  };
  learningApi.markNotificationRead = async () => ({ data: notification(1, true) });
  await renderProvider();
  await settle();
  await act(async () => snapshot.refresh());
  await settle();
  const finish = finishOld;
  await act(async () => snapshot.markRead(1));
  assert.equal(snapshot.summary.unreadCount, 0);
  assert.equal(snapshot.summary.notifications[0].read, true);
  assert.equal(document.querySelector('.notification-badge'), null);
  await act(async () => finish({ data: summary() }));
  assert.equal(snapshot.summary.unreadCount, 0);
  assert.equal(snapshot.summary.notifications[0].read, true);
});

test('account change ignores late read and summary responses from the earlier account', async () => {
  const streams = [];
  let finishRead;
  learningApi.openNotificationStream = async () => {
    const live = openStream();
    streams.push(live);
    return live.stream;
  };
  learningApi.getNotificationSummary = async () => ({ data: summary() });
  learningApi.markNotificationRead = () =>
    new Promise(resolve => {
      finishRead = resolve;
    });
  await renderProvider();
  await settle();
  let pendingRead;
  await act(async () => {
    pendingRead = snapshot.markRead(1);
  });
  await renderProvider({ user: { id: 2 } });
  await act(async () => finishRead({ data: notification(1, true) }));
  await pendingRead;
  assert.equal(snapshot.userId, 2);
  assert.equal(snapshot.summary.notifications.length, 0);
  assert.equal(streams[0].cancelled, true);
});

test('user notification filters reach the API and changing account clears earlier feed errors', async () => {
  const queries = [];
  learningApi.getNotificationFeed = async params => {
    queries.push(params);
    return { data: pageData([notification()]) };
  };
  const context = {
    userId: 1,
    revision: 0,
    summary: summary(),
    markAllRead: async () => {},
    refresh: () => {},
    markRead: async () => {},
  };
  await renderPage(NotificationsPage, context);
  const select = document.querySelector('select');
  await act(async () => {
    select.value = 'PAYMENT';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(queries.at(-1).category, 'PAYMENT');
  await act(async () => document.querySelector('input[type=checkbox]').click());
  assert.equal(queries.at(-1).unreadOnly, true);
  learningApi.getNotificationFeed = async () => {
    throw new Error('Lỗi tài khoản cũ');
  };
  await renderPage(NotificationsPage, { ...context, revision: 1 });
  assert.match(document.body.textContent, /Lỗi tài khoản cũ/);
  learningApi.getNotificationFeed = async () => ({ data: pageData([]) });
  await renderPage(NotificationsPage, { ...context, userId: 2 });
  assert.doesNotMatch(document.body.textContent, /Lỗi tài khoản cũ|Thông báo thật/);
  assert.match(document.body.textContent, /Chưa có thông báo/);
});

test('admin retries an uncertain send using the same identity and never edits business notifications', async () => {
  const sends = [];
  learningApi.getAdminNotifications = async () => ({ data: pageData([]) });
  learningApi.sendSystemNotification = async payload => {
    sends.push({ ...payload });
    if (sends.length === 1) throw new Error('Mất kết nối');
    return { data: notification() };
  };
  await renderPage(AdminNotificationsPage, null);
  const form = document.querySelector('.notification-compose');
  const inputs = form.querySelectorAll('input');
  await input(inputs[0], '42');
  await input(inputs[1], 'Lịch bảo trì');
  await input(form.querySelector('textarea'), 'Lưu bài làm trước giờ bảo trì.');
  await act(async () =>
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.match(document.body.textContent, /Mất kết nối/);
  await act(async () => button('Gửi thông báo').click());
  assert.equal(sends.length, 2);
  assert.equal(sends[0].eventId, sends[1].eventId);
  assert.equal(sends[1].userId, 42);
  assert.equal(sends[1].type, undefined);
  assert.match(document.body.textContent, /Đã gửi thông báo hệ thống/);
  assert.equal(
    [...document.querySelectorAll('button')].some(item => /Xóa|Sửa/.test(item.textContent)),
    false,
  );
});
