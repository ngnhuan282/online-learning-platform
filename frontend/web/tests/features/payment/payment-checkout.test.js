import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'payment-checkout' });
const { default: Checkout } = await env.load('features/payment/pages/PaymentCheckoutPage.jsx');
const { courseApi } = await env.load('features/courses/api/courseApi.js');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');
const { ROUTES } = await env.load('shared/constants/routes.js');

afterEach(env.unmount);
after(env.close);

function Destination() {
  const { search } = useLocation();
  return h('output', null, search);
}

const render = path =>
  env.render(
    h(
      MemoryRouter,
      { initialEntries: [path] },
      h(
        Routes,
        null,
        h(Route, { path: ROUTES.CHECKOUT, element: h(Checkout) }),
        h(Route, { path: ROUTES.PAYMENT_MOCK, element: h(Destination) }),
      ),
    ),
  );

test('checkout validates the course ID, retries unavailable course data and recovers the payment methods', async t => {
  const checkout = t.mock.method(paymentApi, 'createCheckout', async () =>
    assert.fail('Checkout was not requested'),
  );
  let courseAttempts = 0;
  const course = t.mock.method(courseApi, 'getById', async () => {
    if (++courseAttempts === 1) throw new Error('Course service unavailable');
    return { data: { id: 42, title: 'Writing skills', price: 250000, status: 'PUBLISHED' } };
  });
  let methodAttempts = 0;
  t.mock.method(paymentApi, 'getMethods', async () => {
    if (++methodAttempts < 3) return { data: null };
    return { data: [{ provider: 'MOCK', available: true, name: 'Mock Pay' }] };
  });

  await render(`${ROUTES.CHECKOUT}?course=invalid`);
  assert.match(document.body.textContent, /Chưa chọn khóa học/);
  assert.equal(course.mock.callCount(), 0);
  await env.unmount();

  await render(`${ROUTES.CHECKOUT}?course=42`);
  assert.match(document.body.textContent, /Course service unavailable/);
  await env.click(env.button('Thử lại'));
  assert.match(document.body.textContent, /Writing skills/);
  assert.match(document.body.textContent, /Không thể tải phương thức thanh toán/);
  await env.click(env.button('Thử lại'));
  assert.equal(document.querySelector('input[type="radio"]').checked, true);
  assert.equal(checkout.mock.callCount(), 0);
});

test('checkout clears failed submissions when switching providers and reuses the new key for a retry', async t => {
  t.mock.method(courseApi, 'getById', async () => ({
    data: { id: 42, title: 'Writing skills', price: 250000, status: 'PUBLISHED' },
  }));
  t.mock.method(paymentApi, 'getMethods', async () => ({
    data: [
      { provider: 'VNPAY', available: true, name: 'VNPay' },
      { provider: 'MOCK', available: true, name: 'Mock Pay' },
    ],
  }));
  const requests = [];
  t.mock.method(paymentApi, 'createCheckout', async payload => {
    requests.push(payload);
    if (requests.length < 3) throw new Error('Gateway busy');
    return { data: { checkoutUrl: `${ROUTES.PAYMENT_MOCK}?orderCode=COURSE-42` } };
  });

  await render(`${ROUTES.CHECKOUT}?course=42`);
  const submit = () => env.click('.checkout-submit');
  await env.click(document.querySelectorAll('input[type="radio"]')[0]);
  await submit();
  assert.match(document.body.textContent, /Gateway busy/);
  await env.click(document.querySelectorAll('input[type="radio"]')[1]);
  assert.doesNotMatch(document.body.textContent, /Gateway busy/);
  await submit();
  await submit();
  assert.equal(document.querySelector('output').textContent, '?orderCode=COURSE-42');
  assert.deepEqual(
    requests.map(({ provider }) => provider),
    ['VNPAY', 'MOCK', 'MOCK'],
  );
  assert.equal(requests[2].courseId, 42);
  assert.notEqual(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.equal(requests[1].idempotencyKey, requests[2].idempotencyKey);
});
