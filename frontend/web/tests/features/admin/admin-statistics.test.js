import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost/admin/statistics',
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
  cacheDir: 'node_modules/.vite-tests/admin-statistics',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: AdminStatisticsPage } = await load('features/admin/pages/AdminStatisticsPage.jsx');
const { default: AdminDashboardPage } = await load('features/admin/pages/AdminDashboardPage.jsx');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const originalAdminApi = { ...adminApi };
const cache = createCache({ key: 'admin-statistics-test' });
let root;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  Object.assign(adminApi, originalAdminApi);
});

after(async () => {
  await server.close();
  dom.window.close();
});

const allPermissions = [
  'ADMIN_ACCESS',
  'DASHBOARD_VIEW',
  'PAYMENT_REPORT_VIEW',
  'LEARNING_REPORT_VIEW',
  'COURSE_VIEW',
  'PRO_MEMBER_VIEW',
  'PRO_CODE_VIEW',
  'ENGAGEMENT_VIEW',
  'SHOP_VIEW',
];

async function render(Component, permissions = allPermissions) {
  root = createRoot(document.getElementById('root'));
  const user = { id: 1, fullName: 'Admin Test', roles: ['ADMIN'], status: 'ACTIVE', permissions };
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(AuthContext.Provider, { value: { user } }, h(MemoryRouter, null, h(Component))),
      ),
    ),
  );
}

async function click(label) {
  const button = [...document.querySelectorAll('button')].find(
    node => node.textContent.trim() === label,
  );
  assert.ok(button, `Button exists: ${label}`);
  await act(async () => button.click());
}

test('revenue tab uses shared CommercePager pagination for recent and server transactions', async () => {
  const recentTransactions = Array.from({ length: 12 }, (_, i) => ({
    orderCode: `ORD-${String(i + 1).padStart(2, '0')}`,
    userId: 100 + i,
    courseTitle: `Course ${i + 1}`,
    amount: 250000,
    currency: 'VND',
    status: i % 2 === 0 ? 'SUCCESS' : 'PENDING',
    provider: 'VNPAY',
    createdAt: '2026-11-18T10:00:00Z',
  }));
  const serverCalls = [];
  adminApi.payments = async () => ({
    data: {
      totalOrders: 15,
      pendingPayments: 5,
      successfulPayments: 9,
      failedPayments: 1,
      grossRevenue: 2250000,
      pendingAmount: 750000,
      refundedAmount: 0,
      crossService: { activeLearners: 8, paidCourses: 4, enrollmentReady: 9 },
      revenueSeries: [{ label: '18/11', amount: 2250000, orders: 9 }],
      recentTransactions,
      generatedAt: '2026-11-19T00:00:00Z',
    },
  });
  adminApi.paymentOrders = async params => {
    serverCalls.push(params);
    return {
      data: {
        content: [
          {
            orderCode: `SRV-P${params.page}`,
            userId: 999,
            courseTitle: 'Server Paginated Course',
            amount: 500000,
            currency: 'VND',
            paymentStatus: 'SUCCESS',
            provider: 'VNPAY',
            createdAt: '2026-11-19T00:00:00Z',
          },
        ],
        totalElements: 25,
        totalPages: 3,
      },
    };
  };

  await render(AdminStatisticsPage, ['PAYMENT_REPORT_VIEW']);
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 1–10 \/ 12 kết quả/);
  assert.match(document.body.textContent, /ORD-01/);
  assert.doesNotMatch(document.body.textContent, /ORD-11/);

  const page2Btn = document.querySelector('.admin-pagination button[aria-label="Go to page 2"]');
  assert.ok(page2Btn, 'Page 2 pagination button exists');
  await act(async () => page2Btn.click());
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 11–12 \/ 12 kết quả/);
  assert.match(document.body.textContent, /ORD-11/);

  await click('Tất cả lịch sử');
  assert.equal(serverCalls.length, 1);
  assert.deepEqual(serverCalls[0], { page: 0, size: 10 });
  assert.match(document.body.textContent, /SRV-P0/);
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 1–1 \/ 25 kết quả/);
});

