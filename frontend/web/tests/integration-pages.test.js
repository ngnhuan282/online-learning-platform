import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
const { default: ResultPage } = await load('features/payment/pages/PaymentResultPage.jsx');
const { default: LearningPage } = await load('features/learning/pages/LearningPage.jsx');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { ToastContext } = await load('shared/context/ToastContext.jsx');
const originals = [paymentApi, learningApi].map(api => [api, { ...api }]);
let root;
const cache = createCache({ key: 'integration-test' });
const order = status => ({
  data: {
    orderCode: 'test-order',
    totalAmount: 100000,
    currency: 'VND',
    items: [{ courseId: 42, courseTitle: 'Real course' }],
    payment: { status, amount: 100000, currency: 'VND', provider: 'MOCK' },
  },
});

async function render(Component, path, route) {
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          ToastContext.Provider,
          { value: () => {} },
          h(
            MemoryRouter,
            { initialEntries: [path] },
            h(Routes, null, h(Route, { path: route, element: h(Component) })),
          ),
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

test('payment return ignores forged success query and uses backend order status', async () => {
  paymentApi.getOrder = async () => order('FAILED');
  learningApi.getMyEnrollments = async () => {
    throw new Error('Must not grant access for failed payment');
  };
  await render(
    ResultPage,
    '/payment/result?orderCode=test-order&status=SUCCESS&vnp_ResponseCode=00',
    '/payment/result',
  );
  assert.ok(document.body.textContent.includes('Thanh toán không thành công'));
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
});

test('successful payment waits for matching active enrollment before exposing learning action', async () => {
  paymentApi.getOrder = async () => order('SUCCESS');
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 41, status: 'ACTIVE' }] });
  await render(ResultPage, '/payment/result?orderCode=test-order', '/payment/result');
  assert.ok(document.body.textContent.includes('Đang chờ quyền học'));
  assert.equal(document.querySelector('a[href="/my-courses"]'), null);
  learningApi.getMyEnrollments = async () => ({ data: [{ courseId: 42, status: 'ACTIVE' }] });
  await act(async () => document.querySelector('.result-actions button').click());
  assert.ok(document.querySelector('a[href="/my-courses"]'));
});

test('private learning denial shows enrollment error and renders no demo content', async () => {
  learningApi.getLearningCourse = async () => {
    throw Object.assign(new Error('Enrollment is required'), { status: 403 });
  };
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  await render(LearningPage, '/learning/42', '/learning/:courseId');
  assert.ok(document.body.textContent.includes('Bạn chưa có quyền học khóa này'));
  assert.equal(document.querySelector('.lesson-stage'), null);
  assert.equal(document.querySelector('.lesson-progress-item'), null);
});

test('learning uses actual curriculum IDs and preserves backend progress', async () => {
  learningApi.getLearningCourse = async courseId => {
    assert.equal(courseId, '42');
    return {
      data: {
        courseId: 42,
        title: 'Real course',
        totalLessons: 1,
        completedLessons: 0,
        progressPercent: 0,
        progress: [{ lessonId: 812, status: 'IN_PROGRESS', progressPercent: 10 }],
        sections: [
          {
            id: 81,
            courseId: 42,
            title: 'Private section',
            orderIndex: 0,
            lessons: [
              {
                id: 812,
                sectionId: 81,
                title: 'Actual lesson',
                content: 'Allowed private text',
                lessonType: 'TEXT',
                orderIndex: 0,
              },
            ],
          },
        ],
      },
    };
  };
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  learningApi.markLessonComplete = async (courseId, lessonId) => {
    assert.equal(courseId, '42');
    assert.equal(lessonId, 812);
    return { data: { lessonId, status: 'COMPLETED', progressPercent: 100 } };
  };
  await render(LearningPage, '/learning/42', '/learning/:courseId');
  assert.ok(document.body.textContent.includes('Allowed private text'));
  assert.equal(document.querySelectorAll('.lesson-progress-item').length, 1);
  assert.ok(document.querySelector('.lesson-stage').textContent.includes('Đang học'));
  await act(async () => document.querySelector('.lesson-stage button').click());
  assert.ok(document.body.textContent.includes('100%'));
  assert.equal(document.querySelector('.lesson-stage button').disabled, true);
});
