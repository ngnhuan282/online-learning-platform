import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.FormData = dom.window.FormData;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/course-components',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { default: AddLessonDialog } = await load('features/courses/components/AddLessonDialog.jsx');
const { default: ReviewForm } = await load('features/courses/components/ReviewForm.jsx');
const { default: MediaUploader } = await load('features/courses/components/MediaUploader.jsx');
const { default: LessonResourcesModal } = await load('features/courses/components/LessonResourcesModal.jsx');
const { default: AdminCoursePage } = await load('features/courses/pages/AdminCoursePage.jsx');
const { default: AdminReviewPage } = await load('features/courses/pages/AdminReviewPage.jsx');
const { default: CurriculumBuilderPage } = await load('features/courses/pages/CurriculumBuilderPage.jsx');
const { useCurriculum } = await load('features/courses/hooks/useCurriculum.js');
const { mediaApi } = await load('features/courses/api/mediaApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { lessonApi } = await load('features/courses/api/lessonApi.js');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const originals = [mediaApi, sectionApi, lessonApi, courseApi, categoryApi, reviewApi, learningApi].map(
  api => [api, { ...api }],
);
const cache = createCache({ key: 'course-test' });
const user = {
  id: 1,
  roles: ['ADMIN'],
  permissions: ['COURSE_VIEW', 'COURSE_CREATE', 'COURSE_UPDATE', 'COURSE_DELETE'],
};
let root;

async function render(content) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(h(CacheProvider, { value: cache }, h(AuthContext.Provider, { value: { user } }, content))),
  );
}

async function changeValue(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing field ${selector}`);
  const prototype = Object.getPrototypeOf(element);
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

async function clickControl(selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing control ${selector}`);
  assert.equal(element.disabled, false, selector);
  await act(async () => element.click());
}

const courseBuilder = () =>
  h(
    MemoryRouter,
    { initialEntries: ['/admin/courses/42/curriculum'] },
    h(
      Routes,
      null,
      h(Route, { path: '/admin/courses/:courseId/curriculum', element: h(CurriculumBuilderPage) }),
    ),
  );

