import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'toeic-reader' });
const { default: Reader } = await env.load('features/learning/pages/ToeicReaderPage.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');

afterEach(env.unmount);
after(env.close);

const exam = {
  id: 7,
  title: 'Practice set',
  questions: [
    { id: 1, part: 5 },
    { id: 2, part: 6 },
  ],
};

function Destination() {
  return h('output', null, useLocation().pathname);
}

function render() {
  return env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/exams/toeic/tests/7'] },
      h(
        AuthContext.Provider,
        { value: { user: { id: 1 } } },
        h(
          Routes,
          null,
          h(Route, { path: '/exams/toeic/tests/:testId', element: h(Reader) }),
          h(Route, { path: '*', element: h(Destination) }),
        ),
      ),
    ),
  );
}

test('practice validates custom time, retries failed starts and sends the selected part', async t => {
  t.mock.method(toeicApi, 'detail', async () => ({ data: exam }));
  t.mock.method(toeicApi, 'progress', async () => ({ data: { attempts: [] } }));
  let attempts = 0;
  const start = t.mock.method(toeicApi, 'start', async () => {
    if (++attempts === 1) throw new Error('Attempt service busy');
    return { data: { id: 21, status: 'IN_PROGRESS' } };
  });
  await render();
  for (const mode of ['exam', 'practice']) {
    const card = document.querySelector(`.toeic-mode-card.is-${mode}`);
    await act(async () =>
      card.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    assert.equal(card.getAttribute('aria-pressed'), 'true');
  }
  await env.click('.toeic-scope-card:nth-child(2) h3');
  assert.match(document.body.textContent, /Sẵn sàng luyện Part 5/);
  await env.click('.toeic-scope-card:first-child h3');
  await env.click(env.button('Tùy chỉnh'));
  await env.setInputValue('[aria-label="Số phút tùy chỉnh"]', '0');
  await env.click(env.button('Luyện trọn bộ'));
  assert.match(document.body.textContent, /số nguyên từ 1 đến 180 phút/);
  assert.equal(start.mock.callCount(), 0);
  await env.setInputValue('[aria-label="Số phút tùy chỉnh"]', '35');
  await env.click(env.button('Luyện Part 5'));
  assert.match(document.body.textContent, /Attempt service busy/);
  await env.click(env.button('Luyện Part 5'));
  assert.deepEqual(
    start.mock.calls.map(call => call.arguments),
    [
      ['7', 'PRACTICE', 5, 35],
      ['7', 'PRACTICE', 5, 35],
    ],
  );
  assert.equal(document.querySelector('output').textContent, '/exams/toeic/attempts/21');
});

test('reader offers a return route for an absent exam and opens completed history rows', async t => {
  let available = false;
  t.mock.method(toeicApi, 'detail', async () => ({ data: available ? exam : null }));
  t.mock.method(toeicApi, 'progress', async () => ({
    data: { attempts: [{ id: 8, status: 'GRADED', mode: 'EXAM' }] },
  }));
  await render();
  assert.match(document.body.textContent, /Không tìm thấy bộ đề/);
  await env.unmount();
  available = true;
  await render();
  await env.click('.toeic-history-list article strong');
  assert.equal(document.querySelector('output').textContent, '/exams/toeic/attempts/8/result');
});
