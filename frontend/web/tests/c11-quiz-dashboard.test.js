import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { default: QuizPage } = await load('features/learning/pages/QuizPage.jsx');
const { default: QuizResultPage } = await load('features/learning/pages/QuizResultPage.jsx');
const { default: AdminQuizPage } = await load('features/learning/pages/AdminQuizPage.jsx');
const { default: UserDashboardPage } = await load('features/learning/pages/UserDashboardPage.jsx');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { NotificationsContext } = await load('features/learning/context/NotificationsContext.jsx');
const { invalidateSessionRequests } = await load('shared/utils/tokenUtils.js');
const { AUTH_CHANGED_EVENT } = await load('shared/constants/appConstants.js');
const originalApis = [learningApi, courseApi].map(api => [api, { ...api }]);
const cache = createCache({ key: 'quiz-dashboard-test' });
let root;
let navigate;

function Navigation() {
  navigate = useNavigate();
  return null;
}

const question = () => ({
  id: 11,
  questionText: 'Câu hỏi thực tế',
  questionType: 'SINGLE_CHOICE',
  points: 2,
  options: [
    { id: 111, optionText: 'Đáp án A', correct: true },
    { id: 112, optionText: 'Đáp án B', correct: false },
  ],
});
const quiz = (id = 21) => ({
  id,
  courseId: 42,
  title: 'Quiz ' + id,
  passingScore: 70,
  timeLimitMinutes: 5,
  questions: [question()],
});
const attempt = (quizId = 21, attemptId = 91) => ({
  attemptId,
  quizId,
  courseId: 42,
  startedAt: new Date().toISOString(),
  status: 'IN_PROGRESS',
});
const review = (attemptId = 91, quizId = 21) => ({
  ...quiz(quizId),
  quizId,
  attemptId,
  quizTitle: 'Kết quả ' + quizId,
  score: 100,
  passed: true,
  questions: [{ ...question(), correct: true, answered: true, pointsAwarded: 2 }],
});
const dashboard = () => ({
  activeEnrollments: 1,
  completedEnrollments: 2,
  completedLessons: 3,
  recentEnrollments: [{ id: 7, courseId: 42, status: 'ACTIVE' }],
  recentQuizResults: [{ attemptId: 91, quizId: 21, score: 85 }],
});

