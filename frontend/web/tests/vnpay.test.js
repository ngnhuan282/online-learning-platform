import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import {
  getCheckoutErrorMessage,
  getPaymentDisplayStatus,
  getResumePaymentUrl,
  needsPaymentRefresh,
  readCheckoutRedirect,
} from '../src/features/payment/utils/paymentFlow.js';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:5173' });
const cache = createCache({ key: 'vnpay-test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: PaymentResultPage } = await load('features/payment/pages/PaymentResultPage.jsx');
const { default: PaymentCheckoutPage } = await load('features/payment/pages/PaymentCheckoutPage.jsx');
const { default: PaymentHistoryPage } = await load('features/payment/pages/PaymentHistoryPage.jsx');
const { default: client } = await load('shared/apis/axiosClient.js');
const originalAdapter = client.defaults.adapter;
let root;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  client.defaults.adapter = originalAdapter;
});
after(async () => {
  await server.close();
  dom.window.close();
});

function order(status = 'PENDING', overrides = {}) {
  return {
    orderCode: 'LS-PAY-TEST-1',
    totalAmount: 1490000,
    currency: 'VND',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    items: [{ courseId: 101, courseTitle: 'IELTS nền tảng' }],
    payment: {
      provider: 'VNPAY',
      status,
      amount: 1490000,
      currency: 'VND',
      checkoutUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=LS-PAY-TEST-1',
      enrollmentReady: status === 'SUCCESS',
      ...overrides,
    },
  };
}

async function mount(data, search = '?orderCode=LS-PAY-TEST-1', adapter, Component = PaymentResultPage) {
  client.defaults.adapter =
    adapter ||
    (async config => ({
      config,
      status: 200,
      headers: {},
      data: { success: true, data },
    }));
  root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(MemoryRouter, { initialEntries: [`/payment/result${search}`] }, h(Component)),
      ),
    );
  });
}

test('only trusted provider checkout URLs can redirect, without production hosts or unsafe schemes', () => {
  const origin = 'http://localhost:5173';
  assert.equal(readCheckoutRedirect('/payment/mock?orderCode=x', 'MOCK', origin).origin, origin);
  assert.equal(
    readCheckoutRedirect(order().payment.checkoutUrl, 'VNPAY', origin).hostname,
    'sandbox.vnpayment.vn',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://untrusted.test/payment',
    'https://sandbox.vnpayment.vn/other',
    'https://sandbox.vnpayment.vn@untrusted.test/paymentv2/vpcpay.html',
  ]) {
    assert.throws(() => readCheckoutRedirect(url, 'VNPAY', origin), /Không thể mở/);
  }
});

test('pending VNPay resumes its stored URL, never the Mock gateway or an expired checkout', () => {
  const origin = 'http://localhost:5173';
  const payment = order();
  assert.equal(getResumePaymentUrl(payment, origin), payment.payment.checkoutUrl);
  assert.equal(getResumePaymentUrl({ ...payment, expiresAt: '2025-01-01T00:00:00Z' }, origin), null);
  assert.equal(getResumePaymentUrl({ ...payment, status: 'EXPIRED' }, origin), null);
  assert.equal(getResumePaymentUrl(order('SUCCESS'), origin), null);
  assert.equal(
    getResumePaymentUrl(order('PENDING', { checkoutUrl: 'https://untrusted.test' }), origin),
    null,
  );
  assert.match(getResumePaymentUrl(order('PENDING', { provider: 'MOCK' }), origin), /^\/payment\/mock\?/);
});

