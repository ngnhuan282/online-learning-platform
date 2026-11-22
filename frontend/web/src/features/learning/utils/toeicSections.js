export const LISTENING_PARTS = [1, 2, 3, 4];
export const READING_PARTS = [5, 6, 7];
export const PART_TITLES = {
  1: 'Mô tả hình ảnh',
  2: 'Câu hỏi và phản hồi',
  3: 'Hội thoại',
  4: 'Bài nói ngắn',
  5: 'Hoàn thành câu',
  6: 'Hoàn thành đoạn văn',
  7: 'Đọc hiểu',
};

export const isListeningPart = part => LISTENING_PARTS.includes(part);

const ETS_LISTENING_TITLE_PATTERN = /^(ETS\s+2024\s*[—–-]\s*Test\s*)(\d+)(\s*·\s*Listening)$/i;
const ETS_LISTENING_SOURCE_PATTERN = /^(ETS\s+2024\s+Listening\s*·\s*Test\s*)(\d+)$/i;

// The bundled ETS 2024 Listening dataset omits Test 04 (01–03, 05–10).
// Shift displayed numbers 05..10 -> 04..09 on learner screens unless Test 04 exists in the catalogue.
let etsListeningHasTest04 = false;

function shiftEtsListeningLabel(text, pattern) {
  if (!text || etsListeningHasTest04) return text;
  const match = String(text).match(pattern);
  if (!match) return text;
  const number = Number(match[2]);
  if (!Number.isInteger(number) || number <= 4) return text;
  const formatted = String(number - 1).padStart(Math.max(2, match[2].length), '0');
  return `${match[1]}${formatted}${match[3] ?? ''}`;
}

export function syncEtsListeningSequence(exams) {
  const listeningEts = (exams ?? []).filter(
    exam => exam?.section === 'LISTENING' && ETS_LISTENING_TITLE_PATTERN.test(String(exam?.title ?? '')),
  );
  if (!listeningEts.length) return;
  etsListeningHasTest04 = listeningEts.some(exam => {
    const match = String(exam.title).match(ETS_LISTENING_TITLE_PATTERN);
    return Number(match?.[2]) === 4;
  });
}

export function formatToeicTitle(title) {
  return shiftEtsListeningLabel(title, ETS_LISTENING_TITLE_PATTERN);
}

export function formatToeicSourceLabel(sourceLabel) {
  return shiftEtsListeningLabel(sourceLabel, ETS_LISTENING_SOURCE_PATTERN);
}

export function normalizeToeicLibraryExams(exams) {
  syncEtsListeningSequence(exams);
  return (exams ?? []).map(exam => {
    if (exam?.section !== 'LISTENING') return exam;
    const title = formatToeicTitle(exam.title);
    const sourceLabel = formatToeicSourceLabel(exam.sourceLabel);
    if (title === exam.title && sourceLabel === exam.sourceLabel) return exam;
    return { ...exam, title, sourceLabel };
  });
}
