import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
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
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Event: dom.window.Event,
  FormData: dom.window.FormData,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  DocumentFragment: dom.window.DocumentFragment,
  ShadowRoot: dom.window.ShadowRoot,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/community-engagement',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = name => server.ssrLoadModule('/src/' + name);
const { default: AchievementsPage } = await load('features/engagement/pages/AchievementsPage.jsx');
const { default: LeaderboardPage } = await load('features/engagement/pages/LeaderboardPage.jsx');
const { default: CommunityPage } = await load('features/community/pages/CommunityPage.jsx');
const { default: CommunityPostPage } = await load('features/community/pages/CommunityPostPage.jsx');
const { default: LanguageSwitcher } = await load('shared/components/LanguageSwitcher.jsx');
const { default: ShopPage } = await load('features/shop/pages/ShopPage.jsx');
const { shopApi } = await load('features/shop/api/shopApi.js');
const { default: HeaderProgress } = await load('shared/components/HeaderProgress.jsx');
const { default: AccountMenu } = await load('shared/components/AccountMenu.jsx');
const { default: NotificationBell } = await load('features/learning/components/NotificationBell.jsx');
const { EngagementContext } = await load('features/engagement/context/EngagementContext.jsx');
const { NotificationsContext } = await load('features/learning/context/NotificationsContext.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { default: ProtectedRoute } = await load('routes/ProtectedRoute.jsx');
const { engagementApi } = await load('features/engagement/api/engagementApi.js');
const { communityApi } = await load('features/community/api/communityApi.js');
const { setLocale, t, getIntlLocale } = await load('shared/i18n/locale.js');
const original = [engagementApi, communityApi, shopApi].map(api => [api, { ...api }]);
const cache = createCache({ key: 'community-engagement-test' });
let root;
const summary = () => ({
  totalXp: 20,
  level: 1,
  xpInLevel: 20,
  xpPerLevel: 100,
  gems: 0,
  currentStreak: 1,
  longestStreak: 1,
  today: '2026-11-15',
  activeToday: true,
  days: [{ date: '2026-11-15', count: 1 }],
  rewards: [
    { code: 'FIRST_LESSON', gems: 20, eligible: true, claimed: false },
    { code: 'STREAK_7', gems: 70, eligible: false, claimed: false },
  ],
});
const post = () => ({
  id: 11,
  authorId: 1,
  authorName: 'Learner',
  topicId: 1,
  topicCode: 'learning',
  kind: 'QUESTION',
  title: 'Giữ nguyên nội dung từ học viên',
  body: '<img src=x onerror=alert(1)>',
  locked: false,
  acceptedCommentId: null,
  commentCount: 1,
  createdAt: '2026-11-15T10:00:00Z',
  updatedAt: '2026-11-15T10:00:00Z',
});
const page = content => ({
  data: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 },
});
function LoginEcho() {
  const { state } = useLocation();
  return h('p', { id: 'login-gate' }, `Login from:${state?.from || ''}`);
}

