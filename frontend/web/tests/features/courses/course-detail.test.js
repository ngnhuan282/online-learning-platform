import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'course-detail' });
const { load, unmount, flush, setInputValue, dom } = env;

const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { ToastProvider } = await load('shared/context/ToastContext.jsx');
const { ProContext } = await load('features/pro/context/ProContext.jsx');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { lessonApi } = await load('features/courses/api/lessonApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { default: CourseDetailPage } = await load('features/courses/pages/CourseDetailPage.jsx');

const originalAdapter = axiosClient.defaults.adapter;
const originals = [courseApi, sectionApi, lessonApi, reviewApi, learningApi].map(api => [api, { ...api }]);
const originalConfirm = window.confirm;
const originalAlert = window.alert;

function LocationDisplay() {
  const { pathname, search } = useLocation();
  return h('output', { id: 'loc' }, pathname + search);
}

async function renderPage(
  path = '/courses/42',
  auth = { user: null, isAuthenticated: false, isLoading: false },
  pro = { membership: null, loading: false },
) {
  await env.render(
    h(
      ToastProvider,
      null,
      h(
        AuthContext.Provider,
        { value: auth },
        h(
          ProContext.Provider,
          { value: pro },
          h(
            MemoryRouter,
            { initialEntries: [path] },
            h(
              Routes,
              null,
              h(Route, { path: '/courses/:id', element: h(CourseDetailPage) }),
              h(Route, { path: '*', element: h(LocationDisplay) }),
            ),
          ),
        ),
      ),
    ),
  );
  await flush();
}

beforeEach(() => {
  axiosClient.defaults.adapter = async config => ({
    config,
    status: 200,
    headers: {},
    data: { success: true, data: [] },
  });
});

afterEach(async () => {
  await unmount();
  originals.forEach(([api, methods]) => Object.assign(api, methods));
  axiosClient.defaults.adapter = originalAdapter;
  window.confirm = originalConfirm;
  window.alert = originalAlert;
});

after(async () => {
  await env.close();
});

test('signed-in learner with data: null myReview response sees ReviewForm and can submit first review', async () => {
  let myReviewCalls = 0;
  let createdPayload = null;
  let currentMyReview = null;

  courseApi.getById = async () => ({
    data: {
      id: 42,
      title: 'IELTS Speaking Booster',
      categoryName: 'IELTS',
      description: 'Speak fluently',
      level: 'INTERMEDIATE',
      price: 0,
      status: 'PUBLISHED',
      avgRating: 4.5,
      reviewCount: 0,
    },
  });
  sectionApi.listByCourse = async () => ({ data: [] });
  reviewApi.list = async () => ({ data: { content: currentMyReview ? [currentMyReview] : [], totalPages: 1 } });
  reviewApi.myReview = async () => {
    myReviewCalls++;
    return { success: true, data: currentMyReview };
  };
  reviewApi.create = async (_cId, payload) => {
    createdPayload = payload;
    currentMyReview = {
      id: 501,
      userId: 7,
      userFullName: 'Learner One',
      ...payload,
      createdAt: '2026-11-20T00:00:00Z',
    };
    return { success: true, data: currentMyReview };
  };
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 42, status: 'ACTIVE' }] });

  await renderPage('/courses/42', {
    user: { id: 7, fullName: 'Learner One', roles: ['USER'] },
    isAuthenticated: true,
    isLoading: false,
  });

  assert.equal(myReviewCalls, 1);

  const reviewTab = [...document.querySelectorAll('[role="tab"]')].find(b =>
    /đánh giá/i.test(b.textContent || ''),
  );
  assert.ok(reviewTab);
  await act(async () => reviewTab.click());
  await flush(2);

  const textarea = document.querySelector('textarea');
  assert.ok(textarea, 'Expected ReviewForm textarea when myReview returns data: null');
  assert.match(document.body.textContent, /Viết đánh giá của bạn/);

  await setInputValue(textarea, 'Great course for speaking practice!');
  const submitBtn = textarea.closest('form')?.querySelector('button[type="submit"]');
  assert.ok(submitBtn);
  await act(async () => submitBtn.click());
  await flush();

  assert.equal(createdPayload?.comment, 'Great course for speaking practice!');
  assert.match(document.body.textContent, /Đánh giá của bạn/);
  assert.match(document.body.textContent, /Great course for speaking practice!/);
});

