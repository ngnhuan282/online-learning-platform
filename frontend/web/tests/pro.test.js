import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
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
  cacheDir: 'node_modules/.vite-tests/pro',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = name => server.ssrLoadModule('/src/' + name);
const { default: ProPage } = await load('features/pro/pages/ProPage.jsx');
const { default: ProCheckoutPage } = await load('features/payment/pages/ProCheckoutPage.jsx');
const { default: AdminProCodesPage } = await load('features/pro/pages/AdminProCodesPage.jsx');
const { default: ProUpgradeButton } = await load('shared/components/ProUpgradeButton.jsx');
const { default: LanguageSwitcher } = await load('shared/components/LanguageSwitcher.jsx');
const { proApi } = await load('features/pro/api/proApi.js');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { ProContext } = await load('features/pro/context/ProContext.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { setLocale } = await load('shared/i18n/locale.js');
const original = [proApi, paymentApi].map(api => [api, { ...api }]);
const cache = createCache({ key: 'pro-test' });
let root, refreshes;
const plans = [
  { code: 'PRO_MONTH', durationMonths: 1, price: 50000, originalPrice: 50000, currency: 'VND' },
  { code: 'PRO_QUARTER', durationMonths: 3, price: 120000, originalPrice: 150000, currency: 'VND' },
  { code: 'PRO_YEAR', durationMonths: 12, price: 499000, originalPrice: 600000, currency: 'VND' },
];
function LoginEcho() {
  const { state } = useLocation();
  return h('p', { id: 'login-gate' }, `Login from:${state?.from || ''}`);
}

const defaultUser = {
  id: 1,
  fullName: 'Pro Learner',
  roles: ['ADMIN'],
  permissions: ['ADMIN_ACCESS', 'PRO_CODE_VIEW', 'PRO_CODE_CREATE', 'PRO_CODE_REVOKE'],
};

async function render(path = '/pro', membership = { userId: 1, active: false }, user = defaultUser) {
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user } },
          h(
            ProContext.Provider,
            {
              value: {
                membership,
                refresh() {
                  refreshes++;
                },
              },
            },
            h(
              MemoryRouter,
              { initialEntries: [path] },
              h(LanguageSwitcher),
              user && h(ProUpgradeButton),
              h(
                Routes,
                null,
                h(Route, { path: '/login', element: h(LoginEcho) }),
                h(Route, { path: '/courses', element: h('p', null, 'Courses') }),
                h(Route, { path: '/pro', element: h(ProPage) }),
                h(Route, { path: '/payment/pro-checkout', element: h(ProCheckoutPage) }),
                h(Route, { path: '/admin/pro-codes', element: h(AdminProCodesPage) }),
                h(Route, { path: '/payment/mock', element: h('p', null, 'Mock checkout') }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
function button(text) {
  const value = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
  assert.ok(value, 'Missing button: ' + text);
  return value;
}
async function click(text) {
  await act(async () => button(text).click());
}
async function input(element, value) {
  const prototype =
    element.tagName === 'SELECT'
      ? dom.window.HTMLSelectElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(
      new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
    );
  });
}
beforeEach(() => {
  refreshes = 0;
  setLocale('vi');
  proApi.plans = async () => ({ data: plans });
  paymentApi.getMethods = async () => ({
    data: [
      {
        provider: 'MOCK',
        label: 'Thanh toán mô phỏng',
        description: 'Không phát sinh thanh toán thật',
        available: true,
      },
    ],
  });
  proApi.codes = async () => ({ data: [] });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  original.forEach(([api, methods]) => Object.assign(api, methods));
  setLocale('vi');
});
after(async () => {
  await server.close();
  dom.window.close();
});

test('Pro uses the three server prices, changes duration and translates without changing selection', async () => {
  await render();
  assert.match(document.querySelector('.pro-price-block strong').textContent, /499.000/);
  await click('1 tháng');
  assert.match(document.querySelector('.pro-price-block strong').textContent, /50.000/);
  await click('3 tháng');
  assert.match(document.querySelector('.pro-price-block strong').textContent, /120.000/);
  await act(async () => document.querySelector('.language-switcher').click());
  await act(async () => document.querySelector('.language-menu-paper [lang="en"]').click());
  assert.match(document.body.textContent, /Choose the right plan/);
  assert.equal(document.querySelector('.pro-periods [aria-pressed=true]').textContent, '3 months');
  await click('Subscribe now');
  assert.match(document.querySelector('.payment-method-list').textContent, /Simulated payment/);
  assert.match(document.querySelector('.checkout-total').textContent, /120,000/);
});

test('Pro checkout retries the same identity and sends plan only with no client amount or user ID', async () => {
  const requests = [];
  let finish;
  paymentApi.createProCheckout = payload => {
    requests.push(payload);
    if (requests.length === 1) return Promise.reject({ code: 'NETWORK_ERROR' });
    return new Promise(resolve => {
      finish = resolve;
    });
  };
  await render();
  await click('Đăng ký ngay');
  await click('Tiếp tục thanh toán');
  assert.ok(document.querySelector('.checkout-error[role=alert]'));
  await click('Thử lại thanh toán');
  assert.equal(button('Đang tạo giao dịch...').disabled, true);
  await click('Đang tạo giao dịch...');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.equal(requests[0].planCode, 'PRO_YEAR');
  assert.equal(requests[0].amount, undefined);
  assert.equal(requests[0].userId, undefined);
  await act(async () => finish({ data: { checkoutUrl: '/payment/mock?orderCode=PRO-TEST' } }));
  await act(async () => new Promise(resolve => setTimeout(resolve, 300)));
  assert.match(document.body.textContent, /Mock checkout/);
});

test('activation reports unavailable codes and refreshes membership after a valid redemption', async () => {
  proApi.redeem = async () => {
    throw { code: 'INVALID_ACTIVATION_CODE' };
  };
  await render();
  await input(document.getElementById('pro-code'), 'CCG-invalid');
  await click('Kích hoạt');
  assert.match(document.body.textContent, /Mã không hợp lệ/);
  const requests = [];
  proApi.redeem = async code => {
    requests.push(code);
    return { data: { active: true } };
  };
  await input(document.getElementById('pro-code'), 'CCG-valid-code');
  await click('Kích hoạt');
  assert.deepEqual(requests, ['CCG-valid-code']);
  assert.equal(refreshes, 1);
  assert.equal(document.getElementById('pro-code').value, '');
  assert.match(document.body.textContent, /Đã kích hoạt Pro thành công/);
});

test('unavailable payment methods disable checkout while activation remains available', async () => {
  paymentApi.getMethods = async () => ({ data: [] });
  await render();
  await input(document.getElementById('pro-code'), 'CCG-valid-code');
  assert.equal(button('Kích hoạt').disabled, false);
  await click('Đăng ký ngay');
  assert.equal(button('Tiếp tục thanh toán').disabled, true);
  assert.match(document.body.textContent, /Hiện chưa có phương thức thanh toán khả dụng/);
});

test('admin issuance shows the full code once and keeps only masked codes after a fresh view', async () => {
  const raw = 'CCG-1111-2222-3333-4444-5555-6666-7777-8888';
  const info = {
    id: 1,
    maskedCode: 'CCG-••••-8888',
    durationMonths: 1,
    createdAt: '2030-01-01T00:00:00Z',
    status: 'AVAILABLE',
  };
  proApi.createCode = async () => {
    proApi.codes = async () => ({ data: [info] });
    return { data: { code: raw, info } };
  };
  await render('/admin/pro-codes');
  await click('Tạo mã kích hoạt');
  await click('Tạo mã');
  assert.match(document.querySelector('.pro-issued-code').textContent, /CCG-1111/);
  await act(async () => root.unmount());
  root = null;
  await render('/admin/pro-codes');
  assert.equal(document.querySelector('.pro-issued-code'), null);
  assert.equal(document.body.textContent.includes(raw), false);
  assert.match(document.body.textContent, /8888/);
});

test('an active member sees the management entry and renewal action with their expiry', async () => {
  await render('/pro', {
    userId: 1,
    active: true,
    expiresAt: '2030-04-15T03:00:00Z',
    planCode: 'PRO_QUARTER',
  });
  assert.equal(document.querySelector('.header-pro-button').getAttribute('href'), '/pro');
  assert.equal(document.querySelector('.header-pro-button').getAttribute('aria-label'), 'Pro của bạn');
  assert.ok(document.querySelector('.pro-membership-card.is-pro'));
  assert.equal(button('Gia hạn Pro').disabled, false);
});

test('guests preview Pro plans and pricing, while activation code redirects to login', async () => {
  await render('/pro', null, null);
  assert.equal(document.querySelector('.pro-membership-card'), null);
  assert.equal(document.querySelector('.free-action')?.getAttribute('href'), '/courses');
  assert.match(document.querySelector('.pro-price-block strong').textContent, /499.000/);
  await click('1 tháng');
  assert.match(document.querySelector('.pro-price-block strong').textContent, /50.000/);
  await click('Kích hoạt');
  assert.equal(document.getElementById('login-gate')?.textContent, 'Login from:/pro');
});