async function render(path, user = { id: 1, roles: ['USER'] }) {
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user, isAuthenticated: Boolean(user) } },
          h(
            MemoryRouter,
            { initialEntries: [path] },
            h(LanguageSwitcher),
            h(
              Routes,
              null,
              h(Route, { path: '/login', element: h(LoginEcho) }),
              h(
                Route,
                { element: h(ProtectedRoute) },
                h(Route, { path: '/payment/gem-checkout', element: h('p', { id: 'gem-checkout-gate' }, 'Gem') }),
                h(Route, { path: '/community/:id', element: h(CommunityPostPage) }),
              ),
              h(Route, { path: '/achievements', element: h(AchievementsPage) }),
              h(Route, { path: '/shop', element: h(ShopPage) }),
              h(Route, { path: '/leaderboard', element: h(LeaderboardPage) }),
              h(Route, { path: '/community', element: h(CommunityPage) }),
            ),
          ),
        ),
      ),
    ),
  );
}
function button(text) {
  const result = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(result, 'Missing button: ' + text);
  return result;
}
async function click(text) {
  await act(async () => button(text).click());
}
async function switchLanguage(value) {
  await act(async () => document.querySelector('.language-switcher').click());
  await act(async () => document.querySelector(`.language-menu-paper [lang="${value}"]`).click());
}
async function input(element, value) {
  const proto =
    element.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : element.tagName === 'SELECT'
        ? dom.window.HTMLSelectElement.prototype
        : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
    element.dispatchEvent(
      new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
    );
  });
}
beforeEach(() => {
  setLocale('vi');
  engagementApi.summary = async () => ({ data: summary() });
  communityApi.topics = async () => ({ data: [{ id: 1, code: 'learning' }] });
  communityApi.posts = async () => page([post()]);
  communityApi.post = async () => ({ data: post() });
  communityApi.comments = async () =>
    page([
      {
        id: 51,
        postId: 11,
        authorId: 2,
        authorName: 'Peer',
        body: 'Practise daily.',
        createdAt: post().createdAt,
      },
    ]);
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

const shopFixture = () => ({
  gems: 200,
  streakFreezes: 0,
  freezeCapacity: 7,
  items: [
    { code: 'STREAK_FREEZE', nameKey: 'Streak freeze', itemType: 'FREEZE', price: 25, rarity: 'RARE' },
    { code: 'FRAME_KITTY', nameKey: 'Mèo nhỏ chăm học', itemType: 'FRAME', price: 150, rarity: 'EPIC' },
    { code: 'FRAME_OWL', nameKey: 'Cú mèo phù thủy', itemType: 'FRAME', price: 250, rarity: 'EPIC' },
    {
      code: 'BACKGROUND_SKY',
      nameKey: 'Bầu trời khởi đầu',
      itemType: 'BACKGROUND',
      price: 0,
      originalPrice: 50,
      rarity: 'RARE',
    },
  ],
});

test('shop retries ambiguous purchases with the same request ID and prevents duplicate clicks', async () => {
  let state = shopFixture();
  shopApi.state = async () => ({ data: state });
  const calls = [];
  let finish;
  shopApi.purchase = (code, requestId) => {
    calls.push({ code, requestId });
    if (calls.length === 1) return Promise.reject({ code: 'NETWORK_ERROR' });
    return new Promise(resolve => {
      finish = resolve;
    });
  };
  await render('/shop');
  const cards = document.querySelectorAll('.shop-card');
  assert.equal(cards[1].querySelector('button').disabled, true);
  await act(async () => cards[0].querySelector('button').click());
  await click('Xác nhận mua');
  assert.match(document.querySelector('[role="dialog"]').textContent, /Không thể thực hiện/);
  await click('Xác nhận mua');
  assert.equal(button('Đang xử lý').disabled, true);
  await click('Đang xử lý');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].code, 'FRAME_KITTY');
  assert.match(calls[0].requestId, /^[a-zA-Z0-9_-]{16,64}$/);
  state = {
    ...state,
    gems: 50,
    items: state.items.map(item => ({ ...item, owned: item.code === 'FRAME_KITTY' })),
  };
  await act(async () => finish({ data: {} }));
  await act(async () => new Promise(resolve => setTimeout(resolve, 300)));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.match(document.querySelector('.shop-wallet').textContent, /50/);
  assert.match(document.body.textContent, /Đã mua thành công/);
});

test('inventory filters items and equips or removes the owned appearance', async () => {
  let state = shopFixture();
  state.items[1].owned = true;
  shopApi.state = async () => ({ data: state });
  const calls = [];
  shopApi.equip = async (type, code) => {
    calls.push([type, code]);
    state = { ...state, items: state.items.map(item => ({ ...item, equipped: item.code === code })) };
    return { data: state };
  };
  await render('/shop');
  await click('Kho đồ');
  assert.equal(document.querySelectorAll('.shop-card').length, 1);
  await click('Trang bị');
  assert.deepEqual(calls, [['FRAME', 'FRAME_KITTY']]);
  assert.ok(document.querySelector('.shop-card.is-equipped'));
  await click('Đang dùng · Tháo');
  assert.deepEqual(calls[1], ['FRAME', null]);
  await click('Ảnh nền');
  assert.equal(document.querySelectorAll('.shop-card').length, 0);
  await click('Khám phá cửa hàng');
  await switchLanguage('en');
  assert.match(document.body.textContent, /Kitty scholar/);
  assert.match(document.body.textContent, /Claim free/);
});

