import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, StrictMode, useContext } from 'react';
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
const { default: AdminRolesPage } = await load('features/admin/pages/AdminRolesPage.jsx');
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

test('admin can edit and save USER permissions while system-role deletion and ADMIN edits stay protected', async () => {
  let role = {
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
    if (config.url.endsWith('/users/me')) return reply(config, { ...user, roles: ['ADMIN'] });
    if (config.url.endsWith('/admin/roles/1') && config.method === 'put') {
      const payload = JSON.parse(config.data);
      assert.equal(payload.name, 'USER');
      assert.equal(payload.version, 0);
      assert.deepEqual(new Set(payload.permissions), new Set(['DASHBOARD_VIEW', 'ADMIN_ACCESS']));
      role = { ...role, ...payload, version: 1 };
      saved = true;
      return reply(config, role);
    }
    if (config.url.endsWith('/admin/roles')) return reply(config, [role, adminRole]);
    if (config.url.endsWith('/admin/permissions')) return reply(config, catalog);
    throw Error(`Unexpected request: ${config.method} ${config.url}`);
  };
  await mount(h(ToastContext.Provider, { value: () => {} }, h(AdminRolesPage)));
  await flush();
  const checkbox = code => document.querySelector(`input[aria-label="${code}"]`);
  assert.equal(checkbox('DASHBOARD_VIEW').disabled, false);
  assert.equal(checkbox('ROLE_MANAGE').disabled, true);
  assert.ok(document.body.textContent.includes('tài khoản đang mang vai trò USER'));
  assert.equal(document.body.textContent.includes('Xóa vai trò'), false);
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
