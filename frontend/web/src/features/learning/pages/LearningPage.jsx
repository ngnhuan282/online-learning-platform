import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useMemo, useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import LearningHeader from '../components/LearningHeader';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { lessonApi } from '../../courses/api/lessonApi';
import { mediaApi } from '../../courses/api/mediaApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useToast from '../../../shared/hooks/useToast';
import useLearningResource from '../hooks/useLearningResource';
import ErrorState from '../../../shared/components/ErrorState';
import AppLoading from '../../../shared/components/AppLoading';
import Icon from '../../../shared/components/Icon';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { AUTH_CHANGED_EVENT, API_PREFIX } from '../../../shared/constants/appConstants';
import { youtubeEmbedUrl } from '../utils/lessonMedia';
import { ROUTES } from '../../../shared/constants/routes';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import '../styles/quiz.css';

const lessonStatus = item => item?.status ?? 'NOT_STARTED';
const isMediaUrl = value =>
  typeof value === 'string' && (/^https?:\/\//i.test(value) || value.startsWith(`${API_PREFIX}/media/`));
const subscribeToSession = callback => {
  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, callback);
};

function LearningCoursePage({ courseId }) {
  useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const loadCourse = useCallback(options => learningApi.getLearningCourse(courseId, options), [courseId]);
  const loadQuizzes = useCallback(() => learningApi.getCourseQuizzes(courseId), [courseId]);
  const emptyQuizzes = useMemo(() => [], []);
  const snapshot = useLearningResource(loadCourse, null);
  const quizzes = useLearningResource(loadQuizzes, emptyQuizzes);
  const course = snapshot.data;
  const courseLoading = snapshot.loading;
  const [changes, setChanges] = useState({});
  const [updatingLessonId, setUpdatingLessonId] = useState(null);
  const [error, setError] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const usingFallback = false;
  const sections = useMemo(
    () =>
      [...(course?.sections ?? [])]
        .sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id)
        .map(section => ({
          ...section,
          lessons: [...(section.lessons ?? [])].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id),
        })),
    [course?.sections],
  );
  const allLessons = useMemo(
    () =>
      sections.flatMap(section =>
        section.lessons.map(lesson => ({ ...lesson, sectionTitle: section.title })),
      ),
    [sections],
  );
  const selectedLessonId = searchParams.get('lessonId');
  const currentLesson = useMemo(
    () => allLessons.find(lesson => String(lesson.id) === selectedLessonId) ?? allLessons[0] ?? null,
    [allLessons, selectedLessonId],
  );
  const progressByLesson = useMemo(() => {
    const next = new Map((course?.progress ?? []).map(item => [item.lessonId, item]));
    Object.values(changes).forEach(item => {
      if (next.get(item.lessonId)?.status !== 'COMPLETED') next.set(item.lessonId, item);
    });
    return next;
  }, [course?.progress, changes]);
  const selectedProgress = progressByLesson.get(currentLesson?.id);
  const completedCount = allLessons.filter(
    lesson => lessonStatus(progressByLesson.get(lesson.id)) === 'COMPLETED',
  ).length;
  const courseProgress = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;
  const courseQuizzes = quizzes.data;
  const quizzesLoading = quizzes.loading;
  const quizError = quizzes.error;

  const loadPlayback = useCallback(async () => {
    if (!currentLesson) return { data: null };
    if (['TEXT', 'QUIZ'].includes(currentLesson.lessonType) || isMediaUrl(currentLesson.videoUrl)) {
      return { data: { ...currentLesson, lessonId: currentLesson.id, playUrl: currentLesson.videoUrl } };
    }
    return lessonApi.getPlayUrl(courseId, currentLesson.id);
  }, [courseId, currentLesson]);
  const playback = useLearningResource(loadPlayback, null);
  const playData = playback.data?.lessonId === currentLesson?.id ? playback.data : null;
  const playLoading = playback.loading;
  const playError = playback.error?.message;
  const loadPlayUrl = playback.reload;

  function mergeProgress(progress) {
    setChanges(previous => ({ ...previous, [progress.lessonId]: progress }));
  }

  const resourceLessonId = currentLesson?.id;
  const loadResources = useCallback(async () => {
    if (!resourceLessonId) return { data: [] };
    const response = await mediaApi.listResources(resourceLessonId);
    const data = response?.data?.data ?? response?.data ?? [];
    return { data: Array.isArray(data) ? data : [] };
  }, [resourceLessonId]);
  const resources = useLearningResource(loadResources, emptyQuizzes);
  const lessonResources = resources.data;
  const loadingResources = resources.loading;

  async function openLesson(lessonId) {
    if (pending.current) return;
    pending.current = true;
    setUpdatingLessonId(lessonId);
    setError(null);
    const session = getSessionVersion();
    try {
      const response = await learningApi.accessLesson(courseId, lessonId);
      if (!mounted.current || session !== getSessionVersion()) return;
      if (response.data) mergeProgress(response.data);
      setSearchParams({ lessonId: String(lessonId) }, { replace: true });
    } catch (error) {
      if (mounted.current && session === getSessionVersion()) setError(error);
    } finally {
      pending.current = false;
      setUpdatingLessonId(null);
    }
  }

  async function completeLesson() {
    if (pending.current || !currentLesson) return;
    pending.current = true;
    setUpdatingLessonId(currentLesson.id);
    setError(null);
    const session = getSessionVersion();
    try {
      const response = await learningApi.markLessonComplete(courseId, currentLesson.id);
      if (!mounted.current || session !== getSessionVersion()) return;
      if (response.data) mergeProgress(response.data);
      toast('Đã đánh dấu hoàn thành bài học.');
    } catch (error) {
      if (mounted.current && session === getSessionVersion()) setError(error);
    } finally {
      pending.current = false;
      setUpdatingLessonId(null);
    }
  }

  if (snapshot.loading || snapshot.error || !course) {
    return (
      <section className="learning-page">
        <div className="learning-shell">
          <LearningHeader title={t('Không gian học tập')} />
          {snapshot.loading ? (
            <AppLoading label={t('Đang tải nội dung học...')} />
          ) : (
            <ErrorState
              error={snapshot.error ?? new Error('Không tìm thấy nội dung khóa học.')}
              title={
                snapshot.error?.status === 403
                  ? t('Bạn chưa có quyền học khóa này')
                  : t('Không thể mở khóa học')
              }
              onRetry={snapshot.reload}
            />
          )}
          {snapshot.error?.status === 403 && (
            <div style={{ marginTop: 16 }}>
              <Link className="button button-outline" to={ROUTES.PRO}>
                {t('Xem hoặc gia hạn Pro')}
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  const embedUrl = youtubeEmbedUrl(playData?.playUrl);

  return (
    <section className="learning-page">
      <div className="learning-shell learning-studio">
        <LearningHeader
          title={course.title || `Khóa học #${courseId}`}
          description={t('Học theo từng bài, lưu tiến độ và kiểm tra kiến thức.')}
        >
          {course.level && <span className="learning-level-pill">{course.level}</span>}
          <Link className="button button-outline" to={`/courses/${courseId}`}>
            {t('Chi tiết khóa học')}
          </Link>
          <Link
            className="button button-soft"
            to={`${ROUTES.AI_ASSISTANT}?courseId=${encodeURIComponent(courseId)}${currentLesson ? `&lessonId=${encodeURIComponent(currentLesson.id)}` : ''}`}
          >
            <AutoAwesomeOutlined fontSize="small" /> {t('Trợ lý AI')}
          </Link>
          <Link className="button button-primary" to="/my-courses">
            {t('Khóa học của tôi')}
          </Link>
        </LearningHeader>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-studio-grid" aria-busy={courseLoading}>
          <article className="lesson-stage">
            <div className="course-progress-summary">
              <div className="learning-progress-heading">
                <span>
                  {t('Tiến độ hoàn thành:')} {completedCount}/{allLessons.length} {t('bài học')}
                </span>
                <strong>{courseProgress}%</strong>
              </div>
              <ProgressBar value={courseProgress} />
            </div>

            <div className="learning-media">
              {playLoading ? (
                <div className="learning-media-placeholder" role="status">
                  <AppLoading label={t('Đang tải bài giảng...')} />
                </div>
              ) : playError ? (
                <div className="learning-media-placeholder is-error" role="alert">
                  <p>{playError}</p>
                  <button className="button button-primary" type="button" onClick={loadPlayUrl}>
                    {t('Thử lại')}
                  </button>
                </div>
              ) : playData ? (
                <div>
                  {playData.lessonType === 'VIDEO' ? (
                    embedUrl ? (
                      <iframe
                        key={embedUrl}
                        src={embedUrl}
                        title={currentLesson?.title || t('Bài học')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        key={currentLesson.id}
                        controls
                        autoPlay
                        controlsList="nodownload"
                        src={resolveMediaUrl(playData.playUrl)}
                        onPlay={() => {
                          if (!selectedProgress || selectedProgress.status === 'NOT_STARTED')
                            openLesson(currentLesson.id);
                        }}
                        onError={() => setMediaError({ lessonId: currentLesson.id, url: playData.playUrl })}
                      >
                        {t('Trình duyệt của bạn không hỗ trợ phát video này.')}
                      </video>
                    )
                  ) : playData.lessonType === 'DOCUMENT' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div className="learning-doc-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="feature-icon blue" style={{ marginBottom: 0 }}>
                            <Icon name="book" size={20} />
                          </span>
                          <div>
                            <strong>
                              {t('Tài liệu bài học:')} {currentLesson?.title}
                            </strong>
                            <div style={{ fontSize: 12.5, color: 'var(--learn-muted)' }}>
                              {t('Định dạng văn bản / PDF học tập')}
                            </div>
                          </div>
                        </div>
                        {(playData.playUrl || currentLesson?.videoUrl) && (
                          <a
                            href={resolveMediaUrl(playData.playUrl || currentLesson?.videoUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button button-primary"
                          >
                            {t('Mở tài liệu bài học')}
                          </a>
                        )}
                      </div>

                      {(playData.playUrl || currentLesson?.videoUrl)?.toLowerCase().includes('.pdf') ? (
                        <iframe
                          src={resolveMediaUrl(playData.playUrl || currentLesson?.videoUrl)}
                          title={currentLesson?.title || t('Tài liệu PDF')}
                          style={{ height: 520 }}
                        />
                      ) : null}

                      {currentLesson?.content && (
                        <div className="learning-text-reader">
                          <div className="learning-text-content">{currentLesson.content}</div>
                        </div>
                      )}
                    </div>
                  ) : playData.lessonType === 'QUIZ' ? (
                    <div className="learning-quiz-stage">
                      <span className="eyebrow-pill">{t('KIỂM TRA KIẾN THỨC')}</span>
                      <h3>
                        {t('Bài kiểm tra:')} {currentLesson?.title}
                      </h3>
                      <p>
                        {t(
                          'Hãy thực hiện bài kiểm tra này để củng cố kiến thức và ghi nhận tiến độ khóa học của bạn.',
                        )}
                      </p>
                      {(() => {
                        const qId = currentLesson?.content?.match(/^\d+$/)
                          ? currentLesson.content
                          : courseQuizzes.find(q => q.title === currentLesson?.title)?.id ||
                            currentLesson?.content;
                        return qId ? (
                          <Link to={`/quizzes/${qId}`} className="button button-success">
                            {t('Bắt đầu làm bài Quiz ngay')}
                            <Icon name="arrow" size={17} />
                          </Link>
                        ) : (
                          <p style={{ color: 'var(--learn-muted)', fontSize: 13 }}>
                            {t('Chưa liên kết bài quiz cụ thể.')}
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="learning-text-reader">
                      <h4>{t('Nội dung bài học lý thuyết')}</h4>
                      <div className="learning-text-content">
                        {playData.content ||
                          currentLesson?.content ||
                          t('Chưa có nội dung văn bản cho bài học này.')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="learning-media-placeholder">
                  <AutoStoriesOutlined aria-hidden="true" />
                  <p>{t('Chọn một bài học từ danh sách để bắt đầu học.')}</p>
                </div>
              )}
              {mediaError && mediaError.lessonId === currentLesson?.id && (
                <div style={{ marginTop: 16 }}>
                  <ErrorState
                    error={
                      new Error(
                        'Không thể tải video từ máy chủ lưu trữ (Supabase Storage / S3). Có thể dự án Supabase đang tạm dừng hoặc tệp media chưa được tải lên.',
                      )
                    }
                    title={t('Không thể phát bài học')}
                    onRetry={() => {
                      setMediaError(null);
                      snapshot.reload();
                    }}
                  />
                  {mediaError.url && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                      <a
                        href={resolveMediaUrl(mediaError.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button button-soft"
                      >
                        {t('Mở liên kết video trực tiếp')}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {currentLesson && (
              <>
                <div className="learning-lesson-footer">
                  <div>
                    {currentLesson.sectionTitle && (
                      <span className="learning-lesson-section">{currentLesson.sectionTitle}</span>
                    )}
                    <h2>{currentLesson.title}</h2>
                    <div className="learning-lesson-meta">
                      {currentLesson.duration ? (
                        <span>
                          <AccessTimeOutlined fontSize="small" aria-hidden="true" />
                          {Math.round(currentLesson.duration / 60)} {t('phút')}
                        </span>
                      ) : null}
                      <span>
                        {t('Trạng thái:')}{' '}
                        <strong>
                          {lessonStatus(selectedProgress) === 'COMPLETED'
                            ? t('Đã hoàn thành')
                            : lessonStatus(selectedProgress) === 'IN_PROGRESS'
                              ? t('Đang học')
                              : t('Chưa bắt đầu')}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <button
                    className={`button ${lessonStatus(selectedProgress) === 'COMPLETED' ? 'button-success' : 'button-primary'}`}
                    type="button"
                    disabled={updatingLessonId != null || lessonStatus(selectedProgress) === 'COMPLETED'}
                    onClick={completeLesson}
                  >
                    {lessonStatus(selectedProgress) === 'COMPLETED' ? (
                      <>
                        <CheckCircleOutline fontSize="small" aria-hidden="true" />
                        {t('Đã hoàn thành')}
                      </>
                    ) : updatingLessonId === currentLesson.id ? (
                      t('Đang cập nhật...')
                    ) : (
                      t('Đánh dấu hoàn thành')
                    )}
                  </button>
                </div>

                {currentLesson.content && playData?.lessonType === 'VIDEO' && (
                  <div className="learning-lesson-notes">
                    <h3>{t('Ghi chú bài giảng')}</h3>
                    <p>{currentLesson.content}</p>
                  </div>
                )}

                <div className="learning-resources-section">
                  <h4>
                    <Icon name="assignment" size={18} />
                    {t('Tài liệu đính kèm (')}
                    {lessonResources.length})
                  </h4>

                  {loadingResources ? (
                    <p style={{ fontSize: 13, color: 'var(--learn-muted)' }}>
                      {t('Đang tải danh sách tài liệu...')}
                    </p>
                  ) : lessonResources.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>
                      {t('Bài học này không có tệp đính kèm thêm.')}
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {lessonResources.map(res => (
                        <div key={res.id} className="learning-resource-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon name={res.resourceType === 'VIDEO' ? 'play' : 'book'} size={18} />
                            <div>
                              <strong style={{ fontSize: 14 }}>{res.title}</strong>
                              <div style={{ fontSize: 12, color: 'var(--learn-muted)' }}>
                                {res.fileName}{' '}
                                {res.fileSize ? `• ${(res.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                              </div>
                            </div>
                          </div>
                          {res.downloadUrl && (
                            <a
                              href={resolveMediaUrl(res.downloadUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="button button-soft"
                              style={{ minHeight: 36, padding: '6px 12px', fontSize: 12.5 }}
                            >
                              {t('Tải tài liệu')}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </article>

          <aside className="lesson-timeline" aria-label={t('Nội dung khóa học')}>
            <div className="lesson-timeline-heading">
              <h2>{t('Nội dung khóa học')}</h2>
              <p>
                {sections.length} {t('chương,')} {allLessons.length} {t('bài học')}
              </p>
            </div>
            {sections.length === 0 && !courseLoading && (
              <div className="learning-empty">
                <p>{t('Khóa học này chưa có bài giảng nào.')}</p>
              </div>
            )}

            <div className="timeline-sections-stack">
              {sections.map((section, sIndex) => (
                <div key={section.id || sIndex} className="timeline-section-group">
                  <div className="timeline-section-header">
                    {t('Chương')} {sIndex + 1}: {t(section.title)}
                  </div>

                  <div className="timeline-lessons-list">
                    {(section.lessons || []).map((item, lIndex) => {
                      const isSelected = item.id === currentLesson?.id;
                      const isDone = lessonStatus(progressByLesson.get(item.id)) === 'COMPLETED';

                      return (
                        <button
                          key={item.id}
                          className={`lesson-progress-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => openLesson(item.id)}
                          type="button"
                          disabled={updatingLessonId != null}
                          aria-current={isSelected ? 'step' : undefined}
                          aria-label={`${lIndex + 1}. ${item.title}${isDone ? t(', đã hoàn thành') : ''}`}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="timeline-lesson-title">
                              {lIndex + 1}. {t(item.title)}
                            </div>
                            <div className="timeline-lesson-sub">
                              <span>{item.lessonType}</span>
                              {item.duration ? (
                                <span>
                                  • {Math.round(item.duration / 60)} {t('phút')}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <span
                            className={`timeline-status-pill ${isDone ? 'is-done' : isSelected ? 'is-active' : ''}`}
                          >
                            {isDone ? '✓' : isSelected ? '▶' : lIndex + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {!usingFallback && (
          <section className="course-quiz-section">
            <h2>{t('Bài kiểm tra & Đánh giá năng lực')}</h2>
            {quizzesLoading && <p role="status">{t('Đang tải quiz...')}</p>}
            {quizError && (
              <ErrorState error={quizError} title={t('Không thể tải quiz')} onRetry={quizzes.reload} />
            )}
            {!quizzesLoading && !quizError && courseQuizzes.length === 0 && (
              <p style={{ color: 'var(--learn-muted)', marginTop: 8 }}>
                {t('Khóa học chưa có quiz được xuất bản.')}
              </p>
            )}
            <div className="course-quiz-list">
              {courseQuizzes.map(quiz => (
                <Link className="course-quiz-link" to={`/quizzes/${quiz.id}`} key={quiz.id}>
                  <strong>{t(quiz.title)}</strong>
                  <span>
                    {quiz.timeLimitMinutes ? quiz.timeLimitMinutes + ' phút — ' : ''}
                    {t('Điểm đạt')} {quiz.passingScore}%
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default function LearningPage() {
  useLocale();
  const { courseId } = useParams();
  const session = useSyncExternalStore(subscribeToSession, getSessionVersion, getSessionVersion);
  return <LearningCoursePage key={courseId + ':' + session} courseId={courseId} />;
}