test('header renders the live streak, diamond balance, framed level avatar and notification bell', async () => {
  root = createRoot(document.getElementById('root'));
  const renderHeader = data =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user: { id: 1, fullName: 'Shop Learner', roles: ['USER'] } } },
          h(
            EngagementContext.Provider,
            { value: { summary: data } },
            h(
              NotificationsContext.Provider,
              { value: { userId: 1, summary: { unreadCount: 3, notifications: [] }, refresh() { } } },
              h(
                MemoryRouter,
                null,
                h(LanguageSwitcher),
                h(HeaderProgress),
                h(NotificationBell),
                h(AccountMenu),
              ),
            ),
          ),
        ),
      ),
    );
  await act(async () =>
    renderHeader({ gems: 200, currentStreak: 3, activeToday: true, level: 4, activeFrame: 'FRAME_KITTY' }),
  );
  assert.match(document.querySelector('.header-gems').textContent, /200/);
  assert.match(document.querySelector('.header-streak').textContent, /3/);
  assert.equal(document.querySelector('.learner-avatar-level').textContent, 'Lv.4');
  assert.ok(document.querySelector('.learner-avatar-art').getAttribute('src').includes('kitty-scholar'));
  assert.equal(document.querySelector('.notification-badge').textContent, '3');
  await act(async () =>
    renderHeader({ gems: 50, currentStreak: 4, activeToday: true, level: 5, activeFrame: 'FRAME_KOALA' }),
  );
  assert.match(document.querySelector('.header-gems').textContent, /50/);
  assert.equal(document.querySelector('.learner-avatar-level').textContent, 'Lv.5');
  await switchLanguage('en');
  assert.equal(document.querySelector('.header-gems').getAttribute('aria-label'), 'Top up gems: 50 diamonds');
  assert.match(document.querySelector('.header-gems').getAttribute('href'), /\/shop\?tab=topup$/);
});