test('expired checkout display is distinct from a provider outcome and never expires Mock or paid records', () => {
  const pending = { ...order(), expiresAt: '2025-01-01T00:00:00Z' };
  assert.equal(getPaymentDisplayStatus(pending), 'EXPIRED');
  assert.equal(getPaymentDisplayStatus({ ...order(), status: 'EXPIRED' }), 'EXPIRED');
  assert.equal(
    getPaymentDisplayStatus({ ...pending, payment: { provider: 'MOCK', status: 'PENDING' } }),
    'PENDING',
  );
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']) {
    assert.equal(getPaymentDisplayStatus({ ...order(status), expiresAt: pending.expiresAt }), status);
  }
  assert.equal(
    getPaymentDisplayStatus({
      paymentStatus: 'PENDING',
      provider: 'VNPAY',
      orderStatus: 'EXPIRED',
    }),
    'EXPIRED',
  );
  assert.equal(
    getPaymentDisplayStatus({
      status: 'PENDING',
      provider: 'VNPAY',
      expiresAt: pending.expiresAt,
    }),
    'EXPIRED',
  );
  assert.match(getCheckoutErrorMessage({ code: 'CHECKOUT_EXPIRED' }), /hết hạn thanh toán/);
});

test('expired result cannot resume old checkout or claim failure while confirmation may arrive late', async () => {
  await mount({ ...order(), status: 'EXPIRED', expiresAt: '2025-01-01T00:00:00Z' });
  assert.match(document.body.textContent, /Đơn đã hết hạn thanh toán/);
  assert.match(document.body.textContent, /kiểm tra kết quả trước khi tạo giao dịch mới/);
  assert.equal(document.querySelector('a[href^="https://sandbox.vnpayment.vn/"]'), null);
  assert.ok(document.querySelector('a[href="/checkout?course=101"]'));
  assert.doesNotMatch(document.body.textContent, /Thanh toán không thành công|Vào khu học tập/);
});

test('a late confirmed payment shows success despite the expired checkout deadline', async () => {
  await mount({ ...order('SUCCESS'), expiresAt: '2025-01-01T00:00:00Z' });
  assert.match(document.body.textContent, /Thanh toán thành công/);
  assert.ok(document.querySelector('a[href="/my-courses"]'));
  assert.doesNotMatch(document.body.textContent, /Đơn đã hết hạn thanh toán/);
});

