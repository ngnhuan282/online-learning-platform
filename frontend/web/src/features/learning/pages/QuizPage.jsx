import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, Radio } from '@mui/material';
import ErrorState from '../../../shared/components/ErrorState';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useAuth from '../../auth/hooks/useAuth';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { clearQuizDraft, quizDraftKey, readQuizDraft, writeQuizDraft } from '../utils/quizDraft';
import '../styles/quiz.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function remainingSeconds(attempt, quiz) {
  if (!quiz.timeLimitMinutes) return null;
  const deadline = new Date(attempt.startedAt).getTime() + quiz.timeLimitMinutes * 60000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function QuizWorkspace({ quizId, userId }) {
  const navigate = useNavigate();
  const draftKey = quizDraftKey(userId, quizId);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setLoading(true);
        setError(null);
        return learningApi.getQuiz(quizId);
      })
      .then(response => {
        if (active) {
          setQuiz(response.data);
          setAttempt(null);
          setAnswers({});
          setRemaining(null);
        }
      })
      .catch(loadError => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [quizId, retry]);

  useEffect(() => {
    if (!attempt || !quiz?.timeLimitMinutes) return undefined;
    const tick = () => setRemaining(remainingSeconds(attempt, quiz));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, quiz]);

  useEffect(() => {
    if (!attempt || String(attempt.quizId) !== quizId) return;
    writeQuizDraft(draftKey, attempt.attemptId, answers);
  }, [answers, attempt, draftKey, quizId]);

  useEffect(() => {
    if (remaining === 0) clearQuizDraft(draftKey);
  }, [draftKey, remaining]);

  async function start() {
    if (pending.current || !quiz) return;
    pending.current = true;
    const session = getSessionVersion();
    const active = () => mounted.current && session === getSessionVersion();
    setBusy(true);
    setError(null);
    try {
      const response = await learningApi.startQuiz(quizId);
      if (!active()) return;
      setAnswers(readQuizDraft(draftKey, response.data.attemptId, quiz));
      setAttempt(response.data);
      setRemaining(remainingSeconds(response.data, quiz));
    } catch (startError) {
      if (active()) setError(startError);
    } finally {
      pending.current = false;
      if (active()) setBusy(false);
    }
  }

  function choose(question, optionId, checked) {
    setAnswers(previous => {
      if (question.questionType === 'SINGLE_CHOICE') {
        return { ...previous, [question.id]: [optionId] };
      }
      const current = previous[question.id] ?? [];
      return {
        ...previous,
        [question.id]: checked ? [...new Set([...current, optionId])] : current.filter(id => id !== optionId),
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!attempt || pending.current || remaining === 0) return;
    if (remainingSeconds(attempt, quiz) === 0) {
      setRemaining(0);
      clearQuizDraft(draftKey);
      return;
    }
    pending.current = true;
    const session = getSessionVersion();
    const active = () => mounted.current && session === getSessionVersion();
    setBusy(true);
    setError(null);
    try {
      const response = await learningApi.submitQuiz(
        attempt.attemptId,
        Object.entries(answers).map(([questionId, optionIds]) => ({
          questionId: Number(questionId),
          optionIds,
        })),
      );
      if (!active()) return;
      clearQuizDraft(draftKey);
      navigate(`/quizzes/attempts/${response.data.attemptId}/result`);
    } catch (submitError) {
      if (active()) {
        setError(submitError);
        if (remainingSeconds(attempt, quiz) === 0) setRemaining(0);
      }
    } finally {
      pending.current = false;
      if (active()) setBusy(false);
    }
  }

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(ids => ids && ids.length > 0).length;
  }, [answers]);

  const totalQuestions = quiz?.questions?.length || 0;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <section className="learning-page">
      <div className="learning-shell quiz-workspace">
        {/* Header Card */}
        <div className="quiz-header-card">
          <div className="quiz-header-nav">
            <span className="quiz-tag-badge">📝 Bài kiểm tra đánh giá năng lực</span>
            {quiz && (
              <Link
                className="button button-soft"
                to={`/learning/${quiz.courseId}`}
                style={{ fontSize: 13, textDecoration: 'none', padding: '6px 14px' }}
              >
                ← Quay lại khóa học
              </Link>
            )}
          </div>

          <h1 className="quiz-header-title">{quiz?.title ?? `Quiz #${quizId}`}</h1>
          {quiz?.description && <p className="quiz-header-desc">{quiz.description}</p>}

          {quiz && (
            <div className="quiz-overview-badges quiz-overview">
              <span className="quiz-stat-pill">
                📋 <strong>{totalQuestions}</strong> câu hỏi
              </span>
              <span className="quiz-stat-pill is-pass">
                🎯 Điểm đạt: <strong>{quiz.passingScore}%</strong>
              </span>
              {quiz.timeLimitMinutes && (
                <span className="quiz-stat-pill is-timer">
                  ⏱️ Thời gian: <strong>{quiz.timeLimitMinutes} phút</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <ErrorState
            error={error}
            title={
              error.status === 403 ? 'Bạn chưa có quyền làm bài kiểm tra này' : 'Không thể xử lý bài kiểm tra'
            }
            onRetry={!quiz ? () => setRetry(value => value + 1) : undefined}
          />
        )}

        {loading && <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>Đang tải bài kiểm tra...</p>}

        {quiz && (
          <>
            {!attempt || remaining === 0 ? (
              <div className="quiz-start-hero quiz-start">
                <span className="quiz-start-icon">🎯</span>
                <h3>Sẵn sàng làm bài kiểm tra?</h3>
                <p>
                  Hãy đọc kỹ từng câu hỏi và chọn câu trả lời đúng nhất. Hệ thống sẽ lưu nháp câu trả lời của bạn trong suốt quá trình làm bài.
                </p>
                {remaining === 0 && (
                  <Alert severity="warning" style={{ marginBottom: 20, textAlign: 'left' }}>
                    Đã hết thời gian làm bài ở lượt trước. Hãy bắt đầu một lượt làm bài mới.
                  </Alert>
                )}
                <Button
                  variant="contained"
                  onClick={start}
                  disabled={busy}
                  className="quiz-start-btn"
                >
                  {remaining === 0 ? 'Làm lượt mới' : 'Bắt đầu làm bài'}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="quiz-taking-form">
                {/* Sticky Progress & Timer Bar */}
                <div className="quiz-taking-sticky-bar">
                  <div className="quiz-taking-toolbar">
                    <span className="quiz-progress-text">
                      📊 Đã trả lời: <strong>{answeredCount}/{totalQuestions}</strong> câu ({progressPercent}%)
                    </span>
                    {remaining != null && (
                      <span className="quiz-timer-clock" aria-live="polite">
                        ⏱️ Còn {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  <ProgressBar value={progressPercent} />
                </div>

                {/* Questions List */}
                {quiz.questions.map((question, index) => {
                  const selectedOptions = answers[question.id] ?? [];
                  const isAnswered = selectedOptions.length > 0;

                  return (
                    <div
                      className="quiz-taking-question"
                      key={question.id}
                      style={{
                        borderColor: isAnswered ? '#93c5fd' : '#e2e8f0',
                      }}
                    >
                      <div className="quiz-question-header">
                        <span className="quiz-question-number">Câu {index + 1}</span>
                        <span className="quiz-question-points">{question.points} điểm</span>
                      </div>

                      <h2 className="quiz-question-title">{question.questionText}</h2>
                      <div className="quiz-question-hint">
                        {question.questionType === 'MULTIPLE_CHOICE'
                          ? '☑️ Chọn các đáp án đúng (có thể chọn nhiều)'
                          : '🔘 Chọn một đáp án đúng nhất'}
                      </div>

                      <div className="quiz-options-group">
                        {question.options.map((option, optIdx) => {
                          const isSelected = selectedOptions.includes(option.id);
                          const letter = OPTION_LETTERS[optIdx % OPTION_LETTERS.length];

                          return (
                            <label
                              key={option.id}
                              className={`quiz-taking-option ${isSelected ? 'is-selected' : ''}`}
                            >
                              <div className="quiz-option-content">
                                <span className="quiz-option-letter">{letter}</span>
                                <span className="quiz-option-text">{option.optionText}</span>
                              </div>
                              <FormControlLabel
                                style={{ margin: 0 }}
                                label=""
                                control={
                                  question.questionType === 'MULTIPLE_CHOICE' ? (
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={event => choose(question, option.id, event.target.checked)}
                                      color="primary"
                                    />
                                  ) : (
                                    <Radio
                                      checked={isSelected}
                                      onChange={() => choose(question, option.id, true)}
                                      color="primary"
                                    />
                                  )
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Submit Area */}
                <div className="quiz-submit-box">
                  <p className="quiz-submit-hint">
                    {answeredCount < totalQuestions
                      ? `⚠️ Bạn mới hoàn thành ${answeredCount}/${totalQuestions} câu hỏi. Hãy kiểm tra lại trước khi nộp.`
                      : '🎉 Bạn đã trả lời tất cả các câu hỏi! Sẵn sàng nộp bài.'}
                  </p>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={busy || remaining === 0}
                    className="quiz-submit-btn"
                  >
                    {busy ? 'Đang nộp bài...' : '🚀 Nộp bài'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function QuizPage() {
  const { quizId } = useParams();
  const { user } = useAuth();
  return <QuizWorkspace key={`${user?.id}:${quizId}`} quizId={quizId} userId={user?.id} />;
}
