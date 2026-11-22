import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-toeic' });
const { default: AdminToeic } = await env.load('features/learning/pages/AdminToeicPage.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');

afterEach(env.unmount);
after(env.close);

const render = () =>
  env.render(
    h(
      MemoryRouter,
      null,
      h(AuthContext.Provider, { value: { user: { id: 1, roles: ['ADMIN'] } } }, h(AdminToeic)),
    ),
  );

const reading = {
  id: 7,
  slug: 'reading-practice',
  title: 'Reading practice',
  published: false,
  version: 2,
  durationMinutes: 30,
  lessons: [],
  questions: [101, 102].map(number => ({
    id: 'q' + number,
    number,
    part: 5,
    prompt: `Reading prompt ${number}`,
    passage: '',
    imageUrl: '',
    source: '',
    passageImageUrls: [],
    correctOptionId: 'B',
    explanation: 'Answer explanation',
    options: 'ABCD'.split('').map(letter => ({ id: letter, text: letter + ' answer' })),
  })),
};
const save = () => env.click(env.button('Lưu bộ đề'));

test('reading editor rejects invalid slugs, duplicate numbers and non-local images before saving', async t => {
  t.mock.method(toeicApi, 'adminList', async () => ({ data: [reading] }));
  t.mock.method(toeicApi, 'adminDetail', async () => ({ data: reading }));
  const update = t.mock.method(toeicApi, 'update', async (id, definition) => ({
    data: { id, ...definition },
  }));
  await render();
  await env.setInputValue('[aria-label="Tìm bộ đề quản trị"]', 'Reading');
  await env.click('.toeic-admin-list button');
  await env.setInputValue('input[name="slug"]', 'Invalid slug');
  await save();
  assert.match(document.body.textContent, /chữ thường, số và dấu gạch ngang/);
  await env.setInputValue('input[name="slug"]', 'reading-updated');
  await env.setInputValue('[aria-label="Tìm câu hỏi trong bộ đề"]', '102');
  await env.click('.toeic-admin-question-list button');
  await env.setInputValue(env.field('Số câu hỏi'), '101');
  await save();
  assert.match(document.body.textContent, /không trùng nhau/);
  await env.setInputValue(env.field('Số câu hỏi'), '102');
  await env.setInputValue(
    'input[placeholder="/toeic-assets/..."]',
    'https://assets.example.test/outside.webp',
  );
  await save();
  assert.match(document.body.textContent, /Hình câu hỏi phải dùng tệp từ kho TOEIC hoặc đường dẫn nội bộ/);
  assert.equal(update.mock.callCount(), 0);
  await env.setInputValue('input[placeholder="/toeic-assets/..."]', '/toeic-assets/test/image.webp');
  await env.setInputValue('textarea[name="description"]', ' Reading drill ');
  await env.setInputValue('input[name="sourceLabel"]', ' Practice material ');
  await env.setInputValue('input[name="durationMinutes"]', '55');
  await save();
  const [id, payload] = update.mock.calls[0].arguments;
  assert.equal(id, 7);
  assert.equal(payload.version, 2);
  assert.equal(payload.durationMinutes, 55);
  assert.equal(payload.description, 'Reading drill');
  assert.equal(payload.sourceLabel, 'Practice material');
  assert.equal(payload.questions[1].imageUrl, '/toeic-assets/test/image.webp');
});

test('new exam confirms discarding edits and a failed detail fetch stays recoverable', async t => {
  t.mock.method(toeicApi, 'adminList', async () => ({ data: [reading] }));
  const detail = t.mock.method(toeicApi, 'adminDetail', async () => {
    throw new Error('Exam detail unavailable');
  });
  await render();
  await env.click('.toeic-admin-list button');
  assert.match(document.body.textContent, /Exam detail unavailable/);
  assert.equal(detail.mock.callCount(), 1);
  await env.setInputValue('input[name="title"]', 'Unsaved draft');
  assert.equal(window.dispatchEvent(new window.Event('beforeunload', { cancelable: true })), false);
  await env.click(env.button('Thêm bộ đề'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Bỏ thay đổi chưa lưu/);
  await env.click(env.button('Hủy', document.querySelector('[role="dialog"]')));
  assert.equal(document.querySelector('input[name="title"]').value, 'Unsaved draft');
  await env.click(env.button('Thêm bộ đề'));
  const dialog = document.querySelector('[role="dialog"]');
  await env.click(dialog.querySelector('button.button-danger, button.MuiButton-contained'));
  assert.equal(document.querySelector('input[name="title"]').value, '');
});

test('listening drafts validate audio, transcript and picture requirements before publishing', async t => {
  let exam = {
    ...reading,
    id: 8,
    slug: 'listening-practice',
    title: 'Listening practice',
    questions: [
      {
        id: 'listen-1',
        number: 1,
        part: 1,
        prompt: '',
        passage: '',
        imageUrl: '',
        source: '',
        listening: { audioUrl: '', transcript: '' },
        passageImageUrls: [],
        explanation: '',
        correctOptionId: 'B',
        options: 'ABCD'.split('').map(id => ({ id, text: '' })),
      },
    ],
  };
  t.mock.method(toeicApi, 'adminList', async () => ({ data: [exam] }));
  t.mock.method(toeicApi, 'adminDetail', async () => ({ data: exam }));
  const publish = t.mock.method(toeicApi, 'publish', async (id, published) => ({
    data: { ...exam, id, published },
  }));
  t.mock.method(toeicApi, 'update', async (id, definition) => {
    exam = { id, ...definition };
    return { data: exam };
  });
  await render();
  await env.click('.toeic-admin-list button');
  await env.click(env.button('Xuất bản'));
  assert.match(document.body.textContent, /cần audio và transcript/);
  const audio = env.field('Đường dẫn đoạn nghe');
  await env.setInputValue(audio, 'https://example.test/audio.mp3');
  await save();
  assert.match(document.body.textContent, /cần audio từ kho TOEIC hoặc đường dẫn MP3 dưới/);
  await env.setInputValue(audio, '/toeic-assets/test/audio-001.mp3');
  await env.setInputValue(env.field('Transcript'), 'A person is holding a book.');
  await save();
  await env.click(env.button('Xuất bản'));
  assert.match(document.body.textContent, /Part 1 cần hình ảnh/);
  assert.equal(publish.mock.callCount(), 0);
  await env.setInputValue('input[placeholder="/toeic-assets/..."]', '/toeic-assets/test/question-001.webp');
  await save();
  await env.click(env.button('Xuất bản'));
  assert.deepEqual(publish.mock.calls[0].arguments, [8, true]);
});
