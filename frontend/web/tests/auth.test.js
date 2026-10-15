import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, StrictMode, useContext, useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
const cache = createCache({ key: 'test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { AuthContext, AuthProvider } = await load('features/auth/context/AuthContext.jsx');
const { default: ProtectedRoute } = await load('routes/ProtectedRoute.jsx');
const { default: RoleRoute } = await load('routes/RoleRoute.jsx');
const { default: PermissionRoute } = await load('routes/PermissionRoute.jsx');
const { default: CourseDetailPage } = await load('features/courses/pages/CourseDetailPage.jsx');
const { default: AdminRolesPage } = await load('features/admin/pages/AdminRolesPage.jsx');
const { default: GoogleCallbackPage } = await load('features/auth/pages/GoogleCallbackPage.jsx');
const { default: SignInMethods } = await load('features/auth/components/SignInMethods.jsx');
const { startGoogleLogin, startGoogleLink, readGoogleAttempt, loginDestination, googleErrorMessage } =
  await load('features/auth/utils/googleLogin.js');
const { ToastContext } = await load('shared/context/ToastContext.jsx');
const { default: client } = await load('shared/apis/axiosClient.js');
const { authApi } = await load('features/auth/api/authApi.js');
const tokens = await load('shared/utils/tokenUtils.js');
const user = { id: 1, fullName: 'Test User', email: 'test@example.com', roles: ['USER'] };
const makeToken = (claims = {}) =>
  `header.${Buffer.from(JSON.stringify({ sub: '1', role: 'USER', roles: ['USER'], exp: Math.floor(Date.now() / 1000) + 600, ...claims })).toString('base64url')}.signature`;
const reply = (config, data) => ({ config, status: 200, headers: {}, data: { success: true, data } });
const reject = (config, status) =>
  Promise.reject({ config, response: { status, data: { code: 'UNAUTHENTICATED', message: 'Sign in' } } });
let root;
let auth;
beforeEach(() => {
  tokens.allowSessionRestore();
  client.defaults.adapter = config => reject(config, 401);
});
function Probe() {
  auth = useContext(AuthContext);
  return h('span', null, auth.user?.fullName ?? 'guest');
}
async function mount(children = h(Probe), strict = false) {
  root = createRoot(document.getElementById('root'));
  const content = h(CacheProvider, { value: cache }, h(AuthProvider, null, children));
  await act(async () => root.render(strict ? h(StrictMode, null, content) : content));
}
async function flush() {
  await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
}
afterEach(async () => {
  await act(async () => {
    root?.unmount();
    tokens.clearTokens();
  });
  root = null;
  auth = null;
  window.sessionStorage.clear();
});
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
});

test('authApi register sends only backend fields and no bearer token', async () => {
  tokens.setAccessToken(makeToken());
  let seen;
  await authApi.register(
    { ...user, password: 'StrongPass9!', confirmPassword: 'StrongPass9!', terms: true },
    {
      adapter: async config => {
        seen = config;
        return reply(config, user);
      },
    },
  );
  assert.deepEqual(JSON.parse(seen.data), {
    fullName: user.fullName,
    email: user.email,
    password: 'StrongPass9!',
  });
  assert.equal(seen.headers.has('Authorization'), false);
});

test('login establishes user from server and stores only access token; logout clears both', async () => {
  const accessToken = makeToken();
  client.defaults.adapter = async config => {
    if (config.url.endsWith('/refresh')) return reject(config, 401);
    if (config.url.endsWith('/logout')) return reply(config, null);
    assert.equal(config.url, '/api/v1/auth/login');
    assert.equal(config.headers.has('Authorization'), false);
    return reply(config, { accessToken, user, tokenType: 'Bearer', expiresIn: 600 });
  };
  await mount();
  await act(async () => auth.login({ email: user.email, password: 'StrongPass9!' }));
  assert.deepEqual(auth.user, user);
  assert.equal(auth.isAuthenticated, true);
  assert.equal(window.sessionStorage.length, 1);
  assert.equal(window.sessionStorage.getItem(window.sessionStorage.key(0)), accessToken);
  await act(async () => auth.logout());
  assert.equal(auth.user, null);
  assert.equal(tokens.getAccessToken(), null);
  assert.equal(window.sessionStorage.length, 0);
});

