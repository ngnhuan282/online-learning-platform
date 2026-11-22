import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { createServer } from 'vite';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost/admin/shop',
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
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/admin-shop',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { default: AdminShopPage } = await load('features/admin/pages/AdminShopPage.jsx');
const { default: AdminStatisticsPage } = await load('features/admin/pages/AdminStatisticsPage.jsx');
const { default: AdminEngagementPage } = await load('features/admin/pages/AdminEngagementPage.jsx');
const { default: AdminEngagementRulesPage } = await load('features/admin/pages/AdminEngagementRulesPage.jsx');
const { default: AdminProMembersPage } = await load('features/admin/pages/AdminProMembersPage.jsx');
const { default: AdminProPlansPage } = await load('features/admin/pages/AdminProPlansPage.jsx');
const { default: AdminCommunityPage } = await load('features/admin/pages/AdminCommunityPage.jsx');
const { default: AdminAuditPage } = await load('features/admin/pages/AdminAuditPage.jsx');
const { default: AdminRolesPage } = await load('features/admin/pages/AdminRolesPage.jsx');
const { CommerceTable } = await load('features/admin/components/CommerceAdminUi.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi: api } = await load('features/admin/api/commerceAdminApi.js');
const { PRO_CHANGED } = await load('features/pro/api/proApi.js');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const originals = { ...api };
const originalAdminApi = { ...adminApi };
const originalAdapter = axiosClient.defaults.adapter;
const item = {
  code: 'FRAME_RENDER_TEST',
  nameKey: 'Test frame',
  itemType: 'FRAME',
  rarity: 'RARE',
  price: 5,
  active: true,
};
const purchasePage = {
  content: [
    {
      id: 1,
      userId: 7,
      nameKey: 'Receipt frame',
      gemsSpent: 5,
      createdAt: '2026-11-17T00:00:00Z',
      requestId: 'receipt',
    },
  ],
  totalElements: 1,
  totalPages: 1,
  page: 0,
  size: 20,
};
let root;
beforeEach(() => {
  api.items = async () => ({ data: [item] });
  api.purchases = async () => ({ data: purchasePage });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  Object.assign(api, originals);
  Object.assign(adminApi, originalAdminApi);
  axiosClient.defaults.adapter = originalAdapter;
});
after(async () => {
  await server.close();
  dom.window.close();
});
async function render(component, permissions = ['ADMIN_ACCESS', 'SHOP_VIEW']) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: createCache({ key: 'admin-shop-test' }) },
        h(
          AuthContext.Provider,
          {
            value: {
              user: { id: 1, status: 'ACTIVE', roles: ['ADMIN'], permissions },
            },
          },
          component,
        ),
      ),
    ),
  );
}
async function click(label) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label);
  assert.ok(button, 'Button exists: ' + label);
  await act(async () => button.click());
}

const dialog = () => [...document.querySelectorAll('[role="dialog"]')].at(-1);
async function clickIn(container, label) {
  const button = [...container.querySelectorAll('button')].find(
    node => (node.getAttribute('aria-label') || node.textContent.trim()) === label,
  );
  assert.ok(button, `Missing button ${label}`);
  assert.equal(button.disabled, false, label);
  await act(async () => button.click());
}

