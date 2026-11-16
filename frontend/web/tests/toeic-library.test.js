import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { createServer } from 'vite';

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
const { default: Library } = await load('features/learning/pages/ToeicLibraryPage.jsx');
const { default: Reader } = await load('features/learning/pages/ToeicReaderPage.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { toeicCatalog } = await load('features/learning/data/toeicResources.js');
const { setLocale } = await load('shared/i18n/locale.js');
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const originalStorageSet = dom.window.Storage.prototype.setItem;
const cache = createCache({ key: 'toeic-library-test' });
let root, navigate, location;
function Navigation() {
  navigate = useNavigate();
  location = useLocation();
  return null;
}
async function render(path = '/exams/toeic', userId = 1) {
  root ??= createRoot(document.getElementById('root'));
  globalThis.fetch ??= async () => ({ ok: true });
  const content = h(
    AuthContext.Provider,
    { value: { user: userId == null ? null : { id: userId } } },
    h(
      MemoryRouter,
      { initialEntries: [path] },
      h(Navigation),
      h(
        Routes,
        null,
        h(Route, { path: '/exams/toeic', element: h(Library) }),
        h(Route, { path: '/exams/toeic/tests/:testId', element: h(Reader) }),
      ),
    ),
  );
  await act(async () => root.render(h(CacheProvider, { value: cache }, content)));
}
function findButton(text, selector = 'button') {
  const button = [...document.querySelectorAll(selector)].find(item => item.textContent.includes(text));
  assert.ok(button, 'Missing button: ' + text);
  return button;
}
async function click(text, selector) {
  await act(async () => findButton(text, selector).click());
}
async function clickPage(page) {
  const button = document.querySelector(`.toeic-library-pagination button[aria-label="Trang ${page}"]`);
  assert.ok(button, 'Missing page control: ' + page);
  await act(async () => button.click());
}
async function nextPage() {
  const button = document.querySelector('.toeic-library-pagination button[aria-label="Trang sau"]');
  assert.ok(button && !button.disabled, 'Missing enabled next-page control');
  await act(async () => button.click());
}
const testTitles = () => [...document.querySelectorAll('.toeic-test-card h2')].map(item => item.textContent);
async function change(element, value) {
  await act(async () => {
    const prototype =
      element.tagName === 'SELECT'
        ? dom.window.HTMLSelectElement.prototype
        : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(
      new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
    );
  });
}
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  Date.now = originalNow;
  dom.window.Storage.prototype.setItem = originalStorageSet;
  dom.window.localStorage.clear();
  setLocale('vi');
  globalThis.fetch = originalFetch;
});
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Event;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('the library imports the actual source documents, exposes every test and never offers audio', async () => {
  await render();
  assert.ok(toeicCatalog.tests.length >= 10);
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 6);
  assert.equal(
    document.querySelector('.toeic-library-pagination button[aria-label="Trang trước"]').disabled,
    true,
  );
  assert.equal(
    document.querySelector('.toeic-test-action').getAttribute('href'),
    '/exams/toeic/tests/1?document=reading',
  );
  const titles = [];
  for (let page = 1; page <= Math.ceil(toeicCatalog.tests.length / 6); page++) {
    if (page > 1) await nextPage();
    titles.push(...testTitles());
  }
  assert.deepEqual(
    titles,
    toeicCatalog.tests.map(item => item.title),
  );
  assert.equal(
    document.querySelector('.toeic-library-pagination button[aria-label="Trang sau"]').disabled,
    true,
  );
  assert.ok(
    toeicCatalog.documents.every(
      item => !item.relativePath.split('/').some(part => part.toUpperCase() === 'AUDIO'),
    ),
  );
  assert.equal(document.querySelector('audio'), null);
  await click('Tất cả tài liệu', '.toeic-tabs button');
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  const downloads = [];
  for (let page = 1; page <= Math.ceil(toeicCatalog.documents.length / 6); page++) {
    if (page > 1) await nextPage();
    const rows = document.querySelectorAll('.toeic-document-row');
    assert.ok(rows.length > 0 && rows.length <= 6);
    downloads.push(
      ...[...document.querySelectorAll('.toeic-document-row a[download]')].map(link => link.download),
    );
  }
  assert.deepEqual(
    downloads,
    toeicCatalog.documents.map(item => item.filename),
  );
  assert.ok(downloads.some(filename => filename.endsWith('.docx')));
  assert.equal(new Set(downloads).size, toeicCatalog.documents.length);
});

