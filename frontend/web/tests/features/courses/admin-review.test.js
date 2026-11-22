import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-review' });
const { load, unmount, flush, setInputValue } = env;

const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { ToastProvider } = await load('shared/context/ToastContext.jsx');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { default: AdminReviewPage } = await load('features/courses/pages/AdminReviewPage.jsx');

const originalAdapter = axiosClient.defaults.adapter;
const originals = [courseApi, reviewApi].map(api => [api, { ...api }]);

async function renderAdminReviews(initialEntry = '/admin/reviews') {
  await env.render(
    h(
      ToastProvider,
      null,
      h(
        AuthContext.Provider,
        {
          value: {
            user: { id: 1, roles: ['ADMIN'], permissions: ['COURSE_VIEW', 'COURSE_UPDATE'] },
            isAuthenticated: true,
            isLoading: false,
          },
        },
        h(
          MemoryRouter,
          { initialEntries: [initialEntry] },
          h(
            Routes,
            null,
            h(Route, { path: '/admin/reviews', element: h(AdminReviewPage) }),
            h(Route, { path: '/admin/courses/:courseId/reviews', element: h(AdminReviewPage) }),
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
});

after(async () => {
  await env.close();
});

test('AdminReviewPage calls reviewApi.adminList and unhiding makes the review visible again', async () => {
  const adminListCalls = [];
  const showCalls = [];
  let reviews = [
    {
      id: 30,
      courseId: 1,
      courseTitle: 'Course A',
      userFullName: 'User 1',
      rating: 2,
      comment: 'Hidden one',
      hidden: true,
    },
    {
      id: 31,
      courseId: 1,
      courseTitle: 'Course A',
      userFullName: 'User 2',
      rating: 5,
      comment: 'Visible one',
      hidden: false,
    },
  ];

  courseApi.list = async () => ({ data: { content: [{ id: 1, title: 'Course A' }] } });
  reviewApi.adminList = async (courseId, params) => {
    adminListCalls.push({ courseId, params });
    return { data: { items: reviews.map(r => ({ ...r })), totalPages: 2, totalElements: reviews.length } };
  };
  reviewApi.show = async (courseId, id) => {
    showCalls.push([courseId, id]);
    reviews = reviews.map(r => (r.id === id ? { ...r, hidden: false } : r));
  };
  reviewApi.hide = async (courseId, id) => {
    reviews = reviews.map(r => (r.id === id ? { ...r, hidden: true } : r));
  };

  await renderAdminReviews('/admin/reviews');

  assert.equal(adminListCalls.length, 1);
  assert.equal(adminListCalls[0].courseId, undefined);
  assert.match(document.body.textContent, /Hidden one/);
  assert.match(document.body.textContent, /Đã ẩn vi phạm/);

  const showBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Bỏ ẩn');
  assert.ok(showBtn, 'Expected Bỏ ẩn button for hidden review');
  await act(async () => showBtn.click());
  await flush();

  assert.deepEqual(showCalls, [[1, 30]]);
  assert.equal(reviews.find(r => r.id === 30).hidden, false);
  assert.equal(
    [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Bỏ ẩn').length,
    0,
  );
  assert.equal(
    [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Ẩn review').length,
    2,
  );
});

test('AdminReviewPage covers course/status filtering, pagination, fallback visibility update and load error', async () => {
  const requests = [];
  let failNext = true;
  let reviews = [
    { id: 1, courseId: 5, courseTitle: 'Course 5', userId: 11, rating: 4, comment: 'Good', hidden: false },
    { id: 2, courseId: 5, courseTitle: 'Course 5', userId: 12, rating: 1, comment: '', hidden: true },
  ];

  courseApi.list = async () => ({ data: [{ id: 5, title: 'Course 5' }] });
  courseApi.adminGetById = async id => ({ data: { id, title: 'Course 5', avgRating: 2.5 } });
  reviewApi.adminList = async (courseId, params) => {
    requests.push({ courseId, params });
    if (failNext) {
      failNext = false;
      throw { response: { data: { message: 'Failed to load reviews' } } };
    }
    return { data: { content: reviews.map(r => ({ ...r })), page: params.page, totalPages: 2, totalElements: 12 } };
  };
  reviewApi.hide = undefined;
  reviewApi.show = undefined;
  reviewApi.updateVisibility = async (id, hidden) => {
    reviews = reviews.map(r => (r.id === id ? { ...r, hidden } : r));
  };

  await renderAdminReviews('/admin/reviews');
  assert.match(document.body.textContent, /Failed to load reviews/);

  // Filter by course triggers fresh fetch and clears error
  await setInputValue('#course-select-filter', '5');
  await flush();
  assert.match(document.body.textContent, /Đánh giá: Course 5/);
  assert.match(document.body.textContent, /\(Không có nhận xét\)/);

  // Status filter: HIDDEN then VISIBLE then ALL
  await setInputValue('#status-select-filter', 'HIDDEN');
  assert.doesNotMatch(document.body.textContent, /Học viên #11/);
  await setInputValue('#status-select-filter', 'VISIBLE');
  assert.doesNotMatch(document.body.textContent, /Học viên #12/);
  await setInputValue('#status-select-filter', 'ALL');

  // Toggle hide via updateVisibility fallback
  const hideBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ẩn review');
  assert.ok(hideBtn);
  await act(async () => hideBtn.click());
  await flush();
  assert.equal(reviews.find(r => r.id === 1).hidden, true);

  // Pagination next and prev
  const nextBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Trang sau');
  assert.ok(nextBtn);
  await act(async () => nextBtn.click());
  await flush();
  const prevBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Trang trước');
  assert.ok(prevBtn);
  await act(async () => prevBtn.click());
  await flush();
  assert.equal(requests.at(-1).params.page, 0);
});