async function fill(container, label, value) {
  const labelNode = [...container.querySelectorAll('label')].find(node => {
    const text = node.classList.contains('commerce-field')
      ? node.querySelector('span')?.textContent
      : node.textContent;
    return text.trim().replace(/\s*\*$/, '') === label;
  });
  assert.ok(labelNode, `Missing field ${label}`);
  const field = labelNode.control || labelNode.querySelector('input, select, textarea');
  assert.ok(field, `Missing control ${label}`);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

function serveCommerce(reads, mutate) {
  const requests = [];
  axiosClient.defaults.adapter = async config => {
    const { method, url, params } = config;
    const body = config.data && JSON.parse(config.data);
    requests.push({ method, url, params, body });
    const read = reads[url];
    const data = method === 'get' && read ? read(params) : await mutate({ method, url, body });
    return { status: 200, config, headers: {}, data: { success: true, data } };
  };
  return requests;
}

const catalog = content => ({ ...purchasePage, content, totalElements: content.length });
const learningAdmin = '/api/v1/learning/admin';
const postsPath = `${learningAdmin}/community/posts`;
const discussion = {
  id: 71,
  title: 'Practice advice',
  body: 'Ideas for a weekly practice schedule',
  displayName: 'English tutor',
  topicId: 1,
  kind: 'DISCUSSION',
  locked: false,
  version: 4,
};
const reply = { id: 83, displayName: 'Learner', body: 'Practice a short clip every day', version: 6 };
const planPath = '/api/v1/payments/admin/pro/plans';
const plan = {
  code: 'PRO_MONTH',
  name: 'Monthly Pro',
  price: 50000,
  durationMonths: 1,
  version: 3,
  active: true,
};

test('the administration audit log retains available sources, sorts events, and recovers after all sources fail', async () => {
  let mode = 'payment unavailable';
  const log = (action, createdAt, actorName) => ({
    data: [{ id: 1, actorId: 9, actorName, action, createdAt, target: 'Course 42' }],
  });
  adminApi.audit = async () => {
    if (mode === 'offline') throw new Error('Audit sources unavailable');
    return log('ACCOUNT_UPDATED', '2026-11-21T09:00:00Z', 'Administrator');
  };
  api.learningAudit = async () => {
    if (mode === 'offline') throw new Error('Learning unavailable');
    return log('GEMS_GRANTED', '2026-11-21T10:00:00Z');
  };
  api.paymentAudit = async () => {
    if (mode !== 'online') throw new Error('Payment unavailable');
    return log('ORDER_COMPLETED', '2026-11-21T11:00:00Z');
  };
  await render(h(AdminAuditPage), ['ADMIN_ACCESS']);
  assert.match(document.querySelector('[role=alert]').textContent, /Payment/);
  const sources = () =>
    [...document.querySelectorAll('tbody tr td:nth-child(2)')].map(cell => cell.textContent);
  assert.deepEqual(sources(), ['Learning', 'Auth']);
  assert.match(document.querySelector('tbody').textContent, /#9/);

  mode = 'offline';
  await click('Làm mới');
  assert.deepEqual(sources(), []);
  assert.match(document.querySelector('[role=alert]').textContent, /Audit sources unavailable/);
  mode = 'online';
  await click('Thử lại');
  assert.deepEqual(sources(), ['Payment', 'Learning', 'Auth']);
  assert.equal(document.querySelector('[role=alert]'), null);
});

test('role management creates a custom role, confirms discarding permission edits, and removes an unused role', async () => {
  const baseRole = {
    id: 1,
    name: 'ADMIN',
    label: 'Administrator',
    systemRole: true,
    userCount: 1,
    permissions: [],
  };
  const writePermission = {
    code: 'COURSE_CREATE',
    group: 'Courses',
    resource: 'Catalog',
    action: 'CREATE',
    label: 'Create courses',
    dependencies: ['ADMIN_ACCESS'],
    adminOnly: false,
  };
  const writes = [];
  let roles = [baseRole];
  adminApi.roles = async () => ({ data: roles });
  adminApi.permissions = async () => ({ data: [writePermission] });
  adminApi.createRole = async payload => {
    writes.push(['create', payload]);
    const role = { id: 2, systemRole: false, userCount: 0, ...payload };
    roles = [baseRole, role];
    return { data: role };
  };
  adminApi.deleteRole = async id => {
    writes.push(['delete', id]);
    roles = [baseRole];
  };
  await render(h(AdminRolesPage), ['ADMIN_ACCESS', 'ROLE_MANAGE']);
  await click('Tạo vai trò');
  await fill(dialog(), 'Mã vai trò', 'course_editor');
  await fill(dialog(), 'Tên hiển thị', 'Course editor');
  await fill(dialog(), 'Mô tả', 'Curates the listening catalog');
  await clickIn(dialog(), 'Xác nhận');
  const selectedRole = () => document.querySelector('.admin-role-option.selected');
  assert.match(selectedRole().textContent, /COURSE_EDITOR/);

  const checkbox = () => document.querySelector('input[aria-label="COURSE_CREATE"]');
  await click('Chọn tất cả');
  assert.equal(checkbox().checked, true);
  const [administrator, customRole] = document.querySelectorAll('.admin-role-option');
  assert.ok(administrator);
  assert.ok(customRole);
  await act(async () => administrator.click());
  assert.match(dialog().textContent, /Thay đổi chưa được lưu/);
  await clickIn(dialog(), 'Hủy');
  assert.equal(checkbox().checked, true);
  await act(async () => administrator.click());
  await clickIn(dialog(), 'Bỏ thay đổi');
  assert.match(selectedRole().textContent, /ADMIN/);
  assert.equal(checkbox().disabled, true);

  await act(async () => customRole.click());
  assert.equal(checkbox().checked, false);
  await click('Xóa vai trò');
  await clickIn(dialog(), 'Xác nhận');
  assert.equal(document.querySelectorAll('.admin-role-option').length, 1);
  assert.deepEqual(writes, [
    [
      'create',
      {
        name: 'COURSE_EDITOR',
        label: 'Course editor',
        description: 'Curates the listening catalog',
        permissions: ['ADMIN_ACCESS'],
        version: 0,
      },
    ],
    ['delete', 2],
  ]);
});

test('a moderator locks a discussion and hides and restores it with audit reasons', async () => {
  let post = { ...discussion };
  const requests = serveCommerce(
    { [postsPath]: ({ hidden }) => catalog(hidden === Boolean(post.deletedAt) ? [post] : []) },
    ({ method, url, body }) => {
      assert.equal(method, 'patch');
      assert.equal(url, `${postsPath}/${discussion.id}`);
      post = { ...post, locked: body.locked, deletedAt: body.hidden ? '2026-11-21T09:00:00Z' : null };
      return post;
    },
  );
  await render(h(AdminCommunityPage), ['ADMIN_ACCESS', 'COMMUNITY_VIEW', 'COMMUNITY_MODERATE']);
  assert.equal(document.querySelector('button[aria-label="Chỉnh sửa"]'), null);

  await clickIn(document, 'Khóa thảo luận');
  await fill(dialog(), 'Lý do thay đổi', 'Pause the conversation');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.match(document.querySelector('tbody').textContent, /Đã khóa/);

  await clickIn(document, 'Ẩn bài');
  await fill(dialog(), 'Lý do thay đổi', 'Review requested');
  await clickIn(dialog(), 'Ẩn bài');
  assert.doesNotMatch(document.querySelector('#root').textContent, /Practice advice/);

  await click('Bài đã ẩn');
  assert.match(document.querySelector('#root').textContent, /Practice advice/);
  await clickIn(document, 'Khôi phục');
  await fill(dialog(), 'Lý do thay đổi', 'Review completed');
  await clickIn(dialog(), 'Khôi phục');
  await click('Bài đang hiển thị');
  await clickIn(document, 'Mở khóa');
  await fill(dialog(), 'Lý do thay đổi', 'Resume discussion');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.match(document.querySelector('tbody').textContent, /Đang mở/);
  assert.deepEqual(
    requests.filter(({ method }) => method === 'patch').map(({ body }) => body),
    [
      { hidden: false, locked: true, reason: 'Pause the conversation' },
      { hidden: true, locked: true, reason: 'Review requested' },
      { hidden: false, locked: true, reason: 'Review completed' },
      { hidden: false, locked: false, reason: 'Resume discussion' },
    ],
  );
});

test('community editors send discussion and comment edits with the versions displayed in the list', async () => {
  const commentsPath = `${postsPath}/${discussion.id}/comments`;
  const requests = serveCommerce(
    { [postsPath]: () => catalog([discussion]), [commentsPath]: () => [reply] },
    ({ body }) => body,
  );
  await render(h(AdminCommunityPage), [
    'ADMIN_ACCESS',
    'COMMUNITY_VIEW',
    'COMMUNITY_CREATE',
    'COMMUNITY_UPDATE',
    'COMMUNITY_DELETE',
  ]);

  await click('Thêm bài viết');
  await fill(dialog(), 'Tiêu đề', 'Listening resources');
  await fill(dialog(), 'Chủ đề', '2');
  await fill(dialog(), 'Loại', 'QUESTION');
  await fill(dialog(), 'Nội dung', 'Where can I find short practice clips?');
  await fill(dialog(), 'Lý do thay đổi', 'Assemble practice material');
  await act(async () => dialog().querySelector('input[type=checkbox]').click());
  await clickIn(dialog(), 'Lưu thay đổi');

  await clickIn(document, 'Chỉnh sửa');
  await fill(dialog(), 'Tiêu đề', 'Weekly practice advice');
  await fill(dialog(), 'Lý do thay đổi', 'Clarify the subject');
  await clickIn(dialog(), 'Lưu thay đổi');

  await clickIn(document, 'Xem chi tiết');
  assert.match(dialog().textContent, /Ideas for a weekly practice schedule/);
  await clickIn(dialog(), 'Xem chi tiết');
  assert.match(dialog().textContent, /Practice a short clip every day/);
  await clickIn(dialog(), 'Đóng');
  await clickIn(dialog(), 'Thêm bình luận');
  await fill(dialog(), 'Nội dung', 'Start with the listening library');
  await fill(dialog(), 'Lý do thay đổi', 'Answer the question');
  await clickIn(dialog(), 'Lưu thay đổi');

  await clickIn(dialog(), 'Chỉnh sửa');
  await fill(dialog(), 'Nội dung', 'Practise with a short clip every day');
  await fill(dialog(), 'Lý do thay đổi', 'Correct the wording');
  await clickIn(dialog(), 'Lưu thay đổi');

  await clickIn(dialog(), 'Xóa bình luận');
  await fill(dialog(), 'Lý do thay đổi', 'Duplicate reply');
  await clickIn(dialog(), 'Xóa');
  await clickIn(dialog(), 'Đóng');
  await clickIn(document, 'Xóa bài viết');
  await fill(dialog(), 'Lý do thay đổi', 'Duplicate discussion');
  await clickIn(dialog(), 'Xóa');

  const writes = requests.filter(({ method }) => method !== 'get');
  assert.deepEqual(
    writes.map(({ method, url }) => [method, url]),
    [
      ['post', postsPath],
      ['put', `${postsPath}/${discussion.id}`],
      ['post', commentsPath],
      ['put', `${commentsPath}/${reply.id}`],
      ['delete', `${commentsPath}/${reply.id}`],
      ['delete', `${postsPath}/${discussion.id}`],
    ],
  );
  assert.deepEqual(writes[0].body, {
    topicId: 2,
    kind: 'QUESTION',
    title: 'Listening resources',
    body: 'Where can I find short practice clips?',
    hidden: true,
    version: 0,
    reason: 'Assemble practice material',
  });
  assert.equal(writes[1].body.title, 'Weekly practice advice');
  assert.equal(writes[1].body.version, 4);
  assert.equal(writes[2].body.body, 'Start with the listening library');
  assert.equal(writes[3].body.body, 'Practise with a short clip every day');
  assert.equal(writes[3].body.version, 6);
  assert.deepEqual(writes[4].body, { version: 6, reason: 'Duplicate reply' });
  assert.deepEqual(writes[5].body, { version: 4, reason: 'Duplicate discussion' });
});

test('commerce management sends versioned writes to the appropriate resources and refreshes projections', async () => {
  const payload = { version: 3, reason: 'Review requested by support' };
  const observations = serveCommerce({}, ({ body }) => body);
  let refreshes = 0;
  const refresh = () => refreshes++;
  const commands = [
    ['deleteComment', [8, 9], 'delete', `${learningAdmin}/community/posts/8/comments/9`, false],
    ['restoreComment', [8, 9], 'post', `${learningAdmin}/community/posts/8/comments/9/restore`, false],
    ['deleteItem', ['FRAME_TEST'], 'delete', `${learningAdmin}/shop/items/FRAME_TEST`, true],
    ['restoreItem', ['FRAME_TEST'], 'post', `${learningAdmin}/shop/items/FRAME_TEST/restore`, true],
    [
      'updateReward',
      ['STREAK_TEST'],
      'put',
      `${learningAdmin}/engagement/rewards/STREAK_TEST/definition`,
      true,
    ],
    ['deleteReward', ['STREAK_TEST'], 'delete', `${learningAdmin}/engagement/rewards/STREAK_TEST`, true],
    [
      'restoreReward',
      ['STREAK_TEST'],
      'post',
      `${learningAdmin}/engagement/rewards/STREAK_TEST/restore`,
      true,
    ],
    ['createPlan', [], 'post', planPath, true],
    ['updateGrant', [7, 18], 'put', `${learningAdmin}/pro/members/7/grants/18`, true],
    ['revokeGrant', [7, 18], 'post', `${learningAdmin}/pro/members/7/grants/18/revoke`, true],
    ['createPost', [], 'post', `${learningAdmin}/community/posts`, false],
    ['updatePost', [8], 'put', `${learningAdmin}/community/posts/8`, false],
    ['deletePost', [8], 'delete', `${learningAdmin}/community/posts/8`, false],
    ['restorePost', [8], 'post', `${learningAdmin}/community/posts/8/restore`, false],
    ['createComment', [8], 'post', `${learningAdmin}/community/posts/8/comments`, false],
    ['updateComment', [8, 9], 'put', `${learningAdmin}/community/posts/8/comments/9`, false],
    ['updateCode', [19], 'put', `${learningAdmin}/pro/codes/19`, false],
    ['moderate', [8], 'patch', `${learningAdmin}/community/posts/8`, false],
    ['moderateComment', [8, 9], 'patch', `${learningAdmin}/community/posts/8/comments/9`, false],
  ];

  window.addEventListener(PRO_CHANGED, refresh);
  try {
    for (const [operation, ids, method, url, refreshesMembership] of commands) {
      const before = refreshes;
      const response = await api[operation](...ids, payload);
      assert.deepEqual(response.data, payload, operation);
      assert.deepEqual(observations.at(-1), { method, url, params: undefined, body: payload }, operation);
      assert.equal(refreshes - before, Number(refreshesMembership), operation);
    }
    assert.equal(observations.length, commands.length);
  } finally {
    window.removeEventListener(PRO_CHANGED, refresh);
  }
});

test('staff edit, archive and restore a Pro plan with the current version and reason', async () => {
  let current = { ...plan };
  const requests = serveCommerce({ [planPath]: () => [current] }, ({ method, url, body }) => {
    if (method === 'put' && url === `${planPath}/${plan.code}`) current = { ...current, ...body, version: 4 };
    else if (method === 'delete' && url === `${planPath}/${plan.code}`) {
      current = { ...current, deletedAt: '2026-11-01T00:00:00Z', active: false, version: 5 };
    } else if (url === `${planPath}/${plan.code}/restore`) current = { ...current, deletedAt: null };
    else assert.fail(`Unexpected request ${method} ${url}`);
    return current;
  });

  await render(h(AdminProPlansPage), ['PRO_PLAN_VIEW', 'PRO_PLAN_UPDATE', 'PRO_PLAN_DELETE']);
  await clickIn(document, 'Xem chi tiết');
  assert.match(dialog().textContent, /Monthly Pro/);
  await clickIn(dialog(), 'Đóng');

  await clickIn(document, 'Chỉnh sửa');
  await fill(dialog(), 'Tên gói', 'New monthly plan');
  await fill(dialog(), 'Giá VND', '59000');
  await fill(dialog(), 'Lý do thay đổi', 'Updated published pricing');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.match(document.querySelector('tbody').textContent, /New monthly plan/);
  assert.deepEqual(requests.find(request => request.method === 'put').body, {
    name: 'New monthly plan',
    price: 59000,
    active: true,
    version: 3,
    reason: 'Updated published pricing',
  });

  await clickIn(document, 'Xóa gói Pro');
  await fill(dialog(), 'Lý do thay đổi', 'Archive obsolete pricing');
  await clickIn(dialog(), 'Xóa');
  assert.doesNotMatch(document.querySelector('tbody').textContent, /PRO_MONTH/);
  await clickIn(document, 'Thùng rác');
  assert.match(document.querySelector('tbody').textContent, /PRO_MONTH/);
  await clickIn(document, 'Khôi phục');
  await fill(dialog(), 'Lý do thay đổi', 'Restore plan for review');
  await clickIn(dialog(), 'Khôi phục');
  assert.deepEqual(
    requests.filter(request => ['delete', 'post'].includes(request.method)).map(request => request.body),
    [
      { version: 4, reason: 'Archive obsolete pricing' },
      { version: 5, reason: 'Restore plan for review' },
    ],
  );
});

test('staff adjust a learner level and update inventory without modifying wallet balance', async () => {
  const learner = {
    userId: 7,
    displayName: 'Lan',
    gems: 30,
    totalXp: 20,
    level: 1,
    currentStreak: 2,
    streakFreezes: 1,
  };
  const path = `${learningAdmin}/engagement/learners`;
  let inventory = [];
  const requests = serveCommerce(
    {
      [path]: () => catalog([learner]),
      [`${path}/7`]: () => learner,
      [`${path}/7/adjustments`]: () => [],
      [`${path}/7/inventory`]: () => inventory,
      [`${learningAdmin}/shop/items`]: () => [item],
    },
    ({ url, body }) => {
      if (url.endsWith('/adjustments')) learner.level = body.targetLevel;
      else if (url === `${path}/7/inventory/${item.code}`) {
        inventory = body.owned ? [{ itemCode: item.code, acquiredAt: '2026-11-01T00:00:00Z', ...item }] : [];
      } else assert.fail(`Unexpected request ${url}`);
      return learner;
    },
  );

  await render(h(AdminEngagementPage), [
    'ENGAGEMENT_VIEW',
    'XP_ADJUST',
    'INVENTORY_VIEW',
    'INVENTORY_MANAGE',
  ]);
  await clickIn(document, 'Xem chi tiết');
  assert.match(dialog().textContent, /Lan · #7/);
  await clickIn(dialog(), 'Điều chỉnh tài khoản học tập');
  await fill(dialog(), 'Thao tác', 'targetLevel');
  await fill(dialog(), 'Giá trị mới', '4');
  await fill(dialog(), 'Lý do thay đổi', 'Correct placement data');
  await clickIn(dialog(), 'Lưu thay đổi');
  const adjustment = requests.find(request => request.method === 'post').body;
  assert.equal(adjustment.targetLevel, 4);
  assert.equal(adjustment.gemsDelta, 0);
  assert.equal(adjustment.reason, 'Correct placement data');
  assert.match(adjustment.requestId, /^[0-9a-f-]{36}$/);

  await clickIn(dialog(), 'Cấp vật phẩm');
  await fill(dialog(), 'Lý do thay đổi', 'Course completion gift');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.match(dialog().textContent, /Test frame/);
  await clickIn(dialog(), 'Thu hồi vật phẩm');
  await fill(dialog(), 'Lý do thay đổi', 'Correct award recipient');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.deepEqual(
    requests.filter(request => request.method === 'put').map(request => request.body),
    [
      { owned: true, reason: 'Course completion gift' },
      { owned: false, reason: 'Correct award recipient' },
    ],
  );
  assert.match(dialog().textContent, /Gem30/);
});

test('staff save learning settings and create a first-lesson reward with threshold one', async () => {
  const path = `${learningAdmin}/engagement`;
  let settings = { lessonXp: 10, quizXp: 20, dailyGems: 5, xpPerLevel: 100, version: 2 };
  const rewards = [];
  const requests = serveCommerce(
    { [`${path}/settings`]: () => settings, [`${path}/rewards`]: () => rewards },
    ({ url, body }) => {
      if (url.endsWith('/settings')) settings = { ...settings, ...body };
      else if (url.endsWith('/rewards')) rewards.push(body);
      else assert.fail(`Unexpected request ${url}`);
      return body;
    },
  );

  await render(h(AdminEngagementRulesPage), [
    'ENGAGEMENT_CONFIG_VIEW',
    'ENGAGEMENT_CONFIG_UPDATE',
    'REWARD_CREATE',
  ]);
  await clickIn(document, 'Chỉnh sửa quy tắc');
  await fill(dialog(), 'Gem mỗi ngày học', '9');
  await fill(dialog(), 'Lý do thay đổi', 'Update daily practice award');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.equal(requests.find(request => request.method === 'put').body.dailyGems, 9);

  await clickIn(document, 'Thêm phần thưởng');
  await fill(dialog(), 'Mã phần thưởng', 'first_lesson');
  await fill(dialog(), 'Tên phần thưởng', 'First completed lesson');
  await fill(dialog(), 'Điều kiện', 'FIRST_LESSON');
  await fill(dialog(), 'Gem', '15');
  await fill(dialog(), 'Lý do thay đổi', 'Reward new learners');
  await clickIn(dialog(), 'Lưu thay đổi');
  const reward = requests.find(request => request.method === 'post').body;
  assert.equal(reward.code, 'FIRST_LESSON');
  assert.equal(reward.gems, 15);
  assert.equal(reward.threshold, 1);
  assert.match(document.querySelector('tbody').textContent, /First completed lesson/);
});

test('staff suspend a Pro member using the current membership version', async () => {
  const path = `${learningAdmin}/pro/members`;
  const member = {
    userId: 7,
    displayName: 'Lan',
    planCode: plan.code,
    expiresAt: '2099-12-05T00:00:00Z',
    active: true,
    version: 4,
  };
  const requests = serveCommerce(
    {
      [path]: () => catalog([member]),
      [`${path}/7`]: () => ({ membership: member, grants: [] }),
      '/api/v1/payments/pro/plans': () => [plan],
    },
    ({ url, body }) => {
      assert.equal(url, `${path}/7/suspension`);
      Object.assign(member, body);
      return member;
    },
  );

  await render(h(AdminProMembersPage), ['PRO_MEMBER_VIEW', 'PRO_MEMBER_MANAGE']);
  await clickIn(document, 'Xem chi tiết');
  await clickIn(dialog(), 'Tạm khóa Pro');
  await fill(dialog(), 'Lý do thay đổi', 'Review access request');
  await clickIn(dialog(), 'Lưu thay đổi');
  assert.deepEqual(requests.find(request => request.method === 'patch').body, {
    suspended: true,
    version: 4,
    reason: 'Review access request',
  });
  assert.match(dialog().textContent, /Mở lại Pro/);
});
function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

test('shop switches between item arrays and purchase pages while requests are pending', async () => {
  const receipts = deferred(),
    items = deferred();
  let itemCalls = 0;
  api.items = () => (++itemCalls === 1 ? Promise.resolve({ data: [item] }) : items.promise);
  api.purchases = () => receipts.promise;
  await render(h(AdminShopPage));
  assert.match(document.querySelector('tbody').textContent, /FRAME_RENDER_TEST/);
  await click('Giao dịch gem');
  assert.ok(document.querySelector('.admin-loading'));
  assert.equal(document.querySelector('tbody'), null);
  await act(async () => receipts.resolve({ data: purchasePage }));
  assert.match(document.querySelector('tbody').textContent, /Receipt frame/);
  await click('Vật phẩm');
  assert.ok(document.querySelector('.admin-loading'));
  assert.equal(document.querySelector('tbody'), null);
  await act(async () => items.resolve({ data: [item] }));
  assert.match(document.querySelector('tbody').textContent, /FRAME_RENDER_TEST/);
});

test('shared commerce tables safely render absent row data', async () => {
  for (const rows of [undefined, null]) {
    await render(h(CommerceTable, { columns: [['Name', 'name']], rows, paginate: true }));
    assert.equal(document.querySelectorAll('tbody tr').length, 0);
    assert.match(document.body.textContent, /Không có dữ liệu/);
  }
});

test('shop reports invalid API data and supports retrying instead of crashing', async () => {
  api.items = async () => ({ data: { unexpected: true } });
  await render(h(AdminShopPage));
  assert.ok(document.querySelector('[role=alert]'));
  assert.equal(document.querySelector('tbody'), null);
  api.items = async () => ({ data: [] });
  await click('Thử lại');
  assert.match(document.body.textContent, /Không có dữ liệu/);
});

test('admin statistics render real zero totals and avoid mislabeled or unavailable reports', async () => {
  let paymentCalls = 0;
  adminApi.payments = async () => {
    paymentCalls++;
    return { data: { grossRevenue: 0, refundedAmount: 0, successfulPayments: 0, recentTransactions: [] } };
  };
  adminApi.overview = async () => ({ data: { total: 18, active: 12, newThisWeek: 0, monthly: [] } });
  adminApi.learning = async () => ({ data: { enrollments: 3, completed: 1, completionRate: 33.3 } });
  adminApi.commerceAnalytics = async () => ({
    data: reportFixture({ snapshot: { ownedItems: 0 }, current: { purchases: 0 }, details: [] }),
  });
  const report = h(AdminStatisticsPage);
  await render(report, ['DASHBOARD_VIEW', 'LEARNING_REPORT_VIEW', 'SHOP_VIEW']);
  assert.equal(paymentCalls, 0);
  assert.match(document.body.textContent, /Tổng tài khoản18/);
  assert.match(document.body.textContent, /Tài khoản đang được bật12/);
  await click('Tiến độ & Kết quả học');
  assert.match(document.body.textContent, /Lượt ghi danh hợp lệ3/);
  assert.equal(
    [...document.querySelectorAll('button')].some(node => node.textContent === 'Xuất Excel'),
    false,
  );
  await click('Cửa hàng & Kho đồ');
  assert.match(document.body.textContent, /Vật phẩm trong kho đồ0/);
  assert.match(document.body.textContent, /Chưa có dữ liệu trong kỳ này/);
  await render(report, ['DASHBOARD_VIEW', 'PAYMENT_REPORT_VIEW']);
  assert.equal(paymentCalls, 1);
  assert.match(document.querySelector('.stat-card-value').textContent, /0/);
  assert.match(document.body.textContent, /Chưa có giao dịch/);
});

const defaultRange = { from: '2026-10-21', to: '2026-11-19' };
function reportFixture(values) {
  return {
    range: defaultRange,
    previousRange: { from: '2026-09-21', to: '2026-10-20' },
    asOf: '2026-11-19T10:00:00Z',
    snapshot: {},
    current: {},
    previous: {},
    trend: [{ range: defaultRange, current: 0, previous: 0 }],
    ...values,
  };
}

async function enterDate(name, value) {
  const input = document.querySelector(`input[name=${name}]`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

test('Pro, Gem and Shop reports load authorized data and use date filters with the Gateway client', async () => {
  const requests = [];
  let gemUnavailable = true;
  const reports = {
    pro: reportFixture({
      snapshot: { active: 8 },
      current: { grants: 5 },
      previous: { grants: 4 },
      details: {
        recentGrants: [{ id: 1, userId: 7, source: 'PAYMENT', planCode: 'PRO_MONTH', months: 1 }],
        codes: {
          created: 1,
          redeemed: 0,
          recent: [{ id: 2, maskedCode: 'CCG-••••-A123', planCode: 'PRO_MONTH', status: 'AVAILABLE' }],
        },
      },
    }),
    gems: reportFixture({
      snapshot: { balance: 1000 },
      current: { issued: 50, spent: 25, legacyActivityDays: 1 },
      previous: { issued: 20 },
      details: [{ id: 1, userId: 7, actorId: 3, delta: -25, reason: 'Điều chỉnh kiểm thử' }],
    }),
    shop: reportFixture({
      snapshot: { ownedItems: 4, equippedItems: 2, equipRate: 50 },
      current: { purchases: 3 },
      details: [
        { code: 'FRAME_TEST', name: 'Khung kiểm thử', type: 'FRAME', purchases: 3, currentPrice: 20 },
      ],
    }),
  };
  axiosClient.defaults.adapter = async config => {
    const report = config.url.split('/').at(-1);
    requests.push({ url: config.url, params: config.params });
    assert.ok(config.signal);
    if (report === 'gems' && gemUnavailable) throw new Error('Test upstream outage');
    const data = reports[report];
    return {
      config,
      status: 200,
      data: { success: true, data: { ...data, range: config.params ?? data.range } },
    };
  };
  await render(h(AdminStatisticsPage), ['PRO_MEMBER_VIEW', 'ENGAGEMENT_VIEW', 'SHOP_VIEW']);
  assert.match(document.body.textContent, /Đang hoạt động8/);
  assert.match(document.body.textContent, /CCG-••••-A123/);
  assert.match(document.body.textContent, /Lượt cấp Pro chưa bị thu hồi54/);
  await enterDate('from', '2026-01-01');
  await click('Áp dụng');
  assert.match(document.querySelector('[role=alert]').textContent, /tối đa 90 ngày/);
  assert.equal(requests.length, 1);
  await enterDate('from', '2026-11-15');
  await enterDate('to', '2026-11-16');
  await click('Áp dụng');
  assert.deepEqual(requests.at(-1), {
    url: '/api/v1/learning/admin/analytics/pro',
    params: { from: '2026-11-15', to: '2026-11-16' },
  });
  assert.match(document.body.textContent, /Kỳ này 2026-11-15 – 2026-11-16/);
  await click('Kinh tế Gem');
  assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải báo cáo/);
  assert.equal(document.querySelector('[aria-label="Kinh tế Gem"] table'), null);
  gemUnavailable = false;
  await click('Thử lại');
  assert.match(document.body.textContent, /Điều chỉnh kiểm thử/);
  assert.match(document.body.textContent, /Gem cộng vào ví đã ghi nhận5020/);
  await click('Cửa hàng & Kho đồ');
  assert.match(document.body.textContent, /Tỷ lệ vật phẩm trang bị \(%\)50%/);
  assert.match(document.body.textContent, /Khung kiểm thử/);
  assert.deepEqual(
    requests.map(request => request.url.split('/').at(-1)),
    ['pro', 'pro', 'gems', 'gems', 'shop'],
  );
});

test(
  'commerce Excel exports server totals, the applied period and visible rows',
  { timeout: 30000 },
  async () => {
    adminApi.commerceAnalytics = async () => ({
      data: reportFixture({
        snapshot: { balance: 220 },
        current: { issued: 200 },
        previous: { issued: 25 },
        details: [{ id: 1, userId: 7, actorId: 3, delta: 200, reason: 'Kiểm tra Excel' }],
      }),
    });
    const pending = deferred();
    const createUrl = URL.createObjectURL;
    const anchorClick = dom.window.HTMLAnchorElement.prototype.click;
    let blob;
    URL.createObjectURL = value => {
      blob = value;
      return 'blob:test-commerce-report';
    };
    dom.window.HTMLAnchorElement.prototype.click = function () {
      pending.resolve(this.download);
    };
    try {
      await render(h(AdminStatisticsPage), ['ENGAGEMENT_VIEW']);
      await click('Xuất Excel');
      assert.equal(await pending.promise, 'thong-ke-gems-2026-10-21-2026-11-19.xlsx');
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blob.arrayBuffer());
      const rows = [];
      workbook.worksheets[0].eachRow(row => rows.push(row.values.slice(1)));
      assert.deepEqual(
        rows.find(row => row[0] === 'Gem cộng vào ví đã ghi nhận'),
        ['Gem cộng vào ví đã ghi nhận', 200, 25],
      );
      assert.ok(rows.some(row => row.includes('Kiểm tra Excel') && row.includes(200)));
    } finally {
      URL.createObjectURL = createUrl;
      dom.window.HTMLAnchorElement.prototype.click = anchorClick;
    }
  },
);
