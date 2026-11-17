const LETTERS = ['A', 'B', 'C', 'D'];

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  maxQuestions: 1000,
  maxUnpackedBytes: 30 * 1024 * 1024,
});

const COLUMNS = [
  ['number', 'Số câu', ['number', 'questionnumber', 'socauhoi']],
  ['part', 'Part', ['phan']],
  ['passage', 'Đoạn đọc', ['passage']],
  ['prompt', 'Câu hỏi', ['prompt', 'question', 'noidungcauhoi']],
  ...LETTERS.map(letter => [letter, letter, []]),
  ['correctOptionId', 'Đáp án', ['correctoptionid', 'correctanswer', 'answer', 'dapandung']],
  ['explanation', 'Giải thích', ['explanation', 'loigiai']],
  ['source', 'Nguồn', ['source', 'thamchieunguon']],
];
const REQUIRED = ['number', 'part', 'prompt', ...LETTERS, 'correctOptionId', 'explanation'];
const MAX_LENGTHS = { prompt: 20000, passage: 100000, explanation: 50000, source: 2000 };
const COLUMN_NAMES = Object.fromEntries(COLUMNS.map(([key, label]) => [key, label]));
const normalizeHeader = value =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
const HEADER_KEYS = new Map(
  COLUMNS.flatMap(([key, label, aliases]) =>
    [key, label, ...aliases].map(alias => [normalizeHeader(alias), key]),
  ),
);
const SAMPLE = [
  101,
  5,
  '',
  'Ms. Nguyen is known for ------- careful planning.',
  'she',
  'her',
  'hers',
  'herself',
  'B',
  'Dùng tính từ sở hữu her trước cụm danh từ careful planning.',
  'Ví dụ biên soạn để hướng dẫn nhập câu hỏi',
];

function failed(fileName, message) {
  return { fileName, sheetName: null, rows: [], errors: [message] };
}

function delimiterFor(text) {
  const counts = new Map([',', ';', '\t'].map(value => [value, 0]));
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const value = text[index];
    if (value === '"') {
      if (quoted && text[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (value === '\r' || value === '\n') break;
      if (counts.has(value)) counts.set(value, counts.get(value) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0][0];
}

function csvRows(input) {
  let text = input.replace(/^\uFEFF/, '');
  const separator = text.match(/^sep=([,;\t])(?:\r\n|\n|\r)/i);
  let line = separator ? 2 : 1;
  if (separator) text = text.slice(separator[0].length);
  const delimiter = separator ? separator[1] : delimiterFor(text.trimStart());
  const rows = [];
  let startLine = line;
  let cells = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;

  function finishCell() {
    cells.push(value);
    value = '';
    closedQuote = false;
  }
  function finishRow() {
    finishCell();
    if (cells.some(cell => cell.trim())) rows.push({ line: startLine, cells, errors: [] });
    cells = [];
    if (rows.length > IMPORT_LIMITS.maxQuestions + 1)
      throw new Error('Mỗi file chỉ được chứa tối đa 1.000 câu hỏi.');
  }

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && text[index + 1] === '\n') index++;
        value += '\n';
        line++;
      } else value += character;
    } else if (character === delimiter) finishCell();
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      finishRow();
      line++;
      startLine = line;
    } else if (closedQuote) {
      if (!/\s/.test(character))
        throw new Error(`CSV không hợp lệ ở dòng ${line}: có ký tự sau dấu ngoặc kép đóng.`);
    } else if (character === '"') {
      if (value.length) throw new Error(`CSV không hợp lệ ở dòng ${line}: dấu ngoặc kép phải ở đầu ô.`);
      quoted = true;
    } else value += character;
    if (value.length > 100000) throw new Error(`Một ô dữ liệu ở dòng ${startLine} vượt quá 100.000 ký tự.`);
  }
  if (quoted) throw new Error(`CSV không hợp lệ ở dòng ${startLine}: thiếu dấu ngoặc kép đóng.`);
  finishRow();
  return rows;
}

