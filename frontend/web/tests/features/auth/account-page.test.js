import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'account-page' });
const { default: Account } = await env.load('features/auth/pages/AccountPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { userApi } = await env.load('features/auth/api/userApi.js');

afterEach(env.unmount);
after(env.close);

test('account shows field validation and preserves edits after profile and password errors', async t => {
  const user = { id: 7, fullName: 'Lan Nguyen', email: 'lan@example.test', roles: ['USER'] };
  t.mock.method(userApi, 'linkedAccounts', async () => ({ data: { passwordEnabled: true } }));
  const update = t.mock.method(userApi, 'updateProfile', async () => {
    throw new Error('Profile unavailable');
  });
  const password = t.mock.method(userApi, 'changePassword', async () => {
    throw Object.assign(new Error('Password rejected'), {
      response: { data: { code: 'OLD_PASSWORD_INCORRECT' } },
    });
  });
  const updateCurrentUser = t.mock.fn();
  await env.render(
    h(MemoryRouter, null, h(AuthContext.Provider, { value: { user, updateCurrentUser } }, h(Account))),
  );

  const name = document.querySelector('input[placeholder="Nhập họ và tên đầy đủ"]');
  await env.setInputValue(name, '   ');
  assert.equal(env.button('Lưu thông tin').disabled, true);
  await act(async () =>
    name.closest('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.match(document.body.textContent, /Họ và tên không được để trống/);
  assert.equal(update.mock.callCount(), 0);
  await env.setInputValue(name, 'Revised name');
  await env.click(env.button('Lưu thông tin'));
  assert.match(document.body.textContent, /Profile unavailable/);
  assert.equal(name.value, 'Revised name');
  assert.equal(updateCurrentUser.mock.callCount(), 0);

  const [current, next, confirmation] = document.querySelectorAll('input[type="password"]');
  const passwordForm = current.closest('form');
  await act(async () =>
    passwordForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.match(document.body.textContent, /nhập mật khẩu hiện tại/);
  await env.setInputValue(current, 'OldPassword1');
  await env.setInputValue(next, 'A1b');
  await env.setInputValue(confirmation, 'A1b');
  await env.click(env.button('Đổi mật khẩu'));
  assert.match(document.body.textContent, /tối thiểu 8 ký tự/);
  for (const [index, field] of [current, next].entries()) {
    await env.click(document.querySelectorAll('.account-pw-toggle')[index]);
    assert.equal(field.type, 'text');
  }
  await env.setInputValue(next, 'NewPassword1');
  await env.setInputValue(confirmation, 'NewPassword1');
  await env.click(env.button('Đổi mật khẩu'));
  assert.match(document.body.textContent, /Mật khẩu hiện tại không chính xác/);
  assert.equal(password.mock.callCount(), 1);
  assert.equal(next.value, 'NewPassword1');
});
