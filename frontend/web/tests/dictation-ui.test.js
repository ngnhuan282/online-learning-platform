import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'Event', 'HTMLElement', 'DocumentFragment', 'ShadowRoot', 'Node'])
  globalThis[key] = key === 'window' ? dom.window : dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', {
  configurable: true,
  get: () => 4,
});
dom.window.HTMLMediaElement.prototype.pause = function () {
  Object.defineProperty(this, 'paused', { configurable: true, value: true });
  this.dispatchEvent(new Event('pause'));
};
dom.window.HTMLMediaElement.prototype.play = function () {
  Object.defineProperty(this, 'paused', { configurable: true, value: false });
  this.dispatchEvent(new Event('play'));
  return Promise.resolve();
};
const { createRoot } = await import('react-dom/client');
const iconModule = '\0dictation-test-icons';
const icons = [
  'ArrowBackRounded',
  'ArrowForwardRounded',
  'CheckRounded',
  'CheckCircleOutlineRounded',
  'ExpandMoreRounded',
  'ErrorOutlineRounded',
  'HeadphonesOutlined',
  'ListAltOutlined',
  'LockOutlined',
  'LightbulbOutlined',
  'ReplayRounded',
  'VisibilityOutlined',
  'AccessTimeOutlined',
  'FilterListRounded',
  'AssignmentTurnedInOutlined',
  'PlayCircleOutlineRounded',
  'SearchOutlined',
  'SubjectOutlined',
  'PauseRounded',
  'PlayArrowRounded',
  'VolumeUpOutlined',
];
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/dictation-ui',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [
    {
      name: 'dictation-test-icons',
      // Node eagerly loads the whole icon catalog from the barrel; retain only the actual icons under test.
      resolveId(source) {
        if (source === '@mui/icons-material') return iconModule;
      },
      load(id) {
        if (id === iconModule)
          return icons
            .map(name => `export { default as ${name} } from '@mui/icons-material/${name}';`)
            .join('\n');
      },
    },
  ],
});
const { default: Page } = await server.ssrLoadModule(
  '/src/features/dictation/pages/DictationPracticePage.jsx',
);
const { default: Library } = await server.ssrLoadModule(
  '/src/features/dictation/pages/DictationLibraryPage.jsx',
);
const { default: Score } = await server.ssrLoadModule(
  '/src/features/dictation/components/DictationScore.jsx',
);
const { dictationApi } = await server.ssrLoadModule('/src/features/dictation/api/dictationApi.js');
const original = { ...dictationApi };
const cache = createCache({ key: 'dictation-ui-test' });
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const answers = ['We enjoyed it.', 'They work here.'];
const expected = [
  ['we', 'enjoyed', 'it'],
  ['they', 'work', 'here'],
];
let root, router, run, restarted, writes, hints, reveals, finishes, starts, checks, pendingRequests;
let clock, timers, credits;

function attempt(id = 'run') {
  return {
    id,
    exerciseId: 'lesson',
    version: 1,
    scoringMode: 'LIVE',
    title: 'Company picnic',
    topic: 'Workplace',
    level: 'B1',
    duration: 10,
    currentIndex: 0,
    completed: 0,
    accuracy: 0,
    startedAt: '2026-11-16T10:00:00Z',
    completedAt: null,
    sentences: expected.map((words, index) => ({
      index,
      start: index * 5,
      end: index * 5 + 4,
      words: words.length,
      wordLengths: words.map(word => word.length),
    })),
    responses: expected.map((words, index) => ({
      index,
      text: '',
      completed: false,
      checked: false,
      revealed: false,
      skipped: false,
      firstAccuracy: null,
      grade: null,
      answer: null,
      hints: [],
      feedback: words.map((_word, index) => ({ index, state: 'empty', text: null })),
    })),
  };
}

// Keep grading independent of the frontend tokenizer and never mark arbitrary drafts correct.
function gradeDraft(index, text) {
  const response = run.responses[index];
  const typed = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) ?? [];
  const words = expected[index];
  response.text = text;
  response.checked = true;
  response.feedback = words.map((word, index) => ({
    index,
    state:
      typed[index] === word
        ? 'correct'
        : !typed[index]
          ? 'empty'
          : word.startsWith(typed[index])
            ? 'partial'
            : 'incorrect',
    text: typed[index] === word ? word : null,
  }));
  response.feedback.forEach(word => {
    if (word.state === 'correct' && !response.hints.some(hint => hint.index === word.index))
      credits.add(`${index}:${word.index}`);
  });
  const correct = response.feedback.filter(word => word.state === 'correct').length;
  response.grade = {
    accuracy: (correct / words.length) * 100,
    correct,
    total: words.length,
    extra: Math.max(0, typed.length - words.length),
    words: [
      ...words.map((word, i) => ({
        type: typed[i] === word ? 'correct' : typed[i] ? 'wrong' : 'missing',
        expected: typed[i] === word ? word : null,
        actual: typed[i] ?? null,
      })),
      ...typed.slice(words.length).map(actual => ({ type: 'extra', expected: null, actual })),
    ],
  };
  response.completed = correct === words.length && typed.length === words.length;
  if (response.completed) response.answer = answers[index];
  recount();
}

function recount() {
  run.completed = run.responses.filter(response => response.completed).length;
  run.accuracy = Math.round((credits.size / expected.flat().length) * 1000) / 10;
}

function snapshot() {
  return { data: structuredClone(run) };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const request = { promise, resolve, reject };
  pendingRequests.push(request);
  return request;
}