test('progress, courses and commerce tabs render enriched visualizations and shared pagination', async () => {
  adminApi.payments = async () => ({
    data: { grossRevenue: 0, refundedAmount: 0, successfulPayments: 0, recentTransactions: [] },
  });
  adminApi.learning = async () => ({
    data: {
      enrollments: 25,
      completed: 10,
      activeEnrollments: 15,
      completionRate: 40,
      lessonsCompleted: 120,
      totalStudyMinutes: 540,
      quizAttempts: 30,
      quizPassed: 24,
      quizPassRate: 80,
      avgQuizScore: 84.5,
      toeicAttempts: 12,
      avgToeicScore: 76.0,
      dictationAttempts: 18,
      activeStreaks: 9,
      dailyActivity: [{ date: '2026-11-19', label: '19/11', learners: 7, activities: 22 }],
      courseProgress: Array.from({ length: 12 }, (_, i) => ({
        courseId: i + 1,
        enrollments: 10 + i,
        completed: 4,
        active: 6 + i,
      })),
    },
  });
  adminApi.courses = async () => ({
    data: {
      total: 12,
      published: 10,
      draft: 1,
      archived: 1,
      freeCourses: 3,
      paidCourses: 9,
      totalLessons: 95,
      totalReviews: 40,
      avgRating: 4.75,
      categories: [{ name: 'TOEIC', count: 7 }, { name: 'IELTS', count: 5 }],
      levels: [{ level: 'BEGINNER', count: 6 }, { level: 'INTERMEDIATE', count: 6 }],
      recent: [],
      courses: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        title: `English Mastery ${i + 1}`,
        status: 'PUBLISHED',
        level: 'BEGINNER',
        price: i === 0 ? 0 : 490000,
        avgRating: 4.8,
        reviewCount: 5,
        lessonCount: 8,
        categoryName: 'TOEIC',
      })),
    },
  });
  adminApi.commerceAnalytics = async () => ({
    data: {
      range: { from: '2026-10-21', to: '2026-11-19' },
      previousRange: { from: '2026-09-21', to: '2026-10-20' },
      asOf: '2026-11-19T10:00:00Z',
      snapshot: { ownedItems: 20, equippedItems: 10, freezesInWallets: 4, equipRate: 50 },
      current: { purchases: 15, buyers: 8, gemSpent: 500, freezePurchases: 3, freezeUses: 2, unclassifiedReceipts: 0 },
      previous: { purchases: 10, buyers: 5, gemSpent: 300, freezePurchases: 1, freezeUses: 1, unclassifiedReceipts: 0 },
      trend: [{ range: { from: '2026-11-10', to: '2026-11-19' }, current: 15, previous: 10 }],
      details: Array.from({ length: 11 }, (_, i) => ({
        code: `ITEM_${i + 1}`,
        name: `Vật phẩm ${i + 1}`,
        type: 'FRAME',
        currentPrice: 50,
        purchases: 15 - i,
        gemSpent: 150,
        owners: 5,
        equipped: 3,
        equipRate: 60,
      })),
    },
  });

  await render(AdminStatisticsPage);

  await click('Tiến độ & Kết quả học');
  assert.match(document.body.textContent, /120/);
  assert.match(document.body.textContent, /80%/);
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 1–10 \/ 12 kết quả/);

  await click('Hiệu quả Khóa học');
  assert.match(document.body.textContent, /English Mastery 1/);
  assert.doesNotMatch(document.body.textContent, /English Mastery 12/);
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 1–10 \/ 12 kết quả/);

  await click('Cửa hàng & Kho đồ');
  assert.match(document.body.textContent, /\+50%/);
  assert.match(document.querySelector('.admin-pagination').textContent, /Hiển thị 1–10 \/ 11 kết quả/);
});

test('dashboard displays shortcut to detailed statistics page', async () => {
  adminApi.overview = async () => ({ data: { total: 10, active: 8, newThisWeek: 2, monthly: [] } });
  adminApi.courses = async () => ({ data: { total: 4, published: 3, categories: [], recent: [] } });
  adminApi.learning = async () => ({ data: { enrollments: 5, completed: 2, completionRate: 40 } });
  adminApi.payments = async () => ({
    data: { grossRevenue: 100000, revenueSeries: [], recentTransactions: [] },
  });

  await render(AdminDashboardPage, ['DASHBOARD_VIEW', 'COURSE_VIEW', 'LEARNING_REPORT_VIEW', 'PAYMENT_REPORT_VIEW']);
  const link = [...document.querySelectorAll('a')].find(a => a.textContent.includes('Thống kê chi tiết'));
  assert.ok(link, 'Dashboard should include link to detailed statistics');
  assert.equal(link.getAttribute('href'), '/admin/statistics');
});
