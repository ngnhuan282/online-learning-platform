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
  'AddRounded',
  'ArrowDownwardRounded',
  'ArrowUpwardRounded',
  'CloseRounded',
  'DeleteOutlineRounded',
  'DownloadOutlined',
  'EditOutlined',
  'MyLocationRounded',
  'PublishOutlined',
  'RestartAlt',
  'SaveOutlined',
  'UploadFileOutlined',
  'VisibilityOffOutlined',
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
  'RocketLaunchOutlined',
  'SearchOutlined',
  'SpaOutlined',
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
const { default: AdminLibrary } = await server.ssrLoadModule(
  '/src/features/dictation/pages/AdminDictationPage.jsx',
);
const { default: Score } = await server.ssrLoadModule(
  '/src/features/dictation/components/DictationScore.jsx',
);
const { dictationApi } = await server.ssrLoadModule('/src/features/dictation/api/dictationApi.js');
const { AuthContext } = await server.ssrLoadModule('/src/features/auth/context/AuthContext.jsx');
const { default: ProtectedRoute } = await server.ssrLoadModule('/src/routes/ProtectedRoute.jsx');
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
    if (
      path === dictationApi.catalogPath ||
      path === dictationApi.historyPath ||
      path === dictationApi.topicGroupsPath
    )
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
    delete window.YT;
    if (!Object.hasOwn(original, 'check')) delete dictationApi.check;
    Object.assign(dictationApi, original);
  }
});
after(async () => {
  await server.close();
  dom.window.close();
});

async function render(path = '/dictation/lesson?attempt=run', user = { id: 1 }) {
  router = createMemoryRouter(
    [
      { element: h(ProtectedRoute), children: [{ path: '/dictation/:id', element: h(Page) }] },
      { path: '/dictation', element: h(Library) },
      { path: '/admin/dictation', element: h(AdminLibrary) },
      { path: '/login', element: h('p', null, 'Đăng nhập') },
      { path: '/elsewhere', element: h('p', null, 'Elsewhere') },
    ],
    { initialEntries: [path] },
  );
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user, isAuthenticated: Boolean(user) } },
          h(RouterProvider, { router }),
        ),
      ),
    ),
  );
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