beforeEach(() => {
  run = attempt();
  restarted = null;
  writes = [];
  hints = [];
  reveals = [];
  finishes = [];
  starts = [];
  checks = 0;
  pendingRequests = [];
  credits = new Set();
  clock = 0;
  timers = new Map();
  // Advance only the 200 ms autosave clock; React and MUI transitions keep real timers.
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 200) return realSetTimeout(callback, delay, ...args);
    const handle = {};
    timers.set(handle, { at: clock + delay, callback, args });
    return handle;
  };
  globalThis.clearTimeout = handle => {
    if (!timers.delete(handle)) realClearTimeout(handle);
  };
  for (const [name, value] of Object.entries(original)) {
    if (typeof value === 'function' && name !== 'attemptPath')
      dictationApi[name] = async () => assert.fail(`Unexpected API operation: ${name}`);
  }
  dictationApi.check = async () => {
    checks++;
    assert.fail('Live practice must not use /check');
  };
  dictationApi.query = async path => {
    if (path === dictationApi.attemptPath('run')) return snapshot();
    if (path === dictationApi.attemptPath('new-run')) return { data: structuredClone(restarted) };
    if (path === dictationApi.catalogPath || path === dictationApi.historyPath)
      return { data: { items: [], total: 0, topics: ['Workplace', 'Travel'] } };
    assert.fail(`Unexpected query: ${path}`);
  };
  dictationApi.audio = async () => new Blob(['audio'], { type: 'audio/mpeg' });
  dictationApi.progress = async (id, payload) => {
    writes.push({ id, ...payload });
    const response = run.responses[payload.index];
    if (response.completed && payload.text !== response.text)
      throw Object.assign(new Error('Sentence is locked'), { status: 409 });
    run.currentIndex = payload.index;
    if (!response.completed) gradeDraft(payload.index, payload.text);
    return snapshot();
  };
  dictationApi.hint = async (id, index, wordIndex) => {
    hints.push({ id, index, wordIndex });
    const response = run.responses[index];
    if (!response.hints.some(hint => hint.index === wordIndex))
      response.hints.push({ index: wordIndex, text: expected[index][wordIndex] });
    if (response.hints.length === expected[index].length)
      Object.assign(response, { completed: true, revealed: true, answer: answers[index] });
    recount();
    return snapshot();
  };
  dictationApi.reveal = async (id, index) => {
    reveals.push({ id, index });
    Object.assign(run.responses[index], { completed: true, revealed: true, answer: answers[index] });
    recount();
    return snapshot();
  };
  dictationApi.finish = async id => {
    finishes.push(id);
    assert.equal(run.completed, run.sentences.length);
    run.completedAt = '2026-11-16T10:30:00Z';
    return snapshot();
  };
  dictationApi.start = async (id, payload) => {
    starts.push({ id, payload });
    restarted = attempt('new-run');
    return { data: structuredClone(restarted) };
  };
});

afterEach(async () => {
  try {
    for (const request of pendingRequests) request.resolve(snapshot());
    await act(async () => root?.unmount());
    router?.dispose();
    assert.equal(checks, 0, 'No live interaction may call /check');
  } finally {
    root = null;
    router = null;
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    timers.clear();
    if (!Object.hasOwn(original, 'check')) delete dictationApi.check;
    Object.assign(dictationApi, original);
  }
});
after(async () => {
  await server.close();
  dom.window.close();
});

async function render(path = '/dictation/lesson?attempt=run') {
  router = createMemoryRouter(
    [
      { path: '/dictation/:id', element: h(Page) },
      { path: '/dictation', element: h(Library) },
      { path: '/elsewhere', element: h('p', null, 'Elsewhere') },
    ],
    { initialEntries: [path] },
  );
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(CacheProvider, { value: cache }, h(RouterProvider, { router }))));
  assertNoCheck();
}

function button(label, container = document) {
  const result = [...container.querySelectorAll('button, a[role="button"], a.MuiButton-root')].find(
    item => item.textContent.trim() === label,
  );
  assert.ok(result, 'Missing button: ' + label);
  return result;
}
async function click(label, container) {
  await act(async () => button(label, container).click());
}
async function clickElement(element) {
  assert.ok(element);
  await act(async () => element.click());
}
function input() {
  const result = document.querySelector('textarea:not([aria-hidden])');
  assert.ok(result);
  return result;
}
async function change(element, value) {
  await act(async () => {
    const prototype =
      element.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function type(value) {
  await change(input(), value);
}
async function advance(milliseconds = 200) {
  await act(async () => {
    clock += milliseconds;
    for (const [handle, timer] of [...timers]) {
      if (timer.at <= clock && timers.delete(handle)) timer.callback(...timer.args);
    }
  });
}
async function blur() {
  await act(async () => input().dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })));
}
async function settle(request, response = snapshot()) {
  await act(async () => request.resolve(response));
}
async function openConfirmation(label) {
  await click(label);
  await act(async () => new Promise(resolve => realSetTimeout(resolve, 260)));
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(document.activeElement.textContent, 'Hủy');
  return dialog;
}
async function confirmTwice(label, dialog) {
  const confirm = button(label, dialog);
  await act(async () => {
    confirm.click();
    confirm.click();
  });
}
function assertNoCheck() {
  assert.equal(
    [...document.querySelectorAll('button')].some(item =>
      /^(check|kiểm tra)$/i.test(item.textContent.trim()),
    ),
    false,
  );
  assert.equal(document.body.textContent.includes('%'), false);
  assert.equal(checks, 0);
}
function liveWords() {
  return [...document.querySelectorAll('.dictation-live-word')];
}
function assertDone(index) {
  const row = document.querySelectorAll('.dictation-sentence')[index];
  assert.ok(row.classList.contains('done'));
  assert.ok(row.querySelector('[data-testid="CheckRoundedIcon"]'));
  assert.doesNotMatch(row.textContent, /Đã hoàn thành|Chưa luyện|Đã xem đáp án|Chính xác/);
  assert.ok(document.querySelectorAll('.dictation-number-grid button')[index].classList.contains('done'));
}

