import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import ErrorState from '../../../shared/components/ErrorState';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { readStorage, writeStorage, removeStorage } from '../../../shared/utils/storage';
import useAuth from '../../auth/hooks/useAuth';
import { toeicApi } from '../api/toeicApi';
import ToeicQuestion from '../components/ToeicQuestion';
import { isListeningPart } from '../utils/toeicSections';
import StudyTextAssistant from '../components/StudyTextAssistant';

const timeLeft = (deadline, offset) =>
  deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - Date.now() - offset) / 1000)) : null;
const clockText = seconds =>
  seconds == null
    ? ''
    : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
function readDraft(key, questions) {
  try {
    const draft = JSON.parse(readStorage(key));
    if (!draft?.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)) return null;
    const allowed = new Map(
      questions.map(question => [question.id, new Set(question.options.map(option => option.id))]),
    );
    if (Object.entries(draft.answers).some(([id, option]) => !allowed.get(id)?.has(option))) return null;
    return draft.answers;
  } catch {
    return null;
  }
}

function useAttemptSession(attemptId, userId, navigate) {
  const sessionVersion = getSessionVersion();
  const key = `${attemptId}:${userId}:${sessionVersion}`;
  const draftKey = `chitchatgo.toeic.attempt:${userId}:${attemptId}`;
  const [state, setState] = useState({ key: '', loading: true, attempt: null, answers: {}, error: null });
  const [retry, setRetry] = useState(0);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [saveError, setSaveError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const generation = useRef(0);
  const active = useRef(false);
  const loaded = useRef(null);
  const answers = useRef({});
  const editVersion = useRef(0);
  const savedVersion = useRef(0);
  const flight = useRef(null);
  const debounce = useRef(null);
  const sealed = useRef(false);
  const offset = useRef(0);
  const expiryStarted = useRef(false);
  const current = useCallback(
    captured => active.current && generation.current === captured && getSessionVersion() === sessionVersion,
    [sessionVersion],
  );
  const finish = useCallback(
    data => {
      removeStorage(draftKey);
      navigate(`/exams/toeic/attempts/${data.id}/result`, { replace: true });
    },
    [draftKey, navigate],
  );

  const flush = useCallback(() => {
    if (flight.current) return flight.current;
    if (!loaded.current || sealed.current || savedVersion.current >= editVersion.current)
      return Promise.resolve();
    const captured = generation.current;
    const operation = (async () => {
      while (current(captured) && !sealed.current && savedVersion.current < editVersion.current) {
        const sendingVersion = editVersion.current;
        const payload = { ...answers.current };
        setSaveStatus('saving');
        setSaveError(null);
        try {
          const response = await toeicApi.saveAnswers(attemptId, payload);
          if (!current(captured)) return;
          if (response.data.status === 'GRADED') {
            sealed.current = true;
            finish(response.data);
            return;
          }
          if (response.data.serverNow) offset.current = Date.parse(response.data.serverNow) - Date.now();
          savedVersion.current = sendingVersion;
          if (sendingVersion === editVersion.current) removeStorage(draftKey);
          setSaveStatus(savedVersion.current === editVersion.current ? 'saved' : 'pending');
        } catch (failure) {
          if (current(captured)) {
            setSaveStatus('error');
            setSaveError(failure);
          }
          throw failure;
        }
      }
    })();
    flight.current = operation;
    operation
      .finally(() => {
        if (flight.current === operation) flight.current = null;
      })
      .catch(() => {});
    return operation;
  }, [attemptId, current, draftKey, finish]);

  useEffect(() => {
    const captured = ++generation.current;
    const controller = new AbortController();
    active.current = true;
    loaded.current = null;
    answers.current = {};
    editVersion.current = 0;
    savedVersion.current = 0;
    flight.current = null;
    sealed.current = false;
    expiryStarted.current = false;
    Promise.resolve()
      .then(() => {
        if (!current(captured)) return null;
        setState({ key, loading: true, attempt: null, answers: {}, error: null });
        setSaveStatus('saved');
        setSaveError(null);
        setSubmitError(null);
        setSubmitting(false);
        return toeicApi.attempt(attemptId, { signal: controller.signal });
      })
      .then(response => {
        if (!response || !current(captured)) return;
        const attempt = response.data;
        if (attempt.status === 'GRADED') {
          finish(attempt);
          return;
        }
        offset.current = attempt.serverNow ? Date.parse(attempt.serverNow) - Date.now() : 0;
        const canRestore = !attempt.deadlineAt || timeLeft(attempt.deadlineAt, offset.current) > 0;
        const draft = canRestore ? readDraft(draftKey, attempt.questions) : null;
        answers.current = draft ?? attempt.answers ?? {};
        loaded.current = attempt;
        setRemaining(timeLeft(attempt.deadlineAt, offset.current));
        setState({ key, loading: false, attempt, answers: answers.current, error: null });
        if (draft) {
          editVersion.current = 1;
          setSaveStatus('pending');
          debounce.current = window.setTimeout(() => {
            void flush().catch(() => {});
          }, 100);
        }
      })
      .catch(failure => {
        if (current(captured)) setState({ key, loading: false, attempt: null, answers: {}, error: failure });
      });
    return () => {
      active.current = false;
      controller.abort();
      window.clearTimeout(debounce.current);
    };
  }, [attemptId, current, draftKey, finish, flush, key, retry]);

  const submit = useCallback(async () => {
    if (sealed.current || !loaded.current) return;
    const captured = generation.current;
    sealed.current = true;
    window.clearTimeout(debounce.current);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Wait for an in-flight save so it cannot arrive after the final submission.
      await flight.current?.catch(() => {});
      if (!current(captured)) return;
      const response = await toeicApi.submit(attemptId, { ...answers.current });
      if (current(captured)) finish(response.data);
    } catch (failure) {
      if (current(captured)) {
        sealed.current = false;
        setSubmitting(false);
        setSubmitError(failure);
      }
    }
  }, [attemptId, current, finish]);

  const leave = useCallback(async () => {
    const captured = generation.current;
    await flush();
    if (current(captured) && !sealed.current && loaded.current) {
      navigate(`/exams/toeic/tests/${loaded.current.examId}`);
    }
  }, [current, flush, navigate]);

  useEffect(() => {
    const deadline = state.key === key ? state.attempt?.deadlineAt : null;
    if (!deadline) return undefined;
    function tick() {
      const left = timeLeft(deadline, offset.current);
      setRemaining(left);
      if (left === 0 && !expiryStarted.current) {
        expiryStarted.current = true;
        void submit();
      }
    }
    const interval = window.setInterval(tick, 1000);
    const immediate = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(immediate);
    };
  }, [key, state.key, state.attempt?.deadlineAt, submit]);

  useEffect(() => {
    const beforeUnload = event => {
      if (editVersion.current <= savedVersion.current || sealed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  function choose(questionId, optionId) {
    if (sealed.current || !loaded.current || (remaining != null && remaining <= 0)) return;
    const next = { ...answers.current };
    if (optionId) next[questionId] = optionId;
    else delete next[questionId];
    answers.current = next;
    editVersion.current++;
    writeStorage(draftKey, JSON.stringify({ answers: next }));
    setState(previous => ({ ...previous, answers: next }));
    setSaveStatus('pending');
    setSaveError(null);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      void flush().catch(() => {});
    }, 500);
  }
  const visible = state.key === key ? state : { loading: true, attempt: null, answers: {}, error: null };
  return {
    ...visible,
    remaining,
    saveStatus,
    saveError,
    submitError,
    submitting,
    choose,
    flush,
    submit,
    leave,
    reload: () => setRetry(value => value + 1),
  };
}

export default function ToeicAttemptPage() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  return <AttemptWorkspace key={`${attemptId}:${user?.id}`} attemptId={attemptId} userId={user?.id} />;
}

