import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/reset-password' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const cache = createCache({ key: 'reset' });
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: ForgotPasswordPage } = await load('features/auth/pages/ForgotPasswordPage.jsx');
const { default: ResetPasswordPage } = await load('features/auth/pages/ResetPasswordPage.jsx');
const { default: client } = await load('shared/apis/axiosClient.js');
const { authApi } = await load('features/auth/api/authApi.js');
const tokens = await load('shared/utils/tokenUtils.js');
const token = 'r'.repeat(43);
const password = 'NewPassword9!';
const access = `h.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.s`;
const reply = (config, data = null) => ({ config, status: 200, headers: {}, data: { success: true, data } });
const reject = (config, status, code) =>
  Promise.reject({ config, response: { status, data: { code, message: 'private-provider-detail' } } });
let root;

beforeEach(() => {
  client.defaults.adapter = () => {
    throw new Error('Unexpected API request');
  };
  window.history.replaceState(null, '', '/reset-password');
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  tokens.clearTokens();
  window.sessionStorage.clear();
});
after(async () => {
  await server.close();
  dom.window.close();
});

async function mount(Component, path, strict = false) {
  root = createRoot(document.getElementById('root'));
  const content = h(
    CacheProvider,
    { value: cache },
    h(MemoryRouter, { initialEntries: [path] }, h(Component)),
  );
  await act(async () => root.render(strict ? h(StrictMode, null, content) : content));
}
async function input(name, value) {
  await act(async () => {
    const field = document.querySelector(`[name="${name}"]`);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(field, value);
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function submit(twice = false) {
  await act(async () => {
    const form = document.querySelector('form');
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    if (twice) form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
}

test('reset APIs use Gateway without bearer/refresh and strip unrelated fields', async () => {
  tokens.setAccessToken(access);
  const requests = [];
  client.defaults.adapter = async config => {
    requests.push(config);
    assert.equal(config.headers.has('Authorization'), false);
    return reply(config);
  };
  await authApi.forgotPassword({ email: 'user@example.test', userId: 999 });
  await authApi.resetPassword({ token, newPassword: password, confirmPassword: password, email: 'ignored' });
  assert.equal(requests[0].url, '/api/v1/auth/forgot-password');
  assert.deepEqual(JSON.parse(requests[0].data), { email: 'user@example.test' });
  assert.equal(requests[1].url, '/api/v1/auth/reset-password');
  assert.deepEqual(JSON.parse(requests[1].data), { token, newPassword: password, confirmPassword: password });
  requests.length = 0;
  client.defaults.adapter = config => {
    requests.push(config.url);
    return reject(config, 401, 'UNAUTHORIZED');
  };
  await assert.rejects(authApi.resetPassword({ token, newPassword: password, confirmPassword: password }));
  assert.deepEqual(requests, ['/api/v1/auth/reset-password']);
  assert.equal(tokens.getAccessToken(), access);
});

test('forgot validates email, prevents duplicate requests and shows the generic notice', async () => {
  let requests = 0;
  let complete;
  client.defaults.adapter = config => {
    requests++;
    assert.deepEqual(JSON.parse(config.data), { email: 'user@example.test' });
    return new Promise(resolve => {
      complete = () => resolve(reply(config));
    });
  };
  await mount(ForgotPasswordPage, '/forgot-password');
  await submit();
  assert.equal(requests, 0);
  assert.match(document.body.textContent, /Vui lòng nhập địa chỉ email/);
  await input('resetEmail', 'user@example.test');
  await submit(true);
  assert.equal(requests, 1);
  assert.equal(document.querySelector('form').getAttribute('aria-busy'), 'true');
  assert.equal(document.querySelector('button[type="submit"]').disabled, true);
  await act(async () => complete());
  assert.match(document.body.textContent, /Nếu tài khoản hỗ trợ mật khẩu/);
  assert.equal(document.querySelector('a').getAttribute('href'), '/login');
});

test('forgot mail unavailable and throttling are clear and never display raw SMTP errors', async () => {
  for (const [status, code, text] of [
    [503, 'PASSWORD_RESET_UNAVAILABLE', /Chưa có email nào được gửi/],
    [429, 'PASSWORD_RESET_RATE_LIMITED', /quá thường xuyên/],
  ]) {
    client.defaults.adapter = config => reject(config, status, code);
    await mount(ForgotPasswordPage, '/forgot-password');
    await input('resetEmail', 'user@example.test');
    await submit();
    assert.match(document.body.textContent, text);
    assert.equal(document.body.textContent.includes('private-provider-detail'), false);
    assert.equal(document.querySelector('[role="status"]'), null);
    await act(async () => root.unmount());
    root = null;
  }
});

test('opening a reset link in StrictMode strips history without calling an API or storing its token', async () => {
  window.history.replaceState(null, '', `/reset-password#token=${token}`);
  await mount(ResetPasswordPage, `/reset-password#token=${token}`, true);
  assert.equal(window.location.hash, '');
  assert.ok(document.querySelector('form'));
  assert.equal(window.sessionStorage.length, 0);
  assert.equal(document.body.innerHTML.includes(token), false);
});

test('missing, malformed, query-only and ambiguous reset links never submit', async () => {
  for (const path of [
    '/reset-password',
    '/reset-password#token=bad',
    `/reset-password?token=${token}`,
    `/reset-password#token=${token}&token=${token}`,
  ]) {
    await mount(ResetPasswordPage, path);
    assert.match(document.body.textContent, /không hợp lệ, đã hết hạn hoặc đã được sử dụng/);
    assert.equal(document.querySelector('form'), null);
    assert.equal(document.querySelector('a').getAttribute('href'), '/forgot-password');
    await act(async () => root.unmount());
    root = null;
  }
});

test('reset validates confirmation then submits once, clears passwords and ends the local session on success', async () => {
  tokens.setAccessToken(access);
  let requests = 0;
  let complete;
  client.defaults.adapter = config => {
    requests++;
    assert.deepEqual(JSON.parse(config.data), { token, newPassword: password, confirmPassword: password });
    return new Promise(resolve => {
      complete = () => resolve(reply(config));
    });
  };
  await mount(ResetPasswordPage, `/reset-password#token=${token}`);
  await input('newPassword', password);
  await input('confirmPassword', 'wrong');
  await submit();
  assert.equal(requests, 0);
  assert.match(document.body.textContent, /xác nhận chưa khớp/);
  await input('confirmPassword', password);
  await submit(true);
  assert.equal(requests, 1);
  assert.equal(document.querySelector('[name="newPassword"]').value, '');
  assert.equal(document.querySelector('[name="confirmPassword"]').value, '');
  assert.equal(document.querySelector('button[type="submit"]').disabled, true);
  await act(async () => complete());
  assert.match(document.body.textContent, /Đặt lại mật khẩu thành công/);
  assert.equal(document.querySelector('form'), null);
  assert.equal(tokens.getAccessToken(), null);
  assert.equal(window.sessionStorage.length, 0);
  assert.equal(document.querySelector('a').getAttribute('href'), '/login');
});

test('used or expired reset token shows a new-link action without clearing a current session', async () => {
  tokens.setAccessToken(access);
  client.defaults.adapter = config => reject(config, 400, 'PASSWORD_RESET_TOKEN_INVALID');
  await mount(ResetPasswordPage, `/reset-password#token=${token}`);
  await input('newPassword', password);
  await input('confirmPassword', password);
  await submit();
  assert.match(document.body.textContent, /đã hết hạn hoặc đã được sử dụng/);
  assert.equal(document.querySelector('form'), null);
  assert.equal(document.body.textContent.includes('private-provider-detail'), false);
  assert.equal(tokens.getAccessToken(), access);
});