test('live feedback leaves wrong drafts editable and automatically locks a corrected sentence', async () => {
  await render();
  await type('we enjoed it');
  assert.equal(writes.length, 0);
  assert.equal(liveWords().filter(word => word.classList.contains('is-correct')).length, 0);
  await advance();
  assert.deepEqual(writes, [{ id: 'run', index: 0, text: 'we enjoed it' }]);
  assert.equal(input().readOnly, false);
  assert.deepEqual(
    liveWords().map(word => word.textContent),
    ['we', '*******', 'it'],
  );
  assert.ok(liveWords()[1].classList.contains('is-incorrect'));
  assert.equal(document.querySelector('.dictation-sentence-list').textContent.includes('enjoyed'), false);
  assert.equal(document.querySelector('.dictation-reference'), null);
  assert.equal(run.responses[0].grade.words[1].expected, null);
  await type('WE enjoyed it!');
  assert.ok(liveWords()[0].classList.contains('is-correct'), 'Verified green prefix remains while saving');
  assert.ok(liveWords()[1].classList.contains('is-empty'), 'Newly corrected word waits for server approval');
  await advance();
  assert.equal(run.responses[0].completed, true);
  assert.equal(input().readOnly, true);
  assert.equal(input().disabled, false);
  assert.equal(liveWords().filter(word => word.classList.contains('is-correct')).length, 3);
  assert.match(document.querySelector('.dictation-sentence-success').textContent, /Chính xác/);
  assert.equal(document.querySelector('.dictation-reference'), null);
  assertDone(0);
  assert.match(document.querySelector('.dictation-progress-header').textContent, /1\/2/);
  assert.equal(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '50');
  await act(async () =>
    input().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
  await click('Câu tiếp theo');
  assert.equal(input().readOnly, false);
  await click('Câu nghe trước');
  assert.equal(input().readOnly, true);
  assertNoCheck();
});

test('the live fixture rejects same-length wrong, reordered and extra-word drafts as complete', async () => {
  await render();
  for (const value of ['aa bbbbbbb cc', 'it enjoyed we', 'we enjoyed it extra']) {
    await type(value);
    await advance();
    assert.equal(run.responses[0].completed, false, value);
    assert.equal(input().readOnly, false, value);
    assert.equal(document.querySelector('.dictation-sentence-success'), null);
  }
  assert.match(document.querySelector('.dictation-extra-words').textContent, /1 từ dư/);
  await type('we enjoyed');
  assert.equal(
    document.querySelector('.dictation-extra-words'),
    null,
    'Extra-word feedback from an older draft is hidden',
  );
  await advance();
  assert.equal(run.responses[0].completed, false);
});

test('rapid typing coalesces into one progress write at 200 ms without a manual Check', async () => {
  await render();
  await type('w');
  await advance(60);
  await type('we');
  await advance(60);
  await type('we enjoed');
  await advance(79);
  assert.equal(writes.length, 0);
  await advance(1);
  assert.deepEqual(writes, [{ id: 'run', index: 0, text: 'we enjoed' }]);
  await advance(1000);
  assert.equal(writes.length, 1);
  assertNoCheck();
});

test('continuous typing receives feedback every save interval without waiting for a pause', async () => {
  await render();
  await type('w');
  await advance(100);
  await type('we');
  await advance(100);
  assert.equal(writes.length, 1);
  assert.ok(liveWords()[0].classList.contains('is-correct'));
  await type('we e');
  await advance(100);
  await type('we enj');
  await advance(100);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].text, 'we enj');
  assert.ok(liveWords()[1].classList.contains('is-partial'));
});

test('stale feedback never overwrites newer text or marks its changed words correct', async () => {
  const first = deferred();
  const second = deferred();
  const progress = dictationApi.progress;
  let calls = 0;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return calls++ === 0 ? first.promise.then(() => reply) : second.promise.then(() => reply);
  };
  await render();
  await type('we enjoed it');
  await advance();
  await type('they work here');
  await advance();
  assert.equal(writes.length, 1, 'An autosave must not overlap an in-flight autosave');
  await settle(first);
  assert.equal(input().value, 'they work here');
  assert.equal(liveWords().filter(word => word.classList.contains('is-correct')).length, 0);
  await advance();
  assert.equal(writes.length, 2);
  await settle(second);
  assert.equal(input().value, 'they work here');
  assert.equal(input().readOnly, false);
  assert.equal(liveWords().filter(word => word.classList.contains('is-correct')).length, 0);
});

test('a delayed correct save supersedes queued extra text without a locked-sentence write or retry error', async () => {
  const first = deferred();
  const progress = dictationApi.progress;
  let calls = 0;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return calls++ === 0 ? first.promise.then(() => reply) : reply;
  };
  await render();
  await type('we enjoyed it');
  await advance();
  await type('we enjoyed it extra');
  await blur();
  assert.equal(writes.length, 1);
  await settle(first);
  await advance(1000);
  assert.deepEqual(writes, [{ id: 'run', index: 0, text: 'we enjoyed it' }]);
  assert.equal(input().value, 'we enjoyed it');
  assert.equal(input().readOnly, true);
  assert.match(document.querySelector('.dictation-input-meta [role="status"]').textContent, /Đã lưu/);
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(document.body.textContent.includes('Chưa lưu được'), false);
  assertDone(0);
});

test('a failed autosave stays editable and does not retry endlessly', async () => {
  dictationApi.progress = async (id, payload) => {
    writes.push({ id, ...payload });
    throw new Error('Offline');
  };
  await render();
  await type('we enjoed it');
  await advance();
  assert.match(document.querySelector('.dictation-input-meta').textContent, /Chưa lưu được/);
  for (let i = 0; i < 3; i++) await advance(1000);
  assert.equal(writes.length, 1);
  assert.equal(input().readOnly, false);
});

