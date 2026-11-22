import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import ExcelJS from 'exceljs';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'revenue-analytics' });
const { default: Revenue } = await env.load('features/admin/analytics/tabs/RevenueAnalyticsTab.jsx');
const { analyticsApi } = await env.load('features/admin/analytics/analyticsApi.js');
const { adminApi } = await env.load('features/admin/api/adminApi.js');

afterEach(env.unmount);
after(env.close);

const current = { totalOrders: 2, grossRevenue: 250000, successfulOrders: 1, pendingOrders: 1 };

test('revenue filters recent and server orders and exports the displayed server page', async t => {
  t.mock.method(analyticsApi, 'getRevenueAnalytics', async () => ({
    current,
    transactions: [
      { id: 'A', code: 'A', courseTitle: 'Speaking', status: 'SUCCESS', amount: 250000, currency: 'VND' },
      { id: 'B', code: 'B', courseTitle: 'Reading', status: 'PENDING', amount: 100, currency: 'USD' },
    ],
  }));
  const orders = t.mock.method(adminApi, 'paymentOrders', async () => ({
    data: {
      content: [
        {
          orderCode: 'SRV-42',
          courseTitle: 'Reading',
          userId: 7,
          paymentStatus: 'FAILED',
          amount: 42,
          currency: 'USD',
          createdAt: '2026-10-15T00:00:00Z',
          provider: 'MOCK',
        },
      ],
      totalPages: 1,
      totalElements: 1,
    },
  }));
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {});
  let exportReport;
  await env.render(
    h(
      MemoryRouter,
      null,
      h(Revenue, {
        onExportReady: value => {
          exportReport = value;
        },
      }),
    ),
  );

  await env.setInputValue(env.field('Tìm mã đơn, khóa học hoặc ID học viên'), ' Reading ');
  await env.click(env.button('Lọc'));
  assert.match(document.querySelector('table').textContent, /Reading/);
  assert.doesNotMatch(document.querySelector('table').textContent, /Speaking/);
  await env.click(env.button('Tất cả lịch sử'));
  const status = () => document.querySelector('.analytics-table-toolbar [role="combobox"]');
  await env.selectOption(status(), 'EXPIRED');
  assert.deepEqual(orders.mock.calls.at(-1).arguments[0], {
    page: 0,
    size: 10,
    expired: true,
    keyword: 'Reading',
  });
  await env.selectOption(status(), 'FAILED');
  assert.equal(orders.mock.calls.at(-1).arguments[0].status, 'FAILED');
  await exportReport();
  const file = createUrl.mock.calls[0].arguments[0];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet('Doanh thu');
  const exported = sheet.getRow(11).values.slice(1);
  assert.deepEqual(exported.slice(0, 6), ['SRV-42', 'Học viên #7', 'Reading', '42 USD', 'MOCK', 'Thất bại']);
  await env.click(env.button('Xóa lọc'));
  assert.deepEqual(orders.mock.calls.at(-1).arguments[0], { page: 0, size: 10 });
  await env.click(env.button('Gần nhất'));
  assert.match(document.querySelector('table').textContent, /Speaking/);
});

test('missing report totals render an empty state and a prepared export is a no-op', async t => {
  t.mock.method(analyticsApi, 'getRevenueAnalytics', async () => ({}));
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  let exportReport;
  await env.render(
    h(
      MemoryRouter,
      null,
      h(Revenue, {
        onExportReady: value => {
          exportReport = value;
        },
      }),
    ),
  );
  assert.match(document.body.textContent, /Không tìm thấy dữ liệu doanh thu/);
  await exportReport();
  assert.equal(createUrl.mock.callCount(), 0);
});