test('search and sort update the actual test list, including the empty state and reset', async () => {
  await render();
  await change(document.querySelector('select[aria-label="Sắp xếp bộ đề"]'), 'desc');
  assert.match(document.querySelector('.toeic-test-card h2').textContent, /Test 10/);
  await change(document.querySelector('input[type="search"]'), 'test1');
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 1);
  assert.match(document.querySelector('.toeic-test-card h2').textContent, /Test 01/);
  await change(document.querySelector('input[type="search"]'), 'missing test');
  assert.match(document.body.textContent, /Không tìm thấy tài liệu phù hợp/);
  await click('Xem tất cả bộ đề');
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 6);
});

test('page navigation preserves filters in the URL and browser history returns to the previous page', async () => {
  await render('/exams/toeic?type=reading&q=ETS');
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests.slice(0, 6).map(item => item.title),
  );
  await clickPage(2);
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests.slice(6, 12).map(item => item.title),
  );
  assert.equal(document.querySelector('.toeic-library-pagination [aria-current="page"]').textContent, '2');
  const params = new URLSearchParams(location.search);
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('type'), 'reading');
  assert.equal(params.get('q'), 'ETS');
  await act(async () => navigate(-1));
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests.slice(0, 6).map(item => item.title),
  );
  assert.equal(document.querySelector('.toeic-library-pagination [aria-current="page"]').textContent, '1');
});

test('search, sort, category and view changes reset pagination before rendering the new result set', async () => {
  await render('/exams/toeic?page=2');
  await change(document.querySelector('input[type="search"]'), 'test1');
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  assert.deepEqual(testTitles(), [toeicCatalog.tests[0].title]);
  assert.equal(document.querySelector('.toeic-library-pagination'), null);

  await act(async () => navigate('/exams/toeic?page=2'));
  await change(document.querySelector('select[aria-label="Sắp xếp bộ đề"]'), 'desc');
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests
      .slice()
      .reverse()
      .slice(0, 6)
      .map(item => item.title),
  );

  await act(async () => navigate('/exams/toeic?page=2'));
  await change(document.querySelector('select[aria-label="Loại tài liệu"]'), 'answer');
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  assert.equal(document.querySelectorAll('.toeic-document-row').length, 2);
  assert.equal(document.querySelector('.toeic-library-pagination'), null);

  await act(async () => navigate('/exams/toeic?page=2'));
  await click('Tất cả tài liệu', '.toeic-tabs button');
  assert.equal(new URLSearchParams(location.search).has('page'), false);
  assert.equal(document.querySelectorAll('.toeic-document-row').length, 6);
  assert.equal(document.querySelector('.toeic-library-pagination [aria-current="page"]').textContent, '1');
});

test('invalid page numbers default to page one and excessive pages clamp to actual results', async () => {
  await render('/exams/toeic?page=999');
  const lastPage = Math.ceil(toeicCatalog.tests.length / 6);
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests.slice((lastPage - 1) * 6).map(item => item.title),
  );
  assert.equal(
    document.querySelector('.toeic-library-pagination [aria-current="page"]').textContent,
    String(lastPage),
  );
  for (const page of ['0', '-1', '1.5', 'invalid', 'Infinity']) {
    await act(async () => navigate('/exams/toeic?page=' + page));
    assert.deepEqual(
      testTitles(),
      toeicCatalog.tests.slice(0, 6).map(item => item.title),
    );
    assert.equal(document.querySelector('.toeic-library-pagination [aria-current="page"]').textContent, '1');
  }
});

test('removing the final saved test on page two returns to the remaining saved results', async () => {
  const saved = toeicCatalog.tests.slice(0, 7).map(item => item.id);
  window.localStorage.setItem('chitchatgo.toeic.saved:19', JSON.stringify(saved));
  await render('/exams/toeic?view=saved&page=2', 19);
  assert.deepEqual(testTitles(), [toeicCatalog.tests[6].title]);
  await act(async () => document.querySelector('.toeic-save').click());
  assert.deepEqual(
    testTitles(),
    toeicCatalog.tests.slice(0, 6).map(item => item.title),
  );
  assert.equal(document.querySelector('.toeic-library-pagination'), null);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('chitchatgo.toeic.saved:19')), saved.slice(0, 6));
});