test('a word hint waits for the latest draft flush, preserves earned green words and marks only the hint amber', async () => {
  const saved = deferred();
  const hinted = deferred();
  const progress = dictationApi.progress;
  const hint = dictationApi.hint;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return saved.promise.then(() => reply);
  };
  dictationApi.hint = async (...args) => {
    const reply = await hint(...args);
    return hinted.promise.then(() => reply);
  };
  await render();
  await type('we enjoed it');
  await clickElement(document.querySelector('button[aria-label="Gợi ý từ 2"]'));
  assert.equal(writes.length, 1);
  assert.equal(hints.length, 0, 'Hint POST must await draft progress');
  assert.equal(document.body.textContent.includes('enjoyed'), false);
  await settle(saved);
  assert.deepEqual(hints, [{ id: 'run', index: 0, wordIndex: 1 }]);
  assert.equal(liveWords()[1].textContent, '*******', 'Hint is hidden until its server reply');
  await settle(hinted);
  assert.ok(liveWords()[0].classList.contains('is-correct'));
  assert.ok(liveWords()[1].classList.contains('is-hinted'));
  assert.equal(liveWords()[1].textContent, 'enjoyed');
  assert.equal(liveWords()[1].disabled, true);
  assert.equal(input().readOnly, false);
});

test('sentence navigation flushes the old draft before moving to and saving the new sentence', async () => {
  const saved = deferred();
  const progress = dictationApi.progress;
  let calls = 0;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return calls++ === 0 ? saved.promise.then(() => reply) : reply;
  };
  await render();
  await type('we enjoed it');
  await click('Câu tiếp theo');
  assert.deepEqual(writes, [{ id: 'run', index: 0, text: 'we enjoed it' }]);
  assert.match(document.querySelector('.dictation-sentence-heading').textContent, /Câu 1/);
  await settle(saved);
  assert.deepEqual(writes[1], { id: 'run', index: 1, text: '' });
  assert.match(document.querySelector('.dictation-sentence-heading').textContent, /Câu 2/);
  await click('Câu nghe trước');
  assert.equal(input().value, 'we enjoed it');
  assert.equal(input().readOnly, false);
});

test('the library link flushes pending text before leaving practice', async () => {
  const saved = deferred();
  const progress = dictationApi.progress;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return saved.promise.then(() => reply);
  };
  await render();
  await type('we enjoed it');
  await click('Thư viện bài nghe');
  assert.equal(router.state.location.pathname, '/dictation/lesson');
  assert.equal(writes.length, 1);
  await settle(saved);
  assert.equal(router.state.location.pathname, '/dictation');
  assert.equal(run.responses[0].text, 'we enjoed it');
});

test('router navigation offers to save a dirty draft before leaving and waits for that save', async () => {
  const saved = deferred();
  const progress = dictationApi.progress;
  dictationApi.progress = async (...args) => {
    const reply = await progress(...args);
    return saved.promise.then(() => reply);
  };
  await render();
  await type('we enjoed it');
  await act(async () => {
    void router.navigate('/elsewhere');
  });
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.match(dialog.textContent, /Câu trả lời chưa lưu/);
  await click('Lưu và rời trang', dialog);
  assert.equal(router.state.location.pathname, '/dictation/lesson');
  await settle(saved);
  assert.equal(router.state.location.pathname, '/elsewhere');
  assert.equal(writes.length, 1);
});

test('reveal asks first, focuses Cancel and cancellation makes no reveal request', async () => {
  await render();
  const dialog = await openConfirmation('Xem đáp án');
  assert.match(dialog.textContent, /Các từ chưa tự điền đúng sẽ không được tính điểm khi xem đáp án\./);
  assert.equal(reveals.length, 0);
  await click('Hủy', dialog);
  assert.equal(reveals.length, 0);
  assert.equal(run.responses[0].completed, false);
});

test('duplicate confirmation reveals only the selected sentence once and gives it a green completion tick', async () => {
  await render();
  await click('Câu tiếp theo');
  const dialog = await openConfirmation('Xem đáp án');
  await confirmTwice('Xem đáp án', dialog);
  assert.deepEqual(reveals, [{ id: 'run', index: 1 }]);
  assert.equal(run.responses[0].completed, false);
  assert.equal(run.responses[1].completed, true);
  assert.match(document.querySelector('.dictation-reference').textContent, /They work here\./);
  assert.equal(document.querySelector('.dictation-hints'), null);
  assert.equal(input().readOnly, true);
  assertDone(1);
  assertNoCheck();
});

test('opening every word hint completes and locks the sentence without Reveal or Check', async () => {
  await render();
  for (let word = 1; word <= 3; word++)
    await clickElement(document.querySelector(`button[aria-label="Gợi ý từ ${word}"]`));
  assert.equal(hints.length, 3);
  assert.equal(reveals.length, 0);
  assert.equal(run.responses[0].completed, true);
  assert.equal(input().readOnly, true);
  assert.match(document.querySelector('.dictation-reference').textContent, /We enjoyed it\./);
  assert.equal(document.querySelector('.dictation-hints'), null);
  assert.match(document.querySelector('.dictation-progress-header').textContent, /1\/2/);
  assertDone(0);
  assertNoCheck();
});

test('score displays whole numbers in result and compact views without changing stored accuracy or feedback', async () => {
  root = createRoot(document.getElementById('root'));
  for (const compact of [false, true]) {
    for (const [accuracy, displayed] of [
      [0, 0],
      [88.1, 88],
      [88.5, 89],
      [88.9, 89],
      [100, 100],
      [49.9, 50],
    ]) {
      const attempt = { accuracy, scoringMode: 'LIVE' };
      await act(async () => root.render(h(CacheProvider, { value: cache }, h(Score, { attempt, compact }))));
      const score = document.querySelector('.dictation-score');
      assert.equal(score.querySelector('strong').textContent, String(displayed));
      assert.ok(score.getAttribute('aria-label').startsWith(`Điểm: ${displayed}/100.`));
      assert.equal(attempt.accuracy, accuracy);
      if (accuracy === 49.9) assert.ok(score.classList.contains('is-low'));
    }
  }
});

