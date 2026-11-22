import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-payment-management' });
const { default: Management } = await env.load('features/payment/pages/AdminPaymentManagementPage.jsx');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');

afterEach(env.unmount);
after(env.close);

test('admin transaction queries recover, preserve search and status and reset pagination after page size changes', async t => {
  let attempts = 0;
  t.mock.method(paymentApi, 'getAdminAnalytics', async () => ({ data: {} }));
  const orders = t.mock.method(paymentApi, 'getAdminOrders', async () => {
    if (++attempts === 1) throw new Error('Orders unavailable');
    return {
      data: {
        content: [
          {
            orderCode: 'ORD-42',
            userId: 7,
            courseTitle: 'Reading',
            amount: 3000,
            currency: 'VND',
            paymentStatus: 'REFUNDED',
            status: 'REFUNDED',
            createdAt: '2026-10-01T00:00:00Z',
          },
        ],
        totalPages: 3,
        totalElements: 25,
      },
    };
  });
  await env.render(h(MemoryRouter, null, h(Management)));
  assert.match(document.body.textContent, /Orders unavailable/);
  await env.click(env.button('Thử lại'));
  await env.setInputValue('input[placeholder="Tìm theo mã giao dịch hoặc khóa học..."]', ' ORD-42 ');
  await env.click(env.button('Tìm'));
  await env.waitFor(
    () => orders.mock.calls.at(-1).arguments[0].keyword === 'ORD-42',
    'Expected an order search',
  );
  await env.selectOption(env.field('Trạng thái'), 'REFUNDED');
  await env.click('button[aria-label="Go to page 2"]');
  assert.equal(orders.mock.calls.at(-1).arguments[0].page, 1);
  await env.selectOption(env.field('Số dòng'), '20');
  assert.deepEqual(orders.mock.calls.at(-1).arguments[0], {
    page: 0,
    size: 20,
    keyword: 'ORD-42',
    status: 'REFUNDED',
  });
  await env.click(env.button('Đặt lại bộ lọc'));
  assert.equal(orders.mock.calls.at(-1).arguments[0].status, '');
  const previousReads = orders.mock.callCount();
  await env.click(env.button('Làm mới'));
  assert.equal(orders.mock.callCount(), previousReads + 1);
});
