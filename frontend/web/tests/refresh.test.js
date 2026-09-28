import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createServer } from 'vite';

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
const tokens = await server.ssrLoadModule('/src/shared/utils/tokenUtils.js');
const { default: client, refreshAccessToken } = await server.ssrLoadModule('/src/shared/apis/axiosClient.js');
const makeToken = id =>
  `h.${Buffer.from(JSON.stringify({ sub: '1', jti: id, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.s`;
const old = makeToken('old'),
  renewed = makeToken('new');
const response = (config, data) => ({ config, status: 200, headers: {}, data: { success: true, data } });
const unauthorized = config =>
  Promise.reject({ config, response: { status: 401, data: { code: 'UNAUTHORIZED', message: 'Sign in' } } });
afterEach(() => tokens.clearTokens());
after(async () => {
  await server.close();
  delete globalThis.window;
});

test('credential-enabled 401 refresh retries original request with new bearer and payload', async () => {
  tokens.setAccessToken(old);
  const calls = [];
  const adapter = async config => {
    calls.push(config.url);
    assert.equal(config.withCredentials, true);
    if (config.url.endsWith('/refresh')) {
      assert.equal(config.headers.has('Authorization'), false);
      return response(config, { accessToken: renewed });
    }
    if (!config.retriedAfterRefresh) return unauthorized(config);
    assert.equal(config.headers.get('Authorization'), `Bearer ${renewed}`);
    assert.equal(config.method, 'post');
    assert.deepEqual(JSON.parse(config.data), { title: 'test' });
    return response(config, { ok: true });
  };
  assert.equal((await client.post('/api/v1/protected', { title: 'test' }, { adapter })).data.ok, true);
  assert.deepEqual(calls, ['/api/v1/protected', '/api/v1/auth/refresh', '/api/v1/protected']);
  assert.equal(tokens.getAccessToken(), renewed);
});

test('only one retry is allowed and a second 401 clears the session', async () => {
  tokens.setAccessToken(old);
  let refreshes = 0,
    requests = 0;
  const adapter = async config => {
    if (config.url.endsWith('/refresh')) {
      refreshes++;
      return response(config, { accessToken: renewed });
    }
    requests++;
    return unauthorized(config);
  };
  await assert.rejects(client.get('/api/v1/users/me', { adapter }), { status: 401 });
  assert.equal(refreshes, 1);
  assert.equal(requests, 2);
  assert.equal(tokens.getAccessToken(), null);
});

test('locked account response clears local session without attempting refresh', async () => {
  tokens.setAccessToken(old);
  let calls = 0;
  await assert.rejects(
    client.get('/api/v1/users/me', {
      adapter: config => {
        calls++;
        return Promise.reject({ config, response: { status: 403, data: { code: 'ACCOUNT_LOCKED' } } });
      },
    }),
    { code: 'ACCOUNT_LOCKED' },
  );
  assert.equal(calls, 1);
  assert.equal(tokens.getAccessToken(), null);
});

test('Auth endpoints never recursively trigger refresh', async () => {
  let calls = 0;
  const adapter = config => {
    calls++;
    return unauthorized(config);
  };
  for (const path of ['login', 'register', 'refresh', 'logout']) {
    await assert.rejects(client.post(`/api/v1/auth/${path}`, {}, { adapter }), { status: 401 });
  }
  assert.equal(calls, 4);
});

test('failed refresh clears token and resets flight for a later session', async () => {
  tokens.setAccessToken(old);
  let calls = 0;
  await assert.rejects(
    client.get('/api/v1/users/me', {
      adapter: config => {
        calls++;
        return unauthorized(config);
      },
    }),
  );
  assert.equal(calls, 2);
  assert.equal(tokens.getAccessToken(), null);
  await refreshAccessToken({ adapter: async config => response(config, { accessToken: renewed }) });
  assert.equal(tokens.getAccessToken(), renewed);
});

test('concurrent and delayed 401s share exactly one refresh', async () => {
  tokens.setAccessToken(old);
  let refreshes = 0,
    retries = 0;
  const adapter = async config => {
    if (config.url.endsWith('/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 15));
      return response(config, { accessToken: renewed });
    }
    if (!config.retriedAfterRefresh) {
      if (config.url.endsWith('/late')) await new Promise(resolve => setTimeout(resolve, 40));
      return unauthorized(config);
    }
    retries++;
    assert.equal(config.headers.get('Authorization'), `Bearer ${renewed}`);
    return response(config, { ok: true });
  };
  const results = await Promise.all(
    ['one', 'two', 'three', 'late'].map(path => client.get(`/api/v1/${path}`, { adapter })),
  );
  assert.ok(results.every(result => result.data.ok));
  assert.equal(refreshes, 1);
  assert.equal(retries, 4);
});

test('late refresh cannot overwrite a new login or resurrect a cleared session', async () => {
  for (const newerLogin of [true, false]) {
    tokens.setAccessToken(old);
    let release;
    const pending = refreshAccessToken({
      adapter: config =>
        new Promise(resolve => {
          release = () => resolve(response(config, { accessToken: renewed }));
        }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    const newer = makeToken('other-login');
    if (newerLogin) tokens.setAccessToken(newer);
    else tokens.clearTokens();
    release();
    await assert.rejects(pending, { code: 'ERR_CANCELED' });
    assert.equal(tokens.getAccessToken(), newerLogin ? newer : null);
  }
});
