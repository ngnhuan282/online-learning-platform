import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'toeic-result' });
const { default: Result } = await env.load('features/learning/pages/ToeicResultPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');

afterEach(env.unmount);
after(env.close);

const result = {
  id: 21,
  examId: 7,
  title: 'Reading',
  mode: 'PRACTICE',
  status: 'GRADED',
  durationMinutes: 35,
  part: 5,
  answers: { q1: 'B', q2: 'A' },
  correctCount: 1,
  totalQuestions: 3,
  score: 33,
  questions: [1, 2, 3].map(number => ({
    id: 'q' + number,
    number,
    part: 5,
    prompt: `Reading prompt ${number}`,
    correctOptionId: 'B',
    options: ['A', 'B', 'C', 'D'].map(id => ({ id, text: id + ' answer' })),
  })),
};
function Destination() {
  return h('output', null, useLocation().pathname);
}
const render = () =>
  env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/exams/toeic/attempts/21/result'] },
      h(
        AuthContext.Provider,
        { value: { user: { id: 7 } } },
        h(
          Routes,
          null,
          h(Route, { path: '/exams/toeic/attempts/:attemptId/result', element: h(Result) }),
          h(Route, { path: '*', element: h(Destination) }),
        ),
      ),
    ),
  );

test('result review filters questions and retries the same practice configuration', async t => {
  t.mock.method(toeicApi, 'attempt', async () => ({ data: result }));
  t.mock.method(toeicApi, 'notes', async () => ({ data: {} }));
  let attempts = 0;
  const start = t.mock.method(toeicApi, 'start', async () => {
    if (++attempts === 1) throw new Error('Practice restart unavailable');
    return { data: { id: 22 } };
  });
  await render();
  await env.click(env.button('Câu sai và bỏ trống'));
  const prompt = () => document.querySelector('.toeic-question-prompt').textContent;
  assert.match(prompt(), /prompt 2/);
  await env.click(env.button('Câu tiếp'));
  assert.match(prompt(), /prompt 3/);
  await env.click(env.button('Câu trước'));
  await env.click('[aria-label="Xem lời giải câu 3"]');
  assert.match(prompt(), /prompt 3/);
  await env.click(env.button('Câu bỏ trống'));
  assert.equal(document.querySelector('[aria-label="Xem lời giải câu 2"]'), null);
  await env.click(env.button('Làm lại bộ đề'));
  assert.match(document.body.textContent, /Practice restart unavailable/);
  await env.click(env.button('Làm lại bộ đề'));
  assert.equal(document.querySelector('output').textContent, '/exams/toeic/attempts/22');
  assert.deepEqual(
    start.mock.calls.map(call => call.arguments),
    [
      [7, 'PRACTICE', 5, 35],
      [7, 'PRACTICE', 5, 35],
    ],
  );
});

test('unsubmitted results route back to the existing attempt', async t => {
  t.mock.method(toeicApi, 'attempt', async () => ({ data: { ...result, status: 'IN_PROGRESS' } }));
  await render();
  assert.match(document.body.textContent, /Bài làm chưa được nộp/);
  await env.click('a.button-primary');
  assert.equal(document.querySelector('output').textContent, '/exams/toeic/attempts/21');
});
