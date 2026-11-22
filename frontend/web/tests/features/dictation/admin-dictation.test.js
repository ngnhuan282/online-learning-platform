import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-dictation' });
const { default: AdminDictation } = await env.load('features/dictation/pages/AdminDictationPage.jsx');
const { dictationApi } = await env.load('features/dictation/api/dictationApi.js');

afterEach(async () => {
  await env.unmount();
  delete window.YT;
});
after(env.close);

async function render(url = '/admin/dictation') {
  const router = createMemoryRouter(
    [
      { path: '/admin/dictation', element: h(AdminDictation) },
      { path: '/elsewhere', element: h(Link, { to: '/admin/dictation' }, 'Back to dictation') },
    ],
    { initialEntries: [url] },
  );
  await env.render(h(RouterProvider, { router }));
  return router;
}

const row = { id: 'a', title: 'Office conversations', level: 'B1', status: 'DRAFT', topic: 'Work' };
const catalog = total => ({ data: { items: [row], total } });
const editor = () => document.querySelector('.dictation-editor');

test('admin search, status, page size and pagination are URL-backed and exhausted pages are clamped', async t => {
  const list = t.mock.method(dictationApi, 'query', async () => catalog(32));
  const router = await render('/admin/dictation?page=4');
  assert.equal(router.state.location.search, '?page=3');

  await env.setInputValue('[aria-label="Tìm bài nghe"]', ' Office ');
  await env.click(env.button('Tìm kiếm'));
  assert.equal(list.mock.calls.at(-1).arguments[1].keyword, 'Office');
  await env.selectOption(document.querySelector('.dictation-admin-filter-row [role="combobox"]'), 'DRAFT');
  assert.equal(list.mock.calls.at(-1).arguments[1].status, 'DRAFT');
  await env.selectOption(document.querySelector('.dictation-admin-pagination [role="combobox"]'), '20');
  assert.equal(list.mock.calls.at(-1).arguments[1].size, 20);
  await env.click('button[aria-label="Go to page 2"]');
  assert.equal(list.mock.calls.at(-1).arguments[1].page, 1);
});

test('dirty drafts can cancel navigation or be discarded and failed saves retain their edits', async t => {
  t.mock.method(dictationApi, 'query', async () => catalog(1));
  const save = t.mock.method(dictationApi, 'save', async () => {
    throw new Error('Save service unavailable');
  });
  const router = await render();
  await env.click(env.button('Thêm bài nghe'));
  await env.setInputValue(env.field('Tên bài nghe'), 'Morning conversations');
  await env.setInputValue(env.field('Chủ đề'), 'Daily life');
  await env.selectOption(editor().querySelector('.dictation-editor-metadata [role="combobox"]'), 'B2');
  await env.setInputValue(editor().querySelector('textarea:not([aria-hidden])'), 'Good morning.');
  assert.equal(window.dispatchEvent(new window.Event('beforeunload', { cancelable: true })), false);

  await env.click(env.button('Xuất bản', editor()));
  assert.match(editor().textContent, /liên kết YouTube hợp lệ/);
  await env.click(env.button('Lưu bản nháp', editor()));
  assert.match(editor().textContent, /Save service unavailable/);
  assert.equal(save.mock.calls[0].arguments[1].definition.level, 'B2');

  await act(async () => router.navigate('/elsewhere'));
  await env.click(env.button('Hủy', [...document.querySelectorAll('[role="dialog"]')].at(-1)));
  assert.equal(router.state.location.pathname, '/admin/dictation');
  await env.click(editor().querySelector('button[aria-label="Đóng"]'));
  await env.click(env.button('Xác nhận', [...document.querySelectorAll('[role="dialog"]')].at(-1)));
  assert.equal(window.dispatchEvent(new window.Event('beforeunload', { cancelable: true })), true);
});

