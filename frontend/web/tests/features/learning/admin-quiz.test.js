import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-quiz' });
const { default: Quiz } = await env.load('features/learning/pages/AdminQuizPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { courseApi } = await env.load('features/courses/api/courseApi.js');
const { learningApi } = await env.load('features/learning/api/learningApi.js');

afterEach(env.unmount);
after(env.close);

const user = { id: 1, roles: ['ADMIN'], permissions: ['QUIZ_MANAGE'] };
const render = () => env.render(h(AuthContext.Provider, { value: { user } }, h(Quiz)));
const edit = (label, value) => env.setInputValue(env.field(label), value);

test('quiz editor retries the course catalog and preserves multiple-choice edits when saving fails', async t => {
  let courseReads = 0;
  t.mock.method(courseApi, 'adminList', async () => {
    if (++courseReads === 1) throw new Error('Course catalog unavailable');
    return { data: { items: [{ id: 12, title: 'Reading course' }] } };
  });
  t.mock.method(learningApi, 'getAdminQuizzes', async () => ({ data: [] }));
  let attempts = 0;
  const create = t.mock.method(learningApi, 'createQuiz', async payload => {
    if (++attempts === 1) throw new Error('Quiz draft unavailable');
    return { data: { id: 25, ...payload } };
  });

  await render();
  assert.match(document.body.textContent, /Course catalog unavailable/);
  await env.click(env.button('Thử lại'));
  const course = document.querySelector('form [role="combobox"]');
  await env.selectOption(course, '12');
  await edit('Bài học (tùy chọn)', '13');
  await edit('Tên quiz', 'Reading review');
  await edit('Điểm đạt (%)', '75');
  await edit('Giới hạn thời gian (phút)', '15');
  await edit('Mô tả', ' Review the first chapter ');
  await edit('Nội dung câu hỏi', 'Which options are nouns?');
  const type = document.querySelector('.quiz-question-editor [role="combobox"]');
  await env.selectOption(type, 'MULTIPLE_CHOICE');
  await edit('Điểm', '2');
  await edit('Đáp án 1', 'Classroom');
  await edit('Đáp án 2', 'Teacher');
  await env.click(env.button('Đáp án', document.querySelector('.quiz-question-editor')));
  await edit('Đáp án 3', 'Quickly');
  await env.click('button[aria-label="Xóa đáp án 3"]');
  const correct = () => [...document.querySelectorAll('.quiz-option-editor input[type="checkbox"]')];
  for (const checkbox of correct()) if (!checkbox.checked) await env.click(checkbox);
  await env.selectOption(document.querySelector('.quiz-question-editor [role="combobox"]'), 'SINGLE_CHOICE');
  assert.equal(correct().filter(input => input.checked).length, 1);
  const save = () => env.click('form button[type="submit"]');
  await save();
  assert.match(document.body.textContent, /Quiz draft unavailable/);
  await save();
  const payload = create.mock.calls[1].arguments[0];
  assert.equal(payload.courseId, 12);
  assert.equal(payload.lessonId, 13);
  assert.equal(payload.passingScore, 75);
  assert.equal(payload.timeLimitMinutes, 15);
  assert.equal(payload.questions[0].points, 2);
  assert.deepEqual(payload.questions[0].options, [
    { optionText: 'Classroom', correct: true },
    { optionText: 'Teacher', correct: false },
  ]);
});