test('YouTube seeks within one iframe and pauses at the selected sentence end', async () => {
  const videoId = '_R7nrvhNmrI';
  run.video = { url: `https://www.youtube.com/watch?v=${videoId}`, duration: 10 };
  dictationApi.audio = async () => assert.fail('YouTube lessons use the iframe player');
  const seeks = [];
  const cued = [];
  const pauses = [];
  let callbacks;
  let player;
  let position = 0;
  let playerState = -1;
  function reportState(value) {
    playerState = value;
    callbacks.onStateChange({ data: value });
  }
  const tick = () => act(async () => new Promise(resolve => realSetTimeout(resolve, 65)));
  window.YT = {
    Player: class {
      constructor(iframe, { events }) {
        assert.equal(new URL(iframe.src).pathname, `/embed/${videoId}`);
        callbacks = events;
        player = this;
      }
      cueVideoById(clip) {
        cued.push(clip);
      }
      seekTo(seconds, allowSeekAhead) {
        seeks.push([seconds, allowSeekAhead]);
      }
      getCurrentTime() {
        return position;
      }
      getPlayerState() {
        return playerState;
      }
      playVideo() {
        reportState(1);
      }
      pauseVideo() {
        pauses.push(position);
        reportState(2);
      }
      destroy() { }
    },
  };
  await render();
  await act(async () => callbacks.onReady({ target: player }));
  const initialCue = { videoId, startSeconds: run.sentences[0].start };
  assert.deepEqual(cued, [initialCue]);
  const iframe = document.querySelector('.dictation-youtube iframe');
  const controls = document.querySelector('.dictation-player-row');
  const rows = document.querySelectorAll('.dictation-sentence');
  await clickElement(rows[1]);
  await clickElement(rows[0]);
  await clickElement(rows[1]);
  assert.deepEqual(seeks, []);
  await act(async () => reportState(5));
  const { start, end } = run.sentences[1];
  assert.deepEqual(seeks, [[start, true]]);
  position = end - 0.1;
  await tick();
  assert.deepEqual(pauses, []);
  position = end + 0.02;
  await tick();
  assert.deepEqual(pauses, [position]);
  assert.equal(playerState, 2);
  assert.deepEqual(seeks, [[start, true]]);

  await click('Phát lại', controls);
  assert.deepEqual(seeks, [
    [start, true],
    [start, true],
  ]);
  await clickElement(rows[0]);
  assert.deepEqual(seeks.at(-1), [run.sentences[0].start, true]);
  await tick();
  assert.equal(pauses.length, 1, 'The old clock must not stop the new sentence.');
  position = run.sentences[0].start + 0.1;
  await tick();
  position = run.sentences[0].end + 0.01;
  await tick();
  assert.equal(pauses.at(-1), position);
  assert.equal(pauses.length, 2);
  assert.deepEqual(cued, [initialCue]);
  assert.equal(document.querySelector('.dictation-youtube iframe'), iframe);
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

function installLibraryFixture(levels = [], catalogTopics = []) {
  const queries = [];
  // The server returns only the latest attempt per lesson; do not simulate client-side deduplication.
  const items = Array.from({ length: 41 }, (_, index) => ({
    ...attempt(`latest-${index}`),
    exerciseId: `lesson-${index}`,
    title: `Company picnic ${index + 1}`,
    level: levels[index] ?? (index % 2 ? 'B2' : 'B1'),
    topic: index % 2 ? 'Travel' : 'Workplace',
    completed: index < 21 ? 1 : 2,
    completedAt: index < 21 ? null : '2026-11-16T10:30:00Z',
    accuracy: index === 21 ? 30.6 : 100,
    scoringMode: index === 21 ? 'LEGACY' : 'LIVE',
  }));
  assert.equal(new Set(items.map(item => item.exerciseId)).size, items.length);
  const catalog = items.map((item, index) => ({ ...item, topic: catalogTopics[index] ?? 'Test 1' }));
  dictationApi.query = async (path, params) => {
    queries.push({ path, ...params });
    const presets = { BEGINNER: ['A1', 'A2'], ADVANCED: ['B1', 'B2', 'C1', 'C2'] };
    const matchingLevels = presets[params.level] ?? [params.level];
    const filtered = (path === dictationApi.historyPath ? items : catalog).filter(
      item =>
        (!params.keyword || item.title.toLowerCase().includes(params.keyword.toLowerCase())) &&
        (!params.level || matchingLevels.includes(item.level)) &&
        (!params.topic || item.topic === params.topic) &&
        (path !== dictationApi.historyPath ||
          (params.status === 'COMPLETED' ? Boolean(item.completedAt) : !item.completedAt)),
    );
    const lesson = item => ({
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
      description: 'Mô tả cũ của bài nghe',
    });
    if (path === dictationApi.topicGroupsPath) {
      return {
        data: {
          groups: Object.entries(Object.groupBy(filtered, item => item.topic)).map(([topic, entries]) => ({
            topic,
            total: entries.length,
            items: entries.slice(0, 4).map(lesson),
          })),
        },
      };
    }
    const page = filtered.slice(params.page * params.size, (params.page + 1) * params.size);
    return {
      data: {
        items: path === dictationApi.catalogPath ? page.map(lesson) : structuredClone(page),
        total: filtered.length,
        page: params.page,
        size: params.size,
        topics: ['Workplace', 'Travel'],
      },
    };
  };
  return { queries, items };
}

test('guests see an empty library and are asked to sign in for private progress', async () => {
  const queries = [];
  dictationApi.query = async path => {
    queries.push(path);
    return { data: { groups: [] } };
  };
  await render('/dictation', null);
  assert.match(document.body.textContent, /Chưa có bài nghe/);
  assert.doesNotMatch(document.body.textContent, /Chưa có bài nghe phù hợp/);
  assert.equal(document.querySelector('.dictation-lesson-card'), null);

  await click('Tiến độ bài học');
  assert.match(document.body.textContent, /Đăng nhập để xem tiến độ bài học/);
  assert.deepEqual(queries, [dictationApi.topicGroupsPath]);
});

test('the TOEIC group preview opens its own paginated catalog and keeps the latest attempt link', async () => {
  const { queries } = installLibraryFixture();
  await render('/dictation');
  assert.equal(queries.at(-1).path, dictationApi.topicGroupsPath);
  assert.equal(document.querySelector('.dictation-filters'), null);
  assert.equal(document.querySelector('[role="combobox"][aria-label="Chủ đề"]'), null);
  assert.ok(!Object.hasOwn(queries.at(-1), 'topic'));
  assert.equal(document.querySelectorAll('.dictation-lesson-card').length, 4);
  assert.ok(!document.querySelector('.dictation-library-grid').textContent.includes('Mô tả cũ của bài nghe'));
  const openAll = document.querySelector('.dictation-topic-heading a');
  assert.equal(openAll.getAttribute('href'), '/dictation?topic=Test+1');
  await clickElement(openAll);
  assert.equal(document.querySelector('h1').textContent, 'Test 1');
  assert.equal(document.querySelector('.dictation-tier-pills'), null);
  assert.ok(document.querySelector('.dictation-filters.is-catalog'));
  assert.match(document.querySelector('.dictation-heading [role="status"]').textContent, /41 bài nghe/);
  assert.equal(document.querySelector('[role="combobox"][aria-label="Chủ đề"]'), null);
  assert.equal(queries.at(-1).path, dictationApi.catalogPath);
  assert.equal(queries.at(-1).topic, 'Test 1');
  assert.equal(document.querySelectorAll('.dictation-lesson-card').length, 12);
  assert.equal(
    document.querySelector('.dictation-lesson-card a').getAttribute('href'),
    '/dictation/lesson-0?attempt=latest-0',
  );
  await clickElement(document.querySelector('button[aria-label="Go to page 2"]'));
  assert.equal(queries.at(-1).page, 1);
  await select('Trạng thái bài nghe', 'Đang luyện');
  assert.equal(queries.at(-1).status, 'IN_PROGRESS');
  assert.equal(queries.at(-1).page, 0);
  assert.equal(queries.at(-1).topic, 'Test 1');
  await clickElement(document.querySelector('.dictation-library-back'));
  assert.equal(queries.at(-1).path, dictationApi.topicGroupsPath);
});

test('guests can browse the listening library, with history and practice requiring login', async () => {
  const queries = [];
  dictationApi.query = async path => {
    queries.push(path);
    assert.equal(path, dictationApi.topicGroupsPath);
    if (queries.length === 1) throw new Error('Temporary catalog failure');
    return {
      data: {
        groups: [
          {
            topic: 'Workplace',
            total: 1,
            items: [
              { id: 'lesson', title: 'Guest listening preview', level: 'B1', duration: 4, sentenceCount: 2 },
            ],
          },
        ],
      },
    };
  };

  await render('/dictation', null);
  assert.match(document.body.textContent, /Không thể tải dữ liệu/);
  await click('Thử lại');
  assert.match(document.querySelector('.dictation-lesson-card').textContent, /Guest listening preview/);
  await click('Tiến độ bài học');
  assert.match(document.body.textContent, /Đăng nhập để xem tiến độ bài học/);
  assert.deepEqual(queries, [dictationApi.topicGroupsPath, dictationApi.topicGroupsPath]);

  await click('Thư viện bài nghe');
  await clickElement(document.querySelector('.dictation-lesson-card a[href="/dictation/lesson"]'));
  assert.equal(router.state.location.pathname, '/login');
  assert.deepEqual(router.state.location.state, { from: '/dictation/lesson' });
  assert.deepEqual(starts, []);
});

test('admin editing keeps published listening metadata and visibility in sync with the catalog', async () => {
  const requests = [];
  const details = {
    id: 'lesson',
    version: 3,
    published: true,
    hasDraft: false,
    archived: false,
    audio: { duration: 4 },
    definition: {
      title: 'Published listening',
      description: '',
      topic: 'Workplace',
      level: 'B1',
      audioKey: 'sample',
      sentences: [{ text: 'A sentence.', start: 0, end: 2 }],
    },
  };
  const snapshot = () => ({ data: structuredClone(details) });
  dictationApi.query = async (path, params) => {
    assert.equal(path, dictationApi.adminPath);
    const status = details.archived ? 'ARCHIVED' : 'PUBLISHED';
    const item = {
      id: details.id,
      ...details.definition,
      status,
      hasDraft: details.hasDraft,
      duration: 4,
      sentenceCount: 1,
    };
    const matchesStatus = !params.status || params.status === status;
    const matchesKeyword = item.title.includes(params.keyword);
    const items = matchesStatus && matchesKeyword ? [item] : [];
    return { data: { items, total: items.length } };
  };
  dictationApi.detail = async id => {
    assert.equal(id, details.id);
    return snapshot();
  };
  dictationApi.adminAudio = async () => new Blob(['audio'], { type: 'audio/mpeg' });
  dictationApi.save = async (id, { definition, version }) => {
    requests.push(['save', id, version, definition.title]);
    Object.assign(details, { definition, version: version + 1, hasDraft: true });
    return snapshot();
  };
  dictationApi.visibility = async (id, archived) => {
    requests.push(['visibility', id, archived]);
    details.archived = archived;
    return snapshot();
  };
  dictationApi.publish = async (id, version, definition) => {
    requests.push(['publish', id, version, definition]);
    Object.assign(details, { archived: false, hasDraft: false, version: version + 1 });
    return snapshot();
  };

  await render('/admin/dictation?q=does-not-match');
  assert.match(document.body.textContent, /Chưa có bài nghe phù hợp/);
  await click('Đặt lại bộ lọc');
  assert.match(document.querySelector('.dictation-admin-table').textContent, /Published listening/);
  await click('Chỉnh sửa');
  const editor = document.querySelector('.dictation-editor');
  assert.ok(editor);
  const title = editor.querySelector('.dictation-editor-metadata input');
  await change(title, 'Updated listening');
  assert.equal(button('Ẩn bài nghe', editor).disabled, true);
  await click('Lưu bản nháp', editor);
  assert.match(editor.textContent, /Đã lưu bản nháp/);

  await click('Ẩn bài nghe', editor);
  await click('Xác nhận');
  assert.match(editor.textContent, /Đã cập nhật hiển thị/);
  assert.match(document.querySelector('.dictation-admin-table').textContent, /Đã ẩn/);

  await click('Xuất bản', editor);
  const publish = [...document.querySelectorAll('[role="dialog"]')].find(dialog =>
    dialog.textContent.includes('Xuất bản cập nhật?'),
  );
  await click('Xác nhận', publish);
  assert.match(
    document.querySelector('.dictation-admin-table').textContent,
    /Updated listening.*Đã xuất bản/s,
  );
  assert.deepEqual(requests, [
    ['save', 'lesson', 3, 'Updated listening'],
    ['visibility', 'lesson', true],
    ['publish', 'lesson', 4, undefined],
  ]);
});

test('admin sees workbook row errors before choosing to replace the transcript', async () => {
  const names = [];
  const importedRows = [
    { text: 'First imported sentence.', start: 0, end: 1 },
    { text: 'Second imported sentence.', start: 1, end: 2 },
  ];
  dictationApi.query = async () => ({ data: { items: [], total: 0 } });
  dictationApi.import = async file => {
    names.push(file.name);
    return {
      data: {
        sentences: importedRows,
        errors: file.name === 'invalid.xlsx' ? [{ row: 8, message: 'Mốc kết thúc không hợp lệ' }] : [],
      },
    };
  };
  const selectWorkbook = async name => {
    const control = document.querySelector('input[type="file"][accept=".xlsx"]');
    assert.ok(control);
    const workbook = new dom.window.File(['workbook fixture'], name);
    await act(async () => {
      Object.defineProperty(control, 'files', { configurable: true, value: [workbook] });
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  const preview = () => document.querySelector('.dictation-import');
  const waitForDialogExit = () => act(async () => new Promise(done => realSetTimeout(done, 260)));

  await render('/admin/dictation');
  await click('Thêm bài nghe');
  await change(
    document.querySelector('.dictation-editor textarea:not([aria-hidden])'),
    'Unpublished sentence',
  );
  await selectWorkbook('invalid.xlsx');
  assert.match(preview().textContent, /Dòng 8.*Mốc kết thúc không hợp lệ/s);
  assert.equal(button('Thêm 2 câu', preview()).disabled, true);
  await click('Hủy', preview());
  await waitForDialogExit();
  assert.equal(
    document.querySelector('.dictation-editor textarea:not([aria-hidden])').value,
    'Unpublished sentence',
  );

  await selectWorkbook('valid.xlsx');
  assert.match(preview().textContent, /3 câu sau khi nhập/);
  await click('Thay thế toàn bộ', preview());
  assert.match(preview().textContent, /2 câu sau khi nhập/);
  await click('Thay thế transcript', preview());
  await waitForDialogExit();

  const sentences = [...document.querySelectorAll('.dictation-editor-rows textarea:not([aria-hidden])')];
  assert.deepEqual(
    sentences.map(row => row.value),
    importedRows.map(row => row.text),
  );
  assert.deepEqual(names, ['invalid.xlsx', 'valid.xlsx']);
});

test('admin uses audio position to time a sentence, previews the segment, and publishes the draft', async () => {
  const uploads = [];
  const published = [];
  dictationApi.query = async () => ({ data: { items: [], total: 0 } });
  dictationApi.upload = async file => {
    uploads.push(file.name);
    return { data: { key: 'sample-audio', name: file.name, duration: 8 } };
  };
  dictationApi.adminAudio = async key => {
    assert.equal(key, 'sample-audio');
    return new Blob(['audio'], { type: 'audio/mpeg' });
  };
  dictationApi.publish = async (id, version, definition) => {
    published.push({ id, version, definition });
  };

  await render('/admin/dictation');
  await click('Thêm bài nghe');
  const editor = document.querySelector('.dictation-editor');
  await click('Lưu bản nháp', editor);
  assert.match(editor.textContent, /Vui lòng nhập tên bài nghe và chủ đề/);

  const [title, topic] = editor.querySelectorAll('.dictation-editor-metadata input');
  await change(title, '  Listening at work  ');
  await change(topic, '  Workplace  ');
  await change(editor.querySelector('.dictation-youtube-url-field input'), 'https://example.test/video');
  await click('Lưu bản nháp', editor);
  assert.match(editor.textContent, /Vui lòng nhập liên kết YouTube hợp lệ/);
  await change(editor.querySelector('.dictation-youtube-url-field input'), '');
  await change(
    editor.querySelector('.dictation-editor-row textarea:not([aria-hidden])'),
    '  Open the door.  ',
  );

  const audioInput = editor.querySelector('input[type=file][accept*="mp3"]');
  const file = new dom.window.File(['audio'], 'workplace.mp3', { type: 'audio/mpeg' });
  await act(async () => {
    Object.defineProperty(audioInput, 'files', { configurable: true, value: [file] });
    audioInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.match(editor.querySelector('.dictation-audio-name').textContent, /workplace\.mp3/);
  const audio = editor.querySelector('audio');
  assert.ok(audio);
  Object.defineProperty(audio, 'duration', { configurable: true, value: 8 });
  for (const [position, label] of [
    [1, 'Lấy mốc bắt đầu câu 1'],
    [3, 'Lấy mốc kết thúc câu 1'],
  ]) {
    await act(async () => {
      audio.currentTime = position;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    await clickElement(editor.querySelector(`button[aria-label="${label}"]`));
  }
  await clickElement(editor.querySelector('button[aria-label="Nghe thử câu 1"]'));
  assert.equal(audio.currentTime, 1);
  assert.equal(audio.paused, false);
  await clickElement(editor.querySelector('button[aria-label="Tạm dừng câu 1"]'));
  assert.equal(audio.paused, true);

  await click('Thêm câu', editor);
  await change(
    editor.querySelector('.dictation-editor-row:nth-child(2) textarea:not([aria-hidden])'),
    'Extra sentence',
  );
  await clickElement(
    editor.querySelector('.dictation-editor-row:nth-child(2) button[aria-label="Chuyển câu lên"]'),
  );
  assert.equal(
    editor.querySelector('.dictation-editor-row textarea:not([aria-hidden])').value,
    'Extra sentence',
  );
  await clickElement(editor.querySelector('button[aria-label="Xóa câu 1"]'));
  await click('Xuất bản', editor);
  assert.deepEqual(uploads, ['workplace.mp3']);
  assert.deepEqual(published, [
    {
      id: undefined,
      version: 0,
      definition: {
        title: 'Listening at work',
        description: '',
        topic: 'Workplace',
        level: 'B1',
        audioKey: 'sample-audio',
        sentences: [{ text: 'Open the door.', start: 1, end: 3 }],
      },
    },
  ]);
  assert.match(document.body.textContent, /Đã xuất bản bài nghe/);
});

test('level pills filter previews while topic links always open the full topic', async () => {
  const conversation = 'Daily English Conversation';
  const { queries } = installLibraryFixture(['A1', 'A2'], [conversation, conversation]);
  const pills = () => [...document.querySelectorAll('.dictation-topic-pills a')];
  await render('/dictation?tier=beginner');
  assert.equal(button('Người mới').getAttribute('aria-pressed'), 'true');
  assert.equal(queries.at(-1).level, 'BEGINNER');
  assert.deepEqual(
    pills().map(link => link.textContent),
    [conversation, 'Test 1'],
  );
  assert.equal(document.querySelectorAll('.dictation-lesson-card').length, 2);
  const seeAll = document.querySelector('.dictation-topic-heading a');
  assert.equal(pills()[0].getAttribute('href'), seeAll.getAttribute('href'));
  await click('Nâng cao');
  assert.equal(queries.at(-1).level, 'ADVANCED');
  assert.deepEqual(
    pills().map(link => link.textContent),
    [conversation, 'Test 1'],
  );
  assert.equal(document.querySelector('.dictation-topic-heading h2').textContent, 'Test 1');
  assert.equal(pills()[0].getAttribute('href'), '/dictation?topic=Daily+English+Conversation&tier=advanced');
  await clickElement(pills()[0]);
  assert.equal(document.querySelector('h1').textContent, conversation);
  assert.equal(document.querySelector('.dictation-tier-pills'), null);
  assert.equal(queries.at(-1).level, '');
  assert.equal(queries.at(-1).topic, conversation);
  assert.equal(document.querySelectorAll('.dictation-lesson-card').length, 2);
  await select('Trình độ', 'A2');
  assert.equal(queries.at(-1).level, 'A2');
  const back = document.querySelector('.dictation-library-back');
  assert.equal(back.getAttribute('href'), '/dictation?tier=advanced');
  await clickElement(back);
  assert.equal(queries.at(-1).level, 'ADVANCED');
  assert.equal(button('Nâng cao').getAttribute('aria-pressed'), 'true');
  const requestCount = queries.length;
  await click('Tất cả');
  assert.equal(queries.length, requestCount);
  assert.deepEqual(
    [...document.querySelectorAll('.dictation-topic-heading h2')].map(heading => heading.textContent),
    [conversation, 'Test 1'],
  );
  assert.equal(button('Tất cả').getAttribute('aria-pressed'), 'true');
});

test('topic labels use title case and video cards show a thumbnail with a fallback', async () => {
  const topic = 'daily english Conversation';
  const displayName = 'Daily English Conversation';
  const thumbnailUrl = 'https://i.ytimg.com/vi/_R7nrvhNmrI/mqdefault.jpg';
  const lesson = {
    id: 'video-lesson',
    title: 'What day is it today?',
    topic,
    level: 'A1',
    duration: 92,
    sentenceCount: 7,
    video: true,
    thumbnailUrl,
  };
  dictationApi.query = async path => ({
    data:
      path === dictationApi.topicGroupsPath
        ? { groups: [{ topic, total: 1, items: [lesson] }] }
        : { items: [lesson], total: 1, topics: [topic] },
  });
  await render('/dictation');
  const pill = document.querySelector('.dictation-topic-pills a');
  assert.equal(pill.textContent, displayName);
  assert.equal(document.querySelector('.dictation-topic-heading h2').textContent, displayName);
  assert.deepEqual(
    [...document.querySelector('.dictation-lesson-meta').children].map(item => item.textContent),
    ['01:32', '7 câu'],
  );
  const artwork = document.querySelector('.dictation-lesson-art');
  assert.equal(artwork.querySelector('img').getAttribute('src'), thumbnailUrl);
  await act(async () => artwork.querySelector('img').dispatchEvent(new Event('error')));
  assert.equal(artwork.querySelector('img'), null);
  assert.ok(artwork.querySelector('.dictation-cover-icon'));
  await clickElement(pill);
  assert.equal(document.querySelector('h1').textContent, displayName);
  assert.equal(document.querySelector('.dictation-lesson-art img').getAttribute('src'), thumbnailUrl);
});

test('My Lessons uses exclusive status toggles, true 20-item pages and resets pagination on status change', async () => {
  const { queries } = installLibraryFixture();
  await render('/dictation');
  assert.equal(document.querySelector('.dictation-back-row'), null);
  assert.equal(queries.at(-1).path, dictationApi.topicGroupsPath);
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
  assert.equal(queries.at(-1).path, dictationApi.topicGroupsPath);
  assert.equal(queries.at(-1).status, '');
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
