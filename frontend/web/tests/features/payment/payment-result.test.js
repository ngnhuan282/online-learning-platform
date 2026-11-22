import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'payment-result' });
const { default: Result } = await env.load('features/payment/pages/PaymentResultPage.jsx');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');

afterEach(env.unmount);
after(env.close);

const render = () =>
  env.render(
    h(MemoryRouter, { initialEntries: ['/payment/result?orderCode=GEM-7&status=success'] }, h(Result)),
  );

test('payment results offer retry on outages and display the server failure for a gem order', async t => {
  let attempts = 0;
  t.mock.method(paymentApi, 'getOrder', async () => {
    if (++attempts === 1) throw new Error('Order service unavailable');
    return {
      data: {
        orderCode: 'GEM-7',
        productType: 'GEM_TOPUP',
        items: [],
        totalAmount: 25000,
        payment: { provider: 'MOCK', status: 'FAILED', amount: 25000 },
      },
    };
  });
  await render();
  assert.match(document.body.textContent, /Order service unavailable/);
  await env.click(env.button('Thử lại'));
  assert.match(document.body.textContent, /Giao dịch nạp kim cương chưa thành công/);
  assert.doesNotMatch(document.body.textContent, /Nạp kim cương thành công/);
});

test('forbidden orders hide provider details and link back to payment history', async t => {
  t.mock.method(paymentApi, 'getOrder', async () => {
    throw Object.assign(new Error('Owned by another user'), { status: 403 });
  });
  await render();
  assert.match(document.body.textContent, /Bạn không có quyền xem giao dịch này/);
  assert.doesNotMatch(document.body.textContent, /Owned by another user/);
  assert.equal(env.button('Thử lại'), undefined);
  assert.ok([...document.querySelectorAll('a')].some(link => /Về lịch sử thanh toán/.test(link.textContent)));
});