test('course details distinguish a missing course from temporary invalid data and retry', async t => {
  let loads = 0;
  t.mock.method(courseApi, 'getById', async () => {
    if (++loads === 1) throw Object.assign(new Error('Not found'), { status: 404 });
    if (loads === 2) return { data: { id: 42 } };
    return { data: { id: 42, title: 'Reading course', price: 0, status: 'PUBLISHED' } };
  });
  t.mock.method(sectionApi, 'listByCourse', async () => { throw new Error('Sections unavailable'); });
  t.mock.method(reviewApi, 'list', async () => { throw new Error('Reviews unavailable'); });
  await renderPage();
  assert.match(document.body.textContent, /Không tìm thấy khóa học/);
  await unmount();
  await renderPage();
  assert.match(document.body.textContent, /Dữ liệu khóa học không hợp lệ/);
  await env.click(env.button('Thử lại'));
  assert.match(document.body.textContent, /Reading course/);
  await env.click('#btn-enroll-free');
  assert.equal(document.querySelector('#loc').textContent, '/login');
});

test('the course review moderator can change visibility on a paginated list and retry failures', async t => {
  t.mock.method(courseApi, 'getById', async () => ({ data: { id: 42, title: 'Reading course', price: 0 } }));
  t.mock.method(sectionApi, 'listByCourse', async () => ({ data: [] }));
  t.mock.method(learningApi, 'getMyEnrollments', async () => { throw new Error('Enrollment lookup unavailable'); });
  t.mock.method(reviewApi, 'myReview', async () => { throw new Error('Review lookup unavailable'); });
  let hidden = false;
  const list = t.mock.method(reviewApi, 'list', async (_, { page }) => ({ data: {
    page, totalPages: 2, content: [{ id: 9, userId: 77, rating: 5, comment: 'Course feedback', hidden }],
  } }));
  t.mock.method(reviewApi, 'hide', async () => { hidden = true; });
  let reveals = 0;
  t.mock.method(reviewApi, 'show', async () => {
    if (++reveals === 1) throw new Error('Moderation failed');
    hidden = false;
  });
  const alert = t.mock.method(globalThis, 'alert', message => message);

  await renderPage('/courses/42', {
    user: { id: 7, roles: ['ADMIN'] }, isAuthenticated: true, isLoading: false,
  });
  await env.click([...document.querySelectorAll('[role="tab"]')][1]);
  await env.click(env.button('Trang sau'));
  assert.equal(list.mock.calls.at(-1).arguments[1].page, 1);
  await env.click(env.button('Ẩn review'));
  await env.click(env.button('Bỏ ẩn'));
  assert.deepEqual(alert.mock.calls[0].arguments, ['Thao tác thất bại']);
  await env.click(env.button('Bỏ ẩn'));
  await env.click(env.button('Trang trước'));
  assert.equal(list.mock.calls.at(-1).arguments[1].page, 0);
});