test('curriculum builder retries loading and keeps section mutations scoped to the selected course', async () => {
  let reads = 0;
  const writes = [];
  courseApi.adminGetById = async id => {
    assert.equal(id, '42');
    return { data: { id: 42, title: 'Business English', categoryName: 'Speaking' } };
  };
  sectionApi.listByCourse = async () => {
    if (++reads === 1) throw new Error('Temporary curriculum error');
    return { data: [{ id: 21, title: 'Introductions', orderIndex: 0, lessons: [] }] };
  };
  sectionApi.create = async (courseId, payload) => {
    writes.push(['create', courseId, payload]);
    return { data: { id: 22, ...payload } };
  };
  sectionApi.update = async (courseId, id, payload) => {
    writes.push(['update', courseId, id, payload]);
    return { data: { id, ...payload } };
  };
  sectionApi.reorder = async (courseId, items) => writes.push(['reorder', courseId, items]);
  sectionApi.delete = async (courseId, id) => writes.push(['delete', courseId, id]);
  const originalConfirm = window.confirm;
  let approved = false;
  window.confirm = () => approved;

  try {
    await render(courseBuilder());
    assert.match(document.body.textContent, /Temporary curriculum error/);
    const retry = [...document.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Thử lại',
    );
    assert.ok(retry);
    await act(async () => retry.click());
    assert.match(document.querySelector('h1').textContent, /Business English/);

    await clickControl('#btn-add-section');
    await changeValue('#section-title', '  Meetings  ');
    await clickControl('form button[type="submit"]');
    assert.match(document.body.textContent, /Meetings/);
    await clickControl('button[title="Di chuyển xuống"]:not([disabled])');
    await clickControl('button[title="Sửa tên chương"]');
    await changeValue('input[aria-label="Tên chương"]', 'Planning meetings');
    await act(async () =>
      document
        .querySelector('input[aria-label="Tên chương"]')
        .dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    assert.match(document.body.textContent, /Planning meetings/);

    await clickControl('button[title="Xóa chương"]');
    assert.equal(
      writes.some(([operation]) => operation === 'delete'),
      false,
    );
    approved = true;
    await clickControl('button[title="Xóa chương"]');
    assert.doesNotMatch(document.body.textContent, /Planning meetings/);
    assert.deepEqual(writes, [
      ['create', '42', { title: 'Meetings', orderIndex: 1 }],
      [
        'reorder',
        '42',
        [
          { id: 22, orderIndex: 0 },
          { id: 21, orderIndex: 1 },
        ],
      ],
      ['update', '42', 22, { title: 'Planning meetings', orderIndex: 0 }],
      ['delete', '42', 22],
    ]);
  } finally {
    window.confirm = originalConfirm;
  }
});

test('curriculum builder adds a text lesson and preserves lesson IDs through reordering and removal', async () => {
  const writes = [];
  courseApi.adminGetById = async () => ({ data: { id: 42, title: 'Business English' } });
  sectionApi.listByCourse = async () => ({
    data: [
      {
        id: 21,
        title: 'Basics',
        orderIndex: 0,
        lessons: [{ id: 61, title: 'First lesson', lessonType: 'TEXT', orderIndex: 0 }],
      },
    ],
  });
  lessonApi.create = async (sectionId, payload) => {
    writes.push(['create', sectionId, payload]);
    return { data: { id: 62, ...payload } };
  };
  lessonApi.reorder = async (sectionId, items) => writes.push(['reorder', sectionId, items]);
  lessonApi.delete = async id => writes.push(['delete', id]);
  const originalConfirm = window.confirm;
  window.confirm = () => true;

  try {
    await render(courseBuilder());
    await clickControl('#btn-add-lesson-21');
    const type = document.querySelector('#lesson-type');
    await act(async () => {
      type.value = 'TEXT';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await changeValue('#lesson-title', 'Negotiation');
    await changeValue('#lesson-content', 'Useful phrases for negotiation.');
    await clickControl('form button[type="submit"]');
    assert.match(document.body.textContent, /Negotiation/);
    await clickControl('button[title="Lên trên"]:not([disabled])');
    await clickControl('button[title="Xóa bài học"]');

    assert.equal(writes[0][1], 21);
    assert.equal(writes[0][2].title, 'Negotiation');
    assert.equal(writes[0][2].content, 'Useful phrases for negotiation.');
    assert.equal(writes[0][2].orderIndex, 1);
    assert.deepEqual(writes.slice(1), [
      [
        'reorder',
        21,
        [
          { id: 62, orderIndex: 0 },
          { id: 61, orderIndex: 1 },
        ],
      ],
      ['delete', 62],
    ]);
    assert.doesNotMatch(document.body.textContent, /Negotiation/);
    assert.match(document.body.textContent, /First lesson/);
  } finally {
    window.confirm = originalConfirm;
  }
});

beforeEach(() => {
  learningApi.getAdminQuizzes = async () => ({ data: [] });
  courseApi.list = async () => ({ data: { items: [] } });
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

test('lesson form keeps edits during rerenders and resets when another lesson is selected', async () => {
  const lesson = { id: 1, title: 'First lesson', lessonType: 'TEXT', content: 'First content' };
  const dialog = initialLesson =>
    h(AddLessonDialog, { initialLesson, mode: 'edit', onCancel() {}, onConfirm() {} });
  await render(dialog(lesson));
  await changeValue('#lesson-title', 'Unsaved lesson title');
  await render(dialog(lesson));
  assert.equal(document.querySelector('#lesson-title').value, 'Unsaved lesson title');
  await render(dialog({ id: 2, title: 'Second lesson', lessonType: 'VIDEO', duration: 120 }));
  assert.equal(document.querySelector('#lesson-title').value, 'Second lesson');
  assert.equal(document.querySelector('#lesson-type').value, 'VIDEO');
  assert.equal(document.querySelector('#lesson-duration').value, '120');
});

test('lesson quiz picker only offers quizzes belonging to the current course', async () => {
  learningApi.getAdminQuizzes = async () => ({
    data: [
      { id: 21, courseId: 42, title: 'Current course quiz', passingScore: 70 },
      { id: 22, courseId: 43, title: 'Other course quiz', passingScore: 70 },
    ],
  });
  const initialLesson = { lessonType: 'QUIZ' };
  const dialog = courseId => h(AddLessonDialog, { courseId, initialLesson, onCancel() {}, onConfirm() {} });
  await render(dialog(42));
  assert.deepEqual(
    [...document.querySelectorAll('#lesson-quiz-picker option')].map(option => option.value),
    ['', '21'],
  );
  await render(dialog(43));
  assert.deepEqual(
    [...document.querySelectorAll('#lesson-quiz-picker option')].map(option => option.value),
    ['', '22'],
  );
});

test('review drafts survive rerenders and reset when switching between edit and create', async () => {
  const review = { id: 1, rating: 2, comment: 'First review' };
  const form = existingReview => h(ReviewForm, { courseId: 42, existingReview });
  await render(form(review));
  await changeValue('textarea', 'Unsaved review');
  await render(form(review));
  assert.equal(document.querySelector('textarea').value, 'Unsaved review');
  await render(form({ id: 2, rating: 4, comment: 'Second review' }));
  assert.equal(document.querySelector('textarea').value, 'Second review');
  assert.match(document.body.textContent, /4 \/ 5 sao/);
  await render(form(null));
  assert.equal(document.querySelector('textarea').value, '');
  assert.match(document.body.textContent, /5 \/ 5 sao/);
});

test('uploader preserves a successful preview until currentUrl changes, and removal stays removed', async () => {
  mediaApi.upload = async () => ({ data: { objectKey: 'thumbnails/uploaded.png', fileName: 'upload.png' } });
  const uploader = currentUrl => h(MediaUploader, { accept: 'image/*', currentUrl });
  await render(uploader('/images/old.png'));
  const input = document.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', {
    value: [new dom.window.File(['image'], 'upload.png', { type: 'image/png' })],
  });
  await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
  assert.match(document.querySelector('img').src, /thumbnails\/uploaded\.png$/);
  await render(uploader('/images/old.png'));
  assert.match(document.querySelector('img').src, /thumbnails\/uploaded\.png$/);
  await render(uploader('/images/new.png'));
  assert.match(document.querySelector('img').src, /images\/new\.png$/);
  await act(async () => document.querySelector('button').click());
  await render(uploader('/images/new.png'));
  assert.equal(document.querySelector('img'), null);
});

test('switching resource lessons ignores the previous lesson response', async () => {
  const pending = new Map();
  mediaApi.listResources = id => new Promise(resolve => pending.set(id, resolve));
  const modal = id => h(LessonResourcesModal, { lesson: { id, title: `Lesson ${id}` }, onClose() {} });
  await render(modal(1));
  await render(modal(2));
  await act(async () =>
    pending.get(2)({ data: [{ id: 2, title: 'Current attachment', resourceType: 'PDF' }] }),
  );
  assert.match(document.body.textContent, /Current attachment/);
  await act(async () =>
    pending.get(1)({ data: [{ id: 1, title: 'Stale attachment', resourceType: 'PDF' }] }),
  );
  assert.match(document.body.textContent, /Current attachment/);
  assert.doesNotMatch(document.body.textContent, /Stale attachment/);
});

test('curriculum ignores a late course response and refresh clears old errors', async () => {
  const pending = new Map();
  sectionApi.listByCourse = id => new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  let curriculum;
  function Probe({ courseId }) {
    curriculum = useCurriculum(courseId);
    return h(
      'p',
      null,
      curriculum.loading ? 'loading' : curriculum.sections.map(section => section.title).join(','),
    );
  }
  await render(h(Probe, { courseId: 1 }));
  await render(h(Probe, { courseId: 2 }));
  await act(async () => pending.get(2).resolve({ data: [{ id: 2, title: 'Current curriculum' }] }));
  await act(async () => pending.get(1).reject(new Error('Stale course failed')));
  assert.equal(document.body.textContent, 'Current curriculum');
  assert.equal(curriculum.error, null);
  await act(async () => {
    curriculum.refresh();
  });
  await act(async () => pending.get(2).reject(new Error('Refresh failed')));
  assert.equal(curriculum.error.message, 'Refresh failed');
  await act(async () => {
    curriculum.refresh();
  });
  assert.equal(curriculum.loading, true);
  assert.equal(curriculum.error, null);
  await act(async () => pending.get(2).resolve({ data: [{ id: 3, title: 'Refreshed curriculum' }] }));
  assert.equal(document.body.textContent, 'Refreshed curriculum');
});

test('admin pagination loads the selected page without reloading on form edits', async () => {
  let categoryLoads = 0;
  const pages = [];
  let finishPage;
  categoryApi.list = async () => {
    categoryLoads++;
    return { data: [{ id: 7, name: 'Java' }] };
  };
  courseApi.adminList = ({ page }) => {
    pages.push(page);
    const response = {
      data: { items: [{ id: page + 1, title: `Course page ${page + 1}` }], totalPages: 2, totalElements: 11 },
    };
    return page === 1
      ? new Promise(resolve => {
          finishPage = () => resolve(response);
        })
      : Promise.resolve(response);
  };
  await render(h(MemoryRouter, null, h(AdminCoursePage)));
  assert.deepEqual(pages, [0]);
  await changeValue('input[aria-label="Tên khóa học"]', 'Draft course');
  assert.deepEqual(pages, [0]);
  const next = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Sau →'));
  assert.ok(next);
  await act(async () => next.click());
  assert.equal(next.disabled, true);
  await act(async () => finishPage());
  assert.match(document.body.textContent, /Course page 2/);
  assert.match(document.body.textContent, /Trang 2 \/ 2/);
  const previous = [...document.querySelectorAll('button')].find(button =>
    button.textContent.includes('← Trước'),
  );
  await act(async () => previous.click());
  assert.match(document.body.textContent, /Course page 1/);
  assert.deepEqual(pages, [0, 1, 0]);
  assert.equal(categoryLoads, 1);
});

test('course administration validates drafts, retries creation, updates the selected course and archives it', async () => {
  const writes = [];
  let course;
  categoryApi.list = async () => ({ data: [{ id: 7, name: 'Listening' }] });
  courseApi.adminList = async () => ({ data: { content: course ? [course] : [], totalPages: 1 } });
  courseApi.create = async payload => {
    writes.push(['create', payload]);
    if (writes.length === 1) throw new Error('Course update unavailable');
    course = { id: 42, categoryName: 'Listening', ...payload };
  };
  courseApi.update = async (id, payload) => {
    writes.push(['update', id, payload]);
    course = { ...course, ...payload };
  };
  courseApi.delete = async id => {
    writes.push(['archive', id]);
  };
  await render(h(MemoryRouter, null, h(AdminCoursePage)));
  assert.match(document.body.textContent, /Chưa có khóa học được xuất bản/);

  const title = 'input[aria-label="Tên khóa học"]';
  const description = 'textarea[aria-label="Mô tả khóa học"]';
  const save = 'form.course-card button[type=submit]';
  await changeValue(title, 'AB');
  await changeValue(description, 'Short');
  await clickControl(save);
  assert.match(document.body.textContent, /Tên khóa học phải có ít nhất 5 ký tự/);
  assert.match(document.body.textContent, /Mô tả phải có ít nhất 10 ký tự/);
  assert.deepEqual(writes, []);

  await changeValue(title, '  Listening practice  ');
  await changeValue(description, '  Guided listening for intermediate learners  ');
  await changeValue('select[aria-label="Trình độ"]', 'INTERMEDIATE');
  await changeValue('input[aria-label="Giá"]', '150000');
  await changeValue('input[aria-label="Giá gốc"]', '200000');
  await clickControl(save);
  assert.match(document.body.textContent, /Không thể lưu thay đổi/);
  assert.equal(document.querySelector(title).value, '  Listening practice  ');
  await clickControl(save);
  assert.match(document.querySelector('tbody').textContent, /Listening practice/);
  assert.equal(document.querySelector(title).value, '');

  await clickControl('button[title="Sửa khóa học"]');
  assert.equal(document.querySelector(title).value, 'Listening practice');
  await changeValue(title, 'Listening practice II');
  await clickControl(save);
  assert.match(document.querySelector('tbody').textContent, /Listening practice II/);
  await clickControl('button[title="Lưu trữ khóa học (giữ dữ liệu)"]');
  assert.match(document.querySelector('tbody').textContent, /Listening practice II/);
  const payload = {
    title: 'Listening practice',
    description: 'Guided listening for intermediate learners',
    categoryId: 7,
    price: 150000,
    originalPrice: 200000,
    level: 'INTERMEDIATE',
    status: 'PUBLISHED',
    thumbnailUrl: '/images/english-ielts.jpg',
  };
  assert.deepEqual(writes, [
    ['create', payload],
    ['create', payload],
    ['update', 42, { ...payload, title: 'Listening practice II' }],
    ['archive', 42],
  ]);
});

test('a category created from the course editor is selected without discarding the draft', async () => {
  const writes = [];
  let reads = 0;
  categoryApi.list = async () => {
    if (++reads === 1) throw new Error('Could not read categories');
    return { data: [{ id: 7, name: 'Listening' }] };
  };
  categoryApi.create = async payload => {
    writes.push(payload);
    if (writes.length === 1) throw { response: { data: { message: 'Category name already exists' } } };
    return { data: { id: 11, name: payload.name } };
  };
  courseApi.adminList = async () => ({ data: [] });
  await render(h(MemoryRouter, null, h(AdminCoursePage)));
  const retry = [...document.querySelectorAll('button')].find(
    button => button.textContent.trim() === 'Thử lại',
  );
  assert.ok(retry);
  await act(async () => retry.click());
  assert.equal(document.querySelector('select[aria-label="Danh mục"]').value, '7');

  await changeValue('input[aria-label="Tên khóa học"]', 'Listening in context');
  await clickControl('button[title="Thêm danh mục mới nhanh"]');
  const name = 'input[maxlength="100"]';
  const description = 'textarea[maxlength="500"]';
  const save = 'form:not(.course-card) button[type=submit]';
  await changeValue(name, '   ');
  await clickControl(save);
  assert.match(document.body.textContent, /Vui lòng nhập tên danh mục/);
  await changeValue(name, '  Short stories  ');
  await changeValue(description, '  Stories organized by listening level  ');
  await clickControl(save);
  assert.match(document.body.textContent, /Category name already exists/);
  await clickControl(save);

  const payload = { name: 'Short stories', description: 'Stories organized by listening level' };
  assert.deepEqual(writes, [payload, payload]);
  assert.equal(document.querySelector('select[aria-label="Danh mục"]').value, '11');
  assert.equal(document.querySelector('input[aria-label="Tên khóa học"]').value, 'Listening in context');
  assert.equal(document.querySelector(name), null);
});

test('admin reviews reset on course navigation and moderation still reloads the current course', async () => {
  const courses = new Map();
  const reviews = new Map();
  const actions = [];
  courseApi.adminGetById = id => new Promise(resolve => courses.set(id, resolve));
  reviewApi.adminList = id => new Promise(resolve => reviews.set(id, resolve));
  reviewApi.hide = async (courseId, reviewId) => {
    actions.push([courseId, reviewId]);
  };
  let navigate;
  function Navigation() {
    navigate = useNavigate();
    return null;
  }
  const route = '/admin/courses/:courseId/reviews';
  await render(
    h(
      MemoryRouter,
      { initialEntries: ['/admin/courses/1/reviews'] },
      h(Navigation),
      h(Routes, null, h(Route, { path: route, element: h(AdminReviewPage) })),
    ),
  );
  await act(async () => navigate('/admin/courses/2/reviews'));
  await act(async () => {
    courses.get('2')({ data: { title: 'Current course' } });
    reviews.get('2')({ data: { items: [{ id: 20, rating: 4, comment: 'Current review', hidden: false }] } });
  });
  await act(async () => {
    courses.get('1')({ data: { title: 'Stale course' } });
    reviews.get('1')({ data: { items: [{ id: 10, rating: 1, comment: 'Stale review' }] } });
  });
  assert.match(document.body.textContent, /Current course/);
  assert.match(document.body.textContent, /Current review/);
  assert.doesNotMatch(document.body.textContent, /Stale course|Stale review/);
  const hide = [...document.querySelectorAll('button')].find(button => button.textContent === 'Ẩn review');
  assert.ok(hide);
  await act(async () => hide.click());
  await act(async () => {
    courses.get('2')({ data: { title: 'Current course' } });
    reviews.get('2')({ data: { items: [{ id: 20, rating: 4, comment: 'Current review', hidden: true }] } });
  });
  assert.deepEqual(actions, [['2', 20]]);
  assert.match(document.body.textContent, /Bỏ ẩn/);
});
