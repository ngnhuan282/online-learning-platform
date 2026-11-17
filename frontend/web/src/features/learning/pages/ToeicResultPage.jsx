import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorState from '../../../shared/components/ErrorState';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import useAuth from '../../auth/hooks/useAuth';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import ToeicQuestion from '../components/ToeicQuestion';

export default function ToeicResultPage() {
  useLocale();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(options => toeicApi.attempt(attemptId, options), [attemptId]);
  const { data: result, loading, error, reload } = useLearningResource(load, null);
  const questions = result?.questions ?? [];
  const answers = result?.answers ?? {};
  const matches = question =>
    filter === 'all' ||
    (filter === 'unanswered' ? !answers[question.id] : answers[question.id] !== question.correctOptionId);
  const filtered = questions.filter(matches);
  const question = filtered.find(item => item.id === selectedId) ?? filtered[0];
  const current = filtered.indexOf(question);
  useEffect(() => {
    const activeGeneration = ++generation.current;
    return () => {
      generation.current = activeGeneration + 1;
      pending.current = false;
    };
  }, [attemptId, user?.id]);
  async function restart() {
    if (pending.current || !result) return;
    pending.current = true;
    setBusy(true);
    setActionError(null);
    const captured = generation.current;
    const session = getSessionVersion();
    const isCurrent = () => generation.current === captured && getSessionVersion() === session;
    try {
      const response = await toeicApi.start(result.examId, result.mode, result.part ?? null);
      if (isCurrent()) navigate(`/exams/toeic/attempts/${response.data.id}`);
    } catch (failure) {
      if (isCurrent()) setActionError(failure);
    } finally {
      if (isCurrent()) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  if (loading)
    return (
      <p className="toeic-loading" role="status">
        {t('Đang tải kết quả...')}
      </p>
    );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!result) return null;
  if (result.status !== 'GRADED')
    return (
      <div className="toeic-empty">
        <h1>{t('Bài làm chưa được nộp')}</h1>
        <p>{t('Hoàn thành và nộp bài để mở điểm số cùng lời giải.')}</p>
        <Link className="toeic-button button-primary" to={`/exams/toeic/attempts/${attemptId}`}>
          {t('Tiếp tục làm bài')}
        </Link>
      </div>
    );
  const answered = questions.filter(item => answers[item.id]).length;
  return (
    <>
      <div className="toeic-reader-back">
        <Link to={`/exams/toeic/tests/${result.examId}`}>
          <ArrowBackRounded fontSize="small" />
          {t('Về bộ đề')}
        </Link>
        <span>
          {result.submittedAt
            ? new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(result.submittedAt),
              )
            : ''}
        </span>
      </div>
      <header className="toeic-page-heading">
        <div>
          <h1>{t('Kết quả Reading')}</h1>
          <p>{result.title}</p>
        </div>
        <span className="toeic-pill">
          <CheckCircleOutlineOutlined fontSize="small" />
          {t('Đã chấm điểm')}
        </span>
      </header>
      <section className="toeic-result-summary">
        <div className="toeic-score">
          <strong>{result.score}%</strong>
          <span>{t('Tỷ lệ trả lời đúng')}</span>
        </div>
        <div>
          <strong>
            {result.correctCount}/{result.totalQuestions}
          </strong>
          <span>{t('Câu trả lời đúng')}</span>
        </div>
        <div>
          <strong>{result.totalQuestions - answered}</strong>
          <span>{t('Câu bỏ trống')}</span>
        </div>
        <div>
          <strong>{result.mode === 'EXAM' ? t('Thi thử') : t('Luyện tập')}</strong>
          <span>TOEIC Reading</span>
        </div>
      </section>
      <p className="toeic-result-note">
        {t(
          'Kết quả thể hiện số câu đúng và tỷ lệ phần trăm; không quy đổi sang thang điểm TOEIC chính thức.',
        )}
      </p>
      <div className="toeic-result-parts">
        {[5, 6, 7]
          .filter(part => questions.some(item => item.part === part))
          .map(part => {
            const items = questions.filter(item => item.part === part);
            const correct = items.filter(item => answers[item.id] === item.correctOptionId).length;
            return (
              <div key={part}>
                <strong>Part {part}</strong>
                <span>
                  {correct}/{items.length} {t('câu đúng')}
                </span>
                <progress max={items.length} value={correct} />
              </div>
            );
          })}
      </div>
      {actionError && <ErrorState error={actionError} />}
      <div className="toeic-result-actions">
        <button className="toeic-button button-primary" type="button" disabled={busy} onClick={restart}>
          <ReplayRounded fontSize="small" />
          {busy ? t('Đang chuẩn bị...') : t('Làm lại bộ đề')}
        </button>
        <Link className="toeic-button toeic-button-outline" to={`/exams/toeic/tests/${result.examId}`}>
          {t('Học lại kiến thức')}
        </Link>
      </div>
      <section className="toeic-review-heading">
        <h2>{t('Xem lại từng câu')}</h2>
        <div className="toeic-tabs" aria-label={t('Lọc kết quả')}>
          {[
            ['all', 'Tất cả câu'],
            ['incorrect', 'Câu sai và bỏ trống'],
            ['unanswered', 'Câu bỏ trống'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'is-active' : ''}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setSelectedId(null);
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </section>
      <div className="toeic-review-layout">
        <div>
          {question ? (
            <>
              <ToeicQuestion question={question} selected={answers[question.id]} review />
              <nav className="toeic-question-navigation" aria-label={t('Điều hướng lời giải')}>
                <button
                  className="toeic-button toeic-button-outline"
                  type="button"
                  disabled={current <= 0}
                  onClick={() => setSelectedId(filtered[current - 1].id)}
                >
                  {t('Câu trước')}
                </button>
                <span>
                  {current + 1}/{filtered.length}
                </span>
                <button
                  className="toeic-button toeic-button-outline"
                  type="button"
                  disabled={current === filtered.length - 1}
                  onClick={() => setSelectedId(filtered[current + 1].id)}
                >
                  {t('Câu tiếp')}
                </button>
              </nav>
            </>
          ) : (
            <div className="toeic-empty">
              <CheckCircleOutlineOutlined />
              <h3>{t('Không có câu hỏi trong nhóm này')}</h3>
              <p>{t('Chọn một bộ lọc khác để xem lời giải.')}</p>
            </div>
          )}
        </div>
        <aside className="toeic-review-palette">
          <h3>{t('Các câu hỏi')}</h3>
          <div className="toeic-question-palette">
            {filtered.map(item => (
              <button
                type="button"
                key={item.id}
                className={`${answers[item.id] === item.correctOptionId ? 'is-correct' : answers[item.id] ? 'is-wrong' : ''} ${item.id === question?.id ? 'is-current' : ''}`}
                aria-label={t('Xem lời giải câu {number}', { number: item.number })}
                aria-current={item.id === question?.id ? 'step' : undefined}
                onClick={() => setSelectedId(item.id)}
              >
                {item.number}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