test('Google uses a browser verifier and the shared Gateway API without bearer credentials', async () => {
  tokens.setAccessToken(makeToken());
  let challenge;
  client.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/auth/google/start');
    assert.equal(config.headers.has('Authorization'), false);
    assert.equal(config.withCredentials, true);
    challenge = JSON.parse(config.data).challenge;
    return reply(config, {
      authorizationPath: `/api/v1/auth/google/authorize/google?challenge=${challenge}`,
    });
  };
  const url = await startGoogleLogin('/my-courses');
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url, `http://gateway.test/api/v1/auth/google/authorize/google?challenge=${challenge}`);
  const attempt = readGoogleAttempt();
  assert.equal(attempt.from, '/my-courses');
  assert.notEqual(attempt.verifier, challenge);
  assert.equal(
    Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier))).toString(
      'base64url',
    ),
    challenge,
  );
});

test('Google callback exchanges once in StrictMode and establishes the existing Auth session', async () => {
  const code = 'c'.repeat(43),
    verifier = 'v'.repeat(43);
  window.sessionStorage.setItem(
    'google_login_attempt',
    JSON.stringify({ verifier, from: '/my-courses', createdAt: Date.now() }),
  );
  let exchanges = 0;
  client.defaults.adapter = async config => {
    if (config.url.endsWith('/refresh')) return reject(config, 401);
    assert.equal(config.url, '/api/v1/auth/google/exchange');
    assert.deepEqual(JSON.parse(config.data), { code, verifier });
    assert.equal(config.headers.has('Authorization'), false);
    exchanges++;
    return reply(config, { accessToken: makeToken(), user });
  };
  await mount(
    h(
      MemoryRouter,
      { initialEntries: [`/auth/google/callback?code=${code}`] },
      h(
        'div',
        null,
        h(Probe),
        h(
          Routes,
          null,
          h(Route, { path: '/auth/google/callback', element: h(GoogleCallbackPage) }),
          h(Route, { path: '/my-courses', element: h('p', null, 'Google destination') }),
        ),
      ),
    ),
    true,
  );
  await flush();
  assert.equal(exchanges, 1);
  assert.equal(auth.user.fullName, user.fullName);
  assert.equal(tokens.getAccessToken(), makeToken());
  assert.match(document.body.textContent, /Google destination/);
  assert.equal(window.location.search, '');
  assert.equal(readGoogleAttempt(), null);
});

test('Google cancellation and missing browser proof show an error without exchanging a code', async () => {
  for (const query of ['error=GOOGLE_LOGIN_CANCELLED', `code=${'c'.repeat(43)}`]) {
    let exchanges = 0;
    client.defaults.adapter = async config => {
      if (config.url.endsWith('/exchange')) exchanges++;
      return reject(config, 401);
    };
    await mount(
      h(MemoryRouter, { initialEntries: [`/auth/google/callback?${query}`] }, h(GoogleCallbackPage)),
    );
    await flush();
    assert.equal(exchanges, 0);
    assert.match(
      document.body.textContent,
      query.startsWith('error=') ? /đã hủy/ : /hết hạn hoặc không hợp lệ/,
    );
    assert.equal(document.querySelector('a').getAttribute('href'), '/login');
    await act(async () => root.unmount());
    root = null;
  }
});

test('LINK API keeps bearer authentication, strips untrusted fields and retries after refresh', async () => {
  const oldToken = makeToken({ marker: 'before' });
  const newToken = makeToken({ marker: 'rotated' });
  tokens.setAccessToken(oldToken);
  let starts = 0;
  let refreshes = 0;
  client.defaults.adapter = async config => {
    if (config.url.endsWith('/refresh')) {
      refreshes++;
      return reply(config, { accessToken: newToken });
    }
    assert.equal(config.withCredentials, true);
    if (config.url.endsWith('/link/start')) {
      starts++;
      assert.deepEqual(JSON.parse(config.data), {
        currentPassword: 'CurrentPassword9!',
        challenge: 'c'.repeat(43),
      });
      if (starts === 1) {
        assert.equal(config.headers.get('Authorization'), `Bearer ${oldToken}`);
        return reject(config, 401);
      }
      assert.equal(config.headers.get('Authorization'), `Bearer ${newToken}`);
      return reply(config, {});
    }
    assert.equal(config.url, '/api/v1/auth/google/link/complete');
    assert.equal(config.headers.get('Authorization'), `Bearer ${newToken}`);
    assert.deepEqual(JSON.parse(config.data), { code: 'code', verifier: 'verifier' });
    return reply(config, { alreadyLinked: false });
  };
  await authApi.startGoogleLink({
    currentPassword: 'CurrentPassword9!',
    challenge: 'c'.repeat(43),
    userId: 999,
    role: 'ADMIN',
  });
  await authApi.completeGoogleLink({ code: 'code', verifier: 'verifier', userId: 999 });
  assert.equal(starts, 2);
  assert.equal(refreshes, 1);
});

