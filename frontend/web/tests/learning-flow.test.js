import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
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
const load = path => server.ssrLoadModule('/src/' + path);
const { default: LearningPage } = await load('features/learning/pages/LearningPage.jsx');
const { default: MyCoursesPage } = await load('features/learning/pages/MyCoursesPage.jsx');
const { default: QuizResultPage } = await load('features/learning/pages/QuizResultPage.jsx');
const { default: PaymentResultPage } = await load('features/payment/pages/PaymentResultPage.jsx');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { ToastContext } = await load('shared/context/ToastContext.jsx');
const { NotificationsContext } = await load('features/learning/context/NotificationsContext.jsx');
const originals = [learningApi, paymentApi].map(api => [api, { ...api }]);
const cache = createCache({ key: 'learning-flow-test' });
let root;
let navigate;

function Navigation() {
  navigate = useNavigate();
  return null;
}

function course(id = 42) {
  return {
    courseId: id,
    title: 'Khóa Java ' + id,
    completedLessons: 0,
    totalLessons: 2,
    progressPercent: 0,
    progress: [],
    sections: [
      {
        id: 9,
        title: 'Chương Java',
        orderIndex: 0,
        lessons: [
          {
            id: 42101,
            title: 'Bài thực tế thứ nhất',
            content: 'Nội dung thật',
            lessonType: 'TEXT',
            orderIndex: 0,
          },
          {
            id: 42102,
            title: 'Bài thực tế thứ hai',
            content: 'Nội dung tiếp theo',
            lessonType: 'TEXT',
            orderIndex: 1,
          },
        ],
      },
    ],
  };
}