test('Start advances after a sentence ends while Replay stays on it and pending text is saved', async () => {
  run.sentences[0].end = 4.125;
  await render();
  const controls = document.querySelector('.dictation-player-row');
  const player = document.querySelector('audio');
  const timeline = document.querySelector('input[aria-label="Vị trí trong toàn bài"]');
  assert.equal(timeline.min, '0');
  assert.equal(timeline.max, '10');
  assert.equal(player.paused, true);
  assert.equal(button('Câu nghe trước').disabled, true);
  assert.ok(button('Phát lại', controls));
  await click('Bắt đầu', controls);
  player.currentTime = 2;
  await click('Tạm dừng', controls);
  assert.ok(button('Bắt đầu', controls));
  await click('Bắt đầu', controls);
  assert.equal(player.currentTime, 2);
  await act(async () => {
    player.currentTime = 4.2;
    player.dispatchEvent(new Event('timeupdate'));
  });
  assert.equal(player.paused, true);
  assert.equal(player.currentTime, 4.125);
  await click('Phát lại', controls);
  assert.equal(player.currentTime, 0);
  await type('we');
  await act(async () => {
    player.currentTime = 4.2;
    player.dispatchEvent(new Event('timeupdate'));
  });
  assert.equal(document.body.textContent.includes('Bỏ qua'), false);
  await click('Bắt đầu', controls);
  assert.equal(run.responses[0].text, 'we');
  assert.equal(run.completed, 0, 'Listening never marks an unfinished answer complete');
  assert.equal(player.paused, false);
  assert.equal(player.currentTime, 5);
  assert.equal(timeline.min, '0');
  assert.equal(timeline.max, '10');
  const row = document.querySelectorAll('.dictation-sentence')[1];
  await clickElement(row);
  assert.equal(player.paused, false);
  player.currentTime = 6;
  await clickElement(row);
  assert.equal(player.currentTime, 5);
  await act(async () => {
    player.currentTime = 9.1;
    player.dispatchEvent(new Event('timeupdate'));
  });
  assert.equal(player.paused, true);
  assert.equal(player.currentTime, 9);
  assert.equal(button('Bắt đầu', controls).disabled, true);
  await click('Phát lại', controls);
  assert.equal(player.currentTime, 5);
  assert.equal(player.paused, false);
  assert.equal(button('Câu nghe trước').disabled, false);
  assert.equal(button('Hoàn thành bài nghe').disabled, true);
  assertNoCheck();
});

test('rapid transcript seeks play only the latest target after the native seek completes', async () => {
  await render();
  const player = document.querySelector('audio');
  const timeline = document.querySelector('input[aria-label="Vị trí trong toàn bài"]');
  const rows = document.querySelectorAll('.dictation-sentence');
  let nativeTime = 2;
  let seeking = false;
  const targets = [];
  Object.defineProperty(player, 'currentTime', {
    configurable: true,
    get: () => nativeTime,
    set: value => {
      targets.push(value);
      seeking = true;
    },
  });
  Object.defineProperty(player, 'seeking', { configurable: true, get: () => seeking });
  await clickElement(rows[1]);
  assert.equal(targets.at(-1), 5);
  assert.equal(Number(timeline.value), 5);
  assert.equal(player.paused, true, 'Playback must wait for the seek instead of playing the old sentence');
  await act(async () => player.dispatchEvent(new Event('timeupdate')));
  assert.equal(Number(timeline.value), 5, 'An old timestamp must not move the thumb back');
  await clickElement(rows[0]);
  assert.equal(targets.at(-1), 0);
  assert.equal(player.paused, true);
  await act(async () => player.dispatchEvent(new Event('timeupdate')));
  assert.equal(Number(timeline.value), 0);
  await clickElement(rows[1]);
  nativeTime = 10;
  await act(async () => player.dispatchEvent(new Event('timeupdate')));
  assert.equal(Number(timeline.value), 5);
  assert.equal(targets.at(-1), 5, 'The previous EOF must not overwrite the newest seek');
  nativeTime = 5.28;
  seeking = false;
  await act(async () => player.dispatchEvent(new Event('seeked')));
  assert.equal(Number(timeline.value), 5.28, 'Native time is authoritative, without a target tolerance gate');
  assert.equal(player.paused, false);
  nativeTime = 9.2;
  await act(async () => player.dispatchEvent(new Event('timeupdate')));
  assert.equal(player.paused, true);
  assert.equal(targets.at(-1), 9);
});

test('pausing a pending seek cancels playback and late media events cannot change the button state', async () => {
  await render();
  const player = document.querySelector('audio');
  const controls = document.querySelector('.dictation-player-row');
  let seeking = true;
  Object.defineProperty(player, 'seeking', { configurable: true, get: () => seeking });
  await clickElement(document.querySelectorAll('.dictation-sentence')[1]);
  assert.equal(player.paused, true);
  await click('Bắt đầu', controls);
  seeking = false;
  await act(async () => player.dispatchEvent(new Event('seeked')));
  assert.equal(player.paused, true, 'A cancelled seek must not autoplay when it finishes');
  await click('Bắt đầu', controls);
  assert.equal(player.paused, false);
  await act(async () => player.dispatchEvent(new Event('pause')));
  assert.ok(button('Tạm dừng', controls), 'A queued pause event must read the current native state');
  await click('Tạm dừng', controls);
  await act(async () => {
    player.dispatchEvent(new Event('play'));
    player.dispatchEvent(new Event('canplay'));
  });
  assert.equal(player.paused, true);
  assert.ok(button('Bắt đầu', controls));
});

