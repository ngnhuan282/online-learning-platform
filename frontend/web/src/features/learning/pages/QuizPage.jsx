import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, Radio } from '@mui/material';
import ErrorState from '../../../shared/components/ErrorState';
import { learningApi } from '../api/learningApi';
import useAuth from '../../auth/hooks/useAuth';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { clearQuizDraft, quizDraftKey, readQuizDraft, writeQuizDraft } from '../utils/quizDraft';
import '../styles/quiz.css';

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

  return (
    <section className="learning-page">
      <div className="learning-shell quiz-workspace">
        <div className="learning-page-header">
          <div>
            <p>Quiz</p>
            <h1>{quiz?.title ?? `Quiz #${quizId}`}</h1>
          </div>
          {quiz && (
            <Link className="button button-outline" to={`/learning/${quiz.courseId}`}>
              Quay lại khóa học
            </Link>
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
        {loading && <p>Đang tải quiz...</p>}
        {quiz && (
          <>
            <div className="quiz-overview">
              {quiz.description && <p>{quiz.description}</p>}
              <span>{quiz.questions.length} câu hỏi</span>
              <span>Điểm đạt: {quiz.passingScore}%</span>
              {quiz.timeLimitMinutes && <span>Thời gian: {quiz.timeLimitMinutes} phút</span>}
            </div>
            {!attempt || remaining === 0 ? (
              <div className="quiz-start">
                {remaining === 0 && <Alert severity="warning">Đã hết thời gian làm bài.</Alert>}
                <Button variant="contained" onClick={start} disabled={busy}>
                  {remaining === 0 ? 'Làm lượt mới' : 'Bắt đầu làm bài'}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="quiz-taking-form">
                <div className="quiz-taking-toolbar">
                  <span>
                    Đã trả lời: {Object.values(answers).filter(ids => ids.length).length}/
                    {quiz.questions.length}
                  </span>
                  {remaining != null && (
                    <strong aria-live="polite">
                      Còn {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                    </strong>
                  )}
                </div>
                {quiz.questions.map((question, index) => (
                  <fieldset className="quiz-taking-question" key={question.id} disabled={busy}>
                    <legend>
                      Câu {index + 1} · {question.points} điểm
                    </legend>
                    <h2>{question.questionText}</h2>
                    <p>
                      {question.questionType === 'MULTIPLE_CHOICE'
                        ? 'Chọn các đáp án đúng'
                        : 'Chọn một đáp án'}
                    </p>
                    {question.options.map(option => (
                      <FormControlLabel
                        key={option.id}
                        className="quiz-taking-option"
                        label={option.optionText}
                        control={
                          question.questionType === 'MULTIPLE_CHOICE' ? (
                            <Checkbox
                              checked={(answers[question.id] ?? []).includes(option.id)}
                              onChange={event => choose(question, option.id, event.target.checked)}
                            />
                          ) : (
                            <Radio
                              checked={(answers[question.id] ?? []).includes(option.id)}
                              onChange={() => choose(question, option.id, true)}
                            />
                          )
                        }
                      />
                    ))}
                  </fieldset>
                ))}
                <Button type="submit" variant="contained" disabled={busy || remaining === 0}>
                  {busy ? 'Đang nộp...' : 'Nộp bài'}
                </Button>
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
