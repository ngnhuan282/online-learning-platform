import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'sign-in-methods' });
const { default: SignInMethods } = await env.load('features/auth/components/SignInMethods.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { userApi } = await env.load('features/auth/api/userApi.js');
const { authApi } = await env.load('features/auth/api/authApi.js');

afterEach(env.unmount);
after(env.close);

test('retries malformed sign-in methods and clears confirmation input after cancellation or history restoration', async t => {
  const localAccount = { passwordEnabled: true, google: null };
  let fetches = 0;
  t.mock.method(userApi, 'linkedAccounts', async () => ({ data: ++fetches === 1 ? {} : localAccount }));
  const onStatus = t.mock.fn();
  const startLink = t.mock.method(authApi, 'startGoogleLink', async () => {
    throw new Error('Confirmation rejected');
  });

  await env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/account'] },
      h(
        AuthContext.Provider,
        { value: { user: { id: 7, email: 'learner@example.test' } } },
        h(SignInMethods, { onStatus }),
      ),
    ),
  );
  assert.match(document.querySelector('#sign-in-methods').textContent, /Không thể tải phương thức đăng nhập/);
  await env.click(env.button('Thử lại'));
  assert.deepEqual(onStatus.mock.calls[0].arguments, [localAccount]);

  await env.click(env.button('Liên kết Google'));
  const passwordSelector = 'input[name="googleLinkPassword"]';
  await env.setInputValue(passwordSelector, 'Cancelled draft');
  await env.click(env.button('Hủy'));
  await env.click(env.button('Liên kết Google'));
  assert.equal(document.querySelector(passwordSelector).value, '');
  assert.equal(startLink.mock.callCount(), 0);

  await env.setInputValue(passwordSelector, 'History draft');
  await act(async () =>
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })),
  );
  assert.equal(document.querySelector(passwordSelector).value, '');
  await env.setInputValue(passwordSelector, 'Current password');
  await env.click(env.button('Xác nhận và tiếp tục'));
  await env.flush();
  assert.match(document.querySelector('[role="dialog"]').textContent, /Confirmation rejected/);
  assert.equal(document.querySelector(passwordSelector).value, '');
  const [
    {
      arguments: [payload],
    },
  ] = startLink.mock.calls;
  assert.equal(payload.currentPassword, 'Current password');
  assert.match(payload.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(window.sessionStorage.getItem('google_link_attempt'), null);
});
