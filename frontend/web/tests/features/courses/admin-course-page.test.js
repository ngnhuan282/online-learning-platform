import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-course-page' });
const { default: AdminCourses } = await env.load('features/courses/pages/AdminCoursePage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { courseApi } = await env.load('features/courses/api/courseApi.js');
const { categoryApi } = await env.load('features/courses/api/categoryApi.js');

afterEach(env.unmount);
after(env.close);

function Location() {
  return h('output', null, useLocation().pathname);
}
const user = {
  id: 1,
  roles: ['STAFF'],
  permissions: ['COURSE_VIEW', 'COURSE_UPDATE', 'COURSE_DELETE', 'COURSE_CREATE'],
};
const courses = [
  { id: 42, title: 'Reading course', categoryId: 5, categoryName: 'TOEIC', price: 0, status: 'PUBLISHED' },
  { id: 43, title: 'Writing course', categoryId: 6, categoryName: 'IELTS', price: 25000, status: 'DRAFT' },
];
const render = () =>
  env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/admin/courses'] },
      h(
        AuthContext.Provider,
        { value: { user } },
        h(
          Routes,
          null,
          h(Route, { path: '/admin/courses', element: h(AdminCourses) }),
          h(Route, { path: '*', element: h(Location) }),
        ),
      ),
    ),
  );

test('course admin retries a failed list, filters by category and routes to the correct review or curriculum page', async t => {
  let attempts = 0;
  t.mock.method(courseApi, 'adminList', async () => {
    if (++attempts === 1) throw new Error('Could not load courses');
    return { data: { content: courses, totalPages: 1, totalElements: 2 } };
  });
  t.mock.method(categoryApi, 'list', async () => ({
    data: [
      { id: 5, name: 'TOEIC' },
      { id: 6, name: 'IELTS' },
    ],
  }));

  await render();
  assert.match(document.body.textContent, /Could not load courses/);
  await env.click(env.button('Thử lại'));
  await env.setInputValue('input[placeholder="Tìm khóa học..."]', 'TOEIC');
  await env.waitFor(() => document.querySelectorAll('tbody tr').length === 1, 'Expected one filtered course');
  assert.match(document.querySelector('tbody').textContent, /Reading course/);
  await env.click('button[title="Xem đánh giá"]');
  assert.equal(document.querySelector('output').textContent, '/admin/courses/42/reviews');
  await env.unmount();
  await render();
  await env.click('button[title="Quản lý bài học"]');
  assert.equal(document.querySelector('output').textContent, '/admin/courses/42/curriculum');
});
