import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.FormData = dom.window.FormData;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.ShadowRoot = dom.window.ShadowRoot;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/integration-pages',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: ResultPage } = await load('features/payment/pages/PaymentResultPage.jsx');
const { default: LearningPage } = await load('features/learning/pages/LearningPage.jsx');
const { default: GemCheckoutPage } = await load('features/payment/pages/GemCheckoutPage.jsx');
const { default: MockPaymentPage } = await load('features/payment/pages/MockPaymentPage.jsx');
const { default: AdminCategoryPage } = await load('features/courses/pages/AdminCategoryPage.jsx');
const { default: AccountPage } = await load('features/auth/pages/AccountPage.jsx');
const { default: AdminAccountsPage } = await load('features/admin/pages/AdminAccountsPage.jsx');
const { default: AdminPaymentDetailPage } = await load('features/payment/pages/AdminPaymentDetailPage.jsx');
const { default: CommunityPostPage } = await load('features/community/pages/CommunityPostPage.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { userApi } = await load('features/auth/api/userApi.js');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { communityApi } = await load('features/community/api/communityApi.js');
const { ToastContext } = await load('shared/context/ToastContext.jsx');
const originals = [paymentApi, learningApi, categoryApi, userApi, adminApi, communityApi].map(api => [
  api,
  { ...api },
]);
let root;
const cache = createCache({ key: 'integration-test' });
const order = status => ({
  data: {
    orderCode: 'test-order',
    totalAmount: 100000,
    currency: 'VND',
    items: [{ courseId: 42, courseTitle: 'Real course' }],
    payment: { status, amount: 100000, currency: 'VND', provider: 'MOCK' },
  },
});

function Destination() {
  const { pathname, search } = useLocation();
  return h('output', { id: 'destination' }, pathname + search);
}

async function render(Component, path, route, auth = {}) {
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          ToastContext.Provider,
          { value: () => {} },
          h(
            AuthContext.Provider,
            { value: auth },
            h(
              MemoryRouter,
              { initialEntries: [path] },
              h(
                Routes,
                null,
                h(Route, { path: route, element: h(Component) }),
                h(Route, { path: '*', element: h(Destination) }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

async function clickButton(label, container = document) {
  const button = [...container.querySelectorAll('button')].find(
    control => control.textContent.trim() === label || control.getAttribute('aria-label') === label,
  );
  assert.ok(button, `Missing button ${label}`);
  assert.equal(button.disabled, false, label);
  await act(async () => button.click());
}

async function editValue(selector, value) {
  const control = document.querySelector(selector);
  assert.ok(control, `Missing field ${selector}`);
  const setValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value').set;
  await act(async () => {
    setValue.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('a forum author can edit the question, choose a reply, and remove their own comment after confirming', async () => {
  const date = '2026-11-21T09:00:00Z';
  const writes = [];
  let post = {
    id: 71,
    authorId: 13,
    authorName: 'Mai',
    title: 'Listening question',
    body: 'How do I practise with short clips?',
    topicCode: 'TOEIC',
    topicId: 2,
    kind: 'QUESTION',
    createdAt: date,
    commentCount: 1,
  };
  let replies = [
    { id: 8, authorId: 14, authorName: 'Linh', body: 'Repeat the shortest clip', createdAt: date },
  ];
  communityApi.topics = async () => ({ data: [{ id: 2, code: 'TOEIC' }] });
  communityApi.post = async () => ({ data: post });
  communityApi.comments = async () => ({ data: { content: replies, totalPages: 1 } });
  communityApi.update = async (id, payload) => {
    writes.push(['update', id, payload]);
    post = { ...post, ...payload };
  };
  communityApi.answer = async (id, replyId) => {
    writes.push(['answer', id, replyId]);
    post = { ...post, acceptedCommentId: replyId };
  };
  communityApi.addComment = async (id, body) => {
    writes.push(['addComment', id, body]);
    replies = [...replies, { id: 9, authorId: 13, authorName: 'Mai', createdAt: date, body }];
    post = { ...post, commentCount: 2 };
  };
  communityApi.updateComment = async (id, replyId, body) => {
    writes.push(['updateComment', id, replyId, body]);
    replies = replies.map(reply => (reply.id === replyId ? { ...reply, body } : reply));
  };
  communityApi.removeComment = async (id, replyId) => {
    writes.push(['removeComment', id, replyId]);
    replies = replies.filter(reply => reply.id !== replyId);
    post = { ...post, commentCount: 1 };
  };
  await render(CommunityPostPage, '/community/posts/71', '/community/posts/:id', {
    user: { id: 13, roles: ['USER'] },
    isAuthenticated: true,
  });
  await clickButton('Sửa', document.querySelector('.post-detail'));
  await editValue('[role=dialog] input[name=title]', 'Listening with short clips');
  await clickButton('Lưu thay đổi', document.querySelector('[role=dialog]'));
  assert.match(document.querySelector('.post-detail h1').textContent, /Listening with short clips/);

  await clickButton('Chọn làm lời giải', document.querySelector('.comment-list'));
  assert.match(document.querySelector('.accepted-comment').textContent, /Repeat the shortest clip/);
  await clickButton('Bỏ chọn lời giải', document.querySelector('.comment-list'));
  assert.equal(document.querySelector('.accepted-comment'), null);

  await editValue('.community-workspace > form textarea', 'Thanks for the tip');
  await clickButton('Gửi bình luận');
  const ownComment = () => document.querySelector('.comment-list article:last-child');
  await clickButton('Sửa', ownComment());
  await editValue('.comment-list textarea', 'Thanks, that worked');
  await clickButton('Lưu thay đổi', ownComment());
  assert.match(ownComment().textContent, /Thanks, that worked/);
  await clickButton('Xóa', ownComment());
  await clickButton('Xóa', document.querySelector('[role=dialog]'));
  assert.equal(document.querySelectorAll('.comment-list article').length, 1);
  assert.deepEqual(writes, [
    ['update', '71', { topicId: 2, kind: 'QUESTION', title: 'Listening with short clips', body: post.body }],
    ['answer', '71', 8],
    ['answer', '71', null],
    ['addComment', '71', 'Thanks for the tip'],
    ['updateComment', '71', 9, 'Thanks, that worked'],
    ['removeComment', '71', 9],
  ]);
});

const learner = {
  id: 7,
  fullName: 'Lan Nguyen',
  email: 'lan@example.test',
  roles: ['USER'],
  status: 'ACTIVE',
};

test('account profile trims updates and validates password changes before sending them', async () => {
  const profileUpdates = [];
  const passwordChanges = [];
  const synced = [];
  userApi.linkedAccounts = async () => ({ data: { passwordEnabled: true } });
  userApi.updateProfile = async payload => {
    profileUpdates.push(payload);
    return { data: { ...learner, ...payload } };
  };
  userApi.changePassword = async payload => {
    passwordChanges.push(payload);
  };

  await render(AccountPage, '/account', '/account', {
    user: learner,
    updateCurrentUser: user => synced.push(user),
  });
  await editValue('input[placeholder="Nhập họ và tên đầy đủ"]', '  Lan Revised  ');
  await editValue('input[name="phone"]', '0900000010');
  await editValue('textarea[name="biography"]', 'Practising speaking');
  await clickButton('Lưu thông tin');
  assert.deepEqual(profileUpdates[0], {
    fullName: 'Lan Revised',
    avatarUrl: '',
    phone: '0900000010',
    dateOfBirth: null,
    biography: 'Practising speaking',
  });
  assert.equal(synced[0].id, learner.id);
  assert.match(document.body.textContent, /Cập nhật thông tin tài khoản thành công/);

  const [current, next, confirmation] = [
    ...document.querySelectorAll('.account-form-card input[type="password"]'),
  ];
  await editValue(`input[placeholder="${current.placeholder}"]`, 'OldPassword1!');
  await editValue(`input[placeholder="${next.placeholder}"]`, 'noDigitsHere');
  await editValue(`input[placeholder="${confirmation.placeholder}"]`, 'noDigitsHere');
  await clickButton('Đổi mật khẩu');
  assert.equal(passwordChanges.length, 0);
  assert.match(document.querySelector('.account-feedback.is-error').textContent, /chữ hoa, chữ thường và số/);

  await editValue(`input[placeholder="${next.placeholder}"]`, 'NewPassword1!');
  await clickButton('Đổi mật khẩu');
  assert.equal(passwordChanges.length, 0);
  assert.match(document.querySelector('.account-feedback.is-error').textContent, /không khớp/);
  await editValue(`input[placeholder="${confirmation.placeholder}"]`, 'NewPassword1!');
  await clickButton('Đổi mật khẩu');
  assert.deepEqual(passwordChanges, [{ currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' }]);
  assert.equal(next.value, '');
});

test('account administration uses server user details and persists status and name changes', async () => {
  let row = { ...learner };
  const mutations = [];
  userApi.adminListUsers = async () => ({ data: { content: [row], totalPages: 1, totalElements: 1 } });
  userApi.adminGetUser = async id => {
    assert.equal(id, learner.id);
    return { data: { ...row, fullName: 'Current server name' } };
  };
  userApi.adminUpdateStatus = async (id, status) => {
    mutations.push(['status', id, status]);
    row = { ...row, status };
  };
  userApi.adminUpdateUser = async (id, payload) => {
    mutations.push(['profile', id, payload]);
    row = { ...row, ...payload };
  };
  adminApi.roles = async () => ({ data: [{ id: 1, name: 'USER', label: 'Học viên' }] });
  adminApi.overview = async () => ({ data: { total: 1, active: 1, locked: 0 } });
  const staff = { id: 1, roles: ['ADMIN'], permissions: ['USER_VIEW', 'USER_UPDATE', 'USER_STATUS_UPDATE'] };

  await render(AdminAccountsPage, '/admin/users', '/admin/users', { user: staff });
  await clickButton('Xem Lan Nguyen');
  assert.equal(document.querySelector('[role="dialog"] input[type="text"]').value, 'Current server name');
  await clickButton('Đóng', document.querySelector('[role="dialog"]'));
  await clickButton('Đổi trạng thái Lan Nguyen');
  await clickButton('Lưu thay đổi', document.querySelector('[role="dialog"]'));
  assert.match(document.querySelector('tbody').textContent, /Đã khóa/);

  await clickButton('Sửa Lan Nguyen');
  await editValue('[role="dialog"] input[type="text"]', '  Lan Updated  ');
  await clickButton('Lưu thay đổi', document.querySelector('[role="dialog"]'));
  assert.deepEqual(mutations, [
    ['status', learner.id, 'LOCKED'],
    ['profile', learner.id, { fullName: 'Lan Updated', roles: ['USER'] }],
  ]);
  assert.match(document.querySelector('tbody').textContent, /Lan Updated/);
});

function paymentDetail(provider, status, availableStatuses, transactions = []) {
  const stored = order(status).data;
  return {
    data: {
      order: {
        ...stored,
        userId: learner.id,
        status: status === 'FAILED' ? 'CANCELLED' : 'PENDING_PAYMENT',
        expiresAt: '2099-12-01T10:00:00Z',
        createdAt: '2026-11-21T10:00:00Z',
        payment: { ...stored.payment, provider },
      },
      availableStatuses,
      transactions,
    },
  };
}

test('admin confirms a failed mock payment with a trimmed reason and sees the server transaction history', async () => {
  const writes = [];
  const actor = { id: 1, roles: ['ADMIN'] };
  paymentApi.getAdminOrder = async code => {
    assert.equal(code, 'test-order');
    return paymentDetail('MOCK', 'PENDING', ['FAILED']);
  };
  paymentApi.updateAdminOrderStatus = async (code, payload) => {
    writes.push({ code, payload });
    return paymentDetail(
      'MOCK',
      'FAILED',
      [],
      [
        {
          id: 17,
          eventType: 'STATUS_CHANGED',
          status: 'FAILED',
          amount: 100000,
          currency: 'VND',
          createdAt: '2026-11-21T10:10:00Z',
        },
      ],
    );
  };

  await render(AdminPaymentDetailPage, '/admin/payments/test-order', '/admin/payments/:orderCode', {
    user: actor,
  });
  await editValue('.admin-status-form textarea:not([aria-hidden])', '  Provider declined transaction  ');
  await clickButton('Cập nhật trạng thái');
  assert.equal(writes.length, 0);
  assert.match(document.querySelector('[role="dialog"]').textContent, /Xác nhận giao dịch thất bại/);
  await clickButton('Hủy', document.querySelector('[role="dialog"]'));
  assert.equal(writes.length, 0);

  await clickButton('Cập nhật trạng thái');
  await clickButton('Xác nhận thất bại', document.querySelector('[role="dialog"]'));
  assert.deepEqual(writes, [
    {
      code: 'test-order',
      payload: { status: 'FAILED', failureMessage: 'Provider declined transaction' },
    },
  ]);
  assert.equal(document.querySelector('.admin-status-form'), null);
  assert.match(
    document.querySelector('.admin-payment-timeline tbody').textContent,
    /Cập nhật trạng thái.*Thất bại/s,
  );
});

test('an administrator cannot manually set VNPay payment state', async () => {
  paymentApi.getAdminOrder = async () => paymentDetail('VNPAY', 'PENDING', ['SUCCESS']);
  paymentApi.updateAdminOrderStatus = async () => assert.fail('VNPay orders require provider confirmation');

  await render(AdminPaymentDetailPage, '/admin/payments/test-order', '/admin/payments/:orderCode', {
    user: { id: 1, roles: ['ADMIN'] },
  });

  assert.match(
    document.querySelector('.admin-payment-detail-grid--readonly').textContent,
    /Thời hạn thanh toán/,
  );
  assert.equal(document.querySelector('.admin-status-form'), null);
});

test('configured routes resolve their production pages with the expected URL parameters', async () => {
  const { default: router } = await load('app/router.jsx');
  const routes = [
    ['/ai-assistant', 'AiAssistantPage'],
    ['/payment/gem-checkout?package=GEM_500', 'GemCheckoutPage'],
    ['/payment/pro-checkout', 'ProCheckoutPage'],
    ['/admin/dictation', 'AdminDictationPage'],
    ['/admin/shop', 'AdminShopPage'],
    ['/admin/engagement', 'AdminEngagementPage'],
    ['/admin/engagement-rules', 'AdminEngagementRulesPage'],
    ['/admin/pro-plans', 'AdminProPlansPage'],
    ['/admin/pro-members', 'AdminProMembersPage'],
    ['/admin/community', 'AdminCommunityPage'],
    ['/admin/pro-codes', 'AdminProCodesPage'],
    ['/admin/statistics', 'AdminStatisticsPage'],
    ['/admin/toeic', 'AdminToeicPage'],
    ['/admin/notifications', 'AdminNotificationsPage'],
    ['/admin/quizzes', 'AdminQuizPage'],
    ['/admin/courses', 'AdminCoursePage'],
    ['/admin/courses/42/curriculum', 'CurriculumBuilderPage', { courseId: '42' }],
    ['/admin/courses/42/reviews', 'AdminReviewPage', { courseId: '42' }],
    ['/admin/reviews', 'AdminReviewPage'],
    ['/admin/categories', 'AdminCategoryPage'],
    ['/exams/toeic', 'ToeicLibraryPage'],
    ['/exams/toeic/tests/11', 'ToeicReaderPage', { testId: '11' }],
    ['/exams/toeic/attempts/3', 'ToeicAttemptPage', { attemptId: '3' }],
    ['/exams/toeic/attempts/3/result', 'ToeicResultPage', { attemptId: '3' }],
    ['/login', 'LoginPage'],
    ['/register', 'RegisterPage'],
    ['/forgot-password', 'ForgotPasswordPage'],
    ['/reset-password', 'ResetPasswordPage'],
    ['/auth/google/callback', 'GoogleCallbackPage'],
    ['/courses', 'CourseListPage'],
    ['/courses/42', 'CourseDetailPage', { id: '42' }],
    ['/dictation', 'DictationLibraryPage'],
    ['/pro', 'ProPage'],
    ['/shop', 'ShopPage'],
    ['/leaderboard', 'LeaderboardPage'],
    ['/community', 'CommunityPage'],
    ['/dictation/lesson', 'DictationPracticePage', { id: 'lesson' }],
    ['/achievements', 'AchievementsPage'],
    ['/community/44', 'CommunityPostPage', { id: '44' }],
    ['/dashboard', 'UserDashboardPage'],
    ['/my-courses', 'MyCoursesPage'],
    ['/my-notes', 'MyNotesPage'],
    ['/learning/42', 'LearningPage', { courseId: '42' }],
    ['/quizzes/12', 'QuizPage', { quizId: '12' }],
    ['/quizzes/12/result', 'QuizResultPage', { quizId: '12' }],
    ['/quizzes/attempts/91/result', 'QuizResultPage', { attemptId: '91' }],
    ['/notifications', 'NotificationsPage'],
  ];

  try {
    for (const [path, page, params = {}] of routes) {
      await router.navigate(path);
      const match = router.state.matches.at(-1);
      assert.equal(router.state.errors, null, path);
      assert.equal((match.route.Component || match.route.element?.type)?.name, page, path);
      assert.deepEqual(match.params, params, path);
    }
  } finally {
    router.dispose();
  }
});

test('gem checkout retries the provider catalog and keeps the same order key after a failed request', async () => {
  let methodLoads = 0;
  const requests = [];
  paymentApi.getMethods = async () => {
    if (++methodLoads === 1) throw Object.assign(new Error('Missing access'), { status: 403 });
    return {
      data: [
        { provider: 'MOCK', label: 'Thanh toán mô phỏng', available: true },
        {
          provider: 'VNPAY',
          label: 'VNPay',
          available: false,
          description: 'Unavailable in this environment',
        },
      ],
    };
  };
  paymentApi.createGemCheckout = async payload => {
    requests.push(payload);
    if (requests.length === 1) throw Object.assign(new Error('Temporary error'), { status: 503 });
    return { data: { checkoutUrl: '/payment/mock?orderCode=GEM-ORDER' } };
  };

  await render(GemCheckoutPage, '/payment/gem-checkout?package=GEM_500', '/payment/gem-checkout');
  assert.match(document.querySelector('[role="alert"]').textContent, /Bạn không có quyền/);
  await clickButton('Thử lại');
  assert.match(document.querySelector('.payment-page').textContent, /500 Kim Cương/);
  assert.equal(document.querySelector('input[value="VNPAY"]').disabled, true);

  const submit = document.querySelector('.checkout-submit');
  await act(async () => submit.click());
  assert.equal(requests.length, 1);
  assert.ok(document.querySelector('[role="alert"]'));
  await act(async () => submit.click());

  assert.deepEqual(requests[1], requests[0]);
  assert.equal(requests[1].packageCode, 'GEM_500');
  assert.equal(requests[1].provider, 'MOCK');
  assert.match(requests[1].cancelUrl, /GEM_500$/);
  assert.equal(document.querySelector('#destination').textContent, '/payment/mock?orderCode=GEM-ORDER');
});

test('gem checkout reports an unrecognized package before permitting an order', async () => {
  paymentApi.getMethods = async () => ({ data: [] });
  paymentApi.createGemCheckout = async () => assert.fail('Unknown package cannot be purchased');

  await render(GemCheckoutPage, '/payment/gem-checkout?package=GEM_UNKNOWN', '/payment/gem-checkout');

  assert.match(document.querySelector('.checkout-state-panel').textContent, /Gói không hợp lệ/);
  assert.equal(document.querySelector('.checkout-summary-panel'), null);
});

test('mock payment retries a failed read and safely returns to the same site after cancellation', async () => {
  let orderReads = 0;
  const completions = [];
  paymentApi.getOrder = async () => {
    if (++orderReads === 1) throw new Error('Temporarily unavailable');
    return order('PENDING');
  };
  paymentApi.completeMockPayment = async (code, payload) => {
    completions.push({ code, ...payload });
    if (completions.length === 1) throw Object.assign(new Error('Unavailable'), { status: 503 });
    return order('CANCELLED');
  };
  learningApi.enroll = async () => assert.fail('Cancelled order must not enroll');

  await render(
    MockPaymentPage,
    '/payment/mock?orderCode=test-order&returnUrl=https%3A%2F%2Fexample.test%2Foutside',
    '/payment/mock',
  );
  await clickButton('Thử lại');
  await clickButton('Hủy giao dịch');
  assert.match(document.body.textContent, /Chưa thể kích hoạt khóa học/);
  await clickButton('Hủy giao dịch');

  assert.deepEqual(
    completions.map(({ code, status }) => ({ code, status })),
    [
      { code: 'test-order', status: 'CANCELLED' },
      { code: 'test-order', status: 'CANCELLED' },
    ],
  );
  assert.equal(
    document.querySelector('#destination').textContent,
    '/payment/result?orderCode=test-order&status=cancelled',
  );
});

test('administrator retries the category list, creates a trimmed category and edits or hides it', async () => {
  let reads = 0;
  let categories = [];
  const changes = [];
  categoryApi.adminList = async () => {
    if (++reads === 1) throw new Error('Catalog temporarily unavailable');
    return { data: categories };
  };
  categoryApi.create = async form => {
    changes.push(['create', form]);
    categories = [{ id: 7, ...form }];
    return { data: categories[0] };
  };
  categoryApi.update = async (id, form) => {
    changes.push(['update', id, form]);
    categories = [{ id, ...form }];
    return { data: categories[0] };
  };
  categoryApi.delete = async id => {
    changes.push(['delete', id]);
    categories = [];
  };

  await render(AdminCategoryPage, '/admin/categories', '/admin/categories');
  assert.match(document.querySelector('[role="alert"]').textContent, /Catalog temporarily unavailable/);
  await clickButton('Thử lại');
  assert.match(document.body.textContent, /Chưa có danh mục nào/);
  await editValue('input[placeholder="Tên danh mục"]', '  Listening  ');
  await editValue('textarea[placeholder="Mô tả danh mục"]', '  Practice  ');
  await clickButton('Lưu danh mục');
  assert.match(document.querySelector('tbody').textContent, /Listening/);

  await clickButton('Sửa');
  await editValue('input[placeholder="Tên danh mục"]', 'Listening lab');
  await act(async () => document.querySelector('form input[type="checkbox"]').click());
  await clickButton('Cập nhật danh mục');
  assert.match(document.querySelector('tbody').textContent, /Listening lab/);
  assert.equal(
    [...document.querySelectorAll('tbody button')].find(button => button.textContent.trim() === 'Ẩn')
      .disabled,
    true,
  );
  await clickButton('Sửa');
  await act(async () => document.querySelector('form input[type="checkbox"]').click());
  await clickButton('Cập nhật danh mục');
  await clickButton('Ẩn');

  assert.deepEqual(changes, [
    ['create', { name: 'Listening', description: 'Practice', active: true }],
    ['update', 7, { name: 'Listening lab', description: 'Practice', active: false }],
    ['update', 7, { name: 'Listening lab', description: 'Practice', active: true }],
    ['delete', 7],
  ]);
  assert.match(document.body.textContent, /Chưa có danh mục nào/);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  originals.forEach(([api, methods]) => Object.assign(api, methods));
});
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Event;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('payment return ignores forged success query and uses backend order status', async () => {
  paymentApi.getOrder = async () => order('FAILED');
  learningApi.getMyEnrollments = async () => {
    throw new Error('Must not grant access for failed payment');
  };
  await render(
    ResultPage,
    '/payment/result?orderCode=test-order&status=SUCCESS&vnp_ResponseCode=00',
    '/payment/result',
  );
  assert.ok(document.body.textContent.includes('Thanh toán không thành công'));
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
});

test('successful payment waits for matching active enrollment before exposing learning action', async () => {
  paymentApi.getOrder = async () => order('SUCCESS');
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 41, status: 'ACTIVE' }] });
  await render(ResultPage, '/payment/result?orderCode=test-order', '/payment/result');
  assert.ok(document.body.textContent.includes('Đang chờ quyền học'));
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 42, status: 'ACTIVE' }] });
  await act(async () => document.querySelector('.result-actions button').click());
  assert.ok(document.querySelector('a[href="/my-courses"]'));
});

test('private learning denial shows enrollment error and renders no demo content', async () => {
  learningApi.getLearningCourse = async () => {
    throw Object.assign(new Error('Enrollment is required'), { status: 403 });
  };
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  await render(LearningPage, '/learning/42', '/learning/:courseId');
  assert.ok(document.body.textContent.includes('Bạn chưa có quyền học khóa này'));
  assert.equal(document.querySelector('.lesson-stage'), null);
  assert.equal(document.querySelector('.lesson-progress-item'), null);
});

test('learning uses actual curriculum IDs and preserves backend progress', async () => {
  learningApi.getLearningCourse = async courseId => {
    assert.equal(courseId, '42');
    return {
      data: {
        courseId: 42,
        title: 'Real course',
        totalLessons: 1,
        completedLessons: 0,
        progressPercent: 0,
        progress: [{ lessonId: 812, status: 'IN_PROGRESS', progressPercent: 10 }],
        sections: [
          {
            id: 81,
            courseId: 42,
            title: 'Private section',
            orderIndex: 0,
            lessons: [
              {
                id: 812,
                sectionId: 81,
                title: 'Actual lesson',
                content: 'Allowed private text',
                lessonType: 'TEXT',
                orderIndex: 0,
              },
            ],
          },
        ],
      },
    };
  };
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  learningApi.markLessonComplete = async (courseId, lessonId) => {
    assert.equal(courseId, '42');
    assert.equal(lessonId, 812);
    return { data: { lessonId, status: 'COMPLETED', progressPercent: 100 } };
  };
  await render(LearningPage, '/learning/42', '/learning/:courseId');
  assert.ok(document.body.textContent.includes('Allowed private text'));
  assert.equal(document.querySelectorAll('.lesson-progress-item').length, 1);
  assert.ok(document.querySelector('.lesson-stage').textContent.includes('Đang học'));
  await act(async () => document.querySelector('.lesson-stage button').click());
  assert.ok(document.body.textContent.includes('100%'));
  assert.equal(document.querySelector('.lesson-stage button').disabled, true);
});
