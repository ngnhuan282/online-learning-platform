import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Skeleton,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  CheckRounded,
  CheckCircleOutlineRounded,
  ExpandMoreRounded,
  ErrorOutlineRounded,
  HeadphonesOutlined,
  ListAltOutlined,
  LightbulbOutlined,
  PlayArrowRounded,
  ReplayRounded,
  VisibilityOutlined,
} from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import ErrorState from '../../../shared/components/ErrorState';
import { dictationApi } from '../api/dictationApi';
import { useDictationAudio } from '../hooks/useDictationQuery';
import SegmentPlayer from '../components/SegmentPlayer';
import YouTubeSegmentPlayer from '../components/YouTubeSegmentPlayer';
import DictationScore from '../components/DictationScore';
import {
  formatTime,
  isCurrentGrade,
  isSentenceLocked,
  maskedWords,
  scoreFeedback,
  sentenceState,
  wordFeedback,
  youtubeVideoId,
} from '../utils/dictation';
import '../styles/dictation.css';

const stateLabel = {
  new: 'Chưa luyện',
  done: 'Đã hoàn thành',
};

export default function DictationPracticePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const attemptId = params.get('attempt');
  return <Practice key={`${id}-${attemptId ?? 'new'}`} exerciseId={id} attemptId={attemptId} />;
}