test('transcript selection before metadata loads waits and retains only the newest seek', async () => {
  await render();
  const player = document.querySelector('audio');
  const timeline = document.querySelector('input[aria-label="Vị trí trong toàn bài"]');
  let ready = false;
  let seeking = false;
  let nativeTime = 0;
  const targets = [];
  Object.defineProperties(player, {
    readyState: { configurable: true, get: () => (ready ? 4 : 0) },
    seeking: { configurable: true, get: () => seeking },
    currentTime: {
      configurable: true,
      get: () => nativeTime,
      set: value => {
        assert.equal(ready, true, 'Do not seek before media metadata is available');
        targets.push(value);
        nativeTime = value;
        seeking = true;
      },
    },
  });
  const rows = document.querySelectorAll('.dictation-sentence');
  for (const index of [1, 0, 1]) await clickElement(rows[index]);
  assert.equal(Number(timeline.value), 5);
  assert.deepEqual(targets, []);
  assert.equal(player.paused, true);
  ready = true;
  await act(async () => player.dispatchEvent(new Event('loadedmetadata')));
  assert.deepEqual(targets, [5]);
  assert.equal(player.paused, true);
  seeking = false;
  await act(async () => player.dispatchEvent(new Event('seeked')));
  assert.equal(player.paused, false);
  nativeTime = 5.4;
  await act(async () => player.dispatchEvent(new Event('loadedmetadata')));
  assert.deepEqual(targets, [5], 'Repeated metadata must not reset an already playing sentence');
  assert.equal(player.currentTime, 5.4);
});

test('an old rejected play request cannot interrupt a more recent transcript selection', async () => {
  await render();
  const player = document.querySelector('audio');
  const controls = document.querySelector('.dictation-player-row');
  const flights = [];
  player.play = function () {
    const flight = deferred();
    flights.push(flight);
    Object.defineProperty(this, 'paused', { configurable: true, value: false });
    this.dispatchEvent(new Event('play'));
    return flight.promise;
  };
  const rows = document.querySelectorAll('.dictation-sentence');
  await clickElement(rows[1]);
  await clickElement(rows[0]);
  assert.equal(flights.length, 2);
  await act(async () => {
    flights[0].reject(new DOMException('The old play was interrupted', 'AbortError'));
    flights[1].resolve();
  });
  assert.equal(player.currentTime, 0);
  assert.equal(player.paused, false);
  assert.ok(button('Tạm dừng', controls));
  assert.equal(document.querySelector('.dictation-audio [role="alert"]'), null);
});

test('the media timeline disables positional easing without changing the volume slider', async () => {
  const style = document.createElement('style');
  style.textContent = await readFile(
    new URL('../src/features/dictation/styles/dictation.css', import.meta.url),
    'utf8',
  );
  document.head.append(style);
  try {
    await render();
    const timeline = document.querySelector('.dictation-timeline');
    const thumb = timeline.querySelector('.MuiSlider-thumb');
    const track = timeline.querySelector('.MuiSlider-track');
    assert.equal(dom.window.getComputedStyle(thumb).transitionProperty, 'box-shadow');
    assert.equal(dom.window.getComputedStyle(track).transition, 'none');
    assert.equal(document.querySelector('.dictation-volume .dictation-timeline'), null);
  } finally {
    style.remove();
  }
});

test('late metadata preserves a manually selected timeline position and seeked updates while paused', async () => {
  await render();
  const player = document.querySelector('audio');
  const timeline = document.querySelector('input[aria-label="Vị trí trong toàn bài"]');
  await change(timeline, '7');
  assert.equal(Number(timeline.value), 7);
  assert.equal(player.currentTime, 7);
  await act(async () => player.dispatchEvent(new Event('loadedmetadata')));
  assert.equal(player.currentTime, 7, 'Metadata must not send a manual seek back to the sentence start');
  await act(async () => {
    player.currentTime = 7.125;
    player.dispatchEvent(new Event('seeked'));
  });
  assert.equal(Number(timeline.value), 7.125);
  assert.equal(player.paused, true);
});

test('finishing confirms once then shows the score and keeps the completed workspace visible and read-only', async () => {
  gradeDraft(0, 'we enjoyed it');
  gradeDraft(1, 'they work here');
  run.currentIndex = 1;
  await render();
  let dialog = await openConfirmation('Hoàn thành bài nghe');
  await click('Hủy', dialog);
  assert.equal(finishes.length, 0);
  dialog = await openConfirmation('Hoàn thành bài nghe');
  await confirmTwice('Hoàn thành bài nghe', dialog);
  assert.deepEqual(finishes, ['run']);
  assert.match(document.querySelector('.dictation-result-band').textContent, /100\/100/);
  assert.ok(document.querySelector('.dictation-studio'));
  assert.equal(document.body.textContent.includes('Xem lại bài'), false);
  assert.equal(document.body.textContent.includes('Ẩn bài luyện'), false);
  assert.ok(document.querySelector('.dictation-score'));
  assert.equal(document.querySelectorAll('.dictation-score .MuiCircularProgress-root').length, 2);
  assert.ok(document.querySelector('.dictation-score.is-high'));
  assert.match(document.querySelector('.dictation-score-feedback').textContent, /Tuyệt vời!/);
  assert.ok(button('Luyện lại'));
  const writesBeforeReview = writes.length;
  assert.equal(input().disabled, true);
  assert.equal(input().readOnly, true);
  assert.match(document.querySelector('.dictation-reference').textContent, /They work here\./);
  await click('Câu nghe trước');
  assert.equal(input().disabled, true);
  assert.equal(writes.length, writesBeforeReview, 'Review navigation makes no progress writes');
  assertNoCheck();
});

test('restart focuses Cancel, makes one new attempt and preserves the completed result', async () => {
  gradeDraft(0, 'we enjoyed it');
  gradeDraft(1, 'they work here');
  run.completedAt = '2026-11-16T10:30:00Z';
  const old = structuredClone(run);
  await render();
  let dialog = await openConfirmation('Luyện lại');
  assert.match(dialog.textContent, /Bài nghe sẽ chuyển về Đang luyện/);
  await click('Hủy', dialog);
  assert.equal(starts.length, 0);
  dialog = await openConfirmation('Luyện lại');
  await confirmTwice('Luyện lại', dialog);
  assert.equal(starts.length, 1);
  assert.equal(starts[0].id, 'lesson');
  assert.equal(starts[0].payload.restart, true);
  assert.ok(starts[0].payload.requestId);
  assert.match(router.state.location.search, /attempt=new-run/);
  assert.equal(input().readOnly, false);
  assert.equal(input().value, '');
  assert.deepEqual(run, old);
});

