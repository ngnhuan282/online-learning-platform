import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-pro-members' });
const { default: Members } = await env.load('features/admin/pages/AdminProMembersPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi: api } = await env.load('features/admin/api/commerceAdminApi.js');
const { proApi } = await env.load('features/pro/api/proApi.js');

afterEach(env.unmount);
after(env.close);

const user = { id: 1, roles: ['STAFF'], permissions: ['PRO_MEMBER_MANAGE'] };
const plans = [
  { code: 'PRO_MONTH', durationMonths: 1 },
  { code: 'PRO_YEAR', durationMonths: 12 },
];
const membership = { userId: 42, displayName: 'Lan', active: true, planCode: 'PRO_MONTH', version: 4 };
const render = () => env.render(h(AuthContext.Provider, { value: { user } }, h(Members)));
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].at(-1);

function mockMembers(t, grants = []) {
  const list = t.mock.method(api, 'members', async () => ({
    data: { content: [membership], totalPages: 2, totalElements: 21 },
  }));
  t.mock.method(proApi, 'plans', async () => ({ data: plans }));
  t.mock.method(api, 'member', async () => ({ data: { membership, grants } }));
  return list;
}

test('staff can search members and retry a grant with the same request identity', async t => {
  const list = mockMembers(t);
  let attempts = 0;
  const grant = t.mock.method(api, 'grant', async () => {
    if (++attempts === 1) throw new Error('Grant unavailable');
  });
  await render();
  await env.setInputValue('.commerce-search input', 'Lan');
  await env.click(env.button('Tìm kiếm'));
  assert.equal(list.mock.calls.at(-1).arguments[0].keyword, 'Lan');
  await env.click(env.button('Cấp Pro'));
  await env.setInputValue(env.field('ID học viên', dialog()), '42');
  await env.setInputValue(env.field('Gói Pro', dialog()), 'PRO_YEAR');
  await env.setInputValue(dialog().querySelector('textarea'), 'Project grant');
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.match(dialog().textContent, /Grant unavailable/);
  await env.click(env.button('Lưu thay đổi', dialog()));
  const [first, second] = grant.mock.calls;
  assert.deepEqual(second.arguments, first.arguments);
  const [id, payload] = first.arguments;
  assert.equal(id, 42);
  assert.equal(payload.planCode, 'PRO_YEAR');
  assert.equal(payload.reason, 'Project grant');
});

test('member details allow versioned edits and revocation of grants issued by staff', async t => {
  mockMembers(t, [
    {
      id: 7,
      sourceType: 'ADMIN',
      actorId: 1,
      planCode: 'PRO_LEGACY',
      grantedAt: '2026-10-10T00:00:00Z',
      version: 3,
      adminReason: 'Training award',
    },
  ]);
  const update = t.mock.method(api, 'updateGrant', async () => {});
  const revoke = t.mock.method(api, 'revokeGrant', async () => {});

  await render();
  await env.click('button[aria-label="Xem chi tiết"]');
  await env.click(dialog().querySelector('button[aria-label="Xem chi tiết"]'));
  assert.match(dialog().textContent, /Training award/);
  await env.click(env.button('Đóng', dialog()));
  await env.click(dialog().querySelector('button[aria-label="Chỉnh sửa"]'));
  const select = env.field('Gói Pro', dialog());
  assert.match(select.selectedOptions[0].textContent, /Ngừng bán/);
  await env.setInputValue(select, 'PRO_MONTH');
  await env.setInputValue(dialog().querySelector('textarea'), 'Change grant duration');
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.deepEqual(update.mock.calls[0].arguments, [
    42,
    7,
    {
      planCode: 'PRO_MONTH',
      version: 3,
      reason: 'Change grant duration',
    },
  ]);
  await env.click(dialog().querySelector('button[aria-label="Thu hồi"]'));
  await env.setInputValue(dialog().querySelector('textarea'), 'Revoke training award');
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.deepEqual(revoke.mock.calls[0].arguments, [42, 7, { reason: 'Revoke training award' }]);
});
