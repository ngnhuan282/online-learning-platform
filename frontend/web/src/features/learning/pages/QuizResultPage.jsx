import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircleOutlined, HighlightOff, RadioButtonUnchecked } from '@mui/icons-material';
import ErrorState from '../../../shared/components/ErrorState';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import '../styles/quiz.css';

export default function QuizResultPage() {
  const { attemptId, quizId } = useParams();
  const loadReview = useCallback(async () => {
    const selectedAttemptId = attemptId ?? (await learningApi.getQuizResult(quizId)).data.attemptId;
    return learningApi.getQuizReview(selectedAttemptId);
  }, [attemptId, quizId]);
  const { data, error, loading } = useLearningResource(loadReview, null);
  const result = data && (!attemptId || String(data.attemptId) === attemptId) ? data : null;
  const correctCount = result?.questions.filter(question => question.correct).length ?? 0;

  return (
    <section className="learning-page">
      <div className="learning-shell quiz-result-shell" aria-busy={loading}>
        <div className="learning-page-header">
          <div>
            <p>Kết quả bài kiểm tra</p>
            <h1>{result?.quizTitle ?? 'Kết quả quiz'}</h1>
          </div>
          {result?.courseId && (
            <Link className="button button-outline" to={`/learning/${result.courseId}`}>
              Quay lại khóa học
            </Link>
          )}
        </div>

        {loading && !result && <p>Đang tải kết quả...</p>}
        {error && <ErrorState error={error} title="Không thể tải kết quả quiz" />}

        {result && (
          <>
            <article className="quiz-result-card">
              <span className={`learning-chip ${result.passed ? 'is-success' : 'is-warning'}`}>
                {result.passed ? 'Đạt' : 'Chưa đạt'}
              </span>
              <strong>{result.score}%</strong>
              <ProgressBar value={result.score} />
              <p>
                Điểm đạt {result.passingScore}% · Đúng {correctCount}/{result.questions.length} câu
              </p>
              <p>Lượt làm #{result.attemptId}</p>
              <Link className="button button-outline" to={`/quizzes/${result.quizId}`}>
                Làm lại
              </Link>
            </article>

            <section className="quiz-review" aria-label="Xem lại đáp án">
              <div className="quiz-review-heading">
                <h2>Xem lại đáp án</h2>
                <span>{result.questions.length} câu hỏi</span>
              </div>
              <div className="quiz-review-list">
                {result.questions.map((question, index) => (
                  <article className="quiz-review-question" key={question.id}>
                    <div className="quiz-review-question-heading">
                      <span>Câu {index + 1}</span>
                      <span className={question.correct ? 'is-correct' : 'is-incorrect'}>
                        {question.correct ? 'Đúng' : question.answered ? 'Chưa đúng' : 'Chưa trả lời'}
                        {' · '}
                        {question.pointsAwarded}/{question.points} điểm
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
                            {option.selected && 'Bạn chọn'}
                            {option.selected && option.correct && ' · '}
                            {option.correct && 'Đáp án đúng'}
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
