import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-pro-codes' });
const { default: Codes } = await env.load('features/pro/pages/AdminProCodesPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { proApi } = await env.load('features/pro/api/proApi.js');
const { commerceAdminApi } = await env.load('features/admin/api/commerceAdminApi.js');

afterEach(env.unmount);
after(env.close);

const user = {
  id: 1,
  roles: ['STAFF'],
  permissions: ['PRO_CODE_CREATE', 'PRO_CODE_UPDATE', 'PRO_CODE_REVOKE'],
};
const dialog = () => document.querySelector('[role="dialog"]');

test('an issued code can be copied, edited and revoked without leaving the full value visible', async t => {
  const plan = { code: 'PRO_YEAR', durationMonths: 12 };
  let code = {
    id: 8,
    maskedCode: 'ABCD-****',
    planCode: plan.code,
    durationMonths: 12,
    status: 'AVAILABLE',
    version: 2,
    expiresAt: '2027-10-01T00:00:00Z',
  };
  t.mock.method(proApi, 'plans', async () => ({ data: [plan] }));
  t.mock.method(proApi, 'codes', async () => ({ data: [code] }));
  t.mock.method(proApi, 'createCode', async () => ({ data: { code: 'ABCD-TEST', info: code } }));
  const update = t.mock.method(commerceAdminApi, 'updateCode', async () => ({}));
  const revoke = t.mock.method(proApi, 'revokeCode', async () => {
    code = { ...code, status: 'REVOKED' };
  });
  const clipboard = t.mock.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboard }, configurable: true });
  t.after(() => {
    delete navigator.clipboard;
  });

  await env.render(h(AuthContext.Provider, { value: { user } }, h(Codes)));
  await env.click(env.button('Tạo mã kích hoạt'));
  await env.click(env.button('Tạo mã', dialog()));
  await env.click(env.button('Sao chép mã'));
  assert.deepEqual(clipboard.mock.calls[0].arguments, ['ABCD-TEST']);
  assert.match(document.body.textContent, /Đã sao chép mã/);
  await env.click('button[aria-label="Xem chi tiết"]');
  assert.match(dialog().textContent, /ABCD-\*\*\*\*/);
  await env.click(env.button('Đóng', dialog()));
  await env.click('button[aria-label="Chỉnh sửa"]');
  await env.setInputValue('input[type="datetime-local"]', '');
  await env.setInputValue('textarea', 'Remove expiration for this trial');
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.deepEqual(update.mock.calls[0].arguments, [
    8,
    {
      expiresAt: null,
      version: 2,
      reason: 'Remove expiration for this trial',
    },
  ]);
  await env.click('button[aria-label="Thu hồi"]');
  await env.click(env.button('Thu hồi', dialog()));
  assert.deepEqual(revoke.mock.calls[0].arguments, [8]);
  assert.doesNotMatch(document.body.textContent, /ABCD-TEST/);
  assert.match(document.body.textContent, /Đã thu hồi/);
});