async function render(path, { userId = 1, revision = 0, unreadCount = 4, notificationError = null } = {}) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user: { id: userId } } },
          h(
            NotificationsContext.Provider,
            {
              value: {
                revision,
                summary: { unreadCount, notifications: [] },
                error: notificationError,
                refresh() {},
              },
            },
            h(
              MemoryRouter,
              { initialEntries: [path] },
              h(Navigation),
              h(
                Routes,
                null,
                h(Route, { path: '/quizzes/:quizId', element: h(QuizPage) }),
                h(Route, { path: '/quizzes/attempts/:attemptId/result', element: h(QuizResultPage) }),
                h(Route, { path: '/admin/quizzes', element: h(AdminQuizPage) }),
                h(Route, { path: '/dashboard', element: h(UserDashboardPage) }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function button(text) {
  const element = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(element, 'Missing button: ' + text);
  return element;
}

async function click(text) {
  await act(async () => button(text).click());
}

beforeEach(() => {
  window.sessionStorage.clear();
  learningApi.getQuiz = async id => ({ data: quiz(Number(id)) });
  learningApi.startQuiz = async id => ({ data: attempt(Number(id)) });
  learningApi.getQuizReview = async id => ({ data: review(Number(id)) });
  learningApi.getDashboard = async () => ({ data: dashboard() });
  learningApi.getAdminQuizzes = async () => ({
    data: [{ id: 21, courseId: 42, title: 'Bản nháp', published: false }],
  });
  learningApi.getAdminQuiz = async () => ({ data: { ...quiz(), published: false } });
  courseApi.adminList = async () => ({ data: { items: [{ id: 42, title: 'Khóa Java thực tế' }] } });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  originalApis.forEach(([api, methods]) => Object.assign(api, methods));
});
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Event;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('quiz load failure is retryable; resumed attempt restores only its valid saved answers', async () => {
  learningApi.getQuiz = async () => {
    throw new Error('Mất kết nối');
  };
  await render('/quizzes/21');
  assert.match(document.body.textContent, /Mất kết nối/);
  learningApi.getQuiz = async () => ({ data: quiz() });
  await click('Thử lại');
  window.sessionStorage.setItem(
    'quiz-draft:1:21',
    JSON.stringify({
      attemptId: 91,
      answers: { 11: [111, 112, 999], 99: [1000] },
    }),
  );
  await click('Bắt đầu làm bài');
  assert.equal(document.querySelector('input[type=radio]').checked, true);
  assert.match(document.body.textContent, /Đã trả lời: 1\/1/);
  assert.equal(document.querySelectorAll('input:checked').length, 1);
});

test('changing quiz clears old questions immediately and ignores a late start response', async () => {
  let finishStart;
  let finishLoad;
  learningApi.startQuiz = () =>
    new Promise(resolve => {
      finishStart = resolve;
    });
  learningApi.getQuiz = async id =>
    Number(id) === 21
      ? { data: quiz() }
      : new Promise(resolve => {
          finishLoad = resolve;
        });
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  await act(async () => navigate('/quizzes/22'));
  assert.doesNotMatch(document.body.textContent, /Quiz 21/);
  await act(async () => finishStart({ data: attempt(21) }));
  await act(async () => finishLoad({ data: quiz(22) }));
  assert.match(document.body.textContent, /Quiz 22/);
  assert.equal(document.querySelector('.quiz-taking-form'), null);
  assert.ok(button('Bắt đầu làm bài'));
});

test('submit failure keeps answers and retry uses the attempt route; duplicate clicks submit once', async () => {
  let submissions = 0;
  learningApi.submitQuiz = async (id, answers) => {
    submissions++;
    assert.equal(id, 91);
    assert.deepEqual(answers, [{ questionId: 11, optionIds: [111] }]);
    if (submissions === 1) throw new Error('Chưa nộp được');
    return { data: { attemptId: 91 } };
  };
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  await act(async () => document.querySelector('input[type=radio]').click());
  await click('Nộp bài');
  assert.match(document.body.textContent, /Chưa nộp được/);
  assert.equal(document.querySelector('input[type=radio]').checked, true);
  await act(async () => {
    const submit = button('Nộp bài');
    submit.click();
    submit.click();
  });
  assert.equal(submissions, 2);
  assert.match(document.body.textContent, /Lượt làm #91/);
  assert.equal(window.sessionStorage.getItem('quiz-draft:1:21'), null);
});

test('a late submit after leaving the quiz cannot navigate back to a previous attempt', async () => {
  let finishSubmit;
  learningApi.submitQuiz = () =>
    new Promise(resolve => {
      finishSubmit = resolve;
    });
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  await click('Nộp bài');
  await act(async () => navigate('/quizzes/22'));
  await act(async () => finishSubmit({ data: { attemptId: 91 } }));
  assert.match(document.body.textContent, /Quiz 22/);
  assert.doesNotMatch(document.body.textContent, /Lượt làm #91/);
});

test('attempt expiry uses server start time and clears its draft without submitting', async () => {
  learningApi.startQuiz = async () => ({
    data: { ...attempt(), startedAt: new Date(Date.now() - 6 * 60000).toISOString() },
  });
  let submissions = 0;
  learningApi.submitQuiz = async () => {
    submissions++;
  };
  window.sessionStorage.setItem('quiz-draft:1:21', JSON.stringify({ attemptId: 91, answers: { 11: [111] } }));
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  assert.match(document.body.textContent, /Đã hết thời gian làm bài/);
  assert.equal(document.querySelector('.quiz-taking-form'), null);
  assert.equal(window.sessionStorage.getItem('quiz-draft:1:21'), null);
  assert.equal(submissions, 0);
  assert.ok(button('Làm lượt mới'));
});

test('changing accounts resets an attempt and ignores a response from the ended session', async () => {
  let finishStart;
  learningApi.startQuiz = () =>
    new Promise(resolve => {
      finishStart = resolve;
    });
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  invalidateSessionRequests();
  await render('/quizzes/21', { userId: 2 });
  await act(async () => finishStart({ data: attempt() }));
  assert.equal(document.querySelector('.quiz-taking-form'), null);
  assert.equal(window.sessionStorage.getItem('quiz-draft:2:21'), null);
  assert.ok(button('Bắt đầu làm bài'));
});

test('a new session for the same user resets quiz state and rejects the previous pending start', async () => {
  let finish;
  learningApi.startQuiz = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  await render('/quizzes/21');
  await click('Bắt đầu làm bài');
  await act(async () => {
    invalidateSessionRequests();
    window.dispatchEvent(new dom.window.Event(AUTH_CHANGED_EVENT));
  });
  await act(async () => finish({ data: attempt() }));
  assert.equal(document.querySelector('.quiz-taking-form'), null);
  assert.ok(
    [...document.querySelectorAll('button')].some(
      item => item.textContent.includes('Bắt đầu làm bài') && !item.disabled,
    ),
  );
  learningApi.startQuiz = async () => ({ data: attempt(21, 92) });
  await click('Bắt đầu làm bài');
  assert.ok(document.querySelector('.quiz-taking-form'));
});

test('result navigation ignores a previous review and ownership denial remains retryable', async () => {
  let finishOld;
  learningApi.getQuizReview = id =>
    String(id) === '91'
      ? new Promise(resolve => {
          finishOld = resolve;
        })
      : Promise.reject(Object.assign(new Error('Không có quyền'), { status: 403 }));
  await render('/quizzes/attempts/91/result');
  await act(async () => navigate('/quizzes/attempts/92/result'));
  await act(async () => finishOld({ data: review() }));
  assert.match(document.body.textContent, /Bạn không có quyền xem kết quả này/);
  assert.equal(document.querySelector('.quiz-result-card'), null);
  learningApi.getQuizReview = async () => ({ data: review(92, 22) });
  await click('Thử lại');
  assert.match(document.body.textContent, /Lượt làm #92/);
  assert.equal(document.querySelector('.quiz-result-card a').getAttribute('href'), '/quizzes/22');
});

test('dashboard refreshes server counts and exact result links on notification revisions', async () => {
  await render('/dashboard');
  assert.deepEqual(
    [...document.querySelectorAll('.learning-stat-card strong')].map(item => item.textContent),
    ['1', '2', '3', '4'],
  );
  assert.ok(document.querySelector('a[href="/quizzes/attempts/91/result"]'));
  learningApi.getDashboard = async () => ({
    data: {
      ...dashboard(),
      activeEnrollments: 0,
      completedEnrollments: 3,
      completedLessons: 8,
      recentEnrollments: [{ id: 7, courseId: 42, status: 'CANCELLED' }],
    },
  });
  await render('/dashboard', { revision: 1, unreadCount: 5 });
  assert.deepEqual(
    [...document.querySelectorAll('.learning-stat-card strong')].map(item => item.textContent),
    ['0', '3', '8', '5'],
  );
  assert.equal(document.querySelector('a[href="/learning/42"]'), null);
  assert.match(document.body.textContent, /Đã hủy/);
});

test('dashboard errors show no demo, retry recovers empty states, and unread count loads independently', async () => {
  learningApi.getDashboard = async () => {
    throw new Error('Dashboard unavailable');
  };
  await render('/dashboard', { unreadCount: 7 });
  assert.equal(document.querySelectorAll('.learning-row').length, 0);
  assert.deepEqual(
    [...document.querySelectorAll('.learning-stat-card strong')].map(item => item.textContent),
    ['—', '—', '—', '7'],
  );
  learningApi.getDashboard = async () => ({
    data: {
      ...dashboard(),
      activeEnrollments: 0,
      completedEnrollments: 0,
      completedLessons: 0,
      recentEnrollments: [],
      recentQuizResults: [],
    },
  });
  await click('Thử lại');
  assert.match(document.body.textContent, /Bạn chưa ghi danh khóa học nào/);
  assert.match(document.body.textContent, /Bạn chưa có kết quả quiz/);
});

test('admin retries list loading, accepts Course items, and rejects a quiz with no correct answer', async () => {
  learningApi.getAdminQuizzes = async () => {
    throw new Error('Quiz list unavailable');
  };
  await render('/admin/quizzes');
  assert.match(document.body.textContent, /Không thể tải danh sách quiz/);
  assert.doesNotMatch(document.body.textContent, /Chưa có quiz/);
  learningApi.getAdminQuizzes = async () => ({ data: [{ id: 21, courseId: 42, title: 'Bản nháp' }] });
  learningApi.getAdminQuiz = async () => ({
    data: {
      ...quiz(),
      published: false,
      questions: [
        { ...question(), options: question().options.map(option => ({ ...option, correct: false })) },
      ],
    },
  });
  let writes = 0;
  learningApi.updateQuiz = async () => {
    writes++;
    return { data: { id: 21 } };
  };
  await click('Thử lại');
  await click('Bản nháp');
  assert.match(document.querySelector('.quiz-editor').textContent, /Khóa Java thực tế/);
  await act(async () =>
    document
      .querySelector('.quiz-editor')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.match(document.body.textContent, /Câu 1 cần đúng một đáp án đúng/);
  assert.equal(writes, 0);
  await act(async () => document.querySelector('.quiz-option-editor input[type=checkbox]').click());
  await act(async () =>
    document
      .querySelector('.quiz-editor')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.equal(writes, 1);
  assert.match(document.body.textContent, /Đã lưu bản nháp quiz/);
});

test('admin prevents resetting an editor while loading a quiz and reports list refresh separately after save', async () => {
  let finishLoad;
  learningApi.getAdminQuiz = () =>
    new Promise(resolve => {
      finishLoad = resolve;
    });
  await render('/admin/quizzes');
  await click('Bản nháp');
  assert.equal(button('Quiz mới').disabled, true);
  await act(async () => finishLoad({ data: { ...quiz(), published: false } }));
  learningApi.updateQuiz = async () => ({ data: { id: 21 } });
  learningApi.getAdminQuizzes = async () => {
    throw new Error('Reload unavailable');
  };
  await act(async () =>
    document
      .querySelector('.quiz-editor')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
  );
  assert.match(document.body.textContent, /Đã lưu bản nháp quiz/);
  assert.match(document.body.textContent, /Không thể tải danh sách quiz/);
  assert.ok(button('Lưu thay đổi'));
});
