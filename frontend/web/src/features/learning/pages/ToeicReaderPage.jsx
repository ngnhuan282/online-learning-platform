import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import StickyNote2Outlined from '@mui/icons-material/StickyNote2Outlined';
import ErrorState from '../../../shared/components/ErrorState';
import { ROUTES } from '../../../shared/constants/routes';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import useAuth from '../../auth/hooks/useAuth';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import {
  formatToeicSourceLabel,
  formatToeicTitle,
  isListeningPart,
  PART_TITLES,
} from '../utils/toeicSections';

const TIME_PRESETS = [
  { value: 'unlimited', minutes: null, label: 'Không giới hạn' },
  { value: '15', minutes: 15, label: '15 phút' },
  { value: '30', minutes: 30, label: '30 phút' },
  { value: '45', minutes: 45, label: '45 phút' },
  { value: '60', minutes: 60, label: '60 phút' },
  { value: '75', minutes: 75, label: '75 phút' },
  { value: '90', minutes: 90, label: '90 phút' },
];

export default function ToeicReaderPage() {
  const { testId } = useParams();
  return <ToeicReaderWorkspace key={testId} testId={testId} />;
}

function ToeicReaderWorkspace({ testId }) {
  useLocale();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState('PRACTICE');
  const [selectedPart, setSelectedPart] = useState(null);
  const [timeChoice, setTimeChoice] = useState('unlimited');
  const [customMinutes, setCustomMinutes] = useState('40');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const [actionError, setActionError] = useState(null);
  const load = useCallback(
    async options => {
      const [exam, progress] = await Promise.all([
        toeicApi.detail(testId, options),
        toeicApi.progress(testId, options),
      ]);
      return { data: { exam: exam.data, progress: progress.data } };
    },
    [testId],
  );
  const { data, loading, error, reload } = useLearningResource(load, null);
  const exam = data?.exam;
  const progress = data?.progress;
  const history = progress?.attempts ?? [];
  const active = history.filter(item => item.status === 'IN_PROGRESS');

  useEffect(() => {
    const activeGeneration = ++generation.current;
    return () => {
      generation.current = activeGeneration + 1;
      pending.current = false;
    };
  }, [testId, user?.id]);

  function resolvePracticeDuration() {
    if (timeChoice === 'unlimited') return null;
    if (timeChoice === 'custom') {
      const parsed = Number(customMinutes);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 180) {
        return NaN;
      }
      return parsed;
    }
    return Number(timeChoice);
  }

  async function act(request) {
    if (pending.current) return;
    const captured = generation.current;
    const session = getSessionVersion();
    const isCurrent = () => generation.current === captured && getSessionVersion() === session;
    pending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await request(isCurrent);
    } catch (failure) {
      if (isCurrent()) setActionError(failure);
    } finally {
      if (isCurrent()) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  function start(mode, part = null) {
    const durationMinutes = mode === 'PRACTICE' ? resolvePracticeDuration() : null;
    if (Number.isNaN(durationMinutes)) {
      setActionError({ message: t('Thời gian luyện tập phải là số nguyên từ 1 đến 180 phút.') });
      return undefined;
    }
    return act(async isCurrent => {
      const response = await toeicApi.start(testId, mode, mode === 'EXAM' ? null : part, durationMinutes);
      if (isCurrent())
        navigate(
          `/exams/toeic/attempts/${response.data.id}${response.data.status === 'GRADED' ? '/result' : ''}`,
        );
    });
  }

  if (loading)
    return (
      <p className="toeic-loading" role="status">
        {t('Đang tải bộ đề...')}
      </p>
    );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!exam)
    return (
      <div className="toeic-empty">
        <h1>{t('Không tìm thấy bộ đề')}</h1>
        <Link to="/exams/toeic">{t('Về thư viện TOEIC')}</Link>
      </div>
    );

  const practiceDuration = resolvePracticeDuration();
  const practiceTimeSummary =
    timeChoice === 'unlimited'
      ? t('Không giới hạn thời gian')
      : Number.isNaN(practiceDuration)
        ? t('Thời gian chưa hợp lệ')
        : t('{minutes} phút', { minutes: practiceDuration });
  const parts = [...new Set(exam.questions.map(question => question.part))].sort((a, b) => a - b);
  const listening = isListeningPart(parts[0]);
  const activePart = parts.includes(selectedPart) ? selectedPart : null;
  const practicePartLabel = activePart ?? (parts.length === 1 ? parts[0] : null);
  const selectedQuestionsCount =
    selectedMode === 'EXAM' || activePart == null
      ? exam.questions.length
      : exam.questions.filter(question => question.part === activePart).length;

  return (
    <>
      <div className="toeic-reader-back">
        <Link to={listening ? '/exams/toeic?section=listening' : '/exams/toeic'}>
          <ArrowBackRounded fontSize="small" />
          {t('Tất cả bộ đề')}
        </Link>
        {exam.sourceLabel && <span>{formatToeicSourceLabel(exam.sourceLabel)}</span>}
      </div>
      <header className="toeic-page-heading">
        <div>
          <h1>{formatToeicTitle(exam.title)}</h1>
          <p>
            {exam.description ||
              t('Chọn chế độ Luyện tập hoặc Thi thực chiến, tùy chỉnh thời gian và bắt đầu làm bài ngay.')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {exam.companionExamId && (
            <Link
              className="toeic-button toeic-button-outline"
              to={`/exams/toeic/tests/${exam.companionExamId}`}
            >
              {t(listening ? 'Mở phần Reading' : 'Mở phần Listening')}
            </Link>
          )}
          {user && (
            <Link className="toeic-button toeic-button-outline" to={ROUTES.MY_NOTES}>
              <StickyNote2Outlined fontSize="small" />
              {t('Ghi chú của tôi')}
            </Link>
          )}
          <span className="toeic-pill">
            <FactCheckOutlined fontSize="small" />
            {t('{count} câu hỏi', { count: exam.questions.length })} ·{' '}
            {t('{minutes} phút', { minutes: exam.durationMinutes })}
          </span>
        </div>
      </header>

      {actionError && <ErrorState error={actionError} />}

      {active.length > 0 && (
        <section className="toeic-resume-panel">
          <div>
            <strong>{t('Bạn có bài làm đang tiếp tục')}</strong>
            <p>{t('Đáp án và thời gian còn lại sẽ được khôi phục khi mở lại bài.')}</p>
          </div>
          <div className="toeic-resume-actions">
            {active.map(attempt => (
              <Link
                key={attempt.id}
                className="toeic-button toeic-button-outline"
                to={`/exams/toeic/attempts/${attempt.id}`}
              >
                {t('Tiếp tục')}{' '}
                {attempt.mode === 'EXAM'
                  ? t('thi thực chiến')
                  : attempt.part
                    ? `Part ${attempt.part}`
                    : t('luyện tập')}
                {attempt.durationMinutes ? ` (${attempt.durationMinutes}p)` : ''}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="toeic-config-section" aria-label={t('Chọn chế độ làm bài')}>
        <div className="toeic-section-title">
          <BoltRounded />
          <h2>{t('1. Chọn chế độ làm bài')}</h2>
        </div>
        <div className="toeic-mode-grid">
          <article
            className={`toeic-mode-card is-practice ${selectedMode === 'PRACTICE' ? 'is-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMode === 'PRACTICE'}
            onClick={() => {
              setSelectedMode('PRACTICE');
              setActionError(null);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedMode('PRACTICE');
                setActionError(null);
              }
            }}
          >
            <div className="toeic-mode-card-top">
              <span className="toeic-mode-badge tone-blue">
                <VisibilityOutlined fontSize="small" />
                {t('Chế độ Luyện tập')}
              </span>
              <span className="toeic-mode-radio" aria-hidden="true" />
            </div>
            <h3>{t('Luyện tập linh hoạt & xem đáp án ngay')}</h3>
            <ul className="toeic-mode-points">
              <li>{t('Luyện từng Part hoặc trọn bộ đề')}</li>
              <li>{t('Tự chọn thời gian làm bài hoặc không giới hạn thời gian')}</li>
              <li>
                {t(
                  listening
                    ? 'Hiện đáp án và transcript khi cần đối chiếu'
                    : 'Xem lại đáp án đúng và lời giải chi tiết thoải mái ngay khi đang làm',
                )}
              </li>
            </ul>
          </article>

          <article
            className={`toeic-mode-card is-exam ${selectedMode === 'EXAM' ? 'is-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMode === 'EXAM'}
            onClick={() => {
              setSelectedMode('EXAM');
              setSelectedPart(null);
              setActionError(null);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedMode('EXAM');
                setSelectedPart(null);
                setActionError(null);
              }
            }}
          >
            <div className="toeic-mode-card-top">
              <span className="toeic-mode-badge tone-orange">
                <VerifiedOutlined fontSize="small" />
                {t('Chế độ Luyện thi thực')}
              </span>
              <span className="toeic-mode-radio" aria-hidden="true" />
            </div>
            <h3>
              {t(
                listening
                  ? 'Thi thử Listening có giới hạn thời gian'
                  : 'Thi thử Reading có giới hạn thời gian',
              )}
            </h3>
            <ul className="toeic-mode-points">
              <li>
                {t(
                  listening ? 'Làm trọn bộ {count} câu hỏi Listening' : 'Làm trọn bộ {count} câu hỏi Reading',
                  {
                    count: exam.questions.length,
                  },
                )}
              </li>
              <li>
                {t('Giới hạn {minutes} phút, tự động nộp khi hết giờ', {
                  minutes: exam.durationMinutes,
                })}
              </li>
              <li>
                {t(
                  listening
                    ? 'Đáp án và transcript mở sau khi nộp bài.'
                    : 'Không xem đáp án giữa chừng — chỉ mở điểm số và lời giải sau khi nộp bài',
                )}
              </li>
            </ul>
          </article>
        </div>
      </section>

      {selectedMode === 'PRACTICE' ? (
        <section className="toeic-practice-section">
          <div className="toeic-time-panel">
            <div className="toeic-time-panel-head">
              <div className="toeic-section-title">
                <AccessTimeRounded />
                <h2>{t('2. Chọn thời gian luyện thi')}</h2>
              </div>
              <span className="toeic-time-current">{practiceTimeSummary}</span>
            </div>
            <div className="toeic-time-pills" role="group" aria-label={t('Chọn thời gian luyện thi')}>
              {TIME_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={`toeic-time-pill ${timeChoice === preset.value ? 'is-active' : ''}`}
                  aria-pressed={timeChoice === preset.value}
                  onClick={() => {
                    setTimeChoice(preset.value);
                    setActionError(null);
                  }}
                >
                  {t(preset.label)}
                </button>
              ))}
              <button
                type="button"
                className={`toeic-time-pill ${timeChoice === 'custom' ? 'is-active' : ''}`}
                aria-pressed={timeChoice === 'custom'}
                onClick={() => {
                  setTimeChoice('custom');
                  setActionError(null);
                }}
              >
                {t('Tùy chỉnh')}
              </button>
              {timeChoice === 'custom' && (
                <label className="toeic-custom-time">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customMinutes}
                    aria-label={t('Số phút tùy chỉnh')}
                    onChange={event => {
                      setCustomMinutes(event.target.value);
                      setActionError(null);
                    }}
                  />
                  <span>{t('phút (1–180)')}</span>
                </label>
              )}
            </div>
          </div>

          {parts.length > 1 && (
            <>
              <div className="toeic-section-title toeic-scope-heading">
                <PlayArrowRounded />
                <h2>{t('3. Chọn phần thi muốn luyện')}</h2>
              </div>

              <div className={`toeic-practice-grid ${listening ? 'is-listening' : 'is-four'}`}>
                <article
                  className={`toeic-scope-card ${activePart === null ? 'is-selected' : ''}`}
                  onClick={event => {
                    if (event.target.closest('button')) return;
                    setSelectedPart(null);
                  }}
                >
                  <span className="toeic-test-edition">{t('Trọn bộ')}</span>
                  <h3>{t(listening ? 'Toàn bộ Listening' : 'Toàn bộ Reading')}</h3>
                  <p>
                    {t('{count} câu hỏi · {time}', {
                      count: exam.questions.length,
                      time: practiceTimeSummary,
                    })}
                  </p>
                  <button
                    type="button"
                    className={`toeic-button ${activePart === null ? 'button-primary' : 'toeic-button-outline'}`}
                    disabled={busy || !exam.questions.length}
                    onClick={() => start('PRACTICE', null)}
                  >
                    {t('Luyện trọn bộ')}
                  </button>
                </article>

                {parts.map(part => {
                  const count = exam.questions.filter(question => question.part === part).length;
                  const isChosen = activePart === part;
                  return (
                    <article
                      key={part}
                      className={`toeic-scope-card ${isChosen ? 'is-selected' : ''}`}
                      onClick={event => {
                        if (event.target.closest('button')) return;
                        setSelectedPart(part);
                      }}
                    >
                      <span className="toeic-test-edition">Part {part}</span>
                      <h3>{t(PART_TITLES[part])}</h3>
                      <p>{t('{count} câu hỏi · {time}', { count, time: practiceTimeSummary })}</p>
                      <button
                        type="button"
                        className={`toeic-button ${isChosen ? 'button-primary' : 'toeic-button-outline'}`}
                        disabled={busy || !count}
                        onClick={() => start('PRACTICE', part)}
                      >
                        {t('Luyện Part {part}', { part })}
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="toeic-exam-start">
            <div>
              <h3>
                {practicePartLabel
                  ? t('Sẵn sàng luyện Part {part}', { part: practicePartLabel })
                  : t(listening ? 'Sẵn sàng luyện trọn bộ Listening' : 'Sẵn sàng luyện trọn bộ Reading')}
              </h3>
              <p>
                {t(
                  listening
                    ? '{count} câu hỏi · {time} · Có đáp án và transcript'
                    : '{count} câu hỏi · {time} · Xem đáp án & lời giải thoải mái khi đang làm',
                  {
                    count: selectedQuestionsCount,
                    time: practiceTimeSummary,
                  },
                )}
              </p>
            </div>
            <button
              type="button"
              className="toeic-button button-primary"
              disabled={busy || !selectedQuestionsCount}
              onClick={() => start('PRACTICE', activePart)}
            >
              {busy ? t('Đang chuẩn bị...') : t('Bắt đầu luyện tập')}
              <PlayArrowRounded fontSize="small" />
            </button>
          </div>
        </section>
      ) : (
        <section className="toeic-practice-section">
          <div className="toeic-exam-start is-real-exam">
            <div>
              <div className="toeic-real-exam-badges">
                <span>
                  <AccessTimeRounded fontSize="small" />
                  {t('Thời gian thi {minutes} phút', { minutes: exam.durationMinutes })}
                </span>
                <span>
                  <VisibilityOffOutlined fontSize="small" />
                  {t('Khóa đáp án giữa chừng')}
                </span>
              </div>
              <h3>{t(listening ? 'Thi thử TOEIC Listening' : 'Thi thử TOEIC Reading')}</h3>
              <p>
                {t(
                  listening
                    ? '{count} câu hỏi · {minutes} phút · Phát audio theo từng nhóm câu. Đáp án và transcript mở sau khi nộp.'
                    : '{count} câu hỏi · {minutes} phút · tự động chấm điểm',
                  {
                    count: exam.questions.length,
                    minutes: exam.durationMinutes,
                  },
                )}
              </p>
            </div>
            <button
              type="button"
              className="toeic-button button-primary"
              disabled={busy || !exam.questions.length}
              onClick={() => start('EXAM')}
            >
              {busy ? t('Đang chuẩn bị...') : t('Bắt đầu thi thử')}
              <PlayArrowRounded fontSize="small" />
            </button>
          </div>
        </section>
      )}

      <section className="toeic-history">
        <h2>{t('Lịch sử làm bài')}</h2>
        {history.length ? (
          <div className="toeic-history-list">
            {history.map(attempt => {
              const target = `/exams/toeic/attempts/${attempt.id}${attempt.status === 'GRADED' ? '/result' : ''}`;
              return (
                <article
                  key={attempt.id}
                  className="is-clickable"
                  onClick={event => {
                    if (event.target.closest('a, button')) return;
                    navigate(target);
                  }}
                >
                  <div>
                    <strong>
                      {attempt.mode === 'EXAM'
                        ? t(listening ? 'Thi thử Listening' : 'Thi thực chiến Reading')
                        : attempt.part
                          ? `${t(listening ? 'Luyện tập Listening' : 'Luyện tập Reading')} · Part ${attempt.part}`
                          : t(listening ? 'Luyện tập Listening' : 'Luyện tập Reading')}
                    </strong>
                    <small>
                      {attempt.startedAt
                        ? new Intl.DateTimeFormat(getIntlLocale(), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(attempt.startedAt))
                        : ''}
                      {attempt.durationMinutes
                        ? ` · ${t('{minutes} phút', { minutes: attempt.durationMinutes })}`
                        : ` · ${t('Không giới hạn')}`}
                    </small>
                  </div>
                  <span>
                    {attempt.status === 'GRADED'
                      ? `${attempt.correctCount}/${attempt.totalQuestions} · ${attempt.score}%`
                      : t('Đang làm')}
                  </span>
                  <Link className="toeic-text-link" to={target}>
                    {t(attempt.status === 'GRADED' ? 'Xem kết quả' : 'Tiếp tục')}
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <p>{t('Bạn chưa có lượt làm bài nào cho bộ đề này. Hãy chọn chế độ ở trên để bắt đầu.')}</p>
        )}
      </section>
    </>
  );
}