test('title, level, topic and audio duration stay visible without internal version metadata', async () => {
  await render();
  assert.equal(document.querySelector('h1').textContent, 'Company picnic');
  const meta = document.querySelector('.dictation-inline-meta').textContent;
  assert.match(meta, /B1/);
  assert.match(meta, /Workplace/);
  assert.match(meta, /00:10/);
  assert.equal(document.querySelector('.dictation-version'), null);
  assertNoCheck();
});

async function select(label, value) {
  const control = document.querySelector(`[role="combobox"][aria-label="${label}"]`);
  assert.ok(control);
  await act(async () =>
    control.dispatchEvent(new dom.window.MouseEvent('mousedown', { button: 0, bubbles: true })),
  );
  const option = [...document.querySelectorAll('[role="option"]')].find(item => item.textContent === value);
  assert.ok(option, 'Missing option: ' + value);
  await clickElement(option);
}

function installLibraryFixture() {
  const queries = [];
  // The server returns only the latest attempt per lesson; do not simulate client-side deduplication.
  const items = Array.from({ length: 41 }, (_, index) => ({
    ...attempt(`latest-${index}`),
    exerciseId: `lesson-${index}`,
    title: `Company picnic ${index + 1}`,
    level: index % 2 ? 'B2' : 'B1',
    topic: index % 2 ? 'Travel' : 'Workplace',
    completed: index < 21 ? 1 : 2,
    completedAt: index < 21 ? null : '2026-11-16T10:30:00Z',
    accuracy: index === 21 ? 30.6 : 100,
    scoringMode: index === 21 ? 'LEGACY' : 'LIVE',
  }));
  assert.equal(new Set(items.map(item => item.exerciseId)).size, items.length);
  dictationApi.query = async (path, params) => {
    queries.push({ path, ...params });
    const filtered = items.filter(
      item =>
        (!params.keyword || item.title.toLowerCase().includes(params.keyword.toLowerCase())) &&
        (!params.level || item.level === params.level) &&
        (!params.topic || item.topic === params.topic) &&
        (path !== dictationApi.historyPath ||
          (params.status === 'COMPLETED' ? Boolean(item.completedAt) : !item.completedAt)),
    );
    const page = filtered.slice(params.page * params.size, (params.page + 1) * params.size);
    return {
      data: {
        items:
          path === dictationApi.catalogPath
            ? page.map(item => ({
                id: item.exerciseId,
                title: item.title,
                topic: item.topic,
                level: item.level,
                duration: item.duration,
                sentenceCount: item.sentences.length,
                attemptId: item.id,
                completed: item.completed,
                progressTotal: item.sentences.length,
                attemptCompleted: Boolean(item.completedAt),
                description: '',
              }))
            : structuredClone(page),
        total: filtered.length,
        page: params.page,
        size: params.size,
        topics: ['Workplace', 'Travel'],
      },
    };
  };
  return { queries, items };
}

test('My Lessons uses exclusive status toggles, true 20-item pages and resets pagination on status change', async () => {
  const { queries } = installLibraryFixture();
  await render('/dictation');
  assert.equal(document.querySelector('.dictation-back-row'), null);
  assert.equal(queries.at(-1).size, 12);
  await click('Tiến độ bài học');
  assert.equal(button('Tất cả').getAttribute('aria-pressed'), 'true');
  assert.equal(queries.at(-1).status, '');
  assert.ok(document.querySelector('.dictation-filters .dictation-progress-tabs'));
  await click('Đang luyện');
  assert.equal(queries.at(-1).status, 'IN_PROGRESS');
  assert.equal(queries.at(-1).size, 20);
  assert.equal(button('Đang luyện').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelectorAll('.dictation-history-row').length, 20);
  assert.match(document.querySelector('.dictation-page-range').textContent, /1–20.*21 bài nghe/);
  assert.equal(document.querySelector('[aria-label="Trạng thái lượt luyện"]'), null);
  await clickElement(document.querySelector('button[aria-label="Go to page 2"]'));
  assert.equal(queries.at(-1).page, 1);
  assert.equal(document.querySelectorAll('.dictation-history-row').length, 1);
  assert.match(document.querySelector('.dictation-page-range').textContent, /21–21.*21 bài nghe/);
  await click('Đã hoàn thành');
  assert.equal(queries.at(-1).status, 'COMPLETED');
  assert.equal(queries.at(-1).page, 0);
  assert.equal(document.querySelectorAll('.dictation-history-row').length, 20);
  assert.equal(
    document.querySelector('.dictation-pagination .MuiPagination-root'),
    null,
    'Exactly 20 items have one page',
  );
  assert.match(document.querySelector('.dictation-page-range').textContent, /1–20.*20 bài nghe/);
  await click('Đã hoàn thành');
  assert.equal(button('Đã hoàn thành').getAttribute('aria-pressed'), 'true');
  assert.equal(queries.at(-1).status, 'COMPLETED');
  assertNoCheck();
});