test('YouTube editor records duration and previews the selected transcript interval', async t => {
  t.mock.method(dictationApi, 'query', async () => catalog(1));
  const preview = t.mock.fn();
  const destroy = t.mock.fn();
  let events;
  let clock = 2;
  class Player {
    constructor(_iframe, config) {
      events = config.events;
      queueMicrotask(() => events.onReady({ target: this }));
    }
    getDuration() {
      return 60;
    }
    getCurrentTime() {
      return clock;
    }
    getPlayerState() {
      return 0;
    }
    loadVideoById = preview;
    destroy = destroy;
    pauseVideo() {}
  }
  window.YT = { Player };
  await render();
  await env.click(env.button('Thêm bài nghe'));
  const url = env.field('Liên kết YouTube');
  await env.setInputValue(url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await act(async () => {
    url.focus();
    url.blur();
  });
  assert.match(editor().querySelector('iframe').src, /dQw4w9WgXcQ/);
  await env.flush(1, 270);
  await env.click('[aria-label="Lấy mốc bắt đầu câu 1"]');
  clock = 5;
  await env.flush(1, 270);
  await env.click('[aria-label="Lấy mốc kết thúc câu 1"]');
  await env.click('[aria-label="Nghe thử câu 1"]');
  assert.deepEqual(preview.mock.calls[0].arguments, [
    { videoId: 'dQw4w9WgXcQ', startSeconds: 2, endSeconds: 5 },
  ]);
  await act(async () => events.onError({ data: 100 }));
  assert.match(editor().textContent, /Không phát được video nhúng YouTube/);
  await act(async () => events.onStateChange({ data: 1 }));
  assert.doesNotMatch(editor().textContent, /Không phát được video nhúng YouTube/);
  await env.unmount();
  assert.equal(destroy.mock.callCount(), 1);
});

test('editor can reorder transcript rows, download a template and dismiss a file preview', async t => {
  t.mock.method(dictationApi, 'query', async () => catalog(1));
  t.mock.method(
    dictationApi,
    'template',
    async () => new Blob(['fixture'], { type: 'application/octet-stream' }),
  );
  t.mock.method(dictationApi, 'import', async () => ({
    data: { sentences: [{ text: 'Imported sentence', start: 5, end: 8 }], errors: [] },
  }));
  const download = t.mock.method(window.HTMLAnchorElement.prototype, 'click', function () {
    assert.equal(this.download, 'transcript-template.xlsx');
  });
  await render();
  await env.click(env.button('Thêm bài nghe'));
  const transcript = () => [...editor().querySelectorAll('textarea:not([aria-hidden])')];
  await env.setInputValue(transcript()[0], 'First phrase');
  await env.click(env.button('Thêm câu', editor()));
  await env.setInputValue(transcript()[1], 'Second phrase');
  await env.setInputValue('[aria-label="Bắt đầu câu 1"]', '00:05');
  await env.click('button[aria-label="Chuyển câu xuống"]');
  assert.deepEqual(
    transcript().map(input => input.value),
    ['Second phrase', 'First phrase'],
  );
  await env.click(env.button('Tải Excel mẫu'));
  assert.equal(download.mock.callCount(), 1);
  const file = editor().querySelector('input[type="file"][accept=".xlsx"]');
  const picker = t.mock.method(file, 'click', () => {});
  await env.click(env.button('Nhập từ Excel'));
  assert.equal(picker.mock.callCount(), 1);
  Object.defineProperty(file, 'files', { value: [new window.File(['fixture'], 'transcript.xlsx')] });
  await act(async () => file.dispatchEvent(new window.Event('change', { bubbles: true })));
  const preview = () => [...document.querySelectorAll('[role="dialog"]')].at(-1);
  assert.match(preview().textContent, /Imported sentence/);
  await env.click(env.button('Hủy', preview()));
  assert.deepEqual(
    transcript().map(input => input.value),
    ['Second phrase', 'First phrase'],
  );
});
