import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'my-notes' });
const { default: MyNotes } = await env.load('features/learning/pages/MyNotesPage.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');

afterEach(env.unmount);
after(env.close);

test('notes filter by phrase, color and exam and retain changes across a failed edit', async t => {
  const notes = [
    {
      id: 1,
      examId: 7,
      examTitle: 'Reading 1',
      selectedText: 'agenda',
      noteContent: 'Meeting plan',
      color: 'yellow',
    },
    {
      id: 2,
      examId: 8,
      examTitle: 'Reading 2',
      selectedText: 'invoice',
      noteContent: 'Payment document',
      color: 'blue',
    },
  ];
  t.mock.method(toeicApi, 'notes', async () => ({ data: { items: notes, count: notes.length, limit: 100 } }));
  const update = t.mock.method(toeicApi, 'updateNote', async () => {
    throw new Error('Could not update note');
  });
  const remove = t.mock.method(toeicApi, 'deleteNote', async () => {
    throw new Error('Could not delete note');
  });
  await env.render(h(MemoryRouter, null, h(MyNotes)));
  await env.setInputValue('[aria-label="Tìm trong ghi chú của tôi"]', 'agenda');
  assert.doesNotMatch(document.body.textContent, /invoice/);
  await env.setInputValue('[aria-label="Tìm trong ghi chú của tôi"]', '');
  await env.click(env.button('Xanh dương'));
  await env.setInputValue('.my-notes-select', '8');
  assert.doesNotMatch(document.body.textContent, /agenda/);
  await env.click('[aria-label="Phát âm invoice"]');
  await env.click(env.button('Sửa'));
  await env.click('.study-color-dot.tone-green[aria-label]');
  await env.setInputValue('.study-note-textarea', 'Billing document');
  await env.click(env.button('Lưu thay đổi'));
  assert.deepEqual(update.mock.calls[0].arguments, [2, { noteContent: 'Billing document', color: 'green' }]);
  assert.match(document.body.textContent, /Could not update note/);
  await env.click(env.button('Hủy'));
  assert.equal(document.querySelector('.study-note-textarea'), null);
  await env.click(env.button('Xóa'));
  assert.deepEqual(remove.mock.calls[0].arguments, [2]);
  assert.match(document.body.textContent, /Could not delete note/);
});