test('My Lessons search, level and topic filters are sent to the server and reset the current page', async () => {
  const { queries } = installLibraryFixture();
  await render('/dictation');
  await click('Tiến độ bài học');
  await click('Đang luyện');
  await clickElement(document.querySelector('button[aria-label="Go to page 2"]'));
  const beforeTyping = queries.length;
  await change(document.querySelector('input[aria-label="Tìm bài nghe"]'), 'picnic');
  assert.equal(queries.length, beforeTyping);
  await click('Tìm kiếm');
  assert.equal(queries.at(-1).keyword, 'picnic');
  assert.equal(queries.at(-1).page, 0);
  await clickElement(document.querySelector('button[aria-label="Go to page 2"]'));
  await select('Trình độ', 'B1');
  assert.equal(queries.at(-1).level, 'B1');
  assert.equal(queries.at(-1).page, 0);
  await select('Chủ đề', 'Workplace');
  assert.equal(queries.at(-1).topic, 'Workplace');
  assert.equal(queries.at(-1).keyword, 'picnic');
  assert.equal(queries.at(-1).status, 'IN_PROGRESS');
  assert.equal(queries.at(-1).size, 20);
  assert.equal(document.querySelectorAll('.dictation-history-row').length, 11);
  await click('Xóa bộ lọc');
  assert.deepEqual(queries.at(-1), {
    path: dictationApi.historyPath,
    keyword: '',
    level: '',
    topic: '',
    page: 0,
    size: 20,
    status: '',
  });
  await click('Thư viện bài nghe');
  assert.equal(queries.at(-1).size, 12);
  assert.equal(Object.hasOwn(queries.at(-1), 'status'), false);
  assert.ok(document.querySelector('.dictation-lesson-card'));
  assert.equal(document.querySelector('.dictation-filters.is-history'), null);
});

test('unfinished lessons show counts and accessible progress; completed LEGACY results retain /100 and old-scoring tooltip', async () => {
  const { items } = installLibraryFixture();
  const old = structuredClone(items);
  await render('/dictation');
  await click('Tiến độ bài học');
  let row = document.querySelector('.dictation-history-row');
  assert.match(row.querySelector('.dictation-history-score').textContent, /1\/2 câu/);
  assert.equal(row.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '50');
  assert.equal(row.querySelector('a').getAttribute('href'), '/dictation/lesson-0?attempt=latest-0');
  assert.match(row.querySelector('a').textContent, /Tiếp tục/);
  await click('Đã hoàn thành');
  row = document.querySelector('.dictation-history-row');
  assert.match(row.querySelector('.dictation-history-score').textContent, /31\/100/);
  assert.equal(row.querySelector('[role="progressbar"]:not([aria-hidden="true"])'), null);
  assert.match(row.querySelector('a').textContent, /Xem kết quả/);
  assert.equal(row.querySelector('a').getAttribute('href'), '/dictation/lesson-21?attempt=latest-21');
  assert.match(
    row.querySelector('.dictation-history-score [tabindex="0"]').getAttribute('aria-label'),
    /lần kiểm tra đầu tiên/,
  );
  assert.deepEqual(items, old, 'Rendering never rewrites historical scores');
  assertNoCheck();
});

test('unavailable unfinished lessons explain the lock while completed results remain accessible', async () => {
  const { items } = installLibraryFixture();
  items[0].archived = true;
  items[21].archived = true;
  const saved = structuredClone(items);
  await render('/dictation');
  await click('Tiến độ bài học');
  const row = document.querySelector('.dictation-history-row');
  assert.match(row.querySelector('.MuiChip-outlined').textContent, /Hiện không khả dụng/);
  assert.equal(button('Tiếp tục', row).disabled, true);
  assert.equal(row.querySelector('a'), null);
  const notice = row.querySelector('.dictation-history-unavailable');
  assert.equal(notice.tabIndex, 0, 'The notice can also be reached with a keyboard');
  assert.equal(notice.title, 'Bài nghe hiện không khả dụng. Tiến độ của bạn vẫn được lưu.');
  assert.doesNotMatch(row.textContent, /đã ẩn/i);
  await click('Đã hoàn thành');
  const completed = document.querySelector('.dictation-history-row');
  assert.equal(
    button('Xem kết quả', completed).getAttribute('href'),
    '/dictation/lesson-21?attempt=latest-21',
  );
  assert.equal(completed.querySelector('.dictation-history-unavailable'), null);
  assert.deepEqual(items, saved, 'Availability copy never changes saved progress or scores');
});

test('direct access to an unavailable attempt uses learner-facing copy instead of the server archive message', async () => {
  dictationApi.query = async () => {
    throw Object.assign(new Error('Bài nghe đã được ẩn. Bạn vẫn có thể xem kết quả đã hoàn thành.'), {
      code: 'DICTATION_ARCHIVED',
    });
  };
  await render();
  const alert = document.querySelector('[role="alert"]');
  assert.match(alert.textContent, /Hiện không khả dụng/);
  assert.match(alert.textContent, /Tiến độ của bạn vẫn được lưu/);
  assert.doesNotMatch(alert.textContent, /đã ẩn/i);
  assert.equal(document.querySelector('.dictation-studio'), null);
});

test('completed unavailable lessons retain their score and show neutral availability copy', async () => {
  gradeDraft(0, 'we enjoyed it');
  gradeDraft(1, 'they work here');
  run.archived = true;
  run.completedAt = '2026-11-16T10:30:00Z';
  const saved = structuredClone(run);
  await render();
  assert.match(
    document.querySelector('[role="alert"]').textContent,
    /Bài nghe hiện không khả dụng\. Kết quả của bạn vẫn được lưu\./,
  );
  assert.doesNotMatch(document.body.textContent, /đã ẩn/i);
  assert.ok(document.querySelector('.dictation-result-score'));
  assert.equal(input().readOnly, true);
  assert.equal(
    [...document.querySelectorAll('button')].some(item => item.textContent === 'Luyện lại'),
    false,
  );
  assert.deepEqual(run, saved);
});

test('an already finished LEGACY attempt opens on its preserved score with the completed workspace visible', async () => {
  gradeDraft(0, 'we enjoyed it');
  gradeDraft(1, 'they work here');
  run.scoringMode = 'LEGACY';
  run.accuracy = 30.6;
  run.completedAt = '2026-11-16T10:30:00Z';
  const old = structuredClone(run);
  await render();
  assert.match(document.querySelector('.dictation-result-band').textContent, /31\/100/);
  assert.ok(document.querySelector('.dictation-studio'));
  assert.equal(document.body.textContent.includes('Xem lại bài'), false);
  assert.equal(input().disabled, true);
  assert.equal(input().readOnly, true);
  assert.deepEqual(run, old);
  assertNoCheck();
});
