import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, Radio } from '@mui/material';
import ErrorState from '../../../shared/components/ErrorState';
import { learningApi } from '../api/learningApi';
import useAuth from '../../auth/hooks/useAuth';
import { clearQuizDraft, quizDraftKey, readQuizDraft, writeQuizDraft } from '../utils/quizDraft';
import '../styles/quiz.css';

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const draftKey = quizDraftKey(user?.id, quizId);
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    learningApi
      .getQuiz(quizId)
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
  }, [quizId]);

  useEffect(() => {
    if (!attempt || !quiz?.timeLimitMinutes) return undefined;
    const deadline = new Date(attempt.startedAt).getTime() + quiz.timeLimitMinutes * 60000;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
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
    setBusy(true);
    setError(null);
    try {
      const response = await learningApi.startQuiz(quizId);
      setAnswers(readQuizDraft(draftKey, response.data.attemptId, quiz));
      setAttempt(response.data);
      setRemaining(null);
    } catch (startError) {
      setError(startError);
    } finally {
      setBusy(false);
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
        [question.id]: checked ? [...current, optionId] : current.filter(id => id !== optionId),
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!attempt || busy || remaining === 0) return;
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
      clearQuizDraft(draftKey);
      navigate(`/quizzes/attempts/${response.data.attemptId}/result`);
    } catch (submitError) {
      setError(submitError);
    } finally {
      setBusy(false);
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
        {error && <ErrorState error={error} title="Không thể xử lý bài kiểm tra" />}
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