test('LINK uses separate tab proof and never stores or sends a target user or password in a URL', async () => {
  tokens.setAccessToken(makeToken());
  const loginProof = JSON.stringify({ verifier: 'l'.repeat(43), createdAt: Date.now() });
  window.sessionStorage.setItem('google_login_attempt', loginProof);
  let challenge;
  client.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/auth/google/link/start');
    assert.ok(config.headers.get('Authorization'));
    const body = JSON.parse(config.data);
    assert.equal(body.currentPassword, 'PrivatePassword9!');
    assert.equal('userId' in body, false);
    challenge = body.challenge;
    return reply(config, {
      authorizationPath: `/api/v1/auth/google/authorize/google?challenge=${challenge}`,
    });
  };
  const url = await startGoogleLink('PrivatePassword9!', 1, '/account');
  assert.equal(url, `http://gateway.test/api/v1/auth/google/authorize/google?challenge=${challenge}`);
  assert.equal(window.sessionStorage.getItem('google_login_attempt'), loginProof);
  const attempt = readGoogleAttempt('link');
  assert.equal(attempt.userId, 1);
  assert.equal(attempt.from, '/account');
  assert.equal(JSON.stringify(Object.values(window.sessionStorage)).includes('PrivatePassword9!'), false);
  assert.equal(
    Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier))).toString(
      'base64url',
    ),
    challenge,
  );
});

function saveLinkProof(userId = 1) {
  window.sessionStorage.setItem(
    'google_link_attempt',
    JSON.stringify({ verifier: 'v'.repeat(43), userId, from: '/account', createdAt: Date.now() }),
  );
  window.sessionStorage.setItem(
    'google_login_attempt',
    JSON.stringify({ verifier: 'l'.repeat(43), createdAt: Date.now() }),
  );
}

test('LINK callback waits for restored session, completes once in StrictMode and retains the local user', async () => {
  saveLinkProof();
  let finishRefresh;
  const restored = makeToken({ marker: 'restored-local' });
  let completes = 0;
  client.defaults.adapter = async config => {
    if (config.url.endsWith('/refresh'))
      return new Promise(resolve => {
        finishRefresh = () => resolve(reply(config, { accessToken: restored, user }));
      });
    if (config.url === '/api/v1/users/me') return reply(config, user);
    assert.equal(config.url, '/api/v1/auth/google/link/complete');
    assert.equal(config.headers.get('Authorization'), `Bearer ${restored}`);
    assert.deepEqual(JSON.parse(config.data), { code: 'c'.repeat(43), verifier: 'v'.repeat(43) });
    completes++;
    return reply(config, {
      alreadyLinked: false,
      linkedAccounts: { passwordEnabled: true, google: { email: user.email } },
    });
  };
  await mount(
    h(
      MemoryRouter,
      { initialEntries: [`/auth/google/callback?flow=link&code=${'c'.repeat(43)}`] },
      h(
        'div',
        null,
        h(Probe),
        h(
          Routes,
          null,
          h(Route, { path: '/auth/google/callback', element: h(GoogleCallbackPage) }),
          h(Route, { path: '/account', element: h(SignInMethods) }),
        ),
      ),
    ),
    true,
  );
  assert.equal(completes, 0);
  // Status is fetched on the destination page after the link succeeds.
  const adapter = client.defaults.adapter;
  client.defaults.adapter = config =>
    config.url.endsWith('/linked-accounts')
      ? Promise.resolve(reply(config, { passwordEnabled: true, google: { email: user.email } }))
      : adapter(config);
  await act(async () => finishRefresh());
  await flush();
  assert.equal(completes, 1);
  assert.equal(auth.user.id, 1);
  assert.equal(tokens.getAccessToken(), restored);
  assert.match(document.body.textContent, /Liên kết Google thành công/);
  assert.match(document.body.textContent, /Đã liên kết — test@example.com/);
  assert.equal(readGoogleAttempt('link'), null);
  assert.ok(readGoogleAttempt());
});