// Check ZIP directory sizes before ExcelJS decompresses an XLSX file in the browser.
function checkWorkbookSize(buffer) {
  const bytes = new DataView(buffer);
  let directory = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65557); offset--) {
    if (bytes.getUint32(offset, true) === 0x06054b50) {
      directory = offset;
      break;
    }
  }
  if (directory < 0) throw new Error('File Excel không hợp lệ. Hãy lưu lại dưới định dạng .xlsx.');
  const entries = bytes.getUint16(directory + 10, true);
  let offset = bytes.getUint32(directory + 16, true);
  let total = 0;
  if (entries > 2000 || entries === 0xffff)
    throw new Error('File Excel quá phức tạp. Hãy chỉ giữ lại trang tính chứa câu hỏi.');
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > bytes.byteLength || bytes.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Cấu trúc file Excel không hợp lệ.');
    const size = bytes.getUint32(offset + 24, true);
    total += size;
    if (total > IMPORT_LIMITS.maxUnpackedBytes)
      throw new Error('Nội dung Excel quá lớn sau giải nén. Hãy chia thành các file nhỏ hơn.');
    offset +=
      46 +
      bytes.getUint16(offset + 28, true) +
      bytes.getUint16(offset + 30, true) +
      bytes.getUint16(offset + 32, true);
  }
}

async function excelLibrary() {
  const module = await import('exceljs');
  return module.default ?? module;
}

async function workbookRows(buffer) {
  checkWorkbookSize(buffer);
  const ExcelJS = await excelLibrary();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets.find(value => !value.state || value.state === 'visible');
  if (!sheet) throw new Error('File Excel không có trang tính đang hiển thị.');
  const rows = [];
  sheet.eachRow(row => {
    const errors = [];
    if (row.cellCount > 64) throw new Error('Trang tính chứa quá nhiều cột. Hãy sử dụng file mẫu.');
    const cells = [];
    for (let column = 1; column <= row.cellCount; column++) {
      const value = row.getCell(column).value;
      if (value == null) cells.push('');
      else if (typeof value === 'string' || typeof value === 'number') cells.push(String(value));
      else if (typeof value === 'object' && Array.isArray(value.richText))
        cells.push(value.richText.map(part => part.text).join(''));
      else {
        cells.push('');
        errors.push(
          typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)
            ? `Ô ${row.getCell(column).address} chứa công thức. Hãy dán giá trị văn bản thay cho công thức.`
            : `Ô ${row.getCell(column).address} phải chứa văn bản hoặc số, không dùng ngày, liên kết hay lỗi Excel.`,
        );
      }
    }
    if (errors.length || cells.some(cell => cell.trim())) rows.push({ line: row.number, cells, errors });
    if (rows.length > IMPORT_LIMITS.maxQuestions + 1)
      throw new Error('Mỗi file chỉ được chứa tối đa 1.000 câu hỏi.');
  });
  return { rows, sheetName: sheet.name };
}

function questionRows(rawRows) {
  if (!rawRows.length) return { rows: [], errors: ['File không có dữ liệu câu hỏi.'] };
  const [header, ...body] = rawRows;
  const errors = [...header.errors];
  const seen = new Set();
  const keys = header.cells.map(value => {
    const normalized = normalizeHeader(value.trim());
    const key = HEADER_KEYS.get(normalized);
    if (normalized && seen.has(key ?? normalized)) errors.push(`Cột bị lặp: ${value.trim()}.`);
    if (normalized) seen.add(key ?? normalized);
    return key;
  });
  for (const key of REQUIRED)
    if (!keys.includes(key)) errors.push(`Thiếu cột bắt buộc: ${COLUMN_NAMES[key]}.`);
  if (errors.length) return { rows: [], errors };
  if (!body.length) return { rows: [], errors: ['File chỉ có tiêu đề, chưa có câu hỏi.'] };

  const rows = body.map(row => {
    const values = Object.fromEntries(
      keys.filter(Boolean).map(key => [key, (row.cells[keys.indexOf(key)] ?? '').trim()]),
    );
    const issues = [...row.errors];
    if (row.cells.slice(keys.length).some(value => value.trim()))
      issues.push('Dòng có nhiều ô dữ liệu hơn dòng tiêu đề.');
    const number = /^\d+$/.test(values.number) ? Number(values.number) : null;
    const part = /^\d+$/.test(values.part) ? Number(values.part) : null;
    if (number == null || number < 1 || number > 10000)
      issues.push('Số câu phải là số nguyên từ 1 đến 10.000.');
    if (![5, 6, 7].includes(part)) issues.push('Part chỉ nhận 5, 6 hoặc 7 (Reading).');
    for (const key of ['prompt', ...LETTERS, 'explanation'])
      if (!values[key]) issues.push(`Thiếu nội dung: ${COLUMN_NAMES[key]}.`);
    const correctOptionId = values.correctOptionId.toUpperCase();
    if (!LETTERS.includes(correctOptionId)) issues.push('Đáp án đúng phải là A, B, C hoặc D.');
    for (const [key, limit] of Object.entries(MAX_LENGTHS))
      if ((values[key] ?? '').length > limit)
        issues.push(`${COLUMN_NAMES[key]} vượt quá ${limit.toLocaleString('vi-VN')} ký tự.`);
    for (const letter of LETTERS)
      if (values[letter].length > 4000) issues.push(`Lựa chọn ${letter} vượt quá 4.000 ký tự.`);
    return {
      line: row.line,
      errors: issues,
      question: {
        id: null,
        number,
        part,
        passage: values.passage ?? '',
        prompt: values.prompt,
        options: LETTERS.map(id => ({ id, text: values[id] })),
        correctOptionId,
        explanation: values.explanation,
        source: values.source ?? '',
        imageUrl: '',
        passageImageUrls: [],
      },
    };
  });
  return { rows, errors: [] };
}