function Practice({ exerciseId, attemptId }) {
  useLocale();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [initialError, setInitialError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [listOpen, setListOpen] = useState(true);
  const [seekRequest, setSeekRequest] = useState({ key: 0, play: false });
  const [confirmation, setConfirmation] = useState(null);
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(false);
  const draft = useRef({ index: 0, text: '', dirty: false });
  const saveFlight = useRef(Promise.resolve());
  const queuedDraft = useRef(null);
  const requestId = useRef(crypto.randomUUID());
  const sentenceList = useRef(null);
  const confirmCancel = useRef(null);
  const composing = useRef(false);
  const timer = useRef(null);
  const video = attempt?.video;
  const youtubeId = youtubeVideoId(video?.url);
  const audio = useDictationAudio(video ? null : attempt?.id);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search) &&
      (draft.current.dirty || queuedDraft.current !== null),
  );

  useEffect(() => {
    const list = sentenceList.current;
    const selected = list?.querySelector('[aria-current="step"]');
    if (!selected || !list.clientHeight) return;
    const bounds = list.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    if (row.top < bounds.top) list.scrollTop += row.top - bounds.top - 8;
    else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom + 8;
  }, [index, listOpen, attempt?.id]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const load = attemptId
      ? dictationApi.query(dictationApi.attemptPath(attemptId))
      : dictationApi.start(exerciseId, { requestId: requestId.current, restart: false });
    load
      .then(({ data }) => {
        if (!active) return;
        if (data.exerciseId !== exerciseId) throw new Error(t('Lượt luyện không thuộc bài nghe này.'));
        if (!attemptId) {
          navigate(`/dictation/${exerciseId}?attempt=${data.id}`, { replace: true });
          return;
        }
        setAttempt(data);
        setIndex(data.currentIndex);
        setText(data.responses[data.currentIndex]?.text ?? '');
        draft.current = {
          index: data.currentIndex,
          text: data.responses[data.currentIndex]?.text ?? '',
          dirty: false,
        };
        setInitialError(null);
      })
      .catch(reason => {
        if (active) setInitialError(reason);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [exerciseId, attemptId, navigate, retry]);

  function handleArchived(reason) {
    if (reason?.code !== 'DICTATION_ARCHIVED') return false;
    clearTimeout(timer.current);
    timer.current = null;
    draft.current.dirty = false;
    queuedDraft.current = null;
    if (mounted.current) setInitialError(reason);
    return true;
  }

  // Live feedback, hints and navigation share one write queue to preserve word credit and answer order.
  function saveDraft() {
    const snapshot = { ...draft.current };
    if (!snapshot.dirty || !attempt || attempt.completedAt) return saveFlight.current;
    const fingerprint = JSON.stringify([snapshot.index, snapshot.text]);
    if (queuedDraft.current === fingerprint) return saveFlight.current;
    queuedDraft.current = fingerprint;
    const flight = saveFlight.current
      .catch(() => {})
      .then(previous => {
        if (previous?.data?.responses[snapshot.index]?.completed) return previous;
        return dictationApi.progress(attempt.id, { index: snapshot.index, text: snapshot.text });
      });
    saveFlight.current = flight;
    let successful = false;
    if (mounted.current) setSaveState('Đang lưu');
    flight
      .then(({ data }) => {
        successful = true;
        const response = data.responses[snapshot.index];
        if (response.completed && draft.current.index === snapshot.index) {
          clearTimeout(timer.current);
          timer.current = null;
          draft.current = { index: snapshot.index, text: response.text, dirty: false };
          if (mounted.current) {
            setText(response.text);
            setSaveState('Đã lưu');
          }
        }
        if (draft.current.index === snapshot.index && draft.current.text === snapshot.text) {
          draft.current.dirty = false;
          if (mounted.current) setSaveState('Đã lưu');
        }
        // Awaiting navigation can resume before the chained finally callback.
        if (queuedDraft.current === fingerprint) queuedDraft.current = null;
        if (mounted.current) setAttempt(data);
      })
      .catch(reason => {
        if (handleArchived(reason)) return;
        if (draft.current.index === snapshot.index && draft.current.text === snapshot.text)
          draft.current.dirty = true;
        if (mounted.current) setSaveState('Chưa lưu được');
      })
      .finally(() => {
        if (queuedDraft.current === fingerprint) queuedDraft.current = null;
        if (successful && mounted.current && draft.current.dirty && !pending.current) scheduleSave();
      });
    return flight;
  }

  useEffect(() => {
    if (!attempt || attempt.completedAt) return;
    const warn = event => {
      if (draft.current.dirty || pending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [attempt]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function scheduleSave() {
    if (composing.current || timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (queuedDraft.current === null) saveDraft().catch(() => {});
    }, 200);
  }

  function updateText(value) {
    if (isSentenceLocked(attempt.responses[index])) return;
    setText(value);
    setError(null);
    draft.current = { index, text: value, dirty: true };
    setSaveState('Chưa lưu');
    scheduleSave();
  }

  async function action(operation) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    clearTimeout(timer.current);
    timer.current = null;
    try {
      await saveDraft();
      const data = await operation();
      if (mounted.current && data) setAttempt(data);
    } catch (reason) {
      if (!handleArchived(reason) && mounted.current) setError(reason);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function select(next, playAudio = false) {
    if (next < 0 || next >= attempt.sentences.length) return;
    if (next === index) {
      setSeekRequest(value => ({ key: value.key + 1, play: playAudio }));
      return;
    }
    action(async () => {
      const nextText = attempt.responses[next]?.text ?? '';
      if (!attempt.completedAt) {
        const { data } = await dictationApi.progress(attempt.id, { index: next, text: nextText });
        if (mounted.current) setAttempt(data);
      }
      if (!mounted.current) return;
      setIndex(next);
      setSeekRequest(value => ({ key: value.key + 1, play: playAudio }));
      setText(nextText);
      draft.current = { index: next, text: nextText, dirty: false };
    });
  }

  const accessError =
    initialError ?? (!video && audio.error?.code === 'DICTATION_ARCHIVED' ? audio.error : null);
  if (accessError)
    return (
      <section className="dictation-page">
        <div className="container dictation-shell">
          <div className="dictation-back-row">
            <Button component={Link} to="/dictation" variant="outlined" startIcon={<ArrowBackRounded />}>
              {t('Thư viện bài nghe')}
            </Button>
          </div>
          <ErrorState
            error={
              accessError.code === 'DICTATION_ARCHIVED'
                ? { message: 'Bài nghe hiện không khả dụng. Tiến độ của bạn vẫn được lưu.' }
                : accessError
            }
            title={
              accessError.code === 'DICTATION_ARCHIVED' ? 'Hiện không khả dụng' : 'Không thể tải dữ liệu'
            }
            onRetry={() => setRetry(value => value + 1)}
          />
        </div>
      </section>
    );
  if (!attempt)
    return (
      <section className="dictation-page">
        <div className="container dictation-shell">
          <Skeleton height={90} />
          <Skeleton variant="rounded" height={460} />
        </div>
      </section>
    );
  const current = attempt.responses[index];
  const segment = attempt.sentences[index];
  const finished = Boolean(attempt.completedAt);
  const feedback = scoreFeedback(attempt.accuracy);
  const sentenceLocked = isSentenceLocked(current);
  const grade = isCurrentGrade(text, current.grade) ? current.grade : null;
  const state = sentenceState(current);
  const percent = (attempt.completed / attempt.sentences.length) * 100;
  const words = wordFeedback(segment, current, text);
  const confirmationCopy = {
    reveal: {
      title: 'Xem đáp án câu này?',
      description: 'Các từ chưa tự điền đúng sẽ không được tính điểm khi xem đáp án.',
      label: 'Xem đáp án',
      icon: <VisibilityOutlined />,
    },
    finish: {
      title: 'Hoàn thành bài nghe?',
      description: 'Kết quả lượt luyện này sẽ được lưu và không thể chỉnh sửa.',
      label: 'Hoàn thành bài nghe',
      icon: <CheckCircleOutlineRounded />,
    },
    restart: {
      title: 'Luyện lại bài nghe?',
      description: 'Tiến độ sẽ bắt đầu lại từ đầu. Bài nghe sẽ chuyển về Đang luyện.',
      label: 'Luyện lại',
      icon: <ReplayRounded />,
    },
  }[confirmation?.type ?? 'reveal'];

  function confirmAction() {
    if (!confirmation?.open || pending.current) return;
    const target = confirmation;
    closeConfirmation();
    action(async () => {
      if (target.type === 'reveal') return (await dictationApi.reveal(attempt.id, target.index)).data;
      if (target.type === 'finish') return (await dictationApi.finish(attempt.id)).data;
      const { data } = await dictationApi.start(exerciseId, {
        requestId: crypto.randomUUID(),
        restart: true,
      });
      if (mounted.current) navigate(`/dictation/${exerciseId}?attempt=${data.id}`);
    });
  }

  function closeConfirmation() {
    setConfirmation(value => value && { ...value, open: false });
  }

  return (
    <section className="dictation-page">
      <div className="container dictation-shell">
        <div className="dictation-back-row">
          <span>
            <HeadphonesOutlined />
            {t('Luyện nghe')}
          </span>
        </div>
        <header className="dictation-heading dictation-practice-heading">
          <div>
            <div className="dictation-inline-meta">
              <Chip size="small" label={attempt.level} />
              <span>{attempt.topic}</span>
              <span>{formatTime(attempt.duration)}</span>
            </div>
            <h1>{attempt.title}</h1>
          </div>
          <Button
            className="dictation-library-link"
            component={Link}
            to="/dictation"
            variant="outlined"
            startIcon={<ArrowBackRounded />}
            disabled={busy}
            onClick={event => {
              if (!finished && (draft.current.dirty || saveState === 'Đang lưu')) {
                event.preventDefault();
                action(async () => {
                  navigate('/dictation');
                });
              }
            }}
          >
            {t('Thư viện bài nghe')}
          </Button>
        </header>
        {attempt.archived && finished && (
          <Alert severity="info">{t('Bài nghe hiện không khả dụng. Kết quả của bạn vẫn được lưu.')}</Alert>
        )}
        {finished && (
          <div className="dictation-result-band">
            <div className="dictation-result-score">
              <DictationScore attempt={attempt} />
              <span>{t('Điểm')}</span>
            </div>
            <div className="dictation-result-summary">
              <p className="dictation-result-status">
                <CheckCircleOutlineRounded fontSize="small" />
                {t('Đã hoàn thành bài nghe')}
              </p>
              <h2 className={`dictation-score-feedback dictation-score-tone is-${feedback.tone}`}>
                {t(feedback.label)}
              </h2>
              <p>
                {attempt.completed}/{attempt.sentences.length} {t('câu đã luyện')}
              </p>
            </div>
            {!attempt.archived && (
              <div className="dictation-result-actions">
                <Button
                  variant="contained"
                  startIcon={<ReplayRounded />}
                  disabled={busy}
                  onClick={() => setConfirmation({ type: 'restart', open: true })}
                >
                  {t('Luyện lại')}
                </Button>
              </div>
            )}
          </div>
        )}
        {!finished && (
          <>
            <div className="dictation-progress-header">
              <span>
                {attempt.completed}/{attempt.sentences.length} {t('câu đã luyện')}
              </span>
            </div>
            <LinearProgress aria-label={t('Tiến độ bài nghe')} variant="determinate" value={percent} />
          </>
        )}
        <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
          <DialogTitle>{t('Câu trả lời chưa lưu')}</DialogTitle>
          <DialogContent>{t('Lưu câu đang viết trước khi rời trang?')}</DialogContent>
          <DialogActions>
            <Button onClick={() => blocker.reset?.()}>{t('Tiếp tục luyện')}</Button>
            <Button onClick={() => blocker.proceed?.()}>{t('Rời trang')}</Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  blocker.proceed?.();
                })
              }
            >
              {t('Lưu và rời trang')}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          className="dictation-dialog dictation-scope"
          open={Boolean(confirmation?.open)}
          onClose={closeConfirmation}
          maxWidth="xs"
          fullWidth
          aria-labelledby="dictation-confirm-title"
          aria-describedby="dictation-confirm-description"
          slotProps={{ transition: { onEntered: () => confirmCancel.current?.focus() } }}
        >
          <DialogTitle id="dictation-confirm-title">{t(confirmationCopy.title)}</DialogTitle>
          <DialogContent>
            <p id="dictation-confirm-description">{t(confirmationCopy.description)}</p>
          </DialogContent>
          <DialogActions>
            <Button ref={confirmCancel} autoFocus onClick={closeConfirmation}>
              {t('Hủy')}
            </Button>
            <Button variant="contained" startIcon={confirmationCopy.icon} onClick={confirmAction}>
              {t(confirmationCopy.label)}
            </Button>
          </DialogActions>
        </Dialog>
        <div className={`dictation-studio${video ? ' has-video' : ''}`} id="dictation-studio">
          <aside className="dictation-media">
            <div className="dictation-panel-heading">
              {video ? <PlayArrowRounded fontSize="small" /> : <HeadphonesOutlined fontSize="small" />}
              <h2>{video ? 'Video' : 'Audio'}</h2>
              <span>{formatTime(attempt.duration)}</span>
            </div>
            {youtubeId ? (
              <YouTubeSegmentPlayer
                key={youtubeId}
                videoId={youtubeId}
                title={attempt.title}
                start={segment.start}
                end={segment.end}
                busy={busy}
                seekRequest={seekRequest}
                onNext={index < attempt.sentences.length - 1 ? () => select(index + 1, true) : undefined}
              />
            ) : !video && audio.error ? (
              <ErrorState title="Không tải được audio" error={audio.error} onRetry={audio.reload} />
            ) : (
              <SegmentPlayer
                key={video?.url ?? audio.src}
                src={video?.url ?? audio.src}
                video={Boolean(video)}
                start={segment.start}
                end={segment.end}
                duration={attempt.duration}
                disabled={!video && audio.loading}
                busy={busy}
                seekRequest={seekRequest}
                onNext={index < attempt.sentences.length - 1 ? () => select(index + 1, true) : undefined}
              />
            )}
            <div className="dictation-overview">
              <div className="dictation-overview-heading">
                <strong>{t('Tiến độ bài nghe')}</strong>
                <span>
                  {attempt.completed}/{attempt.sentences.length}
                </span>
              </div>
              <div className="dictation-number-grid">
                {attempt.sentences.map((_sentence, i) => (
                  <Tooltip
                    key={i}
                    title={`${t('Câu {index}', { index: i + 1 })} · ${t(stateLabel[sentenceState(attempt.responses[i])])}`}
                  >
                    <button
                      type="button"
                      aria-label={`${t('Đến câu')} ${i + 1}`}
                      aria-current={i === index ? 'step' : undefined}
                      className={`${sentenceState(attempt.responses[i])} ${i === index ? 'is-active' : ''}`}
                      disabled={busy}
                      onClick={() => select(i)}
                    >
                      {i + 1}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          </aside>
          <div className="dictation-workbench">
            <div className="dictation-sentence-heading">
              <span>
                {t('Câu {index}', { index: index + 1 })}
                <small> / {attempt.sentences.length}</small>
              </span>
              <Chip
                size="small"
                label={t(stateLabel[state])}
                color={state === 'new' ? 'default' : 'success'}
                variant="outlined"
              />
            </div>
            <div className="dictation-answer-area">
              <TextField
                fullWidth
                multiline
                minRows={5}
                placeholder={t('Nội dung bạn nghe được')}
                value={text}
                disabled={finished || busy}
                slotProps={{
                  htmlInput: {
                    maxLength: 2000,
                    spellCheck: false,
                    autoComplete: 'off',
                    'aria-label': t('Nội dung bạn nghe được'),
                  },
                  input: { readOnly: sentenceLocked },
                }}
                onChange={event => updateText(event.target.value)}
                onBlur={() => {
                  if (!pending.current) saveDraft().catch(() => {});
                }}
                onCompositionStart={() => {
                  composing.current = true;
                  clearTimeout(timer.current);
                  timer.current = null;
                }}
                onCompositionEnd={event => {
                  composing.current = false;
                  updateText(event.target.value);
                }}
              />
              <div className="dictation-input-meta">
                <span role="status" className={saveState === 'Chưa lưu được' ? 'dictation-save-error' : ''}>
                  {t(finished ? 'Đã hoàn thành' : saveState)}
                </span>
                <span>{text.length}/2000</span>
              </div>
              {error && <ErrorState error={error} />}
              {(!sentenceLocked || (!current.revealed && !current.skipped && !finished)) && (
                <div className="dictation-hints">
                  <div className="dictation-hint-heading">
                    <LightbulbOutlined fontSize="small" />
                    <strong>{t('Gợi ý từng từ')}</strong>
                    <span>
                      {words.filter(word => word.state === 'correct').length}/{segment.words}
                    </span>
                  </div>
                  <div className="dictation-hint-words">
                    {words.map((word, wordIndex) => {
                      const revealed = word.state === 'hinted';
                      const correct = word.state === 'correct';
                      return (
                        <Tooltip
                          key={wordIndex}
                          title={t(
                            correct
                              ? 'Đúng'
                              : revealed
                                ? 'Đã mở gợi ý'
                                : word.state === 'incorrect'
                                  ? 'Từ chưa đúng. Bấm để mở gợi ý (không tính điểm từ này).'
                                  : 'Mở từ này (không tính điểm từ đã mở)',
                          )}
                        >
                          <span>
                            <button
                              type="button"
                              className={`dictation-live-word is-${word.state}`}
                              style={{
                                minWidth: `${Math.min(12, segment.wordLengths?.[wordIndex] ?? 4) + 4}ch`,
                              }}
                              aria-label={`${t(correct ? 'Từ đúng' : revealed ? 'Đã mở từ' : 'Gợi ý từ')} ${wordIndex + 1}`}
                              disabled={busy || finished || revealed || correct}
                              onClick={() =>
                                action(
                                  async () => (await dictationApi.hint(attempt.id, index, wordIndex)).data,
                                )
                              }
                            >
                              {correct ? (
                                <CheckRounded />
                              ) : word.state === 'incorrect' ? (
                                <ErrorOutlineRounded />
                              ) : (
                                <VisibilityOutlined />
                              )}
                              {word.text}
                            </button>
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              )}
              {grade?.extra > 0 && !sentenceLocked && (
                <p className="dictation-extra-words" role="status">
                  {grade.extra} {t('từ dư')}
                </p>
              )}
              {current.answer && sentenceLocked && (current.revealed || current.skipped || finished) && (
                <div className="dictation-reference">
                  <span>{t('Transcript')}</span>
                  <p>{current.answer}</p>
                </div>
              )}
              {sentenceLocked && (
                <div className="dictation-sentence-success" role="status">
                  <CheckCircleOutlineRounded fontSize="small" />
                  {t(current.revealed || current.skipped ? 'Đã hoàn thành câu' : 'Chính xác')}
                </div>
              )}
              <div className="dictation-check-actions">
                {!finished && !sentenceLocked && (
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityOutlined />}
                    disabled={busy}
                    onClick={() => setConfirmation({ type: 'reveal', index, open: true })}
                  >
                    {t('Xem đáp án')}
                  </Button>
                )}
              </div>
            </div>
            <div className="dictation-navigation">
              <Button
                startIcon={<ArrowBackRounded />}
                disabled={!index || busy}
                onClick={() => select(index - 1)}
              >
                {t('Câu nghe trước')}
              </Button>
              {index < attempt.sentences.length - 1 ? (
                <Button endIcon={<ArrowForwardRounded />} disabled={busy} onClick={() => select(index + 1)}>
                  {t('Câu tiếp theo')}
                </Button>
              ) : (
                !finished && (
                  <Button
                    variant="contained"
                    endIcon={<CheckCircleOutlineRounded />}
                    disabled={busy || attempt.completed !== attempt.sentences.length}
                    onClick={() => setConfirmation({ type: 'finish', open: true })}
                  >
                    {t('Hoàn thành bài nghe')}
                  </Button>
                )
              )}
            </div>
          </div>
          <aside className={`dictation-sentences ${listOpen ? 'is-open' : ''}`}>
            <button
              className="dictation-list-heading"
              onClick={() => setListOpen(value => !value)}
              aria-expanded={listOpen}
            >
              <ListAltOutlined />
              <strong>{t('Transcript')}</strong>
              <span>{attempt.sentences.length}</span>
              <ExpandMoreRounded className="dictation-mobile-chevron" />
            </button>
            <div className="dictation-sentence-list" ref={sentenceList}>
              {attempt.sentences.map((sentence, i) => {
                const response = attempt.responses[i],
                  tone = sentenceState(response);
                return (
                  <button
                    key={i}
                    aria-label={`${t('Câu {index}', { index: i + 1 })} · ${formatTime(sentence.start)} · ${t(stateLabel[tone])}`}
                    aria-current={i === index ? 'step' : undefined}
                    className={`dictation-sentence ${tone} ${i === index ? 'is-active' : ''}`}
                    disabled={busy}
                    onClick={() => select(i, true)}
                  >
                    <span className="dictation-transcript-row-heading">
                      <span className="dictation-sentence-number">#{i + 1}</span>
                      <span className="dictation-sentence-time">{formatTime(sentence.start)}</span>
                      {tone === 'done' && <CheckRounded fontSize="small" />}
                    </span>
                    <strong className={response.answer ? '' : 'dictation-masked-text'}>
                      {response.answer || maskedWords(sentence, response).join(' ')}
                    </strong>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