test('cancelled LINK keeps the local session and returns to Profile without consuming LOGIN proof', async () => {
  saveLinkProof();
  const localToken = makeToken();
  tokens.setAccessToken(localToken);
  let completes = 0;
  client.defaults.adapter = async config => {
    if (config.url === '/api/v1/users/me') return reply(config, user);
    completes++;
    return reject(config, 401);
  };
  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/auth/google/callback?flow=link&error=GOOGLE_LOGIN_CANCELLED'] },
      h('div', null, h(Probe), h(GoogleCallbackPage)),
    ),
  );
  await flush();
  assert.equal(completes, 0);
  assert.equal(auth.user.id, 1);
  assert.equal(tokens.getAccessToken(), localToken);
  assert.match(document.body.textContent, /đã hủy/);
  assert.equal(document.querySelector('a').getAttribute('href'), '/account#sign-in-methods');
  assert.ok(readGoogleAttempt());
  assert.equal(readGoogleAttempt('link'), null);
});

test('LINK callback refuses a different restored account without changing that account', async () => {
  assert.match(googleErrorMessage('GOOGLE_LOGIN_FAILED', 'link'), /thử lại từ Hồ sơ/);
  assert.match(googleErrorMessage('GOOGLE_LOGIN_CANCELLED', 'link'), /hủy liên kết Google/);
  saveLinkProof(999);
  tokens.setAccessToken(makeToken());
  let completes = 0;
  client.defaults.adapter = async config => {
    if (config.url === '/api/v1/users/me') return reply(config, user);
    completes++;
    return reply(config, {});
  };
  await mount(
    h(
      MemoryRouter,
      { initialEntries: [`/auth/google/callback?flow=link&code=${'c'.repeat(43)}`] },
      h('div', null, h(Probe), h(GoogleCallbackPage)),
    ),
  );
  await flush();
  assert.equal(completes, 0);
  assert.equal(auth.user.id, 1);
  assert.match(document.body.textContent, /Phiên khởi tạo đã thay đổi/);
});

test('Profile displays local, linked and Google-only capabilities from the protected status API', async () => {
  for (const status of [
    { passwordEnabled: true, google: null },
    { passwordEnabled: true, google: { email: user.email } },
    { passwordEnabled: false, google: { email: user.email } },
  ]) {
    tokens.setAccessToken(makeToken());
    client.defaults.adapter = async config => {
      assert.ok(config.headers.get('Authorization'));
      if (config.url === '/api/v1/users/me') return reply(config, user);
      assert.equal(config.url, '/api/v1/users/me/linked-accounts');
      return reply(config, status);
    };
    await mount(h(MemoryRouter, null, h(ProtectedRoute, null, h(SignInMethods))));
    await flush();
    const button = [...document.querySelectorAll('button')].find(
      item => item.textContent === 'Liên kết Google',
    );
    assert.equal(!!button, status.passwordEnabled && !status.google);
    if (status.google) assert.match(document.body.textContent, /Đã liên kết — test@example.com/);
    if (!status.passwordEnabled)
      assert.match(document.body.textContent, /Chưa thiết lập; tài khoản sử dụng Google/);
    await act(async () => root.unmount());
    root = null;
  }
});

test('login redirects and Google error messages reject arbitrary destinations and unknown error values', () => {
  for (const from of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/admin/users',
    '/login',
    '/auth/google/callback',
    '/\n/evil.test',
  ]) {
    assert.equal(loginDestination(user, from), '/account');
  }
  assert.equal(loginDestination(user, '/courses/42?tab=lessons'), '/courses/42?tab=lessons');
  assert.equal(typeof googleErrorMessage('__proto__'), 'string');
  assert.equal(typeof googleErrorMessage('constructor'), 'string');
});