/** Parse locally only. The caller appends fresh IDs after the administrator confirms. */
export async function parseQuestionFile(file) {
  const fileName = file?.name ?? '';
  if (!file || !/\.(?:csv|xlsx)$/i.test(fileName))
    return failed(fileName, 'Chỉ hỗ trợ file .xlsx hoặc .csv. Với Excel cũ (.xls), hãy lưu thành .xlsx.');
  if (!Number.isFinite(file.size) || file.size > IMPORT_LIMITS.maxFileBytes)
    return failed(fileName, 'File phải có dung lượng tối đa 5 MB.');
  if (!file.size) return failed(fileName, 'File đang trống.');
  try {
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > IMPORT_LIMITS.maxFileBytes)
      return failed(fileName, 'File phải có dung lượng tối đa 5 MB.');
    let rawRows;
    let sheetName = null;
    if (/\.csv$/i.test(fileName)) {
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        return failed(fileName, 'CSV phải dùng mã hóa UTF-8. Trong Excel, chọn CSV UTF-8 khi lưu.');
      }
      rawRows = csvRows(text);
    } else ({ rows: rawRows, sheetName } = await workbookRows(buffer));
    return { fileName, sheetName, ...questionRows(rawRows) };
  } catch (error) {
    return failed(
      fileName,
      error instanceof Error &&
        /^(?:CSV|File|Một ô|Mỗi file|Nội dung|Cấu trúc|Trang tính)/.test(error.message)
        ? error.message
        : 'Không đọc được file. Hãy kiểm tra file mẫu và lưu lại thành .xlsx hoặc CSV UTF-8.',
    );
  }
}

/** Always validate the original parse rows against the current form before applying. */
export function validateImportRows(rows, existingQuestions = []) {
  const existingNumbers = new Set(existingQuestions.map(question => Number(question.number)));
  const counts = new Map();
  for (const row of rows) {
    const number = row.question?.number;
    if (number != null) counts.set(number, (counts.get(number) ?? 0) + 1);
  }
  const checked = rows.map(row => {
    const errors = [...(row.baseErrors ?? row.errors ?? [])];
    const number = row.question?.number;
    if (number != null && counts.get(number) > 1) errors.push(`Số câu ${number} bị trùng trong file.`);
    if (number != null && existingNumbers.has(number))
      errors.push(`Số câu ${number} đã tồn tại trong bộ đề. Hãy sửa số câu trong file trước khi nhập.`);
    return { ...row, baseErrors: row.baseErrors ?? row.errors ?? [], errors };
  });
  const errors = [];
  if (existingQuestions.length + rows.length > IMPORT_LIMITS.maxQuestions)
    errors.push('Tổng số câu sau khi nhập không được vượt quá 1.000.');
  const invalidCount = checked.filter(row => row.errors.length).length;
  return {
    rows: checked,
    errors,
    validCount: checked.length - invalidCount,
    invalidCount,
    canImport: checked.length > 0 && !invalidCount && !errors.length,
  };
}

export async function createQuestionTemplate(format) {
  const header = COLUMNS.map(([, label]) => label);
  if (format === 'csv') {
    const escape = value => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, SAMPLE].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
    return {
      blob: new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
      fileName: 'mau-cau-hoi-toeic.csv',
    };
  }
  if (format !== 'xlsx') throw new Error('Định dạng file mẫu không được hỗ trợ.');
  const ExcelJS = await excelLibrary();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Câu hỏi Reading');
  sheet.addRow(header);
  sheet.addRow(SAMPLE);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315EEB' } };
  sheet.columns.forEach((column, index) => {
    column.width = [2, 3, 9, 10].includes(index) ? 54 : index < 2 ? 12 : 22;
    column.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.autoFilter = { from: 'A1', to: 'K2' };
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: 'mau-cau-hoi-toeic.xlsx',
  };
}
