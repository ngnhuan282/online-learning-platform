import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'Event', 'HTMLElement', 'DocumentFragment', 'ShadowRoot']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/toeic-native',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { default: Library } = await load('features/learning/pages/ToeicLibraryPage.jsx');
const { default: Study } = await load('features/learning/pages/ToeicReaderPage.jsx');
const { default: Attempt } = await load('features/learning/pages/ToeicAttemptPage.jsx');
const { default: Result } = await load('features/learning/pages/ToeicResultPage.jsx');
const { default: Admin } = await load('features/learning/pages/AdminToeicPage.jsx');
const { default: MyNotes } = await load('features/learning/pages/MyNotesPage.jsx');
const { default: StudyTextAssistant } = await load('features/learning/components/StudyTextAssistant.jsx');
const { toeicApi } = await load('features/learning/api/toeicApi.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { setLocale } = await load('shared/i18n/locale.js');
const cache = createCache({ key: 'toeic-native-test' });
const originals = { ...toeicApi };
const clone = value => structuredClone(value);
const questions = [
  {
    id: 'q101',
    number: 101,
    part: 5,
    passage: '',
    prompt: 'Former Sendai Company CEO Ken Nakata spoke about ------- career experiences.',
    options: ['he', 'his', 'him', 'himself'].map((text, index) => ({ id: 'ABCD'[index], text })),
  },
  {
    id: 'q131',
    number: 131,
    part: 6,
    passage: 'The office will open on Monday. Please bring your badge.',
    prompt: 'When will the office open?',
    options: ['Monday', 'Tuesday', 'Friday', 'Sunday'].map((text, index) => ({ id: 'ABCD'[index], text })),
  },
];
const detail = {
  id: 1,
  slug: 'ets-2024-test-01',
  title: 'ETS 2024 — Test 01',
  description: 'Reading trực tiếp',
  durationMinutes: 75,
  sourceLabel: 'TOEIC test fixture',
  version: 1,
  lessons: [
    {
      id: 'part5',
      title: 'Tính từ sở hữu',
      content: 'Tính từ sở hữu đứng trước danh từ. Ví dụ: his career experiences.',
    },
  ],
  questions,
};
let root, location, currentAttempt;
const freshAttempt = (overrides = {}) => ({
  id: 41,
  examId: 1,
  title: detail.title,
  mode: 'PRACTICE',
  status: 'IN_PROGRESS',
  startedAt: new Date().toISOString(),
  deadlineAt: null,
  serverNow: new Date().toISOString(),
  submittedAt: null,
  score: null,
  correctCount: null,
  totalQuestions: questions.length,
  answers: {},
  questions: clone(questions),
  ...overrides,
});
function Navigation() {
  location = useLocation();
  return null;
}
async function render(path = '/exams/toeic', userId = 1) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user: { id: userId, roles: ['ADMIN'] } } },
          h(
            MemoryRouter,
            { initialEntries: [path] },
            h(Navigation),
            h(
              Routes,
              null,
              h(Route, { path: '/exams/toeic', element: h(Library) }),
              h(Route, { path: '/exams/toeic/tests/:testId', element: h(Study) }),
              h(Route, { path: '/exams/toeic/attempts/:attemptId', element: h(Attempt) }),
              h(Route, { path: '/exams/toeic/attempts/:attemptId/result', element: h(Result) }),
              h(Route, { path: '/admin/toeic', element: h(Admin) }),
              h(Route, { path: '/my-notes', element: h(MyNotes) }),
              h(Route, {
                path: '/lesson-sample',
                element: h(
                  StudyTextAssistant,
                  { allowNotes: false },
                  h('p', { className: 'lesson-sample-text' }, 'Please review the attached agenda.'),
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
const rows = () => [...document.querySelectorAll('.toeic-test-card h2')].map(node => node.textContent);
async function pause(ms) {
  await act(async () => new Promise(resolve => setTimeout(resolve, ms)));
}
async function click(label) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label);
  assert.ok(button, `Missing button: ${label}`);
  assert.equal(button.disabled, false, `Disabled button: ${label}`);
  await act(async () => button.click());
}
async function change(input, value) {
  assert.ok(input, 'Expected a form field');
  const prototype =
    input.tagName === 'SELECT'
      ? dom.window.HTMLSelectElement.prototype
      : input.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
async function choose(id) {
  const input = document.querySelector(`.toeic-question input[type="radio"][value="${id}"]`);
  assert.ok(input, `Missing answer ${id}`);
  await act(async () => input.click());
}
beforeEach(() => {
  currentAttempt = freshAttempt();
  toeicApi.list = async () => ({
    data: Array.from({ length: 10 }, (_, index) => ({
      ...detail,
      id: index + 1,
      title: `ETS 2024 — Test ${String(index + 1).padStart(2, '0')}`,
      questionCount: 100,
      lessonCount: 3,
      published: true,
    })),
  });
  toeicApi.detail = async () => ({ data: clone(detail) });
  toeicApi.progress = async () => ({ data: { completedLessonIds: [], attempts: [] } });
  toeicApi.attempt = async () => ({ data: clone(currentAttempt) });
  toeicApi.saveAnswers = async (_id, answers) => {
    currentAttempt.answers = clone(answers);
    return { data: clone(currentAttempt) };
  };
  toeicApi.submit = async (_id, answers) => {
    currentAttempt = {
      ...currentAttempt,
      status: 'GRADED',
      answers: clone(answers),
      correctCount: 1,
      score: 50,
      submittedAt: new Date().toISOString(),
      questions: currentAttempt.questions.map((question, index) => ({
        ...question,
        correctOptionId: index ? 'A' : 'B',
        explanation: index
          ? 'The passage states Monday.'
          : 'His là tính từ sở hữu, đứng trước career experiences.',
      })),
    };
    return { data: clone(currentAttempt) };
  };
  toeicApi.adminList = async () => ({ data: [] });
  toeicApi.notes = async () => ({ data: { items: [], count: 0, limit: 100, isPro: false } });
  toeicApi.dictionary = async term => ({
    data: {
      term,
      headword: term.toLowerCase(),
      phonetic: '/ɪkˈspɪriəns/',
      meanings: [
        {
          partOfSpeech: 'Danh từ (n)',
          meaningVi: 'kinh nghiệm, trải nghiệm',
          exampleEn: 'Prior retail experience is preferred.',
          exampleVi: 'Ưu tiên có kinh nghiệm bán lẻ trước đó.',
        },
      ],
      relatedForms: ['experienced'],
      found: true,
    },
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  Object.assign(toeicApi, originals);
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  setLocale('vi');
});
after(async () => {
  await server.close();
  dom.window.close();
});

test('native catalogue keeps six exams per page, filters and saved lists, without PDF or demo content', async () => {
  await render();
  assert.equal(rows().length, 6);
  assert.match(rows()[0], /Test 01/);
  assert.ok(document.querySelector('.toeic-featured .button-primary'));
  assert.equal(document.querySelector('iframe, a[download], audio'), null);
  await act(async () => document.querySelector('button[aria-label="Trang 2"]').click());
  assert.equal(rows().length, 4);
  assert.match(rows()[0], /Test 07/);
  assert.equal(new URLSearchParams(location.search).get('page'), '2');
  await change(document.querySelector('input[type="search"]'), 'Test 01');
  assert.equal(rows().length, 1);
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  await act(async () => document.querySelector('.toeic-save').click());
  assert.equal(location.pathname, '/exams/toeic');
  await click('Đề đã lưu1');
  assert.equal(rows().length, 1);
  await act(async () => document.querySelector('.toeic-test-card h2').click());
  assert.equal(location.pathname, '/exams/toeic/tests/1');
});

test('catalogue API errors show retry instead of substituting the source PDF collection', async () => {
  let calls = 0;
  const list = toeicApi.list;
  toeicApi.list = async () => {
    if (++calls === 1) throw { message: 'TOEIC unavailable' };
    return list();
  };
  await render();
  assert.equal(rows().length, 0);
  assert.match(document.body.textContent, /Không thể tải dữ liệu/);
  await click('Thử lại');
  assert.equal(rows().length, 6);
});

test('learner selects practice timer or real exam mode without pre-practice lessons and can view answers freely in practice mode', async () => {
  const started = [];
  currentAttempt = freshAttempt({
    mode: 'PRACTICE',
    durationMinutes: 30,
    deadlineAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    questions: questions.map((question, index) => ({
      ...question,
      correctOptionId: index ? 'A' : 'B',
      explanation: index
        ? 'The passage states Monday.'
        : 'His là tính từ sở hữu, đứng trước career experiences.',
    })),
  });
  toeicApi.start = async (...args) => {
    started.push(args);
    return { data: clone(currentAttempt) };
  };
  await render('/exams/toeic/tests/1');
  assert.equal(
    document.querySelector('.toeic-lesson-list, .toeic-lesson-content, .toeic-progress-panel'),
    null,
  );
  assert.equal(document.querySelector('iframe, a[download]'), null);
  await click('30 phút');
  await click('Luyện Part 5');
  assert.deepEqual(started[0], ['1', 'PRACTICE', 5, 30]);
  assert.equal(location.pathname, '/exams/toeic/attempts/41');
  assert.match(document.querySelector('.toeic-question-prompt').textContent, /career experiences/);
  assert.equal(document.querySelector('.toeic-explanation'), null);
  await click('Xem đáp án & lời giải');
  assert.match(document.querySelector('.toeic-explanation').textContent, /His là tính từ sở hữu/);
  assert.equal(document.querySelector('input[value="B"]').disabled, false);
  await click('Ẩn đáp án');
  assert.equal(document.querySelector('.toeic-explanation'), null);

  await click('Lưu và về bộ đề');
  assert.equal(location.pathname, '/exams/toeic/tests/1');
  currentAttempt = freshAttempt({
    id: 42,
    mode: 'EXAM',
    durationMinutes: 75,
    deadlineAt: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
  });
  await act(async () => document.querySelector('.toeic-mode-card.is-exam').click());
  await click('Bắt đầu thi thử');
  assert.deepEqual(started[1], ['1', 'EXAM', null, null]);
  assert.equal(location.pathname, '/exams/toeic/attempts/42');
  assert.equal(document.querySelector('.toeic-practice-reveal-bar'), null);
  assert.equal(document.querySelector('.toeic-explanation'), null);
});

test('late autosave responses never overwrite a newer native answer and queued saves keep the newest selection', async () => {
  const saved = [];
  let finish;
  toeicApi.saveAnswers = async (_id, answers) => {
    saved.push(clone(answers));
    if (saved.length === 1)
      await new Promise(resolve => {
        finish = resolve;
      });
    return { data: freshAttempt({ answers: clone(answers) }) };
  };
  await render('/exams/toeic/attempts/41');
  await choose('B');
  await pause(550);
  assert.equal(saved.length, 1);
  await choose('C');
  await act(async () => finish());
  assert.deepEqual(saved.at(-1), { q101: 'C' });
  assert.equal(document.querySelector('input[value="C"]').checked, true);
  assert.equal(document.querySelector('input[value="B"]').checked, false);
});

test('saved answers resume; failed submission keeps choices; retry opens scored per-attempt explanations', async () => {
  currentAttempt.answers = { q101: 'B' };
  const submit = toeicApi.submit;
  let calls = 0;
  toeicApi.submit = async (...args) => {
    if (++calls === 1) throw { message: 'Connection interrupted' };
    return submit(...args);
  };
  await render('/exams/toeic/attempts/41');
  assert.equal(document.querySelector('input[value="B"]').checked, true);
  assert.equal(document.querySelector('.toeic-explanation'), null);
  await click('Nộp bài');
  assert.match(document.body.textContent, /1 câu chưa trả lời/);
  await click('Xác nhận nộp bài');
  assert.equal(location.pathname, '/exams/toeic/attempts/41');
  assert.equal(document.querySelector('input[value="B"]').checked, true);
  assert.match(document.body.textContent, /Chưa nộp được bài/);
  await click('Thử lại');
  assert.equal(location.pathname, '/exams/toeic/attempts/41/result');
  assert.match(document.body.textContent, /50/);
  assert.match(document.body.textContent, /His là tính từ sở hữu/);
  assert.equal(document.querySelector('iframe'), null);
});

test('leaving an attempt for another account ignores the previous owner pending response', async () => {
  let finish;
  toeicApi.saveAnswers = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  await render('/exams/toeic/attempts/41', 1);
  await choose('B');
  await pause(550);
  currentAttempt.answers = { q101: 'D' };
  await render('/exams/toeic/attempts/41', 2);
  assert.equal(document.querySelector('input[value="D"]').checked, true);
  await act(async () => finish({ data: freshAttempt({ status: 'GRADED' }) }));
  assert.equal(location.pathname, '/exams/toeic/attempts/41');
  assert.equal(document.querySelector('input[value="D"]').checked, true);
});

test('submission waits for an in-flight save and sends the latest complete answer map', async () => {
  let finishSave;
  let submitted;
  const submit = toeicApi.submit;
  toeicApi.saveAnswers = () =>
    new Promise(resolve => {
      finishSave = resolve;
    });
  toeicApi.submit = async (id, answers) => {
    submitted = clone(answers);
    return submit(id, answers);
  };
  await render('/exams/toeic/attempts/41');
  await choose('B');
  await pause(550);
  await choose('C');
  await click('Nộp bài');
  await click('Xác nhận nộp bài');
  assert.equal(submitted, undefined);
  await act(async () => finishSave({ data: freshAttempt({ answers: { q101: 'B' } }) }));
  assert.deepEqual(submitted, { q101: 'C' });
  assert.equal(location.pathname, '/exams/toeic/attempts/41/result');
});

test('expired exam automatically submits once and opens the server result', async () => {
  currentAttempt = freshAttempt({
    mode: 'EXAM',
    deadlineAt: new Date(Date.now() - 1000).toISOString(),
    answers: { q101: 'B' },
  });
  let submitted = 0;
  const submit = toeicApi.submit;
  toeicApi.submit = async (...args) => {
    submitted++;
    return submit(...args);
  };
  await render('/exams/toeic/attempts/41');
  await pause(40);
  assert.equal(submitted, 1);
  assert.equal(location.pathname, '/exams/toeic/attempts/41/result');
  assert.match(document.querySelector('.toeic-score').textContent, /50%/);
});

test('source passage images remain enlargeable when reviewing disabled answer controls', async () => {
  currentAttempt = freshAttempt({
    status: 'GRADED',
    score: 100,
    correctCount: 2,
    answers: { q101: 'B', q131: 'A' },
    questions: questions.map((question, index) => ({
      ...question,
      passageImageUrls: index ? [] : ['/toeic-assets/review-passage.webp'],
      correctOptionId: index ? 'A' : 'B',
      explanation: 'Lời giải của câu hỏi từ nguồn.',
    })),
  });
  await render('/exams/toeic/attempts/41/result');
  assert.equal(document.querySelector('.toeic-question input').disabled, true);
  const zoom = document.querySelector('.toeic-image-trigger');
  assert.ok(zoom);
  assert.equal(zoom.disabled, false);
  await act(async () => zoom.click());
  assert.ok(
    document.querySelector(
      '[role="dialog"] .toeic-image-dialog img[src="/toeic-assets/review-passage.webp"]',
    ),
  );
  await click('Đóng');
});

test('save-and-return keeps the graded result when the server finishes an expired attempt during saving', async () => {
  const submit = toeicApi.submit;
  toeicApi.saveAnswers = (id, answers) => submit(id, answers);
  await render('/exams/toeic/attempts/41');
  await choose('B');
  await click('Lưu và về bộ đề');
  assert.equal(location.pathname, '/exams/toeic/attempts/41/result');
  assert.match(document.querySelector('.toeic-score').textContent, /50%/);
});

test('save-and-return from an old account cannot navigate after another account has opened the attempt', async () => {
  let finish;
  toeicApi.saveAnswers = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  await render('/exams/toeic/attempts/41', 1);
  await choose('B');
  const leave = [...document.querySelectorAll('button')].find(node =>
    node.textContent.includes('Lưu và về bộ đề'),
  );
  await act(async () => leave.click());
  assert.ok(finish);
  currentAttempt.answers = { q101: 'D' };
  await render('/exams/toeic/attempts/41', 2);
  await act(async () => finish({ data: freshAttempt({ answers: { q101: 'B' } }) }));
  assert.equal(location.pathname, '/exams/toeic/attempts/41');
  assert.equal(document.querySelector('input[value="D"]').checked, true);
});

const labelled = text =>
  [...document.querySelectorAll('label')]
    .find(label => label.firstChild?.textContent.trim() === text)
    ?.querySelector('input, textarea, select');
async function clickContaining(text) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.includes(text));
  assert.ok(button, `Missing button: ${text}`);
  await act(async () => button.click());
}

test('Admin creates native lessons/questions, edits with a version, publishes and confirms deletion', async () => {
  let stored;
  const calls = [];
  toeicApi.adminList = async () => ({
    data: stored
      ? [{ ...stored, questionCount: stored.questions.length, lessonCount: stored.lessons.length }]
      : [],
  });
  toeicApi.create = async definition => {
    calls.push(['create', clone(definition)]);
    stored = { ...clone(definition), id: 77, version: 1, published: false };
    return { data: clone(stored) };
  };
  toeicApi.update = async (id, definition) => {
    assert.equal(id, 77);
    assert.equal(definition.version, stored.version);
    calls.push(['update', clone(definition)]);
    stored = { ...clone(definition), id, version: stored.version + 1 };
    return { data: clone(stored) };
  };
  toeicApi.publish = async (id, published) => {
    calls.push(['publish', id, published]);
    stored = { ...stored, published, version: stored.version + 1 };
    return { data: clone(stored) };
  };
  toeicApi.remove = async id => {
    calls.push(['remove', id]);
    stored = null;
  };
  await render('/admin/toeic');
  await change(document.querySelector('input[name="title"]'), 'Reading tự luyện');
  await change(document.querySelector('input[name="slug"]'), 'reading-tu-luyen');
  await click('Thêm câu hỏi');
  await change(labelled('Nội dung câu hỏi'), questions[0].prompt);
  for (const option of questions[0].options) await change(labelled(`Lựa chọn ${option.id}`), option.text);
  await change(labelled('Đáp án đúng'), 'B');
  await change(labelled('Giải thích đáp án'), 'His đứng trước cụm danh từ.');
  await click('Lưu bộ đề');
  assert.equal(calls[0][0], 'create');
  assert.deepEqual(calls[0][1].lessons, []);
  assert.equal(calls[0][1].questions[0].correctOptionId, 'B');
  assert.deepEqual(
    calls[0][1].questions[0].options.map(option => option.text),
    ['he', 'his', 'him', 'himself'],
  );
  assert.equal(document.querySelector('iframe, audio'), null);
  assert.ok([...document.querySelectorAll('button')].some(node => node.textContent === 'Import Excel/CSV'));
  await change(document.querySelector('input[name="title"]'), 'Reading đã cập nhật');
  await click('Lưu bộ đề');
  assert.equal(calls[1][0], 'update');
  assert.equal(calls[1][1].version, 1);
  await click('Xuất bản');
  assert.deepEqual(calls[2], ['publish', 77, true]);
  assert.match(document.body.textContent, /Ẩn bộ đề/);
  await click('Xóa bộ đề');
  assert.equal(
    calls.some(call => call[0] === 'remove'),
    false,
  );
  const confirm = [...document.querySelectorAll('[role="dialog"] button')].find(
    node => node.textContent.trim() === 'Xóa bộ đề',
  );
  assert.ok(confirm);
  await act(async () => confirm.click());
  assert.deepEqual(calls.at(-1), ['remove', 77]);
});

const importHeaders = [
  'Số câu',
  'Part',
  'Đoạn đọc',
  'Câu hỏi',
  'A',
  'B',
  'C',
  'D',
  'Đáp án',
  'Giải thích',
  'Nguồn',
];
const importRow = (number = 102) => [
  number,
  5,
  'Thông báo mới, dành cho nhân viên.\nVui lòng đọc kỹ.',
  'The employee showed ------- badge.',
  'he',
  'his',
  'him',
  'himself',
  'B',
  'His đứng trước danh từ "badge".',
  'Nội dung tự biên soạn',
];
function csvQuestionFile(rows, fileName = 'reading-import.csv') {
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  return new File(
    ['\ufeff' + [importHeaders, ...rows].map(row => row.map(quote).join(',')).join('\r\n')],
    fileName,
    {
      type: 'text/csv',
    },
  );
}
async function waitForImport(predicate, description) {
  for (let index = 0; index < 150; index++) {
    if (predicate()) return;
    await pause(20);
  }
  assert.ok(predicate(), description);
}
async function chooseQuestionFile(file) {
  const input = document.querySelector('input[aria-label="File câu hỏi Excel hoặc CSV"]');
  assert.ok(input, 'Expected the question import file input');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
function importConfirm() {
  return [...document.querySelectorAll('[role="dialog"] button')].find(node =>
    /^Nhập(?: \d+)? câu hỏi$/.test(node.textContent.trim()),
  );
}
async function openQuestionBankForImport() {
  let stored = {
    ...clone(detail),
    published: false,
    questions: detail.questions.map(question => ({
      ...clone(question),
      correctOptionId: question.part === 5 ? 'B' : 'A',
      explanation: 'Lời giải đã có trong bộ đề.',
    })),
  };
  const writes = [];
  toeicApi.adminList = async () => ({
    data: [{ ...stored, questionCount: stored.questions.length, lessonCount: stored.lessons.length }],
  });
  toeicApi.adminDetail = async () => ({ data: clone(stored) });
  toeicApi.update = async (id, definition) => {
    writes.push({ id, definition: clone(definition) });
    stored = { ...clone(definition), id, version: stored.version + 1 };
    return { data: clone(stored) };
  };
  await render('/admin/toeic');
  await clickContaining(detail.title);
  await clickContaining('Ngân hàng câu hỏi');
  return { writes };
}

test('Admin previews CSV questions, appends without writing, then explicitly saves preserving existing content', async () => {
  const { writes } = await openQuestionBankForImport();
  await click('Import Excel/CSV');
  await chooseQuestionFile(csvQuestionFile([importRow()]));
  await waitForImport(() => importConfirm() && !importConfirm().disabled, 'CSV preview should allow import');
  assert.match(document.querySelector('[role="dialog"]').textContent, /The employee showed/);
  assert.equal(writes.length, 0);
  await click('Nhập 1 câu hỏi');
  assert.equal(writes.length, 0, 'Import must only change the unsaved form');
  assert.match(document.body.textContent, /Ngân hàng câu hỏi.*\(3\)/);
  await click('Lưu bộ đề');
  assert.equal(writes.length, 1);
  const saved = writes[0].definition;
  assert.equal(saved.questions.length, 3);
  assert.deepEqual(
    saved.questions.slice(0, 2).map(question => question.id),
    ['q101', 'q131'],
  );
  assert.deepEqual(saved.lessons, detail.lessons);
  const imported = saved.questions.find(question => question.number === 102);
  assert.ok(imported.id && !['q101', 'q131'].includes(imported.id));
  assert.equal(imported.passage, importRow()[2]);
  assert.equal(imported.correctOptionId, 'B');
  assert.equal(imported.explanation, importRow()[9]);
  assert.deepEqual(
    imported.options.map(option => option.text),
    importRow().slice(4, 8),
  );
});

test('Admin rejects a CSV with duplicate existing numbers atomically and cancellation keeps all content', async () => {
  const { writes } = await openQuestionBankForImport();
  await click('Import Excel/CSV');
  await chooseQuestionFile(csvQuestionFile([importRow(102), importRow(101)]));
  await waitForImport(
    () => /trùng|đã tồn tại/i.test(document.querySelector('[role="dialog"]')?.textContent ?? ''),
    'Duplicate row should be explained',
  );
  assert.ok(importConfirm()?.disabled, 'A mixed valid and duplicate file must not import partially');
  assert.equal(writes.length, 0);
  await click('Hủy');
  assert.match(document.body.textContent, /Ngân hàng câu hỏi.*\(2\)/);
  await click('Import Excel/CSV');
  assert.ok(importConfirm()?.disabled);
  assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /The employee showed/);
  await click('Hủy');
  assert.equal(writes.length, 0);
});

test('Admin import cancellation discards a file whose asynchronous read completes after the modal closes', async () => {
  const { writes } = await openQuestionBankForImport();
  const file = csvQuestionFile([importRow(102)]);
  const originalBuffer = await file.arrayBuffer();
  let finishRead;
  const pendingRead = new Promise(resolve => {
    finishRead = resolve;
  });
  Object.defineProperty(file, 'arrayBuffer', { value: () => pendingRead.then(() => originalBuffer) });
  Object.defineProperty(file, 'text', {
    value: () => pendingRead.then(() => new TextDecoder().decode(originalBuffer)),
  });
  await click('Import Excel/CSV');
  await chooseQuestionFile(file);
  await click('Hủy');
  await click('Import Excel/CSV');
  await act(async () => finishRead());
  await pause(30);
  assert.ok(importConfirm()?.disabled);
  assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /The employee showed/);
  assert.equal(writes.length, 0);
  await click('Hủy');
  assert.match(document.body.textContent, /Ngân hàng câu hỏi.*\(2\)/);
});

test('Admin imports an actual XLSX workbook into the same editable question form', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Câu hỏi Reading');
  sheet.addRow(importHeaders);
  sheet.addRow(importRow(103));
  const file = new File([await workbook.xlsx.writeBuffer()], 'reading-import.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const { writes } = await openQuestionBankForImport();
  await click('Import Excel/CSV');
  await chooseQuestionFile(file);
  await waitForImport(() => importConfirm() && !importConfirm().disabled, 'XLSX preview should allow import');
  await click('Nhập 1 câu hỏi');
  await click('Lưu bộ đề');
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].definition.questions.find(question => question.number === 103)?.correctOptionId,
    'B',
  );
});

function selectNodeSubstring(element, substring) {
  const walker = document.createTreeWalker(element, dom.window.NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const start = node.nodeValue.indexOf(substring);
    if (start >= 0) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + substring.length);
      const selection = dom.window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return node.parentElement;
    }
  }
  throw new Error(`Substring not found: ${substring}`);
}

