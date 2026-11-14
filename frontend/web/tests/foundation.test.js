import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

// Vite loads the actual JS/JSX modules and import.meta.env, including modules not yet used by pages.
process.env.VITE_API_URL = 'http://gateway.test';
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const events = new EventTarget();
const storage = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  dispatchEvent: events.dispatchEvent.bind(events),
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
};
after(async () => {
  await server.close();
  delete globalThis.window;
});

const load = path => server.ssrLoadModule(`/src/${path}`);
const tokens = await load('shared/utils/tokenUtils.js');
const makeToken = (claims = {}) =>
  `header.${Buffer.from(JSON.stringify({ sub: 'user', role: 'USER', exp: Math.floor(Date.now() / 1000) + 600, ...claims })).toString('base64url')}.signature`;

test('tokens handle Unicode, malformed data, expiry and blocked storage', () => {
  const token = makeToken({ sub: 'Nguyễn Văn A' });
  assert.equal(tokens.decodeToken(token).sub, 'Nguyễn Văn A');
  assert.equal(tokens.isTokenExpired(token), false);
  assert.equal(tokens.isTokenExpired(makeToken({ exp: 1 })), true);
  assert.equal(tokens.isTokenExpired(makeToken({ exp: 'bad' })), true);
  assert.equal(tokens.decodeToken('broken'), null);
  assert.throws(() => tokens.setAccessToken('broken'));
  tokens.setAccessToken(token);
  assert.equal(tokens.getAccessToken(), token);
  tokens.clearTokens();
  assert.equal(tokens.getAccessToken(), null);
  const original = window.sessionStorage;
  window.sessionStorage = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  tokens.setAccessToken(token);
  assert.equal(tokens.getAccessToken(), token);
  tokens.clearTokens();
  window.sessionStorage = original;
});

test('Axios attaches tokens, unwraps envelopes, normalizes 401 and rejects bypass URLs', async () => {
  const { default: client } = await load('shared/apis/axiosClient.js');
  const { authApi } = await load('features/auth/api/authApi.js');
  let seen;
  const adapter = async config => {
    seen = config;
    return {
      config,
      status: 200,
      headers: {},
      data: { success: true, message: 'Success', data: { ready: true } },
    };
  };
  const token = makeToken();
  tokens.setAccessToken(token);
  const result = await client.get('/api/v1/users/me', { adapter });
  assert.equal(result.data.ready, true);
  assert.equal(seen.headers.get('Authorization'), `Bearer ${token}`);
  await authApi.login({ email: 'test@example.com', password: 'test', remember: true }, { adapter });
  assert.equal(seen.headers.has('Authorization'), false);
  assert.equal(JSON.parse(seen.data).remember, undefined);
  assert.equal(JSON.parse(seen.data).rememberMe, true);
  await assert.rejects(client.get('https://other.example/api/v1/users/me', { adapter }), {
    code: 'INVALID_API_URL',
  });
  await assert.rejects(client.get('/api/v1/users/me', { baseURL: 'http://other.example', adapter }), {
    code: 'INVALID_API_URL',
  });
  const unauthorized = config =>
    Promise.reject({
      config,
      response: { status: 401, data: { code: 'UNAUTHORIZED', message: 'Sign in', errors: null } },
    });
  await assert.rejects(client.get('/api/v1/users/me', { adapter: unauthorized }), {
    code: 'UNAUTHORIZED',
    status: 401,
  });
  assert.equal(tokens.getAccessToken(), null);
  tokens.setAccessToken(token);
  const newer = makeToken({ sub: 'new-user' });
  await assert.rejects(
    client.get('/api/v1/users/me', {
      adapter: config => {
        tokens.setAccessToken(newer);
        return unauthorized(config);
      },
    }),
  );
  assert.equal(tokens.getAccessToken(), newer);
  tokens.clearTokens();
});

test('formatting and errors tolerate missing values', async () => {
  const { formatDate } = await load('shared/utils/formatDate.js');
  const { formatCurrency } = await load('shared/utils/formatCurrency.js');
  const { normalizeApiError } = await load('shared/utils/errorUtils.js');
  assert.equal(formatDate('invalid'), '—');
  assert.equal(formatDate(null), '—');
  assert.equal(formatCurrency(null), '—');
  assert.match(formatCurrency(120000), /120/);
  assert.equal(normalizeApiError({ code: 'ECONNABORTED' }).code, 'ECONNABORTED');
  assert.equal(
    normalizeApiError({ response: { status: 400, data: { errors: { email: ['invalid'] } } } }).errors
      .email[0],
    'invalid',
  );
});

test('all reusable JSX components, layouts and guards compile', async () => {
  for (const path of [
    'shared/components/AppLoading.jsx',
    'shared/components/EmptyState.jsx',
    'shared/components/ErrorState.jsx',
    'shared/components/ConfirmDialog.jsx',
    'shared/components/PageHeader.jsx',
    'shared/components/StatusChip.jsx',
    'layouts/UserLayout.jsx',
    'layouts/AdminLayout.jsx',
    'routes/ProtectedRoute.jsx',
    'routes/RoleRoute.jsx',
    'app/providers.jsx',
  ])
    assert.equal(typeof (await load(path)).default, 'function', path);
});