test('bookmarks survive rerenders, filter saved tests and stay isolated between accounts', async () => {
  await render('/exams/toeic', 1);
  await act(async () => document.querySelector('.toeic-save').click());
  assert.deepEqual(JSON.parse(window.localStorage.getItem('chitchatgo.toeic.saved:1')), ['1']);
  await click('Đề đã lưu', '.toeic-tabs button');
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 1);
  await render('/exams/toeic', 2);
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 0);
  assert.match(document.body.textContent, /Bạn chưa lưu bộ đề nào/);
  await render('/exams/toeic', 1);
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 1);
  await act(async () => document.querySelector('.toeic-save').click());
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 0);
});

test('bookmark controls still work when storage quota is exhausted', async () => {
  window.localStorage.setItem('chitchatgo.toeic.saved:87', '["2"]');
  dom.window.Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('chitchatgo.toeic.saved')) throw new Error('Quota exceeded');
    return originalStorageSet.call(this, key, value);
  };
  await render('/exams/toeic?view=saved', 87);
  assert.match(document.querySelector('.toeic-test-card h2').textContent, /Test 02/);
  await act(async () => document.querySelector('.toeic-save').click());
  assert.equal(document.querySelectorAll('.toeic-test-card').length, 0);
});

test('reader switches between the real PDF, explanations, answer key and Word download', async () => {
  globalThis.fetch = async () => ({ ok: true });
  await render('/exams/toeic/tests/9?document=reading');
  const first = document.querySelector('iframe').getAttribute('src');
  assert.match(first, /TEST.*9.*RC/);
  await click('Giải chi tiết', '.toeic-reader-resources button');
  assert.notEqual(document.querySelector('iframe').getAttribute('src'), first);
  await click('Đáp án ETS 2024 Reading', '.toeic-reader-resources button');
  assert.match(document.querySelector('iframe').getAttribute('title'), /Đáp án ETS 2024 Reading/);
  const word = [...document.querySelectorAll('.toeic-reader-resources button')].find(item =>
    item.textContent.includes('WORD'),
  );
  await act(async () => word.click());
  assert.equal(document.querySelector('iframe'), null);
  assert.ok(document.querySelector('.toeic-word-preview a[download$=".docx"]'));
  assert.equal(document.querySelector('audio'), null);
});

test('failed document loading is retryable and a late response cannot replace the next test', async () => {
  globalThis.fetch = async () => ({ ok: false });
  await render('/exams/toeic/tests/1?document=reading');
  assert.match(document.body.textContent, /Không thể mở tài liệu/);
  globalThis.fetch = async () => ({ ok: true });
  await click('Thử lại');
  assert.ok(document.querySelector('iframe'));
  let finish;
  globalThis.fetch = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  await act(async () => navigate('/exams/toeic/tests/2?document=reading'));
  globalThis.fetch = async () => ({ ok: true });
  await act(async () => navigate('/exams/toeic/tests/3?document=reading'));
  await act(async () => finish({ ok: false }));
  assert.match(document.querySelector('h1').textContent, /Test 03/);
  assert.ok(document.querySelector('iframe'));
  assert.doesNotMatch(document.body.textContent, /Không thể mở tài liệu/);
});

test('practice timer expires and resets without generating a score or a server attempt', async () => {
  globalThis.fetch = async () => ({ ok: true });
  await render('/exams/toeic/tests/1?document=reading');
  assert.equal(document.querySelector('[role="timer"]').textContent, '75:00');
  await click('Bắt đầu', '.toeic-timer-actions button');
  Date.now = () => originalNow() + 76 * 60000;
  await act(async () => new Promise(done => setTimeout(done, 1100)));
  assert.equal(document.querySelector('[role="timer"]').textContent, '00:00');
  assert.match(document.body.textContent, /Đã hết thời gian tự luyện/);
  await act(async () => document.querySelector('button[aria-label="Đặt lại đồng hồ"]').click());
  assert.equal(document.querySelector('[role="timer"]').textContent, '75:00');
  assert.equal(document.querySelector('.quiz-result-card'), null);
});

test('invalid test routes remain empty and English labels follow the existing locale switch', async () => {
  await render('/exams/toeic/tests/999');
  assert.match(document.body.textContent, /Không tìm thấy bộ đề/);
  assert.equal(document.querySelector('iframe'), null);
  await act(async () => navigate('/exams/toeic'));
  await act(async () => setLocale('en'));
  assert.ok(document.body.textContent.includes('Practice tests'));
  assert.ok(document.body.textContent.includes('Reading paper'));
});
