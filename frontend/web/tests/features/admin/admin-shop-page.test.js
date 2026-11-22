import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-shop-page' });
const { default: Shop } = await env.load('features/admin/pages/AdminShopPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi } = await env.load('features/admin/api/commerceAdminApi.js');

afterEach(env.unmount);
after(env.close);

const user = { id: 1, roles: ['ADMIN'], permissions: ['SHOP_CREATE', 'SHOP_UPDATE', 'SHOP_DELETE'] };
const render = () => env.render(h(AuthContext.Provider, { value: { user } }, h(Shop)));
const dialog = () => document.querySelector('[role="dialog"]');

test('shop item creation selects an appropriate asset and sends numeric prices', async t => {
  t.mock.method(commerceAdminApi, 'items', async () => ({ data: [] }));
  const save = t.mock.method(commerceAdminApi, 'saveItem', async () => ({}));
  await render();
  await env.click(env.button('Thêm vật phẩm'));
  await env.setInputValue(env.field('Loại', dialog()), 'BACKGROUND');
  assert.equal(env.field('Mã vật phẩm', dialog()).value, 'BACKGROUND_');
  assert.equal(env.field('Hình minh họa', dialog()).value, 'sky');
  await env.setInputValue(env.field('Mã vật phẩm', dialog()), 'BACKGROUND_CAMPUS');
  await env.setInputValue(env.field('Tên vật phẩm', dialog()), 'Campus');
  await env.setInputValue(env.field('Hình minh họa', dialog()), 'campus-sunrise');
  await env.setInputValue(env.field('Giá gem', dialog()), '35');
  await env.setInputValue('textarea', 'Release catalog item');
  await env.click(env.button('Lưu thay đổi', dialog()));
  const [item, creating] = save.mock.calls[0].arguments;
  assert.equal(creating, true);
  assert.equal(item.assetKey, 'campus-sunrise');
  assert.equal(item.price, 35);
  assert.equal(item.originalPrice, null);
});

test('staff inspect, archive and restore an item and filter the purchase history by learner', async t => {
  let item = {
    code: 'FRAME_CLASSIC',
    nameKey: 'Classic',
    itemType: 'FRAME',
    rarity: 'RARE',
    price: 10,
    version: 4,
    assetKey: 'classic',
    active: true,
  };
  t.mock.method(commerceAdminApi, 'items', async () => ({ data: [item] }));
  const archive = t.mock.method(commerceAdminApi, 'deleteItem', async () => {
    item = { ...item, deletedAt: '2026-10-01T00:00:00Z', version: 5 };
  });
  const restore = t.mock.method(commerceAdminApi, 'restoreItem', async () => {
    item = { ...item, deletedAt: null, version: 6, active: false };
  });
  const purchases = t.mock.method(commerceAdminApi, 'purchases', async () => ({ data: { content: [] } }));

  await render();
  await env.click('button[aria-label="Xem chi tiết"]');
  await env.waitFor(dialog, 'The item detail dialog should open');
  assert.match(dialog().textContent, /classic/);
  await env.click(env.button('Đóng', dialog()));
  await env.click('button[aria-label="Xóa vật phẩm"]');
  await env.setInputValue('textarea', 'Archive catalog item');
  await env.click(env.button('Xóa', dialog()));
  assert.deepEqual(archive.mock.calls[0].arguments, [
    'FRAME_CLASSIC',
    { reason: 'Archive catalog item', version: 4 },
  ]);
  await env.click(env.button('Thùng rác'));
  await env.click('button[aria-label="Khôi phục"]');
  await env.setInputValue('textarea', 'Restore catalog item');
  await env.click(env.button('Khôi phục', dialog()));
  assert.deepEqual(restore.mock.calls[0].arguments, [
    'FRAME_CLASSIC',
    { reason: 'Restore catalog item', version: 5 },
  ]);
  await env.click(env.button('Giao dịch gem'));
  await env.setInputValue('form input[type="number"]', '23');
  await env.click(env.button('Lọc'));
  assert.equal(purchases.mock.calls.at(-1).arguments[0].userId, '23');
});