test('establishSession rejects malformed, expired and mismatched user responses', async () => {
  await mount();
  for (const accessToken of ['broken', makeToken({ exp: 1 }), makeToken({ sub: '2' })]) {
    assert.throws(() => auth.establishSession({ accessToken, user }));
  }
  assert.equal(tokens.getAccessToken(), null);
});

test('custom role sessions preserve server permissions and restore successfully', async () => {
  const custom = { ...user, roles: ['CONTENT_MANAGER'], permissions: ['ADMIN_ACCESS', 'COURSE_VIEW'] };
  tokens.setAccessToken(makeToken({ roles: custom.roles }));
  client.defaults.adapter = config => Promise.resolve(reply(config, custom));
  await mount();
  await flush();
  assert.equal(auth.isAuthenticated, true);
  assert.deepEqual(auth.user.roles, custom.roles);
  assert.deepEqual(auth.user.permissions, custom.permissions);
});

test('system roles are read-only while a custom role can be edited', async () => {
  const role = {
    id: 1,
    name: 'USER',
    label: 'Học viên',
    description: '',
    systemRole: true,
    version: 0,
    permissions: [],
    userCount: 5,
  };
  const adminRole = {
    ...role,
    id: 2,
    name: 'ADMIN',
    label: 'Quản trị viên',
    permissions: ['ADMIN_ACCESS', 'DASHBOARD_VIEW', 'ROLE_MANAGE'],
  };
  let customRole = {
    ...role,
    id: 3,
    name: 'SUPPORT',
    label: 'Hỗ trợ',
    systemRole: false,
    userCount: 1,
  };
  const catalog = [
    {
      code: 'ADMIN_ACCESS',
      group: 'Hệ thống',
      resource: 'Admin',
      action: 'VIEW',
      label: 'Truy cập',
      dependencies: [],
      adminOnly: false,
    },
    {
      code: 'DASHBOARD_VIEW',
      group: 'Hệ thống',
      resource: 'Tổng quan',
      action: 'VIEW',
      label: 'Xem tổng quan',
      dependencies: ['ADMIN_ACCESS'],
      adminOnly: false,
    },
    {
      code: 'ROLE_MANAGE',
      group: 'Hệ thống',
      resource: 'Vai trò',
      action: 'SPECIAL',
      label: 'Quản lý vai trò',
      dependencies: ['ADMIN_ACCESS'],
      adminOnly: true,
    },
  ];
  let saved = false;
  tokens.setAccessToken(makeToken({ role: 'ADMIN', roles: ['ADMIN'] }));
  client.defaults.adapter = async config => {
    if (config.url.endsWith('/users/me'))
      return reply(config, {
        ...user,
        roles: ['ADMIN'],
        permissions: ['ADMIN_ACCESS', 'ROLE_VIEW', 'ROLE_MANAGE'],
      });
    if (config.url.endsWith('/admin/roles/3') && config.method === 'put') {
      const payload = JSON.parse(config.data);
      assert.equal(payload.name, 'SUPPORT');
      assert.equal(payload.version, 0);
      assert.deepEqual(new Set(payload.permissions), new Set(['DASHBOARD_VIEW', 'ADMIN_ACCESS']));
      customRole = { ...customRole, ...payload, version: 1 };
      saved = true;
      return reply(config, customRole);
    }
    if (config.url.endsWith('/admin/roles')) return reply(config, [role, adminRole, customRole]);
    if (config.url.endsWith('/admin/permissions')) return reply(config, catalog);
    throw Error(`Unexpected request: ${config.method} ${config.url}`);
  };
  await mount(h(ToastContext.Provider, { value: () => {} }, h(AdminRolesPage)));
  await flush();
  const checkbox = code => document.querySelector(`input[aria-label="${code}"]`);
  assert.equal(checkbox('DASHBOARD_VIEW').disabled, true);
  assert.equal(checkbox('ROLE_MANAGE').disabled, true);
  assert.ok(document.body.textContent.includes('USER là vai trò học viên mặc định'));
  assert.equal(document.body.textContent.includes('Xóa vai trò'), false);
  await act(async () =>
    [...document.querySelectorAll('.admin-role-option')]
      .find(button => button.textContent.startsWith('SUPPORT'))
      .click(),
  );
  assert.equal(checkbox('DASHBOARD_VIEW').disabled, false);
  await act(async () => checkbox('DASHBOARD_VIEW').click());
  assert.equal(checkbox('ADMIN_ACCESS').checked, true);
  const save = [...document.querySelectorAll('button')].find(
    button => button.textContent.trim() === 'Lưu thay đổi',
  );
  assert.equal(save.disabled, false);
  await act(async () => save.click());
  await flush();
  assert.equal(saved, true);
  assert.equal(checkbox('DASHBOARD_VIEW').checked, true);
  assert.equal(document.body.textContent.includes('Có thay đổi chưa được lưu'), false);
  await act(async () =>
    [...document.querySelectorAll('.admin-role-option')]
      .find(button => button.textContent.startsWith('ADMIN'))
      .click(),
  );
  assert.equal(checkbox('DASHBOARD_VIEW').disabled, true);
  assert.equal(document.body.textContent.includes('Xóa vai trò'), false);
});

