import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildToeicCatalog,
  filterToeicDocuments,
  filterToeicTests,
  isSupportedToeicResource,
  toeicDocumentLabel,
  toeicTestUrl,
} from '../src/features/learning/utils/toeicCatalog.js';

const assets = {
  '/docs/resources/ĐỀ RC/TEST 1 RC_.pdf': '/assets/rc-1.pdf',
  '/docs/resources/ĐỀ LC/TEST 1 LC.pdf': '/assets/lc-1.pdf',
  '/docs/resources/ĐỀ RC/TEST 10 RC_.pdf': '/assets/rc-10.pdf',
  '/docs/resources/EBOOK GIẢI CHI TIẾT 10 TEST/GIẢI CHI TIẾT ETS TEST 9.pdf': '/assets/solution-9.pdf',
  '/docs/resources/EBOOK GIẢI CHI TIẾT 10 TEST/GIẢI CHI TIẾT ETS TEST 9.docx': '/assets/solution-9.docx',
  '/docs/resources/ĐÁP ÁN ETS 2024/ĐÁP ÁN ETS 2024 RC.pdf': '/assets/answers.pdf',
  '/docs/resources/AUDIO/TEST 1.pdf': '/must-not-be-included.pdf',
  '/docs/resources/Audio/nested/TEST 99.pdf': '/must-not-be-included-2.pdf',
  '/docs/resources/AUDIO/TEST 1.mp3': '/must-not-be-included.mp3',
};

test('catalog uses the supplied documents, sorts test numbers numerically and excludes every AUDIO path', () => {
  const { tests, documents } = buildToeicCatalog(assets);
  assert.equal(documents.length, 6);
  assert.deepEqual(
    tests.map(item => item.id),
    ['1', '9', '10'],
  );
  assert.deepEqual(tests[0].resources.map(item => item.type).sort(), ['listening', 'reading']);
  assert.ok(documents.every(item => !item.url.includes('must-not-be-included')));
  for (const path of [
    'docs/resources/aUdIo/folder/test.pdf',
    'docs/resources/notes.txt',
    'docs/resources/music.mp3',
  ])
    assert.equal(isSupportedToeicResource(path), false);
});

test('Word and PDF explanations are both preserved while shared answer keys are not invented as tests', () => {
  const { tests, documents } = buildToeicCatalog(assets);
  assert.deepEqual(
    tests[1].resources.map(item => item.format),
    ['PDF', 'WORD'],
  );
  const answer = documents.find(item => item.type === 'answer');
  assert.equal(answer.testNumber, null);
  assert.equal(answer.section, 'Reading');
  assert.equal(answer.filename, 'ĐÁP ÁN ETS 2024 RC.pdf');
  assert.equal(
    tests.some(item => item.id === '2024'),
    false,
  );
  assert.match(
    toeicDocumentLabel(answer, value => (value === 'Đáp án' ? 'Answer key' : value)),
    /Answer key ETS 2024 Reading/,
  );
});

test('search handles Vietnamese accents and exact test numbers without matching Test 10 for Test 1', () => {
  const { tests } = buildToeicCatalog(assets);
  for (const query of ['1', 'Test 1', 'test01', 'Test 01'])
    assert.deepEqual(
      filterToeicTests(tests, { query }).map(item => item.id),
      ['1'],
    );
  assert.deepEqual(
    filterToeicTests(tests, { query: 'giai chi tiet' }).map(item => item.id),
    ['9'],
  );
  assert.deepEqual(
    filterToeicTests(tests, { type: 'listening' }).map(item => item.id),
    ['1'],
  );
  assert.deepEqual(
    filterToeicTests(tests, { savedOnly: true, bookmarks: ['10', 'unknown'] }).map(item => item.id),
    ['10'],
  );
  assert.deepEqual(filterToeicTests(tests, { query: 'not found' }), []);
  assert.equal(toeicTestUrl('9', 'solution-word'), '/exams/toeic/tests/9?document=solution-word');
});

test('document search supports accents, exact test numbers, category filters and translated labels', () => {
  const { documents } = buildToeicCatalog(assets);
  assert.equal(filterToeicDocuments(documents, { query: 'giai chi tiet' }).length, 2);
  assert.equal(filterToeicDocuments(documents, { query: 'test01' }).length, 2);
  assert.equal(filterToeicDocuments(documents, { query: 'test1', type: 'reading' }).length, 1);
  assert.equal(filterToeicDocuments(documents, { query: 'dap an' })[0].testNumber, null);
  assert.equal(
    filterToeicDocuments(documents, { query: 'Detailed explanations' }, value =>
      value === 'Giải chi tiết' ? 'Detailed explanations' : value,
    ).length,
    2,
  );
});
