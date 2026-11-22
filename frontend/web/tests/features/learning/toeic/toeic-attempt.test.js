import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'toeic-attempt' });
const { default: Attempt } = await env.load('features/learning/pages/ToeicAttemptPage.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const draftKey = 'chitchatgo.toeic.attempt:3:21';

afterEach(async () => {
  await env.unmount();
  window.sessionStorage.clear();
});
after(env.close);

const exercise = {
  id: 21,
  examId: 7,
  title: 'Reading practice',
  mode: 'PRACTICE',
  status: 'IN_PROGRESS',
  answers: {},
  questions: [1, 2].map(number => ({
    id: `q${number}`,
    part: 5,
    number,
    prompt: `Reading question ${number}`,
    correctOptionId: 'B',
    explanation: 'The sentence needs a noun.',
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
      { initialEntries: ['/exams/toeic/attempts/21'] },
      h(
        AuthContext.Provider,
        { value: { user: { id: 3 } } },
        h(
          Routes,
          null,
          h(Route, { path: '/exams/toeic/attempts/:attemptId', element: h(Attempt) }),
          h(Route, { path: '*', element: h(Destination) }),
        ),
      ),
    ),
  );

test('valid saved drafts retry synchronization and clearing a choice updates the unanswered filter', async t => {
  let reads = 0;
  t.mock.method(toeicApi, 'attempt', async () => {
    if (++reads === 1) throw new Error('Attempt unavailable');
    return { data: exercise };
  });
  t.mock.method(toeicApi, 'notes', async () => ({ data: { count: 0, limit: 100 } }));
  let writes = 0;
  const save = t.mock.method(toeicApi, 'saveAnswers', async (_, answers) => {
    if (++writes === 1) throw new Error('Could not sync answers');
    return { data: { ...exercise, answers } };
  });
  window.sessionStorage.setItem(draftKey, JSON.stringify({ answers: { q1: 'B' } }));
  await render();
  assert.match(document.body.textContent, /Attempt unavailable/);
  await env.click(env.button('Thử lại'));
  assert.equal(document.querySelector('input[value="B"]').checked, true);
  await env.flush(1, 130);
  assert.match(document.body.textContent, /Could not sync answers/);
  await env.click(env.button('Thử lại'));
  assert.equal(window.sessionStorage.getItem(draftKey), null);
  assert.deepEqual(save.mock.calls[1].arguments[1], { q1: 'B' });

  await env.click('.toeic-auto-reveal-toggle input');
  assert.match(document.querySelector('.toeic-explanation').textContent, /needs a noun/);
  await env.click('.toeic-unanswered-filter input');
  assert.equal(document.querySelector('[aria-label="Đến câu 1"]'), null);
  await env.click(env.button('Câu tiếp'));
  await env.click(env.button('Câu trước'));
  await env.click(env.button('Xóa lựa chọn'));
  assert.ok(document.querySelector('[aria-label="Đến câu 1"]'));
  assert.equal(window.dispatchEvent(new window.Event('beforeunload', { cancelable: true })), false);
  await env.flush(1, 650);
  assert.deepEqual(save.mock.calls.at(-1).arguments[1], {});
});

test('foreign saved answers are ignored and an already graded attempt opens its result', async t => {
  let graded = false;
  const save = t.mock.method(toeicApi, 'saveAnswers', async () =>
    assert.fail('Invalid drafts are never saved'),
  );
  t.mock.method(toeicApi, 'notes', async () => ({ data: {} }));
  t.mock.method(toeicApi, 'attempt', async () => ({
    data: { ...exercise, status: graded ? 'GRADED' : 'IN_PROGRESS', answers: { q1: 'A' } },
  }));
  window.sessionStorage.setItem(draftKey, JSON.stringify({ answers: { q999: 'B' } }));
  await render();
  assert.equal(document.querySelector('input[value="A"]').checked, true);
  await env.unmount();
  graded = true;
  await render();
  assert.equal(document.querySelector('output').textContent, '/exams/toeic/attempts/21/result');
  assert.equal(save.mock.callCount(), 0);
});

test('a server attempt with no questions shows the empty state', async t => {
  t.mock.method(toeicApi, 'attempt', async () => ({ data: { ...exercise, questions: [] } }));
  await act(render);
  assert.match(document.body.textContent, /Bài làm không có câu hỏi/);
});
