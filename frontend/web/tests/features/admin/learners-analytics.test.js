import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import ExcelJS from 'exceljs';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'learners-analytics' });
const { default: Learners } = await env.load('features/admin/analytics/tabs/LearnersAnalyticsTab.jsx');
const { analyticsApi } = await env.load('features/admin/analytics/analyticsApi.js');

afterEach(env.unmount);
after(env.close);

test('learner trends distinguish growth and decline and export the original monthly counts', async t => {
  t.mock.method(analyticsApi, 'getLearnersAnalytics', async () => ({
    current: {
      totalUsers: 120,
      activeUsers: 100,
      lockedUsers: 12,
      disabledUsers: 8,
      newThisWeek: 3,
      series: [
        { label: 'Tháng 1', current: 12 },
        { label: 'Tháng 2', current: 19 },
        { label: 'Tháng 3', current: 14 },
      ],
    },
  }));
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {});
  let exportReport;
  await env.render(
    h(Learners, {
      onExportReady: value => {
        exportReport = value;
      },
    }),
  );
  const rows = [...document.querySelectorAll('tbody tr')].map(row => row.textContent);
  assert.match(rows[0], /Tháng 3.*-5/);
  assert.match(rows[1], /Tháng 2.*\+7/);
  assert.match(rows[2], /Tháng 1.*—/);
  await exportReport();
  const workbook = new ExcelJS.Workbook();
  const blob = createUrl.mock.calls[0].arguments[0];
  await workbook.xlsx.load(await blob.arrayBuffer());
  assert.deepEqual(workbook.getWorksheet('Tài khoản').getRow(10).values.slice(1), ['Tháng 2', 19]);
});
