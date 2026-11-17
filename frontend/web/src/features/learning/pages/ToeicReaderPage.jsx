import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import ErrorState from '../../../shared/components/ErrorState';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import useAuth from '../../auth/hooks/useAuth';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';

export default function ToeicReaderPage() {
  useLocale();
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
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
  const lessons = exam?.lessons ?? [];
  const lesson = lessons.find(item => item.id === params.get('lesson')) ?? lessons[0];
  const completed = progress?.completedLessonIds ?? [];
  const history = progress?.attempts ?? [];
  const active = history.filter(item => item.status === 'IN_PROGRESS');
  useEffect(() => {
    const activeGeneration = ++generation.current;
    return () => {
      generation.current = activeGeneration + 1;
      pending.current = false;
    };
  }, [testId, user?.id]);
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
    return act(async isCurrent => {
      const response = await toeicApi.start(testId, mode, part);
      if (isCurrent())
        navigate(
          `/exams/toeic/attempts/${response.data.id}${response.data.status === 'GRADED' ? '/result' : ''}`,
        );
    });
  }
  if (loading)
    return (
      <p className="toeic-loading" role="status">
        {t('Đang tải nội dung học tập...')}
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
  return (
    <>
      <div className="toeic-reader-back">
        <Link to="/exams/toeic">
          <ArrowBackRounded fontSize="small" />
          {t('Tất cả bộ đề')}
        </Link>
        <span>{exam.sourceLabel}</span>
      </div>
      <header className="toeic-page-heading">
        <div>
          <h1>{exam.title}</h1>
          <p>{exam.description || t('Học kiến thức, luyện tập và xem lại kết quả ngay trên web.')}</p>
        </div>
        <span className="toeic-pill">
          <AccessTimeRounded fontSize="small" />
          {t('Thi thử {minutes} phút', { minutes: exam.durationMinutes })}
        </span>
      </header>
      {actionError && <ErrorState error={actionError} />}
      <section className="toeic-progress-panel" aria-label={t('Tiến độ học tập')}>
        <div>
          <strong>{t('Tiến độ học tập')}</strong>
          <span>
            {t('{completed}/{total} bài học hoàn thành', {
              completed: completed.length,
              total: lessons.length,
            })}
          </span>
        </div>
        <progress value={completed.length} max={Math.max(lessons.length, 1)} />
      </section>
      {active.length > 0 && (
        <section className="toeic-resume-panel">
          <div>
            <strong>{t('Bạn có bài làm đang tiếp tục')}</strong>
            <p>{t('Đáp án đã lưu sẽ được khôi phục khi mở lại bài.')}</p>
          </div>
          {active.map(attempt => (
            <Link
              key={attempt.id}
              className="toeic-button toeic-button-outline"
              to={`/exams/toeic/attempts/${attempt.id}`}
            >
              {t('Tiếp tục')} {attempt.mode === 'EXAM' ? t('thi thử') : t('luyện tập')}
            </Link>
          ))}
        </section>
      )}
      <div className="toeic-study-layout">
        <section className="toeic-lesson-list" aria-label={t('Bài học trong bộ đề')}>
          <h2>
            <MenuBookOutlined fontSize="small" />
            {t('Học trước khi luyện')}
          </h2>
          {lessons.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={lesson?.id === item.id}
              className={lesson?.id === item.id ? 'is-active' : ''}
              onClick={() => setParams({ lesson: item.id }, { replace: true })}
            >
              <span>
                {completed.includes(item.id) ? (
                  <CheckCircleOutlineOutlined fontSize="small" />
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </section>
        <article className="toeic-lesson-content">
          {lesson ? (
            <>
              <span className="toeic-eyebrow">{t('BÀI HỌC')}</span>
              <h2>{lesson.title}</h2>
              <div className="toeic-lesson-text">{lesson.content}</div>
              <button
                type="button"
                className={`toeic-button ${completed.includes(lesson.id) ? 'toeic-button-outline' : 'button-primary'}`}
                disabled={busy || completed.includes(lesson.id)}
                onClick={() =>
                  act(async isCurrent => {
                    await toeicApi.completeLesson(testId, lesson.id);
                    if (isCurrent()) reload();
                  })
                }
              >
                <CheckCircleOutlineOutlined fontSize="small" />
                {t(completed.includes(lesson.id) ? 'Đã hoàn thành bài học' : 'Đánh dấu đã học xong')}
              </button>
            </>
          ) : (
            <p>{t('Bộ đề chưa có bài học.')}</p>
          )}
        </article>
      </div>
      <section className="toeic-practice-section">
        <div className="toeic-section-title">
          <PlayArrowRounded />
          <h2>{t('Chọn cách luyện tập')}</h2>
        </div>
        <div className="toeic-practice-grid">
          {[5, 6, 7].map(part => {
            const count = exam.questions.filter(question => question.part === part).length;
            return (
              <article key={part}>
                <span className="toeic-test-edition">Part {part}</span>
                <h3>{t(part === 5 ? 'Hoàn thành câu' : part === 6 ? 'Hoàn thành đoạn văn' : 'Đọc hiểu')}</h3>
                <p>{t('{count} câu hỏi · không giới hạn thời gian', { count })}</p>
                <button
                  type="button"
                  className="toeic-button toeic-button-outline"
                  disabled={busy || !count}
                  onClick={() => start('PRACTICE', part)}
                >
                  {t('Luyện Part {part}', { part })}
                </button>
              </article>
            );
          })}
        </div>
        <div className="toeic-exam-start">
          <div>
            <h3>{t('Thi thử Reading đầy đủ')}</h3>
            <p>
              {t('{count} câu hỏi · {minutes} phút · tự động chấm điểm', {
                count: exam.questions.length,
                minutes: exam.durationMinutes,
              })}
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
      <section className="toeic-history">
        <h2>{t('Lịch sử làm bài')}</h2>
        {history.length ? (
          <div className="toeic-history-list">
            {history.map(attempt => (
              <article key={attempt.id}>
                <div>
                  <strong>{attempt.mode === 'EXAM' ? t('Thi thử Reading') : t('Luyện tập Reading')}</strong>
                  <small>
                    {attempt.startedAt
                      ? new Intl.DateTimeFormat(getIntlLocale(), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(attempt.startedAt))
                      : ''}
                  </small>
                </div>
                <span>
                  {attempt.status === 'GRADED'
                    ? `${attempt.correctCount}/${attempt.totalQuestions} · ${attempt.score}%`
                    : t('Đang làm')}
                </span>
                <Link
                  className="toeic-text-link"
                  to={`/exams/toeic/attempts/${attempt.id}${attempt.status === 'GRADED' ? '/result' : ''}`}
                >
                  {t(attempt.status === 'GRADED' ? 'Xem kết quả' : 'Tiếp tục')}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p>{t('Bạn chưa làm bài trong bộ đề này. Hãy chọn một Part để bắt đầu.')}</p>
        )}
      </section>
    </>
  );
}
