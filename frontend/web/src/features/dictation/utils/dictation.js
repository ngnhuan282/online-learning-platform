export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const SCORE_DESCRIPTION =
  'Điểm dựa trên số từ bạn tự điền đúng trước khi mở gợi ý hoặc đáp án. Gõ sai rồi tự sửa đúng vẫn được tính điểm.';
export const scoreDescription = attempt =>
  attempt.scoringMode === 'LEGACY'
    ? 'Kết quả cũ được giữ theo lần kiểm tra đầu tiên của từng câu.'
    : SCORE_DESCRIPTION;
export const scoreFeedback = score =>
  Number(score) >= 80
    ? { tone: 'high', label: 'Tuyệt vời!' }
    : Number(score) >= 50
      ? { tone: 'mid', label: 'Có tiến bộ' }
      : { tone: 'low', label: 'Cần luyện thêm' };

export const isSentenceLocked = response =>
  response?.completed ??
  Boolean(
    response?.revealed ||
    response?.skipped ||
    (response?.checked && response.grade?.accuracy === 100 && isCurrentGrade(response.text, response.grade)),
  );

export const answerTokens = value =>
  value
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];

export function isCurrentGrade(text, grade) {
  if (!grade?.words) return false;
  const tokens = value => answerTokens(value).join(' ');
  return (
    tokens(text) ===
    tokens(
      grade.words
        .map(word => word.actual)
        .filter(value => value != null)
        .join(' '),
    )
  );
}

export function maskedWords(segment, response) {
  return wordFeedback(segment, response).map(word => word.text);
}

export function wordFeedback(segment, response = {}, text = response.text ?? '') {
  const hints = new Map((response.hints ?? []).map(hint => [hint.index, hint.text]));
  const feedback = new Map((response.feedback ?? []).map(word => [word.index, word]));
  const fresh = answerTokens(text).join(' ') === answerTokens(response.text ?? '').join(' ');
  const typed = answerTokens(text);
  return Array.from({ length: segment.words }, (_, index) => {
    const value = feedback.get(index);
    const matched = value?.state === 'correct' && (fresh || typed[index] === value.text);
    return {
      index,
      state: hints.has(index) ? 'hinted' : matched ? 'correct' : fresh ? (value?.state ?? 'empty') : 'empty',
      text:
        hints.get(index) ??
        (matched ? value.text : '*'.repeat(Math.min(12, segment.wordLengths?.[index] ?? 4))),
    };
  });
}

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '';
  const value = Math.max(0, Math.floor(Number(seconds)));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function parseTime(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!/^\d{2,3}:[0-5]\d$/.test(value)) throw new Error('Thời gian dùng mm:ss, ví dụ 00:02.');
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
}

export function definitionPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    topic: form.topic.trim(),
    level: form.level,
    audioKey: form.audioKey || null,
    sentences: form.sentences.map(row => ({
      text: row.text.trim(),
      start: parseTime(row.start),
      end: parseTime(row.end),
    })),
  };
}

export function draftError(form) {
  if (!form.title.trim() || !form.topic.trim()) return 'Vui lòng nhập tên bài nghe và chủ đề.';
  if (!form.sentences.length || form.sentences.some(row => !row.text.trim()))
    return 'Vui lòng nhập transcript cho từng câu.';
  try {
    definitionPayload(form);
  } catch (error) {
    return error.message;
  }
  return null;
}

export function transcriptImportBase(sentences, mode) {
  if (mode === 'replace') return [];
  const only = sentences.length === 1 ? sentences[0] : null;
  const untouched = value => value === null || value === undefined || value === '';
  return only && !only.text.trim() && untouched(only.start) && untouched(only.end) ? [] : sentences;
}

export const sentenceState = response => (isSentenceLocked(response) ? 'done' : 'new');
