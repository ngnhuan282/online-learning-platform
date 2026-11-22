import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/payment-analytics',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: Management } = await load('features/payment/pages/AdminPaymentManagementPage.jsx');
const { default: Dashboard } = await load('features/admin/pages/AdminDashboardPage.jsx');
const { default: Chart } = await load('features/payment/components/PaymentRevenueChart.jsx');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const originalPayment = { ...paymentApi };
const originalAdmin = { ...adminApi };
const cache = createCache({ key: 'payment-analytics' });
let root;

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  Object.assign(paymentApi, originalPayment);
  Object.assign(adminApi, originalAdmin);
});
after(async () => {
  await server.close();
  dom.window.close();
});

async function render(Component, props = {}) {
  root = createRoot(document.getElementById('root'));
  const user = { id: 1, roles: ['ADMIN'], status: 'ACTIVE', permissions: ['PAYMENT_REPORT_VIEW'] };
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(AuthContext.Provider, { value: { user } }, h(MemoryRouter, null, h(Component, props))),
      ),
    ),
  );
}

test('statistics failure stays unknown while the payment list remains usable', async () => {
  paymentApi.getAdminOrders = async () => ({
    data: {
      content: [
        {
          orderCode: 'ORDER-FAILED',
          userId: 1,
          courseTitle: 'English grammar',
          amount: 490000,
          currency: 'VND',
          paymentStatus: 'FAILED',
        },
      ],
      totalElements: 1,
      totalPages: 1,
    },
  });
  paymentApi.getAdminAnalytics = async () => {
    throw new Error('Unavailable');
  };
  await render(Management);
  assert.match(document.body.textContent, /Chưa tải được số liệu tổng quan/);
  assert.equal(document.querySelectorAll('.admin-stat > strong').length, 4);
  for (const value of document.querySelectorAll('.admin-stat > strong')) assert.equal(value.textContent, '—');
  assert.match(document.querySelector('.admin-payments-table').textContent, /ORDER-FAILED/);
});

test('dashboard distinguishes unavailable payment data from an empty report', async () => {
  adminApi.payments = async () => {
    throw new Error('Unavailable');
  };
  await render(Dashboard);
  assert.match(document.querySelector('.payment-chart-state').textContent, /Chưa tải được doanh thu/);
  assert.equal(document.querySelector('.payment-period-revenue').textContent, '—');
});

test('zero revenue draws no invented bars even when orders were created', async () => {
  await render(Chart, {
    data: [
      { label: '26/10', amount: 0, orders: 12 },
      { label: '27/10', amount: 0, orders: 8 },
    ],
  });
  for (const bar of document.querySelectorAll('.payment-revenue-fill')) assert.equal(bar.style.height, '0%');
  assert.match(document.body.textContent, /Chưa có thanh toán thành công/);
  assert.match(document.querySelector('table').textContent, /12/);
});
