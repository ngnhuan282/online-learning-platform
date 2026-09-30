import { readStorage, removeStorage, writeStorage } from '../../../shared/utils/storage';

export const quizDraftKey = (userId, quizId) => `quiz-draft:${userId}:${quizId}`;

export function readQuizDraft(key, attemptId, quiz) {
  try {
    const saved = JSON.parse(readStorage(key));
    if (String(saved?.attemptId) !== String(attemptId) || !saved.answers) return {};

    const answers = {};
    for (const question of quiz.questions) {
      const selected = saved.answers[question.id];
      if (!Array.isArray(selected)) continue;
      const validIds = new Set(question.options.map(option => option.id));
      const valid = [...new Set(selected)].filter(id => validIds.has(id));
      if (valid.length) answers[question.id] = question.questionType === 'SINGLE_CHOICE'
        ? valid.slice(0, 1)
        : valid;
    }
    return answers;
  } catch {
    return {};
  }
}

export function writeQuizDraft(key, attemptId, answers) {
  writeStorage(key, JSON.stringify({ attemptId, answers }));
}

export function clearQuizDraft(key) {
  removeStorage(key);
}
