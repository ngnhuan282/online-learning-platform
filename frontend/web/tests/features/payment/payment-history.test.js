import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'payment-history' });
const { default: History } = await env.load('features/payment/pages/PaymentHistoryPage.jsx');
const { paymentApi } = await env.load('features/payment/api/paymentApi.js');

afterEach(env.unmount);
after(env.close);

test('history retries server errors, then applies and clears search, page size and pagination', async t => {
  const requests = [];
  t.mock.method(paymentApi, 'getHistory', async params => {
    requests.push(params);
    if (requests.length === 1) throw new Error('History unavailable');
    return {
      data: {
        content: [
          { orderCode: 'COURSE-42', courseTitle: 'Writing skills', amount: 250000, status: 'SUCCESS' },
        ],
        totalPages: 3,
        totalElements: 35,
      },
    };
  });

  await env.render(h(MemoryRouter, null, h(History)));
  assert.match(document.body.textContent, /History unavailable/);
  await env.click(env.button('Thử lại'));
  assert.match(document.body.textContent, /COURSE-42/);
  await env.setInputValue('.payment-filter-search input', 'Writing');
  await env.click('.payment-filter-search button');
  assert.equal(requests.at(-1).keyword, 'Writing');
  await env.click(env.button('Đặt lại'));
  assert.equal(requests.at(-1).keyword, '');
  await env.click('button[aria-label="Go to page 2"]');
  assert.equal(requests.at(-1).page, 1);
  await env.selectOption(document.querySelector('[role="combobox"]'), '20');
  assert.deepEqual(requests.at(-1), { page: 0, size: 20, keyword: '', status: '' });
});
