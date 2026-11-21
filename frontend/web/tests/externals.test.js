import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import { loadSource } from './load-source.js';

const { getAiErrorMessage, readCapabilities } = await loadSource('../src/features/ai-assistant/utils/aiState.js', import.meta.url);

process.env.VITE_API_URL = 'http://gateway.test';
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/externals',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const load = path => server.ssrLoadModule(`/src/${path}`);

test('AI preparation states are validated and errors are user-facing', () => {
  const capabilities = { available: false, historyAvailable: false, maxMessageLength: 4000 };
  assert.deepEqual(readCapabilities(capabilities), capabilities);
  for (const invalid of [
    null,
    {},
    { ...capabilities, available: 'false' },
    { ...capabilities, maxMessageLength: 5000 },
  ]) {
    assert.throws(() => readCapabilities(invalid), /Không thể tải trạng thái/);
  }
  assert.match(getAiErrorMessage({ code: 'AI_NOT_AVAILABLE', message: 'Internal detail' }), /chưa sẵn sàng/);
  assert.match(getAiErrorMessage({ status: 403, message: 'Access is denied' }), /không có quyền/);
  assert.match(getAiErrorMessage({ status: 503, message: 'Internal detail' }), /Vui lòng thử lại/);
});

test('AI and Payment preparation APIs reuse the Gateway client and do not send identity fields', async () => {
  const { default: client } = await load('shared/apis/axiosClient.js');
  const { aiApi } = await load('features/ai-assistant/api/aiApi.js');
  const { paymentApi } = await load('features/payment/api/paymentApi.js');
  const seen = [];
  const original = client.defaults.adapter;
  client.defaults.adapter = async config => {
    seen.push(config);
    return { config, status: 200, headers: {}, data: { success: true, data: {} } };
  };
  try {
    await aiApi.getCapabilities();
    await paymentApi.getMethods();
    await aiApi.createConversation({ title: 'Bài học', userId: 999, apiKey: 'untrusted' });
    await aiApi.sendMessage(1, 'Explain this lesson');
    await aiApi.getConversations({ page: 1, size: 10 });
    assert.deepEqual(
      seen.map(config => config.url),
      [
        '/api/v1/ai/capabilities',
        '/api/v1/payments/methods',
        '/api/v1/ai/conversations',
        '/api/v1/ai/conversations/1/messages',
        '/api/v1/ai/conversations',
      ],
    );
    assert.equal(seen[0].baseURL, 'http://gateway.test');
    assert.deepEqual(JSON.parse(seen[2].data), { title: 'Bài học' });
    assert.deepEqual(JSON.parse(seen[3].data), { content: 'Explain this lesson' });
    assert.deepEqual(seen[4].params, { page: 1, size: 10 });
  } finally {
    client.defaults.adapter = original;
  }
});

test('AI workspace and updated checkout compile with the existing layout', async () => {
  for (const path of [
    'features/ai-assistant/pages/AiAssistantPage.jsx',
    'features/ai-assistant/components/AiTutorSection.jsx',
    'features/payment/pages/PaymentCheckoutPage.jsx',
  ]) {
    assert.equal(typeof (await load(path)).default, 'function', path);
  }
});

