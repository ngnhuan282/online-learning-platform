import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'review-form' });
const { default: ReviewForm } = await env.load('features/courses/components/ReviewForm.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { reviewApi } = await env.load('features/courses/api/reviewApi.js');

afterEach(env.unmount);
after(env.close);

test('editing an existing review validates its rating and comment and retains corrections on failure', async t => {
  const edit = { id: 5, rating: 8, comment: 'Original draft' };
  let attempts = 0;
  const update = t.mock.method(reviewApi, 'update', async (_course, id, payload) => {
    if (++attempts === 1) throw new Error('Review update unavailable');
    return { data: { id, ...payload } };
  });
  const saved = t.mock.fn();
  await env.render(
    h(
      AuthContext.Provider,
      { value: { user: { fullName: 'Lan' } } },
      h(ReviewForm, { courseId: 12, existingReview: edit, onSubmitSuccess: saved }),
    ),
  );
  const submit = () => env.click('button[type="submit"]');
  await submit();
  assert.match(document.body.textContent, /chọn số sao từ 1 đến 5/);
  await env.click('button[aria-label="4 sao"]');
  await env.setInputValue('textarea', 'a'.repeat(2001));
  await submit();
  assert.match(document.body.textContent, /Nhận xét tối đa 2000 ký tự/);
  assert.equal(update.mock.callCount(), 0);
  await env.setInputValue('textarea', 'A clear explanation.');
  await submit();
  assert.match(document.body.textContent, /Review update unavailable/);
  assert.equal(document.querySelector('textarea').value, 'A clear explanation.');
  await submit();
  assert.deepEqual(update.mock.calls[1].arguments, [
    12,
    5,
    {
      rating: 4,
      comment: 'A clear explanation.',
      userFullName: 'Lan',
    },
  ]);
  assert.equal(saved.mock.calls[0].arguments[0].id, 5);
});
