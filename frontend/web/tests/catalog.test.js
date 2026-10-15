import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { ToastContext } = await load('shared/context/ToastContext.jsx');
const { default: FeaturedCourses } = await load('features/courses/components/FeaturedCourses.jsx');
const { default: CourseListPage } = await load('features/courses/pages/CourseListPage.jsx');
const { default: CourseDetailPage } = await load('features/courses/pages/CourseDetailPage.jsx');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const originals = [courseApi, categoryApi, sectionApi, reviewApi].map(api => [api, { ...api }]);
const cache = createCache({ key: 'catalog-test' });
let root;
const course = (id, title = `Database course ${id}`) => ({
  id,
  title,
  categoryId: 7,
  categoryName: 'IELTS',
  description: 'Course from database',
  price: 0,
  avgRating: 0,
  reviewCount: 0,
  status: 'PUBLISHED',
});

async function render(content, auth = {}) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user: null, isAuthenticated: false, ...auth } },
          h(ToastContext.Provider, { value: () => {} }, content),
        ),
      ),
    ),
  );
}

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

for (const Component of [FeaturedCourses, CourseListPage]) {
  test(`${Component.name} keeps database courses visible when categories fail and filters certificates correctly`, async () => {
    categoryApi.list = async () => {
      throw new Error('Category API unavailable');
    };
    courseApi.list = async () => ({ data: { content: [course(42)], totalPages: 1 } });
    await render(h(MemoryRouter, { initialEntries: ['/?filter=certificates'] }, h(Component)));
    assert.equal(document.querySelectorAll('.course-card').length, 1);
    assert.match(document.body.textContent, /Database course 42/);
    assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải danh mục/);
    assert.match(document.querySelector('.course-rating').textContent, /0\.0.*0 đánh giá/);
    assert.doesNotMatch(document.querySelector('.course-meta').textContent, /8 giờ/);
  });

  test(`${Component.name} shows loading and an actionable error, then retries every catalog page`, async () => {
    let rejectLoad;
    courseApi.list = () =>
      new Promise((resolve, reject) => {
        rejectLoad = reject;
      });
    categoryApi.list = async () => ({ data: [] });
    await render(h(MemoryRouter, null, h(Component)));
    assert.match(document.body.textContent, /Đang tải khóa học/);
    assert.doesNotMatch(document.body.textContent, /tìm thấy khóa học phù hợp/);
    await act(async () => rejectLoad(new Error('Course API unavailable')));
    assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải khóa học/);
    const pages = [];
    courseApi.list = async ({ page }) => {
      pages.push(page);
      return { data: { content: [course(page + 1)], totalPages: 2 } };
    };
    await act(async () => document.querySelector('[role=alert] button').click());
    assert.deepEqual(pages, [0, 1]);
    assert.equal(document.querySelectorAll('.course-card').length, 2);
    assert.equal(document.querySelector('[role=alert]'), null);
  });
}

test('detail waits for session restore and never substitutes a demo course on API failure', async () => {
  let loads = 0;
  courseApi.getById = async () => {
    loads++;
    throw new Error('Course API unavailable');
  };
  sectionApi.listByCourse = async () => ({ data: [] });
  reviewApi.list = async () => ({ data: { content: [] } });
  const detail = h(
    MemoryRouter,
    { initialEntries: ['/courses/42'] },
    h(Routes, null, h(Route, { path: '/courses/:id', element: h(CourseDetailPage) })),
  );
  await render(detail, { isLoading: true });
  assert.equal(loads, 0);
  await render(detail, { isLoading: false });
  assert.equal(loads, 1);
  assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải khóa học/);
  assert.doesNotMatch(document.body.textContent, /IELTS Intensive|Mua khóa học ngay|Đăng ký học miễn phí/);
  courseApi.getById = async () => ({ data: course(42, 'Recovered database course') });
  await act(async () => document.querySelector('[role=alert] button').click());
  assert.match(document.body.textContent, /Recovered database course/);
  assert.equal(document.querySelector('[role=alert]'), null);
});

test('navigating to another course ignores a late response for the previous course', async () => {
  const pending = new Map();
  courseApi.getById = id => new Promise(resolve => pending.set(id, resolve));
  sectionApi.listByCourse = async () => ({ data: [] });
  reviewApi.list = async () => ({ data: { content: [] } });
  let navigate;
  function LocationProbe() {
    navigate = useNavigate();
    return null;
  }
  await render(
    h(
      MemoryRouter,
      { initialEntries: ['/courses/1'] },
      h(LocationProbe),
      h(Routes, null, h(Route, { path: '/courses/:id', element: h(CourseDetailPage) })),
    ),
  );
  await act(async () => navigate('/courses/2'));
  await act(async () => pending.get('2')({ data: course(2, 'Current database course') }));
  await act(async () => pending.get('1')({ data: course(1, 'Stale database course') }));
  assert.match(document.body.textContent, /Current database course/);
  assert.doesNotMatch(document.body.textContent, /Stale database course/);
});
