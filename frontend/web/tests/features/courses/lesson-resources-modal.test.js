import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'lesson-resources-modal' });
const { default: Resources } = await env.load('features/courses/components/LessonResourcesModal.jsx');
const { mediaApi } = await env.load('features/courses/api/mediaApi.js');

afterEach(env.unmount);
after(env.close);

test('attachment saves retain the upload on error and refresh the list after a retry', async t => {
  let resources = [];
  let addAttempts = 0;
  let deleteAttempts = 0;
  t.mock.method(mediaApi, 'listResources', async () => ({ data: resources }));
  t.mock.method(mediaApi, 'upload', async () => ({
    data: {
      objectKey: 'documents/notes.pdf',
      fileName: 'notes.pdf',
      fileSize: 2048,
      contentType: 'application/pdf',
    },
  }));
  const add = t.mock.method(mediaApi, 'addResource', async (lessonId, resource) => {
    if (++addAttempts === 1) throw new Error('Could not save attachment');
    resources = [{ id: 14, lessonId, ...resource }];
  });
  t.mock.method(window, 'confirm', () => true);
  t.mock.method(mediaApi, 'deleteResource', async () => {
    if (++deleteAttempts === 1) throw new Error('Could not delete attachment');
    resources = [];
  });

  await env.render(h(Resources, { lesson: { id: 12, title: 'Reading' }, onClose() {} }));
  await env.click(env.button('+ Tải lên tài liệu mới'));
  await env.click(env.button('Hủy'));
  await env.click(env.button('+ Tải lên tài liệu mới'));
  await env.setInputValue('form input[type="text"]', '  Lesson notes  ');
  await env.setInputValue('form select', 'DOCUMENT');
  const input = document.querySelector('input[type="file"]');
  const notes = new window.File(['notes'], 'notes.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [notes] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  await env.click(env.button('Lưu tài liệu'));
  assert.match(document.body.textContent, /Could not save attachment/);
  await env.click(env.button('Lưu tài liệu'));
  assert.match(document.body.textContent, /Lesson notes/);
  assert.match(document.body.textContent, /2 KB/);
  assert.deepEqual(add.mock.calls[1].arguments, [
    12,
    {
      title: 'Lesson notes',
      resourceType: 'DOCUMENT',
      fileName: 'notes.pdf',
      fileSize: 2048,
      contentType: 'application/pdf',
      objectKey: 'documents/notes.pdf',
      downloadUrl: '/api/v1/media/download/documents/notes.pdf',
    },
  ]);
  await env.click('[title="Xóa tài liệu"]');
  assert.match(document.body.textContent, /Could not delete attachment/);
  await env.click('[title="Xóa tài liệu"]');
  assert.doesNotMatch(document.body.textContent, /Lesson notes/);
});

test('attachment list reports a failed read without showing fabricated resources', async t => {
  t.mock.method(mediaApi, 'listResources', async () => {
    throw new Error('Attachment service unavailable');
  });
  await env.render(h(Resources, { lesson: { id: 12, title: 'Reading' }, onClose() {} }));
  assert.match(document.body.textContent, /Attachment service unavailable/);
  assert.equal(document.querySelector('[title="Xóa tài liệu"]'), null);
});
