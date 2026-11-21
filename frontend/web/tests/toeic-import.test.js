import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './load-source.js';

const {
  IMPORT_LIMITS,
  createQuestionTemplate,
  parseQuestionFile,
  validateImportRows,
} = await loadSource('../src/features/learning/utils/toeicQuestionImport.js', import.meta.url);

const HEADER = ['Số câu', 'Part', 'Đoạn đọc', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án', 'Giải thích', 'Nguồn'];
const ROW = [
  '101',
  '5',
  '',
  'Choose ------- answer.',
  'a',
  'b',
  'c',
  'd',
  'B',
  'Giải thích bằng tiếng Việt.',
  'Nguồn tự biên soạn',
];
const csv = (rows, delimiter = ',') =>
  rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(delimiter)).join('\r\n');
const file = (text, name = 'questions.csv') => new File([text], name);
async function workbookFile(edit, name = 'questions.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reading');
  sheet.addRows([HEADER, ROW]);
  edit?.(workbook, sheet);
  return new File([await workbook.xlsx.writeBuffer()], name);
}

test('CSV preserves Vietnamese, quoted punctuation and multiline passages with physical row numbers', async () => {
  const row = [...ROW];
  row[2] = 'Đọc đoạn này, rồi chọn "đáp án".\nDòng thứ hai.';
  row[3] = 'Chọn đáp án đúng.';
  const result = await parseQuestionFile(
    file('\uFEFF' + csv([HEADER, row, ROW.map((v, i) => (i === 0 ? '102' : v))])),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].question.passage, row[2]);
  assert.equal(result.rows[0].question.prompt, row[3]);
  assert.equal(result.rows[0].question.correctOptionId, 'B');
  assert.equal(result.rows[0].line, 2);
  assert.equal(result.rows[1].line, 4);
  assert.equal(validateImportRows(result.rows).canImport, true);
});

test('CSV accepts Excel semicolon separators, English aliases, lowercase answers and blank lines', async () => {
  const header = [
    'number',
    'part',
    'passage',
    'prompt',
    'A',
    'B',
    'C',
    'D',
    'correctOptionId',
    'explanation',
    'source',
  ];
  const row = ROW.map((value, index) => (index === 8 ? ' b ' : value));
  const result = await parseQuestionFile(file('sep=;\r\n\r\n' + csv([header, row], ';') + '\r\n\r\n'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].line, 4);
  assert.equal(result.rows[0].question.correctOptionId, 'B');
});

test('malformed CSV, missing columns and duplicate normalized columns are rejected without importing partial rows', async () => {
  for (const text of [
    csv([HEADER]) + '\r\n"unclosed',
    csv([HEADER]) + '\r\n"closed"junk,rest',
    csv([HEADER.filter(value => value !== 'Giải thích'), ROW]),
    csv([
      [...HEADER, 'number'],
      [...ROW, 101],
    ]),
  ]) {
    const result = await parseQuestionFile(file(text));
    assert.ok(result.errors.length);
    assert.equal(result.rows.length, 0);
  }
});

test('per-row validation catches invalid answers, Part, number, blank explanation and backend field lengths', async () => {
  const invalid = [...ROW];
  invalid[0] = '10001';
  invalid[1] = '4';
  invalid[4] = 'a'.repeat(4001);
  invalid[8] = 'E';
  invalid[9] = '';
  invalid[10] = 's'.repeat(2001);
  const result = await parseQuestionFile(file(csv([HEADER, invalid, ROW])));
  assert.equal(result.rows[0].line, 2);
  assert.ok(result.rows[0].errors.length >= 6);
  assert.match(result.rows[0].errors.join(' '), /Giải thích|4\.000|2\.000/);
  const checked = validateImportRows(result.rows);
  assert.equal(checked.invalidCount, 1);
  assert.equal(checked.validCount, 1);
  assert.equal(checked.canImport, false);
});

test('duplicate checks revalidate against current questions, mark both file rows, and never mutate source rows', async () => {
  const parsed = await parseQuestionFile(file(csv([HEADER, ROW])));
  const original = structuredClone(parsed.rows);
  assert.equal(validateImportRows(parsed.rows, [{ number: 101 }]).canImport, false);
  assert.equal(validateImportRows(parsed.rows, [{ number: 102 }]).canImport, true);
  const duplicate = validateImportRows([...parsed.rows, ...parsed.rows]);
  assert.equal(duplicate.invalidCount, 2);
  assert.match(duplicate.rows[0].errors[0], /trùng/);
  assert.deepEqual(parsed.rows, original);
  const full = Array.from({ length: 1000 }, (_, index) => ({ number: index + 1000 }));
  assert.equal(validateImportRows(parsed.rows, full).canImport, false);
  assert.match(validateImportRows(parsed.rows, full).errors[0], /1\.000/);
});

test('files are limited to CSV/XLSX, 5MB and 1000 question rows; invalid UTF-8 is rejected', async () => {
  assert.ok((await parseQuestionFile(file('x', 'questions.xls'))).errors.length);
  assert.ok((await parseQuestionFile(file(''))).errors.length);
  assert.match(
    (await parseQuestionFile({ name: 'questions.csv', size: IMPORT_LIMITS.maxFileBytes + 1 })).errors[0],
    /5 MB/,
  );
  const badEncoding = new File([Uint8Array.of(0xff, 0xfe, 0x43)], 'questions.csv');
  assert.match((await parseQuestionFile(badEncoding)).errors[0], /UTF-8/);
  const tooMany = [
    HEADER,
    ...Array.from({ length: 1001 }, (_, index) => ROW.map((v, i) => (i === 0 ? String(index + 1) : v))),
  ];
  assert.match((await parseQuestionFile(file(csv(tooMany)))).errors[0], /1\.000/);
});

test('actual XLSX import selects the first visible sheet, preserves rich text, and rejects formula cells', async () => {
  const input = await workbookFile((workbook, sheet) => {
    sheet.state = 'hidden';
    const visible = workbook.addWorksheet('Câu hỏi chính');
    visible.addRows([HEADER, ROW]);
    visible.getCell('D2').value = { richText: [{ text: 'Vietnamese ' }, { text: 'text' }] };
    visible.addRow(ROW.map((value, index) => (index === 0 ? '102' : value)));
    visible.getCell('J3').value = { formula: 'CONCAT("formula", " answer")', result: 'formula answer' };
  });
  const result = await parseQuestionFile(input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.sheetName, 'Câu hỏi chính');
  assert.equal(result.rows[0].question.prompt, 'Vietnamese text');
  assert.match(result.rows[1].errors.join(' '), /J3.*công thức/);
  assert.equal(validateImportRows(result.rows).canImport, false);
});

test('downloaded CSV and XLSX templates round-trip as valid native questions', async () => {
  for (const format of ['csv', 'xlsx']) {
    const template = await createQuestionTemplate(format);
    assert.ok(template.blob.size > 0);
    const input = new File([template.blob], template.fileName);
    const result = await parseQuestionFile(input);
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows.length, 1);
    assert.equal(validateImportRows(result.rows).canImport, true);
    assert.equal(result.rows[0].question.correctOptionId, 'B');
  }
});

test('corrupt workbooks and workbooks without visible sheets fail clearly', async () => {
  const corrupt = await parseQuestionFile(file('not an Excel workbook', 'questions.xlsx'));
  assert.ok(corrupt.errors.length);
  const hidden = await parseQuestionFile(
    await workbookFile((workbook, sheet) => {
      sheet.state = 'hidden';
    }),
  );
  assert.match(hidden.errors[0], /trang tính/);
});
