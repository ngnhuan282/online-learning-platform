import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'mock-payment' });
const { default: MockPayment } = await env.load('features/payment/pages/MockPaymentPage.jsx');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

function Destination() {
  const { pathname, search } = useLocation();
  return h('output', null, pathname + search);
}
const render = query =>
  env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/payment/mock' + query] },
      h(
        Routes,
        null,
        h(Route, { path: '/payment/mock', element: h(MockPayment) }),
        h(Route, { path: '*', element: h(Destination) }),
      ),
    ),
  );

test('mock payment keeps the order after a conflict and returns to the result when course activation is delayed', async t => {
  t.mock.method(paymentApi, 'getOrder', async () => ({
    data: {
      orderCode: 'ORD-71',
      items: [{ courseId: 7, courseTitle: 'Reading' }],
      payment: { status: 'PENDING' },
    },
  }));
  let attempts = 0;
  const complete = t.mock.method(paymentApi, 'completeMockPayment', async () => {
    if (++attempts === 1) throw Object.assign(new Error('Conflict'), { status: 409 });
  });
  const enroll = t.mock.method(learningApi, 'enroll', async () => {
    throw new Error('Enrollment delayed');
  });
  const warn = t.mock.method(console, 'warn', () => {});

  await render('?orderCode=ORD-71&returnUrl=http%3A%2F%2F%5B');
  await env.click(env.button('Thanh toán thất bại'));
  assert.match(document.body.textContent, /không còn ở trạng thái chờ/);
  await env.click(env.button('Thanh toán thành công'));
  assert.deepEqual(
    complete.mock.calls.map(call => call.arguments[1].status),
    ['FAILED', 'SUCCESS'],
  );
  assert.deepEqual(enroll.mock.calls[0].arguments, [7]);
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(
    document.querySelector('output').textContent,
    '/payment/result?orderCode=ORD-71&status=success',
  );
});

test('mock payment without an order offers links without contacting the payment API', async t => {
  const order = t.mock.method(paymentApi, 'getOrder', async () => assert.fail('Missing order'));
  await render('');
  assert.match(document.body.textContent, /Thiếu mã giao dịch/);
  assert.equal(order.mock.callCount(), 0);
});