test('CourseDetailPage covers enrolled flow, video preview, ReviewForm create/edit/delete and checkout navigation', async () => {
  const reviewActions = [];
  let currentMyReview = null;
  let allReviews = [
    {
      id: 101,
      userId: 99,
      userFullName: 'Bob',
      rating: 5,
      comment: 'Excellent course!',
      createdAt: new Date().toISOString(),
    },
  ];

  courseApi.getById = async () => ({
    data: {
      id: 42,
      title: 'TOEIC Mastery',
      categoryName: 'TOEIC',
      description: 'Complete TOEIC prep',
      level: 'INTERMEDIATE',
      price: 499000,
      originalPrice: 799000,
      avgRating: 4.5,
      reviewCount: 2,
      thumbnailUrl: '/images/english-toeic.jpg',
    },
  });
  sectionApi.listByCourse = async () => ({
    data: [
      {
        id: 1,
        title: 'Part 1 & 2',
        lessons: [
          { id: 11, title: 'YouTube Video Lesson', lessonType: 'VIDEO', preview: true, duration: 180 },
          { id: 12, title: 'Direct MP4 Lesson', lessonType: 'VIDEO', preview: true, duration: 90 },
          { id: 13, title: 'Locked Grammar Lesson', lessonType: 'TEXT', preview: false, duration: 60 },
        ],
      },
    ],
  });
  lessonApi.getPlayUrl = async (_cId, lId) => ({
    data:
      lId === 11
        ? { lessonType: 'VIDEO', playUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expiresInSeconds: 300 }
        : { lessonType: 'VIDEO', playUrl: 'https://cdn.example.com/lesson.mp4', expiresInSeconds: 300 },
  });
  reviewApi.list = async () => ({ data: { content: allReviews, totalPages: 2 } });
  reviewApi.myReview = async () => ({ data: currentMyReview });
  reviewApi.create = async (_cId, payload) => {
    reviewActions.push(['create', payload]);
    currentMyReview = { id: 202, userId: 7, userFullName: 'Me', ...payload, createdAt: new Date().toISOString() };
    allReviews = [currentMyReview, ...allReviews];
    return { data: currentMyReview };
  };
  reviewApi.update = async (_cId, rId, payload) => {
    reviewActions.push(['update', rId, payload]);
    currentMyReview = { ...currentMyReview, ...payload };
    allReviews = [currentMyReview, allReviews[1]];
    return { data: currentMyReview };
  };
  reviewApi.delete = async (_cId, rId) => {
    reviewActions.push(['delete', rId]);
    currentMyReview = null;
    allReviews = [allReviews[1]];
    return { data: {} };
  };
  learningApi.getMyEnrollments = async () => ({ data: [] });

  window.confirm = () => true;

  // 1. Paid course not yet enrolled: open YouTube video preview + direct mp4 preview + click buy
  await renderPage('/courses/42', {
    user: { id: 7, fullName: 'Me', roles: ['USER'] },
    isAuthenticated: true,
    isLoading: false,
  });

  const previewRows = [...document.querySelectorAll('.curriculum-lesson-row')];
  assert.ok(previewRows[0]);
  await act(async () => previewRows[0].click());
  await flush();
  assert.ok(document.querySelector('.preview-modal-card iframe'));
  await act(async () => document.querySelector('.preview-modal-head button')?.click());

  assert.ok(previewRows[1]);
  await act(async () => previewRows[1].click());
  await flush();
  const videoEl = document.querySelector('.preview-modal-card video');
  assert.ok(videoEl);
  // Exercise video fallback error handler
  videoEl.load = () => {};
  videoEl.play = () => Promise.resolve();
  await act(async () => videoEl.dispatchEvent(new dom.window.Event('error')));
  assert.equal(videoEl.dataset.fallbackTried, 'true');
  await act(async () => document.querySelector('.preview-modal-head button')?.click());

  const buyBtn = document.querySelector('#btn-buy-course');
  assert.ok(buyBtn);
  await act(async () => buyBtn.click());
  await flush();
  assert.equal(document.querySelector('#loc')?.textContent, '/checkout?course=42');

  // 2. Signed-in ENROLLED learner: submit, edit, delete review
  await unmount();
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 42, status: 'ACTIVE' }] });
  await renderPage('/courses/42', {
    user: { id: 7, fullName: 'Me', roles: ['USER'] },
    isAuthenticated: true,
    isLoading: false,
  });

  const tabBtns = [...document.querySelectorAll('[role="tab"]')].filter(b =>
    /đánh giá/i.test(b.textContent || ''),
  );
  assert.ok(tabBtns[0]);
  await act(async () => tabBtns[0].click());
  await flush(2);

  const commentBox = document.querySelector('textarea');
  assert.ok(commentBox, 'Expected ReviewForm textarea after opening reviews');
  const starPick = commentBox.closest('form')?.querySelector('button[aria-label$=" sao"]');
  if (starPick) await act(async () => starPick.click());
  const reviewSubmit = commentBox.closest('form')?.querySelector('button[type="submit"]');
  assert.ok(reviewSubmit);
  await setInputValue(commentBox, 'Great structured lessons and practice!');
  await act(async () => reviewSubmit.click());
  await flush();

  const editBtn = [...document.querySelectorAll('button')].find(b => /^sửa/i.test(b.textContent.trim()));
  assert.ok(editBtn);
  await act(async () => editBtn.click());
  const editBox = document.querySelector('textarea');
  assert.ok(editBox);
  await setInputValue(editBox, 'Updated detailed review!');
  const saveEdit = editBox.closest('form')?.querySelector('button[type="submit"]');
  await act(async () => saveEdit.click());
  await flush();

  const delBtn = [...document.querySelectorAll('button')].find(b => /^xóa/i.test(b.textContent.trim()));
  assert.ok(delBtn);
  await act(async () => delBtn.click());
  await flush();

  assert.deepEqual(
    reviewActions.map(([op]) => op),
    ['create', 'update', 'delete'],
  );
  assert.ok(document.querySelector('textarea'), 'ReviewForm reopens after deleting own review');
});
