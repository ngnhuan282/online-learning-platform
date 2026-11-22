import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'add-lesson-dialog' });
const { default: AddLessonDialog } = await env.load('features/courses/components/AddLessonDialog.jsx');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

test('the editor validates video, document and quiz fields and autofills lesson metadata from the quiz', async t => {
  t.mock.method(learningApi, 'getAdminQuizzes', async () => ({
    data: [
      { id: 12, title: 'Foreign quiz', courseId: 8 },
      { id: 13, title: 'Course quiz', courseId: 7, timeLimitMinutes: 2 },
    ],
  }));
  const confirm = t.mock.fn();
  await env.render(h(AddLessonDialog, { courseId: 7, onConfirm: confirm }));
  await env.setInputValue('#lesson-title', 'Quiz: ');
  const submit = () => env.click('button[type="submit"]');
  const submitWithoutNativeValidation = () =>
    act(async () =>
      document
        .querySelector('form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
    );

  for (const [type, error] of [
    ['VIDEO', /yêu cầu nhập Video URL/],
    ['DOCUMENT', /nhập đường dẫn tài liệu/],
    ['QUIZ', /chọn một bài Quiz/],
  ]) {
    await env.setInputValue('#lesson-type', type);
    await submitWithoutNativeValidation();
    assert.match(document.body.textContent, error);
  }
  assert.equal(confirm.mock.callCount(), 0);

  const quiz = document.querySelector('select option[value="13"]').parentElement;
  assert.equal(quiz.querySelector('option[value="12"]'), null);
  await env.setInputValue(quiz, '13');
  assert.equal(document.querySelector('#lesson-title').value, 'Course quiz');
  assert.equal(document.querySelector('#lesson-duration').value, '120');
  await env.click('#lesson-preview');
  await submit();
  assert.deepEqual(confirm.mock.calls[0].arguments[0], {
    title: 'Course quiz',
    lessonType: 'QUIZ',
    duration: 120,
    content: '13',
    videoUrl: null,
    orderIndex: 0,
    preview: true,
  });
});

test('text editor formatting survives preview and the draft remains after a failed save', async t => {
  t.mock.method(learningApi, 'getAdminQuizzes', async () => ({ data: [] }));
  const confirm = t.mock.fn(async () => {
    throw new Error('Lesson could not be saved');
  });
  await env.render(h(AddLessonDialog, { onConfirm: confirm }));
  await env.setInputValue('#lesson-title', 'Reading notes');
  await env.setInputValue('#lesson-type', 'TEXT');
  await env.setInputValue('#lesson-duration', '30');
  for (const action of ['H3 Tiêu đề', 'B', 'I', '• Danh sách', '</> Code']) {
    await env.click(env.button(action));
  }
  const markdown = document.querySelector('#lesson-content').value;
  for (const expected of ['### Tiêu đề bài học', '**in đậm**', '*in nghiêng*', '- Ý 1', '// Code snippet']) {
    assert.ok(markdown.includes(expected));
  }
  await env.click(env.button('👁️ Xem trước'));
  assert.equal(document.querySelector('#lesson-content'), null);
  await env.click(env.button('✏️ Soạn thảo'));
  await env.click('button[type="submit"]');
  assert.match(document.body.textContent, /Lesson could not be saved/);
  assert.equal(document.querySelector('#lesson-content').value, markdown);
  assert.equal(confirm.mock.calls[0].arguments[0].duration, 30);
});
