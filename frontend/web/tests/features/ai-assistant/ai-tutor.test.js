import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'ai-tutor' });
const { default: Tutor } = await env.load('features/ai-assistant/components/AiTutorSection.jsx');

afterEach(env.unmount);
after(env.close);

test('the tutor demo adds relevant and fallback replies while ignoring empty submissions', async () => {
  await env.render(h(MemoryRouter, null, h(Tutor)));
  const form = document.querySelector('.chat-form');
  const input = form.querySelector('input');
  const count = document.querySelectorAll('.user-message').length;
  await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(document.querySelectorAll('.user-message').length, count);
  await env.setInputValue(input, ' How can I improve IELTS Speaking? ');
  await env.click(form.querySelector('button'));
  assert.match(
    [...document.querySelectorAll('.user-message')].at(-1).textContent,
    /How can I improve IELTS Speaking\?/,
  );
  assert.match(document.body.textContent, /hãy thử mở rộng câu trả lời theo 3 bước/);
  await env.setInputValue(input, 'Recommend a book');
  await env.click(form.querySelector('button'));
  assert.match(document.body.textContent, /Bạn có thể hỏi về IELTS Speaking/);
  assert.equal(input.value, '');
  assert.equal(document.querySelectorAll('.user-message').length, count + 2);
});
