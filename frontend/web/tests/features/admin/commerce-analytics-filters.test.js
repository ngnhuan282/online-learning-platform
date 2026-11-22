import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'commerce-analytics-filters' });
const { default: Commerce } = await env.load('features/admin/analytics/tabs/CommerceAnalyticsTab.jsx');
const { adminApi } = await env.load('features/admin/api/adminApi.js');

afterEach(env.unmount);
after(env.close);

test('commerce presets send inclusive Vietnam-local dates and allow a return to the server default', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-30T18:00:00Z') });
  const read = t.mock.method(adminApi, 'commerceAnalytics', async (_, range) => ({
    data: {
      range: range ?? { from: '2026-10-01', to: '2026-10-30' },
      previousRange: { from: '2026-09-01', to: '2026-09-30' },
      snapshot: {},
      current: {},
      previous: {},
      trend: [],
      details: [],
    },
  }));
  await env.render(h(Commerce, { report: 'gems' }));
  for (const days of [7, 90, 30]) {
    await env.click(env.button(`${days} ngày`));
    const [, range] = read.mock.calls.at(-1).arguments;
    if (days === 30) assert.equal(range, null);
    else {
      const vnToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      assert.equal(range.to, vnToday);
      assert.equal((Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1, days);
    }
  }
  await env.setInputValue('input[name="from"]', '2026-09-01');
  await env.click(env.button('30 ngày gần nhất'));
  assert.equal(document.querySelector('input[name="from"]').value, '2026-10-01');
});
