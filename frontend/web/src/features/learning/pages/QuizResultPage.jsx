import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import HighlightOff from '@mui/icons-material/HighlightOff';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import ErrorState from '../../../shared/components/ErrorState';
import ProgressBar from '../components/ProgressBar';
import LearningHeader from '../components/LearningHeader';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import '../styles/quiz.css';

function QuizResult({ attemptId, quizId }) {
  useLocale();
  const loadReview = useCallback(
    async ({ signal }) => {
      const selectedAttemptId = attemptId ?? (await learningApi.getQuizResult(quizId)).data.attemptId;
      signal.throwIfAborted();
      return learningApi.getQuizReview(selectedAttemptId);
    },
    [attemptId, quizId],
  );
  const { data, error, loading, reload } = useLearningResource(loadReview, null);
  const result = data && (!attemptId || String(data.attemptId) === attemptId) ? data : null;
  const correctCount = result?.questions.filter(question => question.correct).length ?? 0;

  return (
    <section className="learning-page">
      <div className="learning-shell quiz-result-shell" aria-busy={loading}>
        <LearningHeader
          title={result?.quizTitle ?? t('Kết quả quiz')}
          description={t('Kết quả bài kiểm tra và đáp án của lượt làm này.')}
        >
          {result?.courseId && (
            <Link className="button button-outline" to={`/learning/${result.courseId}`}>
              {t('Quay lại khóa học')}
            </Link>
          )}
        </LearningHeader>

        {loading && !result && <p>{t('Đang tải kết quả...')}</p>}
        {error && (
          <ErrorState
            error={error}
            title={
              error.status === 403 ? t('Bạn không có quyền xem kết quả này') : t('Không thể tải kết quả quiz')
            }
            onRetry={reload}
          />
        )}

        {result && (
          <>
            <article className="quiz-result-card">
              <span className={`learning-chip ${result.passed ? 'is-success' : 'is-warning'}`}>
                {result.passed ? t('Đạt') : t('Chưa đạt')}
              </span>
              <strong>{result.score}%</strong>
              <ProgressBar value={result.score} />
              <p>
                {t('Điểm đạt')} {result.passingScore}
                {t('% · Đúng')} {correctCount}/{result.questions.length} {t('câu')}
              </p>
              <p>
                {t('Lượt làm #')}
                {result.attemptId}
              </p>
              <Link className="button button-outline" to={`/quizzes/${result.quizId}`}>
                {t('Làm lại')}
              </Link>
            </article>

            <section className="quiz-review" aria-label={t('Xem lại đáp án')}>
              <div className="quiz-review-heading">
                <h2>{t('Xem lại đáp án')}</h2>
                <span>
                  {result.questions.length} {t('câu hỏi')}
                </span>
              </div>
              <div className="quiz-review-list">
                {result.questions.map((question, index) => (
                  <article className="quiz-review-question" key={question.id}>
                    <div className="quiz-review-question-heading">
                      <span>
                        {t('Câu')} {index + 1}
                      </span>
                      <span className={question.correct ? 'is-correct' : 'is-incorrect'}>
                        {question.correct
                          ? t('Đúng')
                          : question.answered
                            ? t('Chưa đúng')
                            : t('Chưa trả lời')}
                        {' · '}
                        {question.pointsAwarded}/{question.points} {t('điểm')}
                      </span>
                    </div>
                    <h3>{question.questionText}</h3>
                    <div className="quiz-review-options">
                      {question.options.map(option => (
                        <div
                          className={`quiz-review-option${option.correct ? ' is-correct' : ''}${option.selected && !option.correct ? ' is-incorrect' : ''}`}
                          key={option.id}
                        >
                          {option.correct ? (
                            <CheckCircleOutlined fontSize="small" aria-hidden="true" />
                          ) : option.selected ? (
                            <HighlightOff fontSize="small" aria-hidden="true" />
                          ) : (
                            <RadioButtonUnchecked fontSize="small" aria-hidden="true" />
                          )}
                          <span>{option.optionText}</span>
                          <small>
                            {option.selected && t('Bạn chọn')}
                            {option.selected && option.correct && ' · '}
                            {option.correct && t('Đáp án đúng')}
                          </small>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

export default function QuizResultPage() {
  useLocale();
  const { attemptId, quizId } = useParams();
  return <QuizResult key={`${attemptId}:${quizId}`} attemptId={attemptId} quizId={quizId} />;
}