test('session restore waits for me and uses server roles instead of JWT roles', async () => {
  tokens.setAccessToken(makeToken({ role: 'ADMIN', roles: ['ADMIN'] }));
  let resolve;
  client.defaults.adapter = config =>
    new Promise(done => {
      resolve = () => done(reply(config, user));
    });
  await mount();
  assert.equal(auth.isLoading, true);
  assert.equal(auth.isAuthenticated, false);
  await act(async () => resolve());
  assert.deepEqual(auth.user.roles, ['USER']);
  assert.equal(auth.isLoading, false);
});

test('expired session attempts refresh and clears storage if cookie authentication fails', async () => {
  const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 1 });
  tokens.setAccessToken(token);
  await new Promise(resolve => setTimeout(resolve, 1100));
  const calls = [];
  client.defaults.adapter = async config => {
    calls.push(config.url);
    return reject(config, 401);
  };
  await mount();
  await flush();
  assert.deepEqual(calls, ['/api/v1/auth/refresh']);
  assert.equal(tokens.getAccessToken(), null);
  assert.equal(auth.user, null);
});

test('me 401 clears the restored session', async () => {
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = config => reject(config, 401);
  await mount();
  await flush();
  assert.equal(auth.isAuthenticated, false);
  assert.equal(auth.isLoading, false);
  assert.equal(tokens.getAccessToken(), null);
});

test('temporary me failure keeps token and can retry', async () => {
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = config => reject(config, 503);
  await mount();
  await flush();
  assert.equal(auth.sessionError.status, 503);
  assert.ok(tokens.getAccessToken());
  assert.equal(auth.isAuthenticated, false);
  client.defaults.adapter = async config => reply(config, user);
  await act(async () => auth.retrySession());
  assert.deepEqual(auth.user, user);
});

test('logout during restore or login cannot resurrect an old session', async () => {
  tokens.setAccessToken(makeToken());
  let resolve;
  client.defaults.adapter = config =>
    new Promise(done => {
      resolve = () => done(reply(config, user));
    });
  await mount();
  client.defaults.adapter = async config => reply(config, null);
  await act(async () => auth.logout());
  await act(async () => resolve());
  assert.equal(auth.user, null);
  client.defaults.adapter = config =>
    new Promise(done => {
      resolve = () => done(reply(config, { accessToken: makeToken(), user }));
    });
  let pending;
  await act(async () => {
    pending = auth.login({ email: user.email, password: 'StrongPass9!' });
    await Promise.resolve();
  });
  client.defaults.adapter = async config => reply(config, null);
  await act(async () => {
    const quitting = auth.logout();
    resolve();
    await assert.rejects(pending);
    await quitting;
  });
  assert.equal(tokens.getAccessToken(), null);
});

