import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'pro-checkout' });
const { default: Checkout } = await env.load('features/payment/pages/ProCheckoutPage.jsx');
const { proApi } = await env.load('features/pro/api/proApi.js');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');

afterEach(env.unmount);
after(env.close);

const render = () =>
  env.render(h(MemoryRouter, { initialEntries: ['/payment/pro-checkout?plan=PRO_YEAR'] }, h(Checkout)));

test('invalid plan and provider responses can be retried and the chosen provider is sent to checkout', async t => {
  let planAttempts = 0;
  t.mock.method(proApi, 'plans', async () => ({
    data: ++planAttempts === 1 ? null : [{ code: 'PRO_YEAR', price: 100000, durationDays: 365 }],
  }));
  let methodAttempts = 0;
  t.mock.method(paymentApi, 'getMethods', async () => ({
    data:
      ++methodAttempts === 1
        ? null
        : [
            { provider: 'MOCK', available: true, name: 'Mock Pay' },
            { provider: 'VNPAY', available: true, name: 'VNPay' },
          ],
  }));
  const checkout = t.mock.method(paymentApi, 'createProCheckout', async () => {
    throw new Error('Checkout temporarily unavailable');
  });
  await render();
  assert.match(document.body.textContent, /Không thể tải thông tin gói Pro/);
  await env.click(env.button('Thử lại'));
  assert.match(document.body.textContent, /Không thể tải phương thức thanh toán/);
  await env.click(env.button('Thử lại'));
  await env.click(document.querySelectorAll('input[type="radio"]')[1]);
  await env.click('.checkout-submit');
  assert.match(document.body.textContent, /Checkout temporarily unavailable/);
  assert.equal(checkout.mock.calls[0].arguments[0].provider, 'VNPAY');
  assert.equal(checkout.mock.calls[0].arguments[0].planCode, 'PRO_YEAR');
});

test('an empty plan catalog offers a route back to available plans', async t => {
  t.mock.method(proApi, 'plans', async () => ({ data: [] }));
  t.mock.method(paymentApi, 'getMethods', async () => ({ data: [] }));
  await render();
  assert.match(document.body.textContent, /Gói Pro không hợp lệ/);
  assert.ok([...document.querySelectorAll('a')].some(link => /Xem các gói Pro/.test(link.textContent)));
});
