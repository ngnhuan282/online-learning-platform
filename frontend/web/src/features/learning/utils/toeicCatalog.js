const normalize = value =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

export const DOCUMENT_TYPES = Object.freeze({
  reading: {
    label: 'Đề Reading',
    shortLabel: 'Reading',
    description: 'Luyện đọc hiểu, ngữ pháp và từ vựng',
    tone: 'blue',
  },
  listening: {
    label: 'Đề Listening',
    shortLabel: 'Listening PDF',
    description: 'Xem đề nghe ở định dạng PDF',
    tone: 'orange',
  },
  solution: {
    label: 'Giải chi tiết',
    shortLabel: 'Giải chi tiết',
    description: 'Đối chiếu và hiểu cách chọn đáp án',
    tone: 'violet',
  },
  answer: {
    label: 'Đáp án',
    shortLabel: 'Đáp án',
    description: 'Bảng đáp án Reading và Listening',
    tone: 'green',
  },
  document: {
    label: 'Tài liệu khác',
    shortLabel: 'Tài liệu',
    description: 'Tài liệu bổ trợ cho quá trình ôn tập',
    tone: 'blue',
  },
});

export function toeicDocumentLabel(resource, translate = value => value) {
  if (resource.type === 'answer') return `${translate('Đáp án')} ETS 2024 ${resource.section ?? ''}`.trim();
  return `${translate(DOCUMENT_TYPES[resource.type].label)}${resource.testNumber ? ` — Test ${String(resource.testNumber).padStart(2, '0')}` : ''}${resource.format === 'WORD' ? ' (Word)' : ''}`;
}

export function isSupportedToeicResource(path) {
  const segments = path.replaceAll('\\', '/').split('/');
  return !segments.some(segment => segment.toUpperCase() === 'AUDIO') && /\.(pdf|docx)$/i.test(path);
}

export function buildToeicCatalog(assets) {
  const documents = Object.entries(assets)
    .filter(([path]) => isSupportedToeicResource(path))
    .map(([path, url]) => {
      const relativePath = path.replaceAll('\\', '/').split('/docs/resources/').at(-1);
      const filename = relativePath.split('/').at(-1);
      const normalized = normalize(relativePath);
      const number = filename.match(/test\s*(\d+)/i)?.[1];
      const testNumber = number ? Number(number) : null;
      const format = /\.docx$/i.test(filename) ? 'WORD' : 'PDF';
      const type = normalized.includes('dap an')
        ? 'answer'
        : normalized.includes('giai chi tiet')
          ? 'solution'
          : /(?:^|\/)de rc\//.test(normalized)
            ? 'reading'
            : /(?:^|\/)de lc\//.test(normalized)
              ? 'listening'
              : 'document';
      const section = /\bRC\b/i.test(filename) ? 'Reading' : /\bLC\b/i.test(filename) ? 'Listening' : null;
      const id = encodeURIComponent(relativePath);
      const label = toeicDocumentLabel({ type, testNumber, format, section });
      return { id, filename, relativePath, url, type, testNumber, format, section, label };
    })
    .sort(
      (a, b) =>
        (a.testNumber ?? 999) - (b.testNumber ?? 999) ||
        a.type.localeCompare(b.type) ||
        a.format.localeCompare(b.format),
    );

  const numbers = [
    ...new Set(
      documents
        .map(document => document.testNumber)
        .filter(number => Number.isSafeInteger(number) && number > 0),
    ),
  ].sort((a, b) => a - b);
  const tests = numbers.map(number => {
    const resources = documents.filter(document => document.testNumber === number);
    return {
      id: String(number),
      number,
      title: `ETS 2024 — Test ${String(number).padStart(2, '0')}`,
      resources,
    };
  });
  return { documents, tests };
}

export function filterToeicTests(
  tests,
  { query = '', type = 'all', savedOnly = false, bookmarks = [] } = {},
) {
  const search = normalize(query.trim());
  const exactTest = search.match(/^(?:test\s*)?0*(\d+)$/)?.[1];
  return tests.filter(
    test =>
      (!savedOnly || bookmarks.includes(test.id)) &&
      (type === 'all' || test.resources.some(resource => resource.type === type)) &&
      (!search ||
        (exactTest
          ? test.number === Number(exactTest)
          : normalize(test.title + ' ' + test.resources.map(resource => resource.label).join(' ')).includes(
              search,
            ))),
  );
}

export function filterToeicDocuments(documents, { query = '', type = 'all' } = {}, translate) {
  const search = normalize(query.trim());
  const exactTest = search.match(/^(?:test\s*)?0*(\d+)$/)?.[1];
  return documents.filter(
    document =>
      (type === 'all' || document.type === type) &&
      (!search ||
        (exactTest
          ? document.testNumber === Number(exactTest)
          : normalize(
              `${document.filename} ${document.label} ${toeicDocumentLabel(document, translate)}`,
            ).includes(search))),
  );
}

export function toeicTestUrl(testId, type = 'reading') {
  return `/exams/toeic/tests/${encodeURIComponent(testId)}?document=${encodeURIComponent(type)}`;
}
