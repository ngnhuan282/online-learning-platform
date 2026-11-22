import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'toeic-question-import' });
const { default: ImportDialog } = await env.load(
  'features/learning/components/ToeicQuestionImportDialog.jsx',
);

afterEach(env.unmount);
after(env.close);

async function chooseFile(file) {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
}

test('the import dialog previews a second page, rejects unreadable files and adds all validated questions', async t => {
  const append = t.mock.fn();
  const close = t.mock.fn();
  await env.render(h(ImportDialog, { questions: [], onImport: append, onClose: close }));
  await chooseFile(new File(['not a workbook'], 'unreadable.xlsx'));
  await env.waitFor(
    () => /Không đọc được file|File Excel không hợp lệ|Cấu trúc file/.test(document.body.textContent),
    'Unreadable workbook error must render',
  );
  const columns = [
    'number',
    'part',
    'passage',
    'prompt',
    'A',
    'B',
    'C',
    'D',
    'answer',
    'explanation',
    'source',
  ];
  const csv = [
    columns,
    ...Array.from({ length: 11 }, (_, index) => [
      index + 101,
      5,
      '',
      `Reading prompt ${index + 1}`,
      'One',
      'Two',
      'Three',
      'Four',
      'B',
      'Answer explanation',
      'Study guide',
    ]),
  ]
    .map(row => row.join(','))
    .join('\n');
  await chooseFile(new File([csv], 'reading.csv', { type: 'text/csv' }));
  assert.match(document.querySelector('table').textContent, /Reading prompt 1/);
  await env.click('button[aria-label="Go to page 2"]');
  assert.match(document.querySelector('table').textContent, /Reading prompt 11/);
  await env.click(env.button('Nhập 11 câu hỏi'));
  assert.equal(append.mock.calls[0].arguments[0].length, 11);
  assert.equal(append.mock.calls[0].arguments[0][10].number, 111);
  await env.click(env.button('Hủy'));
  assert.equal(close.mock.callCount(), 1);
});

test('import templates are downloaded in both formats and a failed download is retryable', async t => {
  const downloads = [];
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', function () {
    downloads.push(this.download);
  });
  let attempts = 0;
  t.mock.method(URL, 'createObjectURL', () => {
    if (++attempts === 1) throw new Error('Download blocked');
    return 'blob:test';
  });
  await env.render(h(ImportDialog, { questions: [], onImport() {}, onClose() {} }));
  await env.click(env.button('Tải mẫu CSV'));
  assert.match(document.body.textContent, /Không thể tạo file mẫu/);
  await env.click(env.button('Tải mẫu CSV'));
  await env.click(env.button('Tải mẫu Excel'));
  await env.waitFor(() => downloads.length === 2, 'Both template files must download');
  assert.deepEqual(
    downloads.map(name => name.slice(name.lastIndexOf('.'))),
    ['.csv', '.xlsx'],
  );
});
