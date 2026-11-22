import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-engagement' });
const { default: Engagement } = await env.load('features/admin/pages/AdminEngagementPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi: api } = await env.load('features/admin/api/commerceAdminApi.js');

afterEach(env.unmount);
after(env.close);

test('engagement searches learners, shows audit deltas and changes the selected gift before saving', async t => {
  const learner = { userId: 7, displayName: 'Lan', gems: 30, totalXp: 90, level: 2 };
  const list = t.mock.method(api, 'learners', async () => ({
    data: {
      content: [learner],
      totalPages: 1,
      totalElements: 1,
    },
  }));
  t.mock.method(api, 'learner', async () => ({ data: learner }));
  t.mock.method(api, 'adjustments', async () => ({
    data: [
      {
        id: 1,
        createdAt: '2026-10-01T00:00:00Z',
        gemsBefore: 10,
        gemsAfter: 30,
        xpBefore: 80,
        xpAfter: 90,
        freezesBefore: 0,
        freezesAfter: 1,
        actorId: 1,
        reason: 'Training complete',
      },
    ],
  }));
  t.mock.method(api, 'inventory', async () => ({ data: [] }));
  t.mock.method(api, 'items', async () => ({
    data: [
      { code: 'FRAME_CLASSIC', itemType: 'FRAME', nameKey: 'Classic' },
      { code: 'FRAME_BUNNY', itemType: 'FRAME', nameKey: 'Bunny' },
    ],
  }));
  const save = t.mock.method(api, 'saveInventory', async () => ({}));
  const user = {
    id: 1,
    roles: ['STAFF'],
    permissions: ['ENGAGEMENT_VIEW', 'INVENTORY_VIEW', 'INVENTORY_MANAGE'],
  };

  await env.render(h(AuthContext.Provider, { value: { user } }, h(Engagement)));
  await env.setInputValue('.commerce-search input', 'Lan');
  await env.click(env.button('Tìm kiếm'));
  assert.equal(list.mock.calls.at(-1).arguments[0].keyword, 'Lan');
  const details = () => [...document.querySelectorAll('[role="dialog"]')].at(-1);
  await env.click('button[aria-label="Xem chi tiết"]');
  assert.match(details().textContent, /10 → 30.*80 → 90.*0 → 1/);
  await env.click(env.button('Cấp vật phẩm', details()));
  await env.setInputValue(details().querySelector('select'), 'FRAME_BUNNY');
  await env.setInputValue(details().querySelector('textarea'), 'Training reward');
  await env.click(env.button('Lưu thay đổi', details()));
  assert.deepEqual(save.mock.calls[0].arguments, [
    7,
    'FRAME_BUNNY',
    { owned: true, reason: 'Training reward' },
  ]);
  await env.click(env.button('Đóng', details()));
});
