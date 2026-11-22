import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'study-text-assistant' });
const { default: Assistant } = await env.load('features/learning/components/StudyTextAssistant.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { toeicApi } = await env.load('features/learning/api/toeicApi.js');

afterEach(env.unmount);
after(env.close);

test('dictionary form translates a term, offers both pronunciations and handles a server note quota race', async t => {
  t.mock.method(toeicApi, 'notes', async () => ({ data: { count: 99, limit: 100, isPro: false } }));
  const dictionary = t.mock.method(toeicApi, 'dictionary', async () => ({
    data: {
      headword: 'agenda',
      phonetic: '/əˈdʒen.də/',
      meanings: [{ partOfSpeech: 'noun', meaningVi: 'chương trình làm việc', exampleEn: 'Read the agenda.' }],
    },
  }));
  const speak = t.mock.fn();
  window.speechSynthesis = { cancel() {}, speak };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  const create = t.mock.method(toeicApi, 'createNote', async () => {
    throw Object.assign(new Error('Quota used in another tab'), { code: 'NOTE_LIMIT_REACHED' });
  });
  await env.render(
    h(
      MemoryRouter,
      null,
      h(
        AuthContext.Provider,
        { value: { user: { id: 9 } } },
        h(
          Assistant,
          { allowNotes: true, examId: 4, questionNumber: 101 },
          h('p', null, 'Review the agenda.'),
        ),
      ),
    ),
  );
  await env.click(env.button('Tra từ điển'));
  await env.setInputValue('input[type="search"]', ' agenda! ');
  await env.click(env.button('Tra từ'));
  assert.equal(dictionary.mock.calls[0].arguments[0], 'agenda');
  assert.match(document.querySelector('.study-floating-popover').textContent, /chương trình làm việc/);
  for (const accent of ['Mỹ', 'Anh']) await env.click(`[aria-label="Phát âm chuẩn ${accent}"]`);
  assert.deepEqual(
    speak.mock.calls.map(call => call.arguments[0].lang),
    ['en-US', 'en-GB'],
  );
  await env.click(env.button('Ghi chú'));
  await env.click('.study-color-dot.tone-blue');
  const note = document.querySelector('.study-note-textarea');
  await env.setInputValue(note, 'Use agenda in meetings.');
  await act(async () =>
    note.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })),
  );
  assert.equal(create.mock.calls[0].arguments[0].color, 'blue');
  assert.equal(create.mock.calls[0].arguments[0].selectedText, 'agenda');
  assert.match(document.querySelector('.study-floating-popover').textContent, /100\/100/);
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(document.querySelector('.study-floating-popover'), null);
  await env.click(env.button('Tra từ điển'));
  await act(async () => document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })));
  assert.equal(document.querySelector('.study-floating-popover'), null);
});
