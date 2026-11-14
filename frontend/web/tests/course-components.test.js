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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
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
const { useCurriculum } = await load('features/courses/hooks/useCurriculum.js');
const { mediaApi } = await load('features/courses/api/mediaApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const originals = [mediaApi, sectionApi, courseApi, categoryApi, reviewApi, learningApi].map(api => [
  api,
  { ...api },
]);
const cache = createCache({ key: 'course-test' });
const user = { id: 1, roles: ['ADMIN'], permissions: ['COURSE_VIEW', 'COURSE_CREATE', 'COURSE_UPDATE'] };
let root;

async function render(content) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(h(CacheProvider, { value: cache }, h(AuthContext.Provider, { value: { user } }, content))),
  );
}

async function changeValue(selector, value) {
  const element = document.querySelector(selector);
  const prototype =
    element.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

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