test('ProtectedRoute redirects guests and allows authenticated users', async () => {
  const routes = h(
    MemoryRouter,
    { initialEntries: ['/private'] },
    h(
      Routes,
      null,
      h(Route, { path: '/login', element: h('p', null, 'login page') }),
      h(Route, { path: '/private', element: h(ProtectedRoute, null, h('p', null, 'private content')) }),
    ),
  );
  await mount(routes);
  assert.match(document.body.textContent, /login page/);
  await act(async () => root.unmount());
  root = null;
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = async config => reply(config, user);
  await mount(routes);
  assert.match(document.body.textContent, /private content/);
});

test('protected Learning/Payment state is remounted when Auth changes accounts', async () => {
  function PrivateState() {
    auth = useContext(AuthContext);
    const { user } = auth;
    const [owner] = useState(user.id);
    return h('p', null, `private state for ${owner}, current user ${user.id}`);
  }
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = async config => reply(config, user);
  await mount(h(MemoryRouter, null, h(ProtectedRoute, null, h(PrivateState))), true);
  assert.match(document.body.textContent, /private state for 1, current user 1/);
  await act(async () =>
    auth.establishSession({
      accessToken: makeToken({ sub: '2' }),
      user: { ...user, id: 2 },
    }),
  );
  assert.match(document.body.textContent, /private state for 2, current user 2/);
  assert.doesNotMatch(document.body.textContent, /private state for 1/);
});

test('Course uses authenticated Learning for free enrollment and Payment checkout for paid courses', async () => {
  for (const price of [0, 100000]) {
    tokens.setAccessToken(makeToken());
    const writes = [];
    client.defaults.adapter = async config => {
      if (config.url === '/api/v1/users/me') return reply(config, user);
      if (config.url === '/api/v1/courses/42')
        return reply(config, {
          id: 42,
          title: 'Integration Course',
          price,
          status: 'PUBLISHED',
        });
      if (config.url === '/api/v1/learning/enrollments' && config.method === 'post') {
        writes.push(JSON.parse(config.data));
        assert.equal(config.headers.get('Authorization'), `Bearer ${tokens.getAccessToken()}`);
        return reply(config, { courseId: 42, status: 'ACTIVE' });
      }
      if (config.url.endsWith('/reviews/me')) return reply(config, null);
      return reply(config, []);
    };
    await mount(
      h(
        MemoryRouter,
        { initialEntries: ['/courses/42'] },
        h(
          Routes,
          null,
          h(Route, { path: '/courses/:id', element: h(CourseDetailPage) }),
          h(Route, { path: '/checkout', element: h('p', null, 'payment checkout destination') }),
          h(Route, { path: '/learning/:id', element: h('p', null, 'learning destination') }),
        ),
      ),
    );
    await flush();
    const button = [...document.querySelectorAll('button')].find(button =>
      button.textContent.includes(price ? 'Mua khóa học ngay' : 'Đăng ký học miễn phí'),
    );
    assert.ok(button, 'Course enrollment button is present');
    await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    await flush();
    assert.match(document.body.textContent, price ? /payment checkout destination/ : /learning destination/);
    assert.deepEqual(writes, price ? [] : [{ courseId: 42 }]);
    await act(async () => root.unmount());
    root = null;
  }
});

test('RoleRoute denies USER and allows ADMIN from AuthContext', async () => {
  const routes = h(MemoryRouter, null, h(RoleRoute, { roles: ['ADMIN'] }, h('p', null, 'admin content')));
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = async config => reply(config, user);
  await mount(routes);
  assert.match(document.body.textContent, /Không có quyền truy cập/);
  assert.doesNotMatch(document.body.textContent, /admin content/);
  await act(async () => root.unmount());
  root = null;
  client.defaults.adapter = async config => reply(config, { ...user, roles: ['USER', 'ADMIN'] });
  await mount(routes);
  assert.match(document.body.textContent, /admin content/);
});

