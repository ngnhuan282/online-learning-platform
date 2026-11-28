import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'ai-tutor' });
const { default: Tutor } = await env.load('features/ai-assistant/components/AiTutorSection.jsx');
const { ROUTES } = await env.load('shared/constants/routes.js');

afterEach(env.unmount);
after(env.close);

test('the home assistant shows a labeled work email example and opens the assistant for questions', async () => {
  await env.render(
    h(
      MemoryRouter,
      null,
      h(
        Routes,
        null,
        h(Route, { path: '/', element: h(Tutor) }),
        h(Route, { path: ROUTES.AI_ASSISTANT, element: h('h1', null, 'Trợ lý học tập AI') }),
      ),
    ),
  );
  const sample = document.querySelector('figure');
  assert.equal(sample.querySelector('figcaption').textContent.trim(), 'Ví dụ hỏi đáp');
  assert.match(sample.textContent, /polite email in English/);
  assert.match(sample.textContent, /when you have a moment/);
  assert.match(sample.textContent, /by Thursday afternoon/);
  assert.equal(document.querySelector('form'), null);

  await env.click(document.querySelector(`a[href="${ROUTES.AI_ASSISTANT}"]`));
  assert.equal(document.querySelector('h1').textContent, 'Trợ lý học tập AI');
});
