import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import ExcelJS from 'exceljs';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'course-analytics' });
const { default: Overview } = await env.load('features/admin/analytics/tabs/OverviewAnalyticsTab.jsx');
const { adminApi } = await env.load('features/admin/api/adminApi.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');

afterEach(env.unmount);
after(env.close);

const user = { id: 1, roles: ['STAFF'], permissions: ['COURSE_VIEW', 'LEARNING_REPORT_VIEW'] };
const courses = [
  { id: 2, title: 'Reading draft', categoryName: 'Reading', status: 'DRAFT', price: 250000 },
  { id: 3, title: 'Writing live', categoryName: 'Writing', status: 'PUBLISHED', price: 100000 },
];
const render = report =>
  env.render(h(MemoryRouter, null, h(AuthContext.Provider, { value: { user } }, h(Overview, { report }))));
const table = () => document.querySelector('table').textContent;

test('course analytics keep the catalog usable when optional progress fails and export filtered rows', async t => {
  t.mock.method(adminApi, 'courses', async () => ({ data: { courses } }));
  t.mock.method(adminApi, 'learning', async () => {
    throw new Error('Progress offline');
  });
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {});
  await render('courses');
  await env.setInputValue(env.field('Tìm tên khóa học hoặc danh mục'), ' Reading ');
  assert.match(table(), /Reading draft/);
  assert.doesNotMatch(table(), /Writing live/);
  await env.selectOption(document.querySelector('.analytics-table-toolbar [role="combobox"]'), 'DRAFT');
  await env.click(env.button('Tải báo cáo (.xlsx)'));
  await env.waitFor(() => createUrl.mock.callCount() === 1, 'Expected an XLSX export');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createUrl.mock.calls[0].arguments[0].arrayBuffer());
  const content = JSON.stringify(workbook.worksheets[0].getSheetValues());
  assert.match(content, /Reading draft/);
  assert.doesNotMatch(content, /Writing live/);
});