test('PermissionRoute uses restored custom permissions and shows a clear forbidden state', async () => {
  const route = h(
    MemoryRouter,
    null,
    h(PermissionRoute, { permission: 'USER_VIEW' }, h('p', null, 'accounts')),
  );
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = async config =>
    reply(config, {
      ...user,
      permissions: ['ADMIN_ACCESS', 'USER_VIEW'],
      status: 'ACTIVE',
    });
  await mount(route);
  assert.match(document.body.textContent, /không có quyền truy cập/);
  assert.doesNotMatch(document.body.textContent, /accounts/);
  await act(async () => root.unmount());
  root = null;
  client.defaults.adapter = async config =>
    reply(config, {
      ...user,
      roles: ['SUPPORT'],
      permissions: ['ADMIN_ACCESS', 'USER_VIEW'],
      status: 'ACTIVE',
    });
  await mount(route);
  assert.match(document.body.textContent, /accounts/);
  await act(async () => root.unmount());
  root = null;
  client.defaults.adapter = async config =>
    reply(config, {
      ...user,
      roles: ['ADMIN'],
      permissions: ['ADMIN_ACCESS'],
      status: 'ACTIVE',
    });
  await mount(route);
  assert.match(document.body.textContent, /không có quyền truy cập/);
  assert.doesNotMatch(document.body.textContent, /accounts/);
});

test('missing access token restores through one refresh then authoritative me, including StrictMode', async () => {
  const calls = [];
  client.defaults.adapter = async config => {
    calls.push(config.url);
    if (config.url.endsWith('/refresh'))
      return reply(config, { accessToken: makeToken(), user: { ...user, roles: ['ADMIN'] } });
    return reply(config, user);
  };
  await mount(h(Probe), true);
  await flush();
  assert.equal(calls.filter(path => path.endsWith('/refresh')).length, 1);
  assert.ok(calls.includes('/api/v1/users/me'));
  assert.deepEqual(auth.user.roles, ['USER']);
  assert.equal(auth.isAuthenticated, true);
});

test('expired access token restores with refresh instead of logging the user out', async () => {
  tokens.setAccessToken(makeToken({ exp: Math.floor(Date.now() / 1000) + 1 }));
  await new Promise(resolve => setTimeout(resolve, 1100));
  const calls = [];
  client.defaults.adapter = async config => {
    calls.push(config.url);
    return reply(config, config.url.endsWith('/refresh') ? { accessToken: makeToken(), user } : user);
  };
  await mount();
  await flush();
  assert.deepEqual(calls, ['/api/v1/auth/refresh', '/api/v1/users/me']);
  assert.deepEqual(auth.user, user);
});

test('logout calls backend and always clears local session on network failure', async () => {
  tokens.setAccessToken(makeToken());
  const calls = [];
  client.defaults.adapter = async config => {
    calls.push(config.url);
    if (config.url.endsWith('/logout')) throw Object.assign(new Error('offline'), { config });
    return reply(config, user);
  };
  await mount();
  let result;
  await act(async () => {
    result = await auth.logout();
  });
  assert.ok(result.error);
  assert.ok(calls.includes('/api/v1/auth/logout'));
  assert.equal(tokens.getAccessToken(), null);
  assert.equal(auth.user, null);
  assert.equal(auth.isLoading, false);
  await flush();
  assert.equal(calls.filter(path => path.endsWith('/refresh')).length, 0);
});

test('logout waits for in-flight refresh cookie rotation before backend revocation', async () => {
  const calls = [];
  let release;
  client.defaults.adapter = config => {
    calls.push(config.url);
    if (config.url.endsWith('/refresh'))
      return new Promise(resolve => {
        release = () => resolve(reply(config, { accessToken: makeToken(), user }));
      });
    return Promise.resolve(reply(config, null));
  };
  await mount();
  let quitting;
  await act(async () => {
    quitting = auth.logout();
  });
  assert.deepEqual(calls, ['/api/v1/auth/refresh']);
  await act(async () => {
    release();
    await quitting;
  });
  assert.deepEqual(calls, ['/api/v1/auth/refresh', '/api/v1/auth/logout']);
  assert.equal(tokens.getAccessToken(), null);
  assert.equal(auth.user, null);
});

test('failed automatic refresh clears Context without starting another restoration refresh', async () => {
  tokens.setAccessToken(makeToken());
  client.defaults.adapter = async config => reply(config, user);
  await mount();
  let refreshes = 0;
  client.defaults.adapter = config => {
    if (config.url.endsWith('/refresh')) refreshes++;
    return reject(config, 401);
  };
  await act(async () => {
    await assert.rejects(authApi.getMe());
  });
  await flush();
  assert.equal(refreshes, 1);
  assert.equal(auth.user, null);
  assert.equal(auth.isLoading, false);
});