test('language switch persists the preference and preserves a draft post without translating learner content', async () => {
  await render('/community');
  await click('Viết bài mới');
  await input(document.querySelector('input[name="title"]'), 'My unsaved question');
  await switchLanguage('en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(window.localStorage.getItem('sgedu.locale'), 'en');
  assert.equal(getIntlLocale(), 'en-US');
  assert.equal(document.querySelector('input[name="title"]').value, 'My unsaved question');
  assert.match(document.body.textContent, /New post/);
  assert.match(document.body.textContent, /Giữ nguyên nội dung từ học viên/);
  assert.equal(t('{days} ngày', { days: 3 }), '3 days');
});

test('achievements prevent duplicate reward submissions and refresh the server balance after claiming', async () => {
  let resolveClaim,
    calls = 0;
  engagementApi.claim = () => {
    calls++;
    return new Promise(resolve => {
      resolveClaim = resolve;
    });
  };
  await render('/achievements');
  assert.equal(document.querySelectorAll('.activity-day').length, 90);
  assert.equal(button('Chưa mở khóa').disabled, true);
  await click('Nhận thưởng');
  assert.equal(button('Nhận thưởng').disabled, true);
  await click('Nhận thưởng');
  assert.equal(calls, 1);
  engagementApi.summary = async () => ({
    data: { ...summary(), gems: 20, rewards: [{ ...summary().rewards[0], claimed: true }] },
  });
  await act(async () => resolveClaim({ data: {} }));
  assert.match(document.body.textContent, /Đã nhận phần thưởng/);
  assert.equal(button('Đã nhận').disabled, true);
});

test('leaderboard switches periods and displays the current learner rank', async () => {
  const requests = [];
  engagementApi.leaderboard = async params => {
    requests.push(params);
    return {
      data: {
        totalPages: 1,
        me: { rank: 2, userId: 1 },
        content: [{ rank: 2, userId: 1, displayName: 'Learner', level: 1, xp: 20 }],
      },
    };
  };
  await render('/leaderboard');
  assert.match(document.body.textContent, /Hạng của bạn: 2/);
  assert.equal(document.querySelector('tr.is-me')?.textContent.includes('Learner'), true);
  await input(document.querySelector('select[aria-label="Bảng xếp hạng"]'), 'all');
  assert.equal(requests.at(-1).period, 'all');
  assert.equal(document.querySelector('input[type="month"]'), null);
});

test('forum publishes the selected topic and question type, then opens the created post', async () => {
  let payload;
  communityApi.create = async request => {
    payload = request;
    return { data: post() };
  };
  await render('/community');
  await click('Viết bài mới');
  await input(document.querySelector('select[name="kind"]'), 'QUESTION');
  await input(document.querySelector('input[name="title"]'), 'How can I improve?');
  await input(document.querySelector('textarea[name="body"]'), 'I would like to practise more.');
  await click('Đăng bài');
  assert.deepEqual(payload, {
    topicId: 1,
    kind: 'QUESTION',
    title: 'How can I improve?',
    body: 'I would like to practise more.',
  });
  assert.equal(document.querySelector('.post-detail h1')?.textContent, post().title);
});

test('forum renders content as text and denies editing controls to another learner', async () => {
  await render('/community/11', { id: 3, roles: ['USER'] });
  assert.match(document.querySelector('.post-body').textContent, /<img/);
  assert.equal(document.querySelector('.post-body img'), null);
  assert.equal(
    [...document.querySelectorAll('button')].some(item =>
      ['Sửa', 'Xóa', 'Khóa thảo luận', 'Chọn làm lời giải'].includes(item.textContent),
    ),
    false,
  );
});

test('locked discussion disables posting', async () => {
  communityApi.post = async () => ({ data: { ...post(), locked: true } });
  await render('/community/11');
  assert.match(document.body.textContent, /Bài viết đã khóa bình luận/);
  assert.equal(document.querySelector('textarea'), null);
});

test('guests preview shop items without balances, and login is required to buy or view inventory', async () => {
  let purchaseCalls = 0;
  shopApi.state = async () => ({
    data: {
      ...shopFixture(),
      gems: 0,
      streakFreezes: 0,
      activeFrame: null,
      activeBackground: null,
      items: shopFixture().items.map(item => ({ ...item, owned: false, equipped: false })),
    },
  });
  shopApi.purchase = async () => {
    purchaseCalls++;
    assert.fail('Guest must not call purchase API');
  };
  await render('/shop', null);
  assert.equal(document.querySelector('.shop-wallet'), null);
  const cards = document.querySelectorAll('.shop-card');
  assert.equal(cards.length, 3);
  assert.equal(cards[1].querySelector('button').disabled, false);
  assert.equal(cards[1].querySelector('button').textContent.trim(), 'Mua');
  assert.equal(cards[2].querySelector('button').textContent.trim(), 'Nhận miễn phí');
  await click('Kho đồ');
  assert.match(document.body.textContent, /Đăng nhập để xem kho đồ và tùy chỉnh hồ sơ/);
  await click('Cửa hàng');
  await act(async () => document.querySelectorAll('.shop-card')[1].querySelector('button').click());
  assert.equal(purchaseCalls, 0);
  assert.equal(document.getElementById('login-gate')?.textContent, 'Login from:/shop');
});

test('guests preview gem packages and preserve the selected package when redirected to login', async () => {
  shopApi.state = async () => ({ data: { ...shopFixture(), gems: 0 } });

  await render('/shop?tab=topup', null);
  assert.equal(document.querySelector('.shop-wallet'), null);
  const packages = document.querySelectorAll('.topup-card');
  assert.equal(packages.length, 3);

  await act(async () => packages[1].querySelector('button').click());
  assert.equal(
    document.getElementById('login-gate')?.textContent,
    'Login from:/payment/gem-checkout?package=GEM_500',
  );
});

test('guests preview the leaderboard and see a login CTA in place of personal rank', async () => {
  engagementApi.leaderboard = async () => ({
    data: {
      totalPages: 1,
      me: null,
      content: [{ rank: 1, userId: 2, displayName: 'Top Learner', level: 3, xp: 150 }],
    },
  });
  await render('/leaderboard', null);
  assert.match(document.body.textContent, /Top Learner/);
  assert.match(document.querySelector('.ranking-self').textContent, /Đăng nhập để theo dõi thứ hạng/);
  assert.equal(document.querySelector('.ranking-self a')?.getAttribute('href'), '/login');
});

test('guests browse community posts and clicking create post redirects to login', async () => {
  await render('/community', null);
  assert.match(document.body.textContent, /Giữ nguyên nội dung từ học viên/);
  assert.equal(document.querySelector('.post-preview h2 a')?.getAttribute('href'), '/community/11');
  await click('Viết bài mới');
  assert.equal(document.getElementById('login-gate')?.textContent, 'Login from:/community');
});

test('guests can retry a failed forum load, filter posts and open the login gate from a result', async () => {
  let topics = 0;
  const filters = [];
  communityApi.topics = async () => {
    if (++topics === 1) throw new Error('Temporary failure');
    return { data: [{ id: 1, code: 'learning' }] };
  };
  communityApi.posts = async params => {
    filters.push(params);
    return { data: { ...page([post()]).data, totalPages: 3 } };
  };
  communityApi.post = async () => assert.fail('Guest must sign in before loading post detail');

  await render('/community?page=1', null);
  assert.match(document.querySelector('[role="alert"]').textContent, /Không thể tải dữ liệu/);
  await click('Thử lại');
  assert.equal(topics, 2);
  assert.equal(document.querySelector('[role="alert"]'), null);

  await input(document.querySelector('select[aria-label="Chủ đề"]'), '1');
  await input(document.querySelector('select[aria-label="Loại bài"]'), 'unanswered');
  await input(document.querySelector('input[aria-label="Tìm kiếm"]'), '  test  ');
  await act(async () => document.querySelector('form[role="search"]').requestSubmit());
  assert.deepEqual(filters.at(-1), {
    page: 0,
    size: 20,
    keyword: 'test',
    topicId: '1',
    kind: undefined,
    unanswered: true,
  });

  await act(async () => document.querySelector('.post-preview h2 a').click());
  assert.equal(document.getElementById('login-gate')?.textContent, 'Login from:/community/11');
});
