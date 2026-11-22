import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
const nativeFormData = globalThis.FormData;
globalThis.FormData = dom.window.FormData;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/catalog',
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
const { default: CategorySection } = await load('features/home/components/CategorySection.jsx');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { lessonApi } = await load('features/courses/api/lessonApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const originals = [courseApi, categoryApi, sectionApi, reviewApi, lessonApi, learningApi].map(api => [
  api,
  { ...api },
]);
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
  globalThis.FormData = nativeFormData;
  delete globalThis.HTMLElement;
  delete globalThis.DocumentFragment;
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
    if (Component === CourseListPage) {
      assert.deepEqual(pages, [0]);
      assert.equal(document.querySelectorAll('.course-card').length, 1);
      const next = [...document.querySelectorAll('button')].find(
        button => button.textContent === 'Trang sau',
      );
      assert.ok(next);
      await act(async () => next.click());
      assert.deepEqual(pages, [0, 1]);
      assert.match(document.body.textContent, /Database course 2/);
      assert.doesNotMatch(document.body.textContent, /Database course 1/);
    } else {
      assert.deepEqual(pages, [0, 1]);
      assert.equal(document.querySelectorAll('.course-card').length, 2);
    }
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

async function clickControl(selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing control ${selector}`);
  assert.equal(Boolean(element.disabled), false, selector);
  await act(async () => element.click());
}

async function changeValue(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing field ${selector}`);
  const setValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set;
  await act(async () => {
    setValue.call(element, value);
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

function Destination() {
  const { pathname, search, state } = useLocation();
  return h('output', { id: 'destination', 'data-return-to': state?.from }, pathname + search);
}

function catalogRoute(path, route, Page) {
  return h(
    MemoryRouter,
    { initialEntries: [path] },
    h(
      Routes,
      null,
      h(Route, { path: route, element: h(Page) }),
      h(Route, { path: '*', element: h(Destination) }),
    ),
  );
}

test('home discovery retries category loading and builds URLs from the search term or chosen category', async () => {
  let reads = 0;
  categoryApi.list = async () => {
    if (++reads === 1) throw new Error('Categories unavailable');
    return {
      data: [
        { id: 7, name: 'IELTS', description: 'Academic test preparation', count: 3 },
        { id: 8, name: 'Listening', description: 'Short listening practice' },
      ],
    };
  };
  function CoursesLocation() {
    const { search, hash } = useLocation();
    return h('output', { id: 'course-location' }, search + hash);
  }
  await render(h(MemoryRouter, null, h(CategorySection), h(CoursesLocation)));
  assert.match(document.querySelector('[role=alert]').textContent, /Không thể tải danh mục/);
  await clickControl('[role=alert] button');
  assert.equal(reads, 2);
  assert.match(document.querySelector('.category-card').textContent, /3 khóa học/);
  assert.match(document.querySelector('.category-card:last-child').textContent, /Khám phá khóa học/);

  const location = () => document.querySelector('#course-location').textContent;
  await changeValue('form[role=search] input', '  IELTS & TOEIC  ');
  await clickControl('form[role=search] button');
  assert.equal(location(), '?q=IELTS+%26+TOEIC#courses');
  await clickControl('.popular-keywords button:first-of-type');
  assert.equal(document.querySelector('form[role=search] input').value, 'IELTS 7.0+');
  assert.equal(location(), '?q=IELTS+7.0%2B#courses');
  await clickControl('.category-card:last-child');
  assert.equal(location(), '?category=8#courses');
  await clickControl('#categories .text-link');
  assert.equal(location(), '#courses');
});

test('catalog filters reset pagination and send category, level, pricing, rating and sort to the server', async () => {
  const reads = [];
  categoryApi.list = async () => ({ data: [{ id: 7, name: 'IELTS' }] });
  courseApi.list = async params => {
    reads.push(params);
    const content = params.keyword === 'Unknown' ? [] : [course(42)];
    return { data: { content, page: params.page, totalPages: 3, totalElements: content.length } };
  };
  await render(catalogRoute('/courses?page=2', '/courses', CourseListPage));
  assert.equal(reads.at(-1).page, 2);
  await clickControl('.course-filters button:nth-of-type(5)');
  assert.equal(reads.at(-1).page, 0);
  assert.equal(reads.at(-1).level, 'INTERMEDIATE');

  await changeValue('.catalog-primary-controls select:nth-of-type(1)', '7');
  await changeValue('.catalog-primary-controls select:nth-of-type(2)', 'price_asc');
  await changeValue('input[aria-label="Giá tối thiểu"]', '100');
  await changeValue('input[aria-label="Giá tối đa"]', '900');
  await changeValue('select[aria-label="Đánh giá tối thiểu"]', '4');
  await clickControl('.course-filters button:nth-of-type(3)');
  assert.deepEqual(reads.at(-1), {
    categoryId: '7',
    minPrice: '100',
    maxPrice: '900',
    minRating: '4',
    page: 0,
    pricing: 'paid',
    size: 12,
    sort: 'price_asc',
  });
  await changeValue('.catalog-search-field input', 'Unknown');
  await act(async () => new Promise(resolve => setTimeout(resolve, 350)));
  assert.equal(reads.at(-1).keyword, 'Unknown');
  assert.match(document.body.textContent, /Không tìm thấy khóa học phù hợp/);
  await clickControl('.catalog-results-bar button');
  assert.equal(document.querySelector('.catalog-search-field input').value, '');
  assert.deepEqual(reads.at(-1), { page: 0, size: 12, sort: 'newest' });
});

test('a guest can retry a lesson preview and is sent to login with the intended checkout URL', async () => {
  const previews = [];
  courseApi.getById = async () => ({ data: { ...course(42, 'Listening clinic'), price: 100000 } });
  sectionApi.listByCourse = async () => ({
    data: [
      {
        id: 1,
        title: 'Introduction',
        lessons: [
          { id: 4, title: 'Sample exercise', preview: true, duration: 120, lessonType: 'TEXT' },
          { id: 5, title: 'Members exercise', preview: false, lessonType: 'VIDEO' },
        ],
      },
    ],
  });
  reviewApi.list = async () => ({ data: [] });
  lessonApi.getPlayUrl = async (id, lessonId) => {
    previews.push([id, lessonId]);
    if (previews.length === 1) throw { response: { data: { message: 'Preview temporarily unavailable' } } };
    return { data: { lessonType: 'TEXT', content: 'Study the sample transcript', expiresInSeconds: 120 } };
  };
  await render(catalogRoute('/courses/42', '/courses/:id', CourseDetailPage));
  assert.ok(document.querySelector('.curriculum-lesson-row:nth-child(2) .curriculum-lock-badge'));
  await clickControl('.curriculum-lesson-row:first-child');
  assert.match(document.querySelector('.preview-modal-body').textContent, /Preview temporarily unavailable/);
  await clickControl('.preview-modal-head button');
  assert.equal(document.querySelector('.preview-modal-card'), null);
  await clickControl('.curriculum-lesson-row:first-child');
  assert.match(document.querySelector('.preview-modal-body').textContent, /Study the sample transcript/);
  assert.deepEqual(previews, [
    ['42', 4],
    ['42', 4],
  ]);
  await clickControl('.preview-modal-foot button');
  const destination = document.querySelector('#destination');
  assert.equal(destination.textContent, '/login');
  assert.equal(destination.dataset.returnTo, '/checkout?course=42');
});

test('a signed-in learner can retry free enrolment and proceed to the course workspace', async () => {
  const enrollmentIds = [];
  courseApi.getById = async () => ({ data: course(42) });
  sectionApi.listByCourse = async () => ({ data: [] });
  reviewApi.list = async () => ({ data: [] });
  reviewApi.myReview = async () => ({ data: null });
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 42, status: 'CANCELLED' }] });
  learningApi.enroll = async id => {
    enrollmentIds.push(id);
    if (enrollmentIds.length === 1) throw new Error('Enrollment temporarily unavailable');
    return { data: { courseId: id } };
  };
  await render(catalogRoute('/courses/42', '/courses/:id', CourseDetailPage), {
    user: { id: 13, roles: ['USER'] },
    isAuthenticated: true,
  });
  await clickControl('#btn-enroll-free');
  assert.match(document.body.textContent, /Không thể đăng ký khóa học/);
  await clickControl('#btn-enroll-free');
  assert.equal(document.querySelector('#destination').textContent, '/learning/42');
  assert.deepEqual(enrollmentIds, [42, 42]);
});
