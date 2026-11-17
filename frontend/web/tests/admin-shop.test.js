import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { createServer } from 'vite';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost/admin/shop',
  pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Event: dom.window.Event,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  DocumentFragment: dom.window.DocumentFragment,
  ShadowRoot: dom.window.ShadowRoot,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/admin-shop',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { default: AdminShopPage } = await load('features/admin/pages/AdminShopPage.jsx');
const { CommerceTable } = await load('features/admin/components/CommerceAdminUi.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi: api } = await load('features/admin/api/commerceAdminApi.js');
const originals = { items: api.items, purchases: api.purchases };
const item = {
  code: 'FRAME_RENDER_TEST',
  nameKey: 'Test frame',
  itemType: 'FRAME',
  rarity: 'RARE',
  price: 5,
  active: true,
};
const purchasePage = {
  content: [
    {
      id: 1,
      userId: 7,
      nameKey: 'Receipt frame',
      gemsSpent: 5,
      createdAt: '2026-11-17T00:00:00Z',
      requestId: 'receipt',
    },
  ],
  totalElements: 1,
  totalPages: 1,
  page: 0,
  size: 20,
};
let root;
beforeEach(() => {
  api.items = async () => ({ data: [item] });
  api.purchases = async () => ({ data: purchasePage });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  Object.assign(api, originals);
});
after(async () => {
  await server.close();
  dom.window.close();
});
async function render(component) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: createCache({ key: 'admin-shop-test' }) },
        h(
          AuthContext.Provider,
          {
            value: {
              user: { id: 1, status: 'ACTIVE', roles: ['ADMIN'], permissions: ['ADMIN_ACCESS', 'SHOP_VIEW'] },
            },
          },
          component,
        ),
      ),
    ),
  );
}
async function click(label) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label);
  assert.ok(button, 'Button exists: ' + label);
  await act(async () => button.click());
}
function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

test('shop switches between item arrays and purchase pages while requests are pending', async () => {
  const receipts = deferred(),
    items = deferred();
  let itemCalls = 0;
  api.items = () => (++itemCalls === 1 ? Promise.resolve({ data: [item] }) : items.promise);
  api.purchases = () => receipts.promise;
  await render(h(AdminShopPage));
  assert.match(document.querySelector('tbody').textContent, /FRAME_RENDER_TEST/);
  await click('Giao dịch gem');
  assert.ok(document.querySelector('.admin-loading'));
  assert.equal(document.querySelector('tbody'), null);
  await act(async () => receipts.resolve({ data: purchasePage }));
  assert.match(document.querySelector('tbody').textContent, /Receipt frame/);
  await click('Vật phẩm');
  assert.ok(document.querySelector('.admin-loading'));
  assert.equal(document.querySelector('tbody'), null);
  await act(async () => items.resolve({ data: [item] }));
  assert.match(document.querySelector('tbody').textContent, /FRAME_RENDER_TEST/);
});

test('shared commerce tables safely render absent row data', async () => {
  for (const rows of [undefined, null]) {
    await render(h(CommerceTable, { columns: [['Name', 'name']], rows, paginate: true }));
    assert.equal(document.querySelectorAll('tbody tr').length, 0);
    assert.match(document.body.textContent, /Không có dữ liệu/);
  }
});

test('shop reports invalid API data and supports retrying instead of crashing', async () => {
  api.items = async () => ({ data: { unexpected: true } });
  await render(h(AdminShopPage));
  assert.ok(document.querySelector('[role=alert]'));
  assert.equal(document.querySelector('tbody'), null);
  api.items = async () => ({ data: [] });
  await click('Thử lại');
  assert.match(document.body.textContent, /Không có dữ liệu/);
});