test('history shows expiry and its filter sends no invented provider status', async () => {
  const seen = [];
  const history = {
    content: [
      {
        orderCode: 'LS-PAY-TEST-1',
        courseTitle: 'IELTS nền tảng',
        amount: 1490000,
        paymentStatus: 'PENDING',
        provider: 'VNPAY',
        orderStatus: 'EXPIRED',
        expiresAt: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        paidAt: null,
      },
    ],
    totalElements: 1,
    totalPages: 1,
  };
  await mount(
    null,
    '',
    async config => {
      seen.push(config);
      return { config, status: 200, headers: {}, data: { success: true, data: history } };
    },
    PaymentHistoryPage,
  );
  assert.match(document.querySelector('.payment-status').textContent, /Hết hạn thanh toán/);
  const select = document.querySelector('select[aria-label="Lọc trạng thái thanh toán"]');
  await act(async () => {
    select.value = 'EXPIRED';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(seen.at(-1).params.expired, true);
  assert.equal(seen.at(-1).params.status, undefined);
});

test('checkout uses the VNPay name and caption without a test badge', async () => {
  await mount(
    null,
    '?course=101',
    async config => {
      const data = config.url.endsWith('/methods')
        ? [
            {
              provider: 'MOCK',
              label: 'Thanh toán mô phỏng',
              description: 'Không phát sinh thanh toán thật',
              available: true,
            },
            { provider: 'VNPAY', label: 'VNPay', description: 'Thanh toán qua VNPay', available: true },
          ]
        : {
            id: 101,
            title: 'IELTS nền tảng',
            status: 'PUBLISHED',
            price: 1490000,
          };
      return { config, status: 200, headers: {}, data: { success: true, data } };
    },
    PaymentCheckoutPage,
  );
  const methods = [...document.querySelectorAll('.payment-method')];
  assert.equal(methods[1].querySelector('b').textContent, 'VNPay');
  assert.equal(methods[1].querySelector('small').textContent, 'Thanh toán qua VNPay');
  assert.equal(methods[1].querySelector('.payment-test-badge'), null);
  assert.ok(document.querySelector('input[value="MOCK"]').checked);
});

test('only unresolved provider payments need refresh and checkout errors are readable', () => {
  assert.equal(needsPaymentRefresh(order()), true);
  assert.equal(needsPaymentRefresh(order('SUCCESS', { enrollmentReady: false })), true);
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']) {
    assert.equal(needsPaymentRefresh(order(status)), false);
  }
  assert.equal(needsPaymentRefresh(order('PENDING', { provider: 'MOCK' })), false);
  assert.match(getCheckoutErrorMessage({ code: 'VNPAY_UNAVAILABLE' }), /chưa sẵn sàng/);
  assert.match(getCheckoutErrorMessage({ code: 'CONFLICT' }), /lịch sử thanh toán/);
});

test('forged query status cannot display success while backend waits for IPN', async () => {
  await mount(order(), '?orderCode=LS-PAY-TEST-1&status=success');
  assert.match(document.body.textContent, /Đang chờ xác nhận từ VNPay/);
  assert.doesNotMatch(document.body.textContent, /Vào khu học tập/);
  assert.equal(document.querySelector('a[href^="/payment/mock"]'), null);
  assert.ok(document.querySelector('a[href^="https://sandbox.vnpayment.vn/"]'));
});

test('stored provider success wins over a failed query status and opens learning', async () => {
  await mount(order('SUCCESS'), '?orderCode=LS-PAY-TEST-1&status=failed');
  assert.match(document.body.textContent, /Thanh toán thành công/);
  assert.ok(document.querySelector('a[href="/my-courses"]'));
});

test('failure and cancellation use distinct result copy', async () => {
  await mount(order('FAILED'));
  assert.match(document.body.textContent, /Thanh toán không thành công/);
  await act(async () => root.unmount());
  root = null;
  await mount(order('CANCELLED'));
  assert.match(document.body.textContent, /Bạn đã hủy thanh toán/);
});

test('result uses the plain VNPay name and preserves the Mock method label', async () => {
  await mount(order('CANCELLED'));
  assert.equal(document.querySelector('.result-details div:last-child dd').textContent, 'VNPay');
  await act(async () => root.unmount());
  root = null;
  await mount(order('CANCELLED', { provider: 'MOCK' }));
  assert.equal(
    document.querySelector('.result-details div:last-child dd').textContent,
    'Thanh toán mô phỏng',
  );
});

test('paid but delayed activation retries the existing order without another checkout', async () => {
  const seen = [];
  let activated = false;
  await mount(null, undefined, async config => {
    seen.push(config);
    if (config.method === 'post') activated = true;
    return {
      config,
      status: 200,
      headers: {},
      data: { success: true, data: order('SUCCESS', { enrollmentReady: activated }) },
    };
  });
  assert.match(document.body.textContent, /không cần thanh toán lại/);
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
  const retry = [...document.querySelectorAll('button')].find(button =>
    button.textContent.includes('Thử kích hoạt'),
  );
  await act(async () => retry.click());
  assert.ok(document.querySelector('a[href="/my-courses"]'));
  assert.equal(seen.filter(config => config.method === 'post').length, 1);
  assert.match(seen.find(config => config.method === 'post').url, /orders\/LS-PAY-TEST-1\/activation$/);
  assert.equal(
    seen.some(config => config.url.endsWith('/checkout')),
    false,
  );
});

test('invalid provider return explains verification failure without exposing an order or trusting query status', async () => {
  let requests = 0;
  await mount(null, '?callbackError=invalid&status=success', async () => {
    requests += 1;
    throw Error('Unexpected request');
  });
  assert.match(document.body.textContent, /Không thể xác minh thông tin trả về từ VNPay/);
  assert.equal(requests, 0);
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
});
