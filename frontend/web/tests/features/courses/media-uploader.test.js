import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'media-uploader' });
const { default: MediaUploader } = await env.load('features/courses/components/MediaUploader.jsx');
const { mediaApi } = await env.load('features/courses/api/mediaApi.js');

afterEach(env.unmount);
after(env.close);

test('media dropzone selects a file, uploads a dropped image once and clears the parent value on removal', async t => {
  const uploaded = t.mock.fn();
  const write = t.mock.method(mediaApi, 'upload', async () => ({
    data: {
      objectKey: 'courses/cover.png',
      fileName: 'cover.png',
      fileSize: 12,
      contentType: 'image/png',
    },
  }));
  await env.render(h(MediaUploader, { folder: 'courses', onUploadSuccess: uploaded }));
  const input = document.querySelector('input[type="file"]');
  const dropzone = input.parentElement;
  const open = t.mock.method(input, 'click', () => {});
  await env.click(dropzone);
  assert.equal(open.mock.callCount(), 1);

  const event = (type, files) => {
    const drag = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(drag, 'dataTransfer', { value: { files } });
    return act(async () => dropzone.dispatchEvent(drag));
  };
  await event('dragover', []);
  assert.equal(dropzone.style.borderColor, 'rgb(37, 99, 235)');
  await event('dragleave', []);
  assert.notEqual(dropzone.style.borderColor, 'rgb(37, 99, 235)');
  await event('drop', []);
  assert.equal(write.mock.callCount(), 0);
  const file = new window.File(['cover image'], 'cover.png', { type: 'image/png' });
  await event('drop', [file]);
  assert.deepEqual(write.mock.calls[0].arguments.slice(0, 2), [file, 'courses']);
  assert.equal(uploaded.mock.calls[0].arguments[0].url, '/api/v1/media/download/courses/cover.png');
  await env.click(env.button('Gỡ bỏ'));
  assert.deepEqual(uploaded.mock.calls[1].arguments[0], {
    url: '',
    objectKey: '',
    fileName: '',
    fileSize: 0,
    contentType: '',
  });
});