function AttemptWorkspace({ attemptId, userId }) {
  useLocale();
  const navigate = useNavigate();
  const session = useAttemptSession(attemptId, userId, navigate);
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [revealedIds, setRevealedIds] = useState({});
  const [autoReveal, setAutoReveal] = useState(false);

  const questions = session.attempt?.questions ?? [];
  const currentIndex = Math.min(index, Math.max(questions.length - 1, 0));
  const question = questions[currentIndex];
  const answered = questions.filter(item => session.answers[item.id]).length;
  const expired = session.remaining === 0;
  const blocked = session.submitting || expired;
  const isPractice = session.attempt?.mode === 'PRACTICE';
  const canRevealAnswer = isPractice && Boolean(question?.correctOptionId);
  const isRevealed = questionId =>
    isPractice && Boolean(revealedIds[questionId] || (autoReveal && session.answers[questionId]));
  const currentRevealed = question ? isRevealed(question.id) : false;

  async function leave() {
    setLeaving(true);
    try {
      await session.leave();
    } catch {
      setLeaving(false);
    }
  }

  function toggleCurrentAnswer() {
    if (!question || !canRevealAnswer) return;
    setRevealedIds(previous => {
      const currentlyShown = Boolean(previous[question.id] || (autoReveal && session.answers[question.id]));
      if (currentlyShown && autoReveal) setAutoReveal(false);
      return { ...previous, [question.id]: !currentlyShown };
    });
  }

  if (session.loading)
    return (
      <p className="toeic-loading" role="status">
        {t('Đang khôi phục bài làm...')}
      </p>
    );
  if (session.error) return <ErrorState error={session.error} onRetry={session.reload} />;
  if (!session.attempt || !question)
    return (
      <div className="toeic-empty">
        <h1>{t('Bài làm không có câu hỏi')}</h1>
        <Link to="/exams/toeic">{t('Về thư viện TOEIC')}</Link>
      </div>
    );
  const listening = isListeningPart(question.part);
  const answerToggle = canRevealAnswer && (
    <button
      type="button"
      className={`toeic-button ${listening || !currentRevealed ? 'toeic-button-outline' : 'button-primary'}`}
      aria-expanded={currentRevealed}
      onClick={toggleCurrentAnswer}
    >
      {currentRevealed ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
      {t(currentRevealed ? 'Ẩn đáp án' : listening ? 'Hiện đáp án' : 'Xem đáp án & lời giải')}
    </button>
  );
  const questionCard = (
    <ToeicQuestion
      question={question}
      selected={session.answers[question.id]}
      onSelect={option => session.choose(question.id, option)}
      disabled={blocked}
      showAnswer={currentRevealed}
      answerToggle={listening ? answerToggle : null}
      showTranscript={isPractice}
      groupQuestions={questions}
    />
  );
  return (
    <>
      <header className="toeic-attempt-heading">
        <div>
          <span className={`toeic-eyebrow ${session.attempt.mode === 'EXAM' ? 'is-exam-badge' : ''}`}>
            {session.attempt.mode === 'EXAM'
              ? t(listening ? 'THI THỬ · LISTENING' : 'THI THỰC CHIẾN · READING')
              : session.attempt.part
                ? `${t('CHẾ ĐỘ LUYỆN TẬP')} · Part ${session.attempt.part}`
                : t(listening ? 'CHẾ ĐỘ LUYỆN TẬP · LISTENING' : 'CHẾ ĐỘ LUYỆN TẬP · READING')}
          </span>
          <h1>{session.attempt.title}</h1>
          <p>{t('{answered}/{total} câu đã trả lời', { answered, total: questions.length })}</p>
        </div>
        <div
          className={`toeic-exam-clock ${session.remaining != null && session.remaining < 300 ? 'is-urgent' : ''}`}
        >
          <AccessTimeRounded />
          <strong role="timer" aria-label={t('Thời gian còn lại')}>
            {session.remaining == null ? t('Không giới hạn') : clockText(session.remaining)}
          </strong>
        </div>
      </header>
      <div className="toeic-attempt-actions">
        <button
          type="button"
          className="toeic-text-link"
          disabled={session.submitting || leaving}
          onClick={leave}
        >
          <ArrowBackRounded fontSize="small" />
          {leaving ? t('Đang lưu...') : t('Lưu và về bộ đề')}
        </button>
        <span
          className={`toeic-save-state ${session.saveStatus === 'error' ? 'is-error' : ''}`}
          role="status"
        >
          {t(
            session.saveStatus === 'saved'
              ? 'Đã lưu đáp án'
              : session.saveStatus === 'error'
                ? 'Chưa lưu được đáp án'
                : 'Đang lưu đáp án...',
          )}
        </span>
      </div>
      {session.saveError && (
        <ErrorState
          error={session.saveError}
          title="Đáp án chưa đồng bộ, lựa chọn của bạn vẫn được giữ"
          onRetry={() => {
            void session.flush().catch(() => {});
          }}
        />
      )}
      {session.submitError && (
        <ErrorState
          error={session.submitError}
          title="Chưa nộp được bài, lựa chọn của bạn vẫn được giữ"
          onRetry={() => {
            void session.submit();
          }}
        />
      )}
      {expired && (
        <p className="toeic-expiry-note" role="alert">
          {t('Đã hết giờ. Hệ thống chấm những đáp án đã được lưu trước thời hạn.')}
        </p>
      )}
      <div className="toeic-attempt-layout">
        <div className="toeic-question-stage">
          {listening ? (
            questionCard
          ) : (
            <StudyTextAssistant
              allowNotes
              examId={session.attempt.examId}
              attemptId={session.attempt.id}
              questionNumber={question.number}
              part={question.part}
            >
              {questionCard}
            </StudyTextAssistant>
          )}
          {!listening && answerToggle && (
            <div className="toeic-practice-reveal-bar">
              {answerToggle}
              <label className="toeic-auto-reveal-toggle">
                <input
                  type="checkbox"
                  checked={autoReveal}
                  onChange={event => setAutoReveal(event.target.checked)}
                />
                <span>{t('Tự động hiện đáp án sau khi chọn')}</span>
              </label>
            </div>
          )}
          <div className="toeic-question-actions">
            <button
              type="button"
              className="toeic-text-link"
              disabled={blocked || !session.answers[question.id]}
              onClick={() => session.choose(question.id, null)}
            >
              {t('Xóa lựa chọn')}
            </button>
            <span>
              {t('Câu {current} / {total}', { current: currentIndex + 1, total: questions.length })}
            </span>
          </div>
          <nav className="toeic-question-navigation" aria-label={t('Điều hướng câu hỏi')}>
            <button
              type="button"
              className="toeic-button toeic-button-outline"
              disabled={currentIndex === 0}
              onClick={() => setIndex(currentIndex - 1)}
            >
              <ArrowBackRounded fontSize="small" />
              {t('Câu trước')}
            </button>
            <button
              type="button"
              className="toeic-button toeic-button-outline"
              disabled={currentIndex === questions.length - 1}
              onClick={() => setIndex(currentIndex + 1)}
            >
              {t('Câu tiếp')}
              <ArrowForwardRounded fontSize="small" />
            </button>
          </nav>
        </div>
        <aside className="toeic-attempt-sidebar">
          <section>
            <h2>{t('Các câu hỏi')}</h2>
            <label className="toeic-unanswered-filter">
              <input
                type="checkbox"
                checked={onlyUnanswered}
                onChange={event => setOnlyUnanswered(event.target.checked)}
              />
              {t('Chỉ hiện câu chưa trả lời')}
            </label>
            <div className="toeic-question-palette">
              {questions.map((item, position) => {
                if (onlyUnanswered && session.answers[item.id]) return null;
                const shown = isRevealed(item.id) && item.correctOptionId;
                const toneClass = shown
                  ? session.answers[item.id] === item.correctOptionId
                    ? 'is-correct'
                    : session.answers[item.id]
                      ? 'is-wrong'
                      : ''
                  : session.answers[item.id]
                    ? 'is-answered'
                    : '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${toneClass} ${position === currentIndex ? 'is-current' : ''}`}
                    aria-label={t('Đến câu {number}', { number: item.number })}
                    aria-current={position === currentIndex ? 'step' : undefined}
                    onClick={() => setIndex(position)}
                  >
                    {item.number}
                  </button>
                );
              })}
            </div>
            <p className="toeic-question-legend">
              <i />
              {t('Đã trả lời')} · {t('{count} câu chưa trả lời', { count: questions.length - answered })}
            </p>
          </section>
          <button
            type="button"
            className="toeic-button button-primary"
            disabled={session.submitting}
            onClick={() => setConfirm(true)}
          >
            <CheckCircleOutlineOutlined fontSize="small" />
            {session.submitting ? t('Đang nộp bài...') : t('Nộp bài')}
          </button>
          <p className="toeic-attempt-note">
            {listening
              ? t(
                  isPractice
                    ? 'Đáp án và transcript mở riêng theo từng đoạn nghe.'
                    : 'Đáp án và transcript mở sau khi nộp bài.',
                )
              : session.attempt.mode === 'EXAM'
                ? t(
                    'Chế độ thi thực chiến: Không xem đáp án giữa chừng. Điểm số và lời giải chi tiết chỉ mở sau khi nộp bài.',
                  )
                : t(
                    'Chế độ luyện tập: Bạn có thể xem đáp án và lời giải ngay trên từng câu hoặc sau khi nộp bài.',
                  )}
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        title={listening ? 'Nộp bài Listening?' : 'Nộp bài Reading?'}
        description={
          answered < questions.length
            ? t('Bạn còn {count} câu chưa trả lời. Các câu bỏ trống không được tính điểm.', {
                count: questions.length - answered,
              })
            : t(
                listening
                  ? 'Sau khi nộp bài, bạn có thể nghe lại và đối chiếu đáp án.'
                  : 'Sau khi nộp bài, bạn có thể xem điểm và lời giải cho từng câu.',
              )
        }
        confirmLabel={t('Xác nhận nộp bài')}
        onClose={() => setConfirm(false)}
        pending={session.submitting}
        onConfirm={() => {
          setConfirm(false);
          void session.submit();
        }}
      />
    </>
  );
}