async function render(path, revision = 0) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          ToastContext.Provider,
          { value: () => {} },
          h(
            NotificationsContext.Provider,
            { value: { revision, summary: { unreadCount: 0, notifications: [] } } },
            h(
              MemoryRouter,
              { initialEntries: [path] },
              h(Navigation),
              h(
                Routes,
                null,
                h(Route, { path: '/learning/:courseId', element: h(LearningPage) }),
                h(Route, { path: '/my-courses', element: h(MyCoursesPage) }),
                h(Route, { path: '/payment/result', element: h(PaymentResultPage) }),
                h(Route, { path: '/quizzes/attempts/:attemptId/result', element: h(QuizResultPage) }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function button(text) {
  const result = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(result, 'Missing button: ' + text);
  return result;
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

test('learning uses real lesson IDs and updates completion instead of five demo lessons', async () => {
  const accesses = [];
  const completions = [];
  learningApi.getLearningCourse = async () => ({ data: course() });
  learningApi.getCourseQuizzes = async () => ({ data: [{ id: 77, title: 'Quiz thật', passingScore: 70 }] });
  learningApi.accessLesson = async (courseId, lessonId) => {
    accesses.push([courseId, lessonId]);
    return { data: { lessonId, status: 'IN_PROGRESS', progressPercent: 10 } };
  };
  learningApi.markLessonComplete = async (courseId, lessonId) => {
    completions.push([courseId, lessonId]);
    return { data: { lessonId, status: 'COMPLETED', progressPercent: 100 } };
  };
  await render('/learning/42');
  assert.equal(document.querySelectorAll('.lesson-progress-item').length, 2);
  assert.match(document.body.textContent, /Nội dung thật/);
  assert.doesNotMatch(document.body.textContent, /Lesson #1/);
  await act(async () => button('Đánh dấu hoàn thành').click());
  assert.match(document.querySelector('.course-progress-summary').textContent, /50%/);
  await act(async () => button('Bài thực tế thứ hai').click());
  await act(async () => button('Đánh dấu hoàn thành').click());
  assert.match(document.querySelector('.course-progress-summary').textContent, /100%/);
  assert.deepEqual(accesses, [['42', 42102]]);
  assert.deepEqual(completions, [
    ['42', 42101],
    ['42', 42102],
  ]);
  assert.equal(document.querySelector('.course-quiz-link').getAttribute('href'), '/quizzes/77');
});

test('denied learning access displays retryable error with no demo content', async () => {
  learningApi.getLearningCourse = async () => {
    throw Object.assign(new Error('Không có quyền học'), { status: 403 });
  };
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  await render('/learning/42');
  assert.match(document.body.textContent, /Không thể mở khóa học/);
  assert.equal(document.querySelector('.lesson-stage'), null);
  learningApi.getLearningCourse = async () => ({ data: course() });
  await act(async () => button('Thử lại').click());
  assert.match(document.body.textContent, /Nội dung thật/);
});

test('video playback marks an existing NOT_STARTED lesson as in progress through Gateway', async () => {
  const snapshot = course();
  snapshot.sections[0].lessons[0] = {
    ...snapshot.sections[0].lessons[0],
    lessonType: 'VIDEO',
    videoUrl: '/api/v1/media/download/videos/lesson.mp4',
  };
  snapshot.progress = [{ lessonId: 42101, status: 'NOT_STARTED', progressPercent: 0 }];
  const accesses = [];
  learningApi.getLearningCourse = async () => ({ data: snapshot });
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  learningApi.accessLesson = async (courseId, lessonId) => {
    accesses.push([courseId, lessonId]);
    return { data: { lessonId, status: 'IN_PROGRESS', progressPercent: 10 } };
  };
  await render('/learning/42');
  const video = document.querySelector('video');
  assert.equal(video.src, 'http://gateway.test/api/v1/media/download/videos/lesson.mp4');
  await act(async () => video.dispatchEvent(new dom.window.Event('play', { bubbles: true })));
  assert.deepEqual(accesses, [['42', 42101]]);
  assert.match(document.body.textContent, /Đang học/);
});

test('changing courses ignores a previous lesson mutation and resets progress', async () => {
  let finish;
  learningApi.getLearningCourse = async id => ({ data: course(id) });
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  learningApi.markLessonComplete = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  await render('/learning/42');
  await act(async () => button('Đánh dấu hoàn thành').click());
  await act(async () => navigate('/learning/43'));
  await act(async () => finish({ data: { lessonId: 42101, status: 'COMPLETED', progressPercent: 100 } }));
  assert.match(document.body.textContent, /Khóa Java 43/);
  assert.match(document.querySelector('.course-progress-summary').textContent, /0%/);
});

test('focus refresh keeps server completion after an earlier local lesson access', async () => {
  let completedElsewhere = false;
  learningApi.getLearningCourse = async () => ({
    data: {
      ...course(),
      progress: completedElsewhere
        ? [{ lessonId: 42101, status: 'COMPLETED', progressPercent: 100 }]
        : [],
    },
  });
  learningApi.getCourseQuizzes = async () => ({ data: [] });
  learningApi.accessLesson = async (_courseId, lessonId) => ({
    data: { lessonId, status: 'IN_PROGRESS', progressPercent: 10 },
  });

  await render('/learning/42');
  await act(async () => button('Bài thực tế thứ nhất').click());
  assert.match(document.querySelector('.lesson-stage').textContent, /Đang học/);
  assert.match(document.querySelector('.course-progress-summary').textContent, /0%/);

  completedElsewhere = true;
  await act(async () => window.dispatchEvent(new dom.window.Event('focus')));

  assert.match(document.querySelector('.course-progress-summary').textContent, /50%/);
  assert.match(document.querySelector('.lesson-stage').textContent, /Đã hoàn thành/);
  assert.equal(button('Đã hoàn thành').disabled, true);
});

test('My Courses error never displays demo enrollments and retry recovers', async () => {
  learningApi.getMyEnrollments = async () => {
    throw new Error('Network unavailable');
  };
  await render('/my-courses');
  assert.match(document.body.textContent, /Không thể tải khóa học của tôi/);
  assert.equal(document.querySelectorAll('.my-course-card').length, 0);
  learningApi.getMyEnrollments = async () => ({ data: [] });
  await act(async () => button('Thử lại').click());
  assert.match(document.body.textContent, /Bạn chưa ghi danh khóa học nào/);
});

test('payment success navigation reloads enrollments and displays real progress', async () => {
  paymentApi.getOrder = async () => ({
    data: {
      orderCode: 'ORDER-42',
      totalAmount: 100000,
      items: [{ courseId: 42, courseTitle: 'Khóa đã mua' }],
      payment: { status: 'SUCCESS', provider: 'MOCK', amount: 100000, currency: 'VND' },
    },
  });
  learningApi.getMyEnrollments = async () => ({
    data: [{ id: 1, courseId: 42, status: 'ACTIVE', enrolledAt: '2026-10-12T00:00:00Z' }],
  });
  learningApi.getLearningCourse = async () => ({
    data: { ...course(), progressPercent: 50, completedLessons: 1 },
  });
  await render('/payment/result?orderCode=ORDER-42');
  const link = [...document.querySelectorAll('a')].find(item => item.textContent.includes('Vào khu học tập'));
  assert.ok(link);
  await act(async () =>
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })),
  );
  assert.match(document.body.textContent, /Khóa Java 42/);
  assert.match(document.querySelector('.my-course-card').textContent, /50%/);
  assert.doesNotMatch(document.querySelector('.my-course-card').textContent, /48%/);
});

test('notification revision refreshes a mounted My Courses after paid enrollment', async () => {
  let owned = false;
  learningApi.getMyEnrollments = async () => ({
    data: owned ? [{ id: 1, courseId: 42, status: 'ACTIVE', enrolledAt: '2026-10-12T00:00:00Z' }] : [],
  });
  learningApi.getLearningCourse = async () => ({ data: course() });
  await render('/my-courses', 0);
  assert.equal(document.querySelectorAll('.my-course-card').length, 0);
  owned = true;
  await render('/my-courses', 1);
  assert.equal(document.querySelectorAll('.my-course-card').length, 1);
  assert.equal(document.querySelector('.my-course-card a').getAttribute('href'), '/learning/42');
});

test('quiz result failure remains visible after removing demo fallbacks', async () => {
  learningApi.getQuizReview = async () => {
    throw new Error('Result unavailable');
  };
  await render('/quizzes/attempts/100/result');
  assert.match(document.body.textContent, /Không thể tải kết quả quiz/);
  assert.ok(button('Thử lại'));
});
