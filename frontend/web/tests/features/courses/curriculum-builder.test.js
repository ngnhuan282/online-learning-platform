import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'curriculum-builder' });
const { default: Builder } = await env.load('features/courses/pages/CurriculumBuilderPage.jsx');
const { courseApi } = await env.load('features/courses/api/courseApi.js');
const { sectionApi } = await env.load('features/courses/api/sectionApi.js');

afterEach(env.unmount);
after(env.close);

function Location() {
  return h('output', null, useLocation().pathname);
}

test('curriculum starts from an empty course and retains the section title after a failed create or delete', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(courseApi, 'adminGetById', async () => ({ data: { id: 42, title: 'Reading course' } }));
  let sections = [];
  t.mock.method(sectionApi, 'listByCourse', async () => ({ data: sections }));
  let creates = 0;
  const create = t.mock.method(sectionApi, 'create', async (_, payload) => {
    if (++creates === 1) throw new Error('Section save unavailable');
    const section = { id: 5, ...payload, lessons: [] };
    sections = [section];
    return { data: section };
  });
  t.mock.method(window, 'confirm', () => true);
  const remove = t.mock.method(sectionApi, 'delete', async () => {
    throw new Error('Section delete unavailable');
  });

  await env.render(
    h(
      MemoryRouter,
      { initialEntries: ['/admin/courses/42/curriculum'] },
      h(
        Routes,
        null,
        h(Route, { path: '/admin/courses/:courseId/curriculum', element: h(Builder) }),
        h(Route, { path: '*', element: h(Location) }),
      ),
    ),
  );
  await env.click(env.button('➕ Thêm chương đầu tiên'));
  await env.click(env.button('Hủy'));
  assert.equal(document.querySelector('#section-title'), null);
  await env.click(env.button('➕ Thêm chương đầu tiên'));
  await env.setInputValue('#section-title', 'Reading basics');
  await env.click('form button[type="submit"]');
  assert.match(document.body.textContent, /Section save unavailable/);
  assert.equal(document.querySelector('#section-title').value, 'Reading basics');
  await env.click('form button[type="submit"]');
  assert.deepEqual(create.mock.calls[1].arguments, ['42', { title: 'Reading basics', orderIndex: 0 }]);
  await env.click('button[title="Xóa chương"]');
  assert.match(document.body.textContent, /Section delete unavailable/);
  assert.deepEqual(remove.mock.calls[0].arguments, ['42', 5]);
  assert.match(document.body.textContent, /Reading basics/);
  await act(async () => t.mock.timers.tick(4000));
  assert.doesNotMatch(document.body.textContent, /Section delete unavailable/);
});