test('drag-highlighting in TOEIC opens compact note dialog with 100-note free quota, while double-click opens dictionary without conflict and lessons forbid notes', async () => {
  const savedNotes = [];
  toeicApi.notes = async () => ({
    data: { items: clone(savedNotes), count: savedNotes.length, limit: 100, isPro: false },
  });
  toeicApi.createNote = async payload => {
    const item = {
      id: savedNotes.length + 1,
      examTitle: detail.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload,
    };
    savedNotes.unshift(item);
    return { data: { note: item, count: savedNotes.length, limit: 100, isPro: false } };
  };
  toeicApi.updateNote = async (id, payload) => {
    const target = savedNotes.find(item => item.id === id);
    Object.assign(target, payload);
    return { data: { note: clone(target), count: savedNotes.length, limit: 100, isPro: false } };
  };
  toeicApi.deleteNote = async id => {
    const idx = savedNotes.findIndex(item => item.id === id);
    if (idx >= 0) savedNotes.splice(idx, 1);
    return { data: { items: clone(savedNotes), count: savedNotes.length, limit: 100, isPro: false } };
  };

  await render('/exams/toeic/attempts/41');
  const promptEl = selectNodeSubstring(
    document.querySelector('.toeic-question-prompt'),
    'career experiences',
  );

  // 1) Drag-select ("tô đen", detail === 1) opens Note dialog, NOT Dictionary
  await act(async () => {
    promptEl.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, detail: 1 }));
  });
  assert.ok(document.querySelector('[role="dialog"][aria-label="Thêm ghi chú TOEIC"]'));
  assert.equal(document.querySelector('[role="dialog"][aria-label="Tra từ điển tiếng Anh"]'), null);
  await change(document.querySelector('textarea[aria-label="Nội dung ghi chú"]'), 'Kinh nghiệm nghề nghiệp');
  await click('Lưu ghi chú');
  assert.equal(savedNotes.length, 1);
  assert.equal(savedNotes[0].selectedText, 'career experiences');
  assert.equal(savedNotes[0].questionNumber, 101);
  assert.match(document.querySelector('.study-tool-badge').textContent, /1\/100/);

  // 2) Double-click (detail === 2 + dblclick) opens Dictionary Lookup WITHOUT triggering Note dialog
  const wordTarget = selectNodeSubstring(document.querySelector('.toeic-question-prompt'), 'experiences');
  await act(async () => {
    wordTarget.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, detail: 2 }));
    wordTarget.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, detail: 2 }));
  });
  await pause(30);
  assert.ok(document.querySelector('[role="dialog"][aria-label="Tra từ điển tiếng Anh"]'));
  assert.equal(document.querySelector('[role="dialog"][aria-label="Thêm ghi chú TOEIC"]'), null);
  assert.match(document.body.textContent, /kinh nghiệm, trải nghiệm/);
  await act(async () => document.querySelector('button[aria-label="Đóng"]').click());

  // 3) Free 100-note limit shows Pro upgrade notice
  toeicApi.notes = async () => ({
    data: { items: clone(savedNotes), count: 100, limit: 100, isPro: false },
  });
  await act(async () => root.unmount());
  root = null;
  await render('/exams/toeic/attempts/41');
  const limitTarget = selectNodeSubstring(document.querySelector('.toeic-question-prompt'), 'Sendai Company');
  await act(async () => {
    limitTarget.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, detail: 1 }));
  });
  assert.match(document.body.textContent, /Đã đạt giới hạn 100\/100 ghi chú/);

  // 4) Non-TOEIC lesson view forbids drag-highlight notes while keeping double-click dictionary
  await act(async () => root.unmount());
  root = null;
  await render('/lesson-sample');
  const lessonNode = selectNodeSubstring(document.querySelector('.lesson-sample-text'), 'agenda');
  await act(async () => {
    lessonNode.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, detail: 1 }));
  });
  assert.equal(document.querySelector('[role="dialog"][aria-label="Thêm ghi chú TOEIC"]'), null);
  await act(async () => {
    lessonNode.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, detail: 2 }));
  });
  await pause(30);
  assert.ok(document.querySelector('[role="dialog"][aria-label="Tra từ điển tiếng Anh"]'));

  // 5) My Notes page (/my-notes) displays, edits and deletes saved TOEIC notes
  toeicApi.notes = async () => ({
    data: { items: clone(savedNotes), count: savedNotes.length, limit: 100, isPro: false },
  });
  await act(async () => root.unmount());
  root = null;
  await render('/my-notes');
  assert.match(document.body.textContent, /career experiences/);
  assert.match(document.body.textContent, /Kinh nghiệm nghề nghiệp/);
  await click('Sửa');
  await change(
    document.querySelector('textarea[aria-label="Chỉnh sửa nội dung ghi chú"]'),
    'Cụm danh từ chỉ kinh nghiệm sự nghiệp',
  );
  await click('Lưu thay đổi');
  assert.match(document.body.textContent, /Cụm danh từ chỉ kinh nghiệm sự nghiệp/);
  await click('Xóa');
  assert.equal(savedNotes.length, 0);
});
