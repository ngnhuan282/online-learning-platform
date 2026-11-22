import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-dashboard' });
const { default: Dashboard } = await env.load('features/admin/pages/AdminDashboardPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { adminApi } = await env.load('features/admin/api/adminApi.js');

afterEach(env.unmount);
after(env.close);

test('dashboard renders genuine category and transaction rows while a failed payment source can be retried', async t => {
  t.mock.method(adminApi, 'overview', async () => ({
    data: { total: 18, monthly: [{ month: '2026-10', count: 7 }] },
  }));
  t.mock.method(adminApi, 'courses', async () => ({
    data: {
      total: 3,
      categories: [
        { name: 'Reading', count: 2 },
        { name: 'Writing', count: 1 },
      ],
      recent: [{ id: 9, title: 'Writing course', price: 250000 }],
    },
  }));
  let paymentAttempts = 0;
  const payments = t.mock.method(adminApi, 'payments', async () => {
    if (++paymentAttempts === 1) throw new Error('Payments offline');
    return {
      data: {
        revenueSeries: [{ label: 'Oct 1', amount: 200000, orders: 1 }],
        recentTransactions: ['SUCCESS', 'FAILED', 'REFUNDED', 'PENDING'].map((paymentStatus, index) => ({
          orderCode: `ORDER-${index}`,
          userId: 7,
          courseTitle: 'Writing course',
          paymentStatus,
          amount: 200000,
          currency: 'VND',
          createdAt: '2026-10-01T00:00:00Z',
        })),
      },
    };
  });
  const user = {
    id: 1,
    roles: ['STAFF'],
    permissions: ['DASHBOARD_VIEW', 'COURSE_VIEW', 'PAYMENT_REPORT_VIEW'],
  };
  await env.render(h(MemoryRouter, null, h(AuthContext.Provider, { value: { user } }, h(Dashboard))));
  assert.match(document.body.textContent, /Reading/);
  assert.ok(document.querySelector('.admin-bar-column'));
  assert.doesNotMatch(document.body.textContent, /ORDER-0/);
  await env.click(env.button('Làm mới dữ liệu'));
  assert.equal(payments.mock.callCount(), 2);
  const rows = [...document.querySelectorAll('table tbody tr')]
    .map(row => row.textContent)
    .filter(text => /ORDER-\d/.test(text));
  assert.equal(rows.length, 4);
  assert.match(rows[0], /ORDER-0.*Thành công/);
  assert.match(rows[1], /ORDER-1.*Thất bại/);
});
