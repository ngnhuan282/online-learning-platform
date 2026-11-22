import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'course-list' });
const { default: Catalog } = await env.load('features/courses/pages/CourseListPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { ToastProvider } = await env.load('shared/context/ToastContext.jsx');
const { courseApi } = await env.load('features/courses/api/courseApi.js');
const { categoryApi } = await env.load('features/courses/api/categoryApi.js');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

function Location() {
  const { pathname, state } = useLocation();
  return h('output', null, pathname + (state?.from ? ' ' + state.from : ''));
}

function mockCatalog(t) {
  t.mock.method(categoryApi, 'list', async () => ({ data: [] }));
  t.mock.method(courseApi, 'list', async () => ({
    data: {
      content: [
        { id: 42, title: 'Reading basics', price: 0 },
        { id: 43, title: 'Writing workshop', price: 0 },
      ],
    },
  }));
}

const render = (auth, path = '/courses') =>
  env.render(
    h(
      MemoryRouter,
      { initialEntries: [path] },
      h(
        ToastProvider,
        null,
        h(
          AuthContext.Provider,
          { value: auth },
          h(
            Routes,
            null,
            h(Route, { path: '/courses', element: h(Catalog) }),
            h(Route, { path: '*', element: h(Location) }),
          ),
        ),
      ),
    ),
  );

test('anonymous course navigation keeps the requested checkout context for sign-in', async t => {
  mockCatalog(t);
  const enroll = t.mock.method(learningApi, 'enroll', async () => assert.fail('Guests cannot enroll'));
  await render({ isAuthenticated: false }, '/courses?filter=free');
  await env.click('.course-action');
  assert.equal(document.querySelector('output').textContent, '/login /courses?filter=free');
  assert.equal(enroll.mock.callCount(), 0);
});

test('course enrollment shows a retryable failure and writes once after retry', async t => {
  mockCatalog(t);
  t.mock.method(learningApi, 'getMyEnrollments', async () => ({
    data: [
      { courseId: 42, status: 'ACTIVE' },
      { courseId: 43, status: 'CANCELLED' },
    ],
  }));
  let attempts = 0;
  const enroll = t.mock.method(learningApi, 'enroll', async courseId => {
    if (++attempts === 1) throw new Error('Enrollment unavailable');
    return { data: { courseId } };
  });

  await render({ user: { id: 7 }, isAuthenticated: true });
  const actions = [...document.querySelectorAll('.course-action')];
  assert.equal(actions[0].disabled, true);
  await env.click(actions[1]);
  assert.match(document.querySelector('[role="dialog"]').textContent, /Enrollment unavailable/);
  await env.click(env.button('Ghi danh miễn phí'));
  assert.equal(document.querySelector('output').textContent, '/my-courses');
  assert.deepEqual(
    enroll.mock.calls.map(call => call.arguments),
    [[43], [43]],
  );
});

test('failure to load enrollment status still lets learners open a course', async t => {
  mockCatalog(t);
  t.mock.method(learningApi, 'getMyEnrollments', async () => {
    throw new Error('Enrollment lookup unavailable');
  });
  await render({ user: { id: 7 }, isAuthenticated: true });
  await env.click('.course-image-button');
  assert.equal(document.querySelector('output').textContent, '/courses/42');
});
