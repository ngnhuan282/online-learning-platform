import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'auth-form' });
const { default: AuthForm } = await env.load('features/auth/components/AuthForm.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { ToastProvider } = await env.load('shared/context/ToastContext.jsx');
const { authApi } = await env.load('features/auth/api/authApi.js');

afterEach(async () => {
  await env.unmount();
  window.sessionStorage.clear();
});
after(env.close);

function render(mode, auth = {}) {
  return env.render(
    h(
      MemoryRouter,
      null,
      h(ToastProvider, null, h(AuthContext.Provider, { value: auth }, h(AuthForm, { mode }))),
    ),
  );
}

test('Google failure re-enables the login form and history restoration clears a pending attempt', async t => {
  const start = t.mock.method(authApi, 'startGoogle', async () => {
    throw new Error('Gateway unavailable');
  });
  await render('login');
  const google = env.button('Đăng nhập bằng Google');
  await env.click(google);
  await env.flush();
  assert.equal(start.mock.callCount(), 1);
  assert.match(document.body.textContent, /Gateway unavailable/);
  assert.equal(google.disabled, false);
  window.sessionStorage.setItem('google_login_attempt', 'kept during regular pageshow');
  await act(async () => window.dispatchEvent(new window.PageTransitionEvent('pageshow')));
  assert.equal(window.sessionStorage.getItem('google_login_attempt'), 'kept during regular pageshow');
  await act(async () =>
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })),
  );
  assert.equal(window.sessionStorage.getItem('google_login_attempt'), null);
});

test('registration validates blurred and mismatched fields, and opens each policy without submitting', async t => {
  const register = t.mock.fn();
  await render('register', { register });
  const email = document.querySelector('[name="email"]');
  await env.setInputValue(email, 'invalid');
  await act(async () => {
    email.focus();
    email.blur();
  });
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  await env.setInputValue('[name="password"]', 'ValidPass123');
  const confirmation = document.querySelector('[name="confirmPassword"]');
  await env.setInputValue(confirmation, 'DifferentPass123');
  await act(async () => {
    confirmation.focus();
    confirmation.blur();
  });
  assert.equal(confirmation.getAttribute('aria-invalid'), 'true');
  await env.setInputValue('[name="password"]', 'DifferentPass123');
  assert.equal(confirmation.getAttribute('aria-invalid'), 'false');

  for (const [button, title] of [
    ['Điều khoản dịch vụ', 'Terms of Service'],
    ['Chính sách bảo mật', 'Privacy Policy'],
  ]) {
    await env.click(env.button(button));
    assert.match(document.querySelector('[role="dialog"]').textContent, new RegExp(title, 'i'));
    await env.click('[role="dialog"] button[aria-label="Đóng"]');
  }
  assert.equal(register.mock.callCount(), 0);
});