test('header keeps four primary links in home-first order including TOEIC and groups extra tools by current route', async () => {
  const { default: Header } = await load('shared/components/SiteHeader.jsx');
  const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
  const { NotificationsProvider } = await load('features/learning/context/NotificationsContext.jsx');
  const primaryLinks = [
    ['/', 'Trang chủ'],
    ['/#courses', 'Khóa học'],
    ['/exams/toeic', 'Luyện thi TOEIC'],
    ['/#categories', 'Danh mục'],
  ];
  const paths = [
    '/ai-assistant',
    '/',
    '/exams/toeic',
    '/exams/toeic/tests/1',
    '/exams/toeic/attempts/7/result',
    '/my-notes',
    '/dictation',
    '/dictation/lesson-1',
  ];
  for (const user of [null, { id: 1, fullName: 'Nguyễn Văn A', roles: ['USER'] }]) {
    for (const path of paths) {
      const html = renderToStaticMarkup(
        h(
          AuthContext.Provider,
          { value: { user } },
          h(MemoryRouter, { initialEntries: [path] }, h(NotificationsProvider, null, h(Header))),
        ),
      );
      const dom = new JSDOM(html);
      try {
        dom.window.document.querySelectorAll('style').forEach(style => style.remove());
        const nav = dom.window.document.querySelector('nav[aria-label="Điều hướng chính"]');
        assert.ok(nav, `Missing primary navigation: ${path}`);
        assert.deepEqual(
          [...nav.querySelectorAll(':scope > a')].map(link => [
            link.getAttribute('href'),
            link.textContent.trim(),
          ]),
          primaryLinks,
          `Primary links changed or duplicated: ${path}`,
        );
        assert.equal(
          nav.querySelector('a[href="/exams/toeic"]').classList.contains('active'),
          path.startsWith('/exams/toeic'),
        );
        assert.equal(
          nav.querySelector('a[href="/"]').getAttribute('aria-current'),
          path === '/' ? 'page' : null,
        );
        assert.equal(dom.window.document.querySelector('.mobile-menu'), null);
        const utilities = nav.querySelector('.header-utilities-trigger');
        assert.equal(utilities.textContent, 'Tiện ích khác');
        assert.equal(utilities.getAttribute('aria-haspopup'), 'menu');
        assert.equal(utilities.getAttribute('aria-expanded'), 'false');
        assert.equal(
          utilities.classList.contains('active'),
          path.startsWith('/dictation') || (Boolean(user) && ['/ai-assistant', '/my-notes'].includes(path)),
        );
        assert.equal(nav.querySelector('a[href="/dictation"]'), null);
        assert.equal(dom.window.document.querySelector('.signup-link'), null);
        const pro = dom.window.document.querySelector('.header-pro-button');
        if (!user) {
          assert.equal(pro, null);
          continue;
        }
        assert.equal(pro.getAttribute('aria-label'), 'Mở khóa PRO');
      } finally {
        dom.window.close();
      }
    }
  }
});

test('admin navigation keeps TOEIC and quiz permissions while adding admin-only dictation', async () => {
  const { default: Layout } = await load('layouts/AdminLayout.jsx');
  const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
  const { ROUTES } = await load('shared/constants/routes.js');
  for (const role of ['ADMIN', 'TEACHER']) {
    const user = {
      id: 1,
      fullName: 'Admin test',
      roles: [role],
      permissions: ['ADMIN_ACCESS', 'QUIZ_VIEW', 'NOTIFICATION_VIEW'],
    };
    const html = renderToStaticMarkup(
      h(
        AuthContext.Provider,
        { value: { user, isAuthenticated: true } },
        h(MemoryRouter, { initialEntries: ['/admin'] }, h(Layout)),
      ),
    );
    const dom = new JSDOM(html);
    try {
      const nav = dom.window.document.querySelector('nav[aria-label="Quản trị"]');
      assert.ok(nav.querySelector(`a[href="${ROUTES.ADMIN_QUIZZES}"]`));
      assert.ok(nav.querySelector(`a[href="${ROUTES.ADMIN_NOTIFICATIONS}"]`));
      for (const route of [ROUTES.ADMIN_TOEIC, ROUTES.ADMIN_DICTATION]) {
        assert.equal(Boolean(nav.querySelector(`a[href="${route}"]`)), role === 'ADMIN');
      }
    } finally {
      dom.window.close();
    }
  }
});

test('dictation translations do not override existing quiz and catalog labels', async () => {
  const english = JSON.parse(
    await readFile(new URL('../src/shared/i18n/en.json', import.meta.url), 'utf8'),
  );
  assert.equal(english['Câu'], 'Question');
  assert.equal(english['câu'], 'questions');
  assert.equal(english['Câu trước'], 'Previous question');
  assert.equal(english['Số câu'], 'Question number');
  assert.equal(english['Đang hiển thị'], 'Visible');
  assert.equal(english['Câu {index}'], 'Sentence {index}');
  assert.equal(english['Câu nghe trước'], 'Previous sentence');
  assert.equal(english['Số câu nghe'], 'Sentences');
});

test('home and footer AI entry points open the actual assistant route instead of the demo section', async () => {
  for (const [path, selector, count] of [
    [
      'features/home/components/HeroSection.jsx',
      '.hero-actions a[href="/ai-assistant"], a.tutor-status[href="/ai-assistant"]',
      2,
    ],
    ['features/ai-assistant/components/AiTutorSection.jsx', '.ai-copy a[href="/ai-assistant"]', 2],
    ['shared/components/SiteFooter.jsx', 'a[href="/ai-assistant"]', 2],
  ]) {
    const { default: Component } = await load(path);
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(Component)));
    const dom = new JSDOM(html);
    try {
      assert.equal(dom.window.document.querySelectorAll(selector).length, count, path);
      assert.equal(dom.window.document.querySelector('a[href$="#ai-tutor"]'), null, path);
    } finally {
      dom.window.close();
    }
  }
});
