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
const { default: AdminStatisticsPage } = await load('features/admin/pages/AdminStatisticsPage.jsx');
const { CommerceTable } = await load('features/admin/components/CommerceAdminUi.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi: api } = await load('features/admin/api/commerceAdminApi.js');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const originals = { items: api.items, purchases: api.purchases };
const originalAdminApi = { ...adminApi };
const originalAdapter = axiosClient.defaults.adapter;
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
  Object.assign(adminApi, originalAdminApi);
  axiosClient.defaults.adapter = originalAdapter;
});
after(async () => {
  await server.close();
  dom.window.close();
});
async function render(component, permissions = ['ADMIN_ACCESS', 'SHOP_VIEW']) {
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
              user: { id: 1, status: 'ACTIVE', roles: ['ADMIN'], permissions },
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

test('admin statistics render real zero totals and avoid mislabeled or unavailable reports', async () => {
  let paymentCalls = 0;
  adminApi.payments = async () => {
    paymentCalls++;
    return { data: { grossRevenue: 0, refundedAmount: 0, successfulPayments: 0, recentTransactions: [] } };
  };
  adminApi.overview = async () => ({ data: { total: 18, active: 12, newThisWeek: 0, monthly: [] } });
  adminApi.learning = async () => ({ data: { enrollments: 3, completed: 1, completionRate: 33.3 } });
  adminApi.commerceAnalytics = async () => ({
    data: reportFixture({ snapshot: { ownedItems: 0 }, current: { purchases: 0 }, details: [] }),
  });
  const report = h(AdminStatisticsPage);
  await render(report, ['DASHBOARD_VIEW', 'LEARNING_REPORT_VIEW', 'SHOP_VIEW']);
  assert.equal(paymentCalls, 0);
  assert.match(document.body.textContent, /Tổng tài khoản18/);
  assert.match(document.body.textContent, /Tài khoản đang được bật12/);
  await click('Tiến độ & Kết quả học');
  assert.match(document.body.textContent, /Lượt ghi danh hợp lệ3/);
  assert.equal([...document.querySelectorAll('button')].some(node => node.textContent === 'Xuất Excel'), false);
  await click('Cửa hàng & Kho đồ');
  assert.match(document.body.textContent, /Vật phẩm trong kho đồ0/);
  assert.match(document.body.textContent, /Chưa có dữ liệu trong kỳ này/);
  await render(report, ['DASHBOARD_VIEW', 'PAYMENT_REPORT_VIEW']);
  assert.equal(paymentCalls, 1);
  assert.match(document.querySelector('.stat-card-value').textContent, /0/);
  assert.match(document.body.textContent, /Chưa có giao dịch/);
});

const defaultRange = { from: '2026-10-21', to: '2026-11-19' };
function reportFixture(values) {
  return {
    range: defaultRange,
    previousRange: { from: '2026-09-21', to: '2026-10-20' },
    asOf: '2026-11-19T10:00:00Z',
    snapshot: {},
    current: {},
    previous: {},
    trend: [{ range: defaultRange, current: 0, previous: 0 }],
    ...values,
  };
}

async function enterDate(name, value) {
  const input = document.querySelector(`input[name=${name}]`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

test('Pro, Gem and Shop reports load authorized data and use date filters with the Gateway client', async () => {
  const requests = [];
  let gemUnavailable = true;
  const reports = {
    pro: reportFixture({
      snapshot: { active: 8 },
      current: { grants: 5 },
      previous: { grants: 4 },
      details: {
        recentGrants: [{ id: 1, userId: 7, source: 'PAYMENT', planCode: 'PRO_MONTH', months: 1 }],
        codes: { created: 1, redeemed: 0, recent: [{ id: 2, maskedCode: 'CCG-••••-A123', planCode: 'PRO_MONTH', status: 'AVAILABLE' }] },
      },
    }),
    gems: reportFixture({
      snapshot: { balance: 1000 },
      current: { issued: 50, spent: 25, legacyActivityDays: 1 },
      previous: { issued: 20 },
      details: [{ id: 1, userId: 7, actorId: 3, delta: -25, reason: 'Điều chỉnh kiểm thử' }],
    }),
    shop: reportFixture({
      snapshot: { ownedItems: 4, equippedItems: 2, equipRate: 50 },
      current: { purchases: 3 },
      details: [{ code: 'FRAME_TEST', name: 'Khung kiểm thử', type: 'FRAME', purchases: 3, currentPrice: 20 }],
    }),
  };
  axiosClient.defaults.adapter = async config => {
    const report = config.url.split('/').at(-1);
    requests.push({ url: config.url, params: config.params });
    assert.ok(config.signal);
    if (report === 'gems' && gemUnavailable) throw new Error('Test upstream outage');
    const data = reports[report];
    return { config, status: 200, data: { success: true, data: { ...data, range: config.params ?? data.range } } };
  };
  await render(h(AdminStatisticsPage), ['PRO_MEMBER_VIEW', 'ENGAGEMENT_VIEW', 'SHOP_VIEW']);
  assert.match(document.body.textContent, /Đang hoạt động8/);
  assert.match(document.body.textContent, /CCG-••••-A123/);
  assert.match(document.body.textContent, /Lượt cấp Pro chưa bị thu hồi54/);
  await enterDate('from', '2026-01-01');
  await click('Áp dụng');
  assert.match(document.querySelector('[role=alert]').textContent, /tối đa 90 ngày/);
  assert.equal(requests.length, 1);
  await enterDate('from', '2026-11-15');
  await enterDate('to', '2026-11-16');
  await click('Áp dụng');
  assert.deepEqual(requests.at(-1), {
    url: '/api/v1/learning/admin/analytics/pro',
    params: { from: '2026-11-15', to: '2026-11-16' },
  });
  assert.match(document.body.textContent, /Kỳ này 2026-11-15 – 2026-11-16/);
  await click('Kinh tế Gem');
  assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải báo cáo/);
  assert.equal(document.querySelector('[aria-label="Kinh tế Gem"] table'), null);
  gemUnavailable = false;
  await click('Thử lại');
  assert.match(document.body.textContent, /Điều chỉnh kiểm thử/);
  assert.match(document.body.textContent, /Gem cộng vào ví đã ghi nhận5020/);
  await click('Cửa hàng & Kho đồ');
  assert.match(document.body.textContent, /Tỷ lệ vật phẩm trang bị \(%\)50%/);
  assert.match(document.body.textContent, /Khung kiểm thử/);
  assert.deepEqual(requests.map(request => request.url.split('/').at(-1)), ['pro', 'pro', 'gems', 'gems', 'shop']);
});

test('commerce Excel exports server totals, the applied period and visible rows', { timeout: 30000 }, async () => {
  adminApi.commerceAnalytics = async () => ({
    data: reportFixture({
      snapshot: { balance: 220 },
      current: { issued: 200 },
      previous: { issued: 25 },
      details: [{ id: 1, userId: 7, actorId: 3, delta: 200, reason: 'Kiểm tra Excel' }],
    }),
  });
  const pending = deferred();
  const createUrl = URL.createObjectURL;
  const anchorClick = dom.window.HTMLAnchorElement.prototype.click;
  let blob;
  URL.createObjectURL = value => {
    blob = value;
    return 'blob:test-commerce-report';
  };
  dom.window.HTMLAnchorElement.prototype.click = function () {
    pending.resolve(this.download);
  };
  try {
    await render(h(AdminStatisticsPage), ['ENGAGEMENT_VIEW']);
    await click('Xuất Excel');
    assert.equal(await pending.promise, 'thong-ke-gems-2026-10-21-2026-11-19.xlsx');
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const rows = [];
    workbook.worksheets[0].eachRow(row => rows.push(row.values.slice(1)));
    assert.deepEqual(rows.find(row => row[0] === 'Gem cộng vào ví đã ghi nhận'), ['Gem cộng vào ví đã ghi nhận', 200, 25]);
    assert.ok(rows.some(row => row.includes('Kiểm tra Excel') && row.includes(200)));
  } finally {
    URL.createObjectURL = createUrl;
    dom.window.HTMLAnchorElement.prototype.click = anchorClick;
  }
});
