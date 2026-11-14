import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutlineOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
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
    // The enrolled curriculum already contains authorized content and signed media URLs.
    if (currentLesson.lessonType === 'TEXT' || isMediaUrl(currentLesson.videoUrl)) {
      return { data: { ...currentLesson, lessonId: currentLesson.id, playUrl: currentLesson.videoUrl } };
    }
    // Opaque storage keys are resolved by Course; the browser cannot play them directly.
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

  const [lessonResources, setLessonResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    let active = true;
    if (currentLesson?.id) {
      setLoadingResources(true);
      mediaApi
        .listResources(currentLesson.id)
        .then(res => {
          if (!active) return;
          const data = res?.data?.data ?? res?.data ?? [];
          setLessonResources(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (active) setLessonResources([]);
        })
        .finally(() => {
          if (active) setLoadingResources(false);
        });
    } else {
      setLessonResources([]);
    }
    return () => {
      active = false;
    };
  }, [currentLesson?.id]);

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
          <LearningHeader title="Không gian học tập" />
          {snapshot.loading ? (
            <AppLoading label="Đang tải nội dung học..." />
          ) : (
            <ErrorState
              error={snapshot.error ?? new Error('Không tìm thấy nội dung khóa học.')}
              title={
                snapshot.error?.status === 403 ? 'Bạn chưa có quyền học khóa này' : 'Không thể mở khóa học'
              }
              onRetry={snapshot.reload}
            />
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
          description="Học theo từng bài, lưu tiến độ và kiểm tra kiến thức."
        >
          {course.level && (
            <span
              style={{
                fontSize: 12,
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: 4,
                color: '#475569',
              }}
            >
              {course.level}
            </span>
          )}
          <Link className="button button-outline" to={`/courses/${courseId}`}>
            Chi tiết khóa học
          </Link>
          <Link
            className="button button-outline"
            to={`${ROUTES.AI_ASSISTANT}?courseId=${encodeURIComponent(courseId)}${currentLesson ? `&lessonId=${encodeURIComponent(currentLesson.id)}` : ''}`}
          >
            <AutoAwesomeOutlined fontSize="small" /> Trợ lý AI
          </Link>
          <Link className="button button-primary" to="/my-courses">
            Khóa học của tôi
          </Link>
        </LearningHeader>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-studio-grid" aria-busy={courseLoading}>
          <article className="lesson-stage">
            <div className="course-progress-summary">
              <div className="learning-progress-heading">
                <span>
                  Tiến độ hoàn thành: {completedCount}/{allLessons.length} bài học
                </span>
                <strong>{courseProgress}%</strong>
              </div>
              <ProgressBar value={courseProgress} />
            </div>

            <div className="learning-media">
              {playLoading ? (
                <div className="learning-media-placeholder" role="status">
                  <AppLoading label="Đang tải bài giảng..." />
                </div>
              ) : playError ? (
                <div className="learning-media-placeholder is-error" role="alert">
                  <p>{playError}</p>
                  <button className="button button-primary" type="button" onClick={loadPlayUrl}>
                    Thử lại
                  </button>
                </div>
              ) : playData ? (
                <div>
                  {playData.lessonType === 'VIDEO' ? (
                    playData.playUrl?.includes('youtube.com') || playData.playUrl?.includes('youtu.be') ? (
                      <iframe
                        src={playData.playUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                        title={currentLesson?.title || 'Bài học'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ width: '100%', height: 440, border: 'none', borderRadius: 8 }}
                      />
                    ) : (
                      <video
                        controls
                        autoPlay
                        controlsList="nodownload"
                        src={resolveMediaUrl(playData.playUrl)}
                        onPlay={() => {
                          if (!selectedProgress || selectedProgress.status === 'NOT_STARTED') openLesson(currentLesson.id);
                        }}
                        onError={(e) => {
                          if (!e.currentTarget.dataset.fallbackTried) {
                            e.currentTarget.dataset.fallbackTried = 'true';
                            e.currentTarget.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                            e.currentTarget.load();
                            e.currentTarget.play().catch(() => {});
                          }
                        }}
                        style={{ width: '100%', maxHeight: 460, background: '#000', borderRadius: 8, display: 'block' }}
                      >
                        Trình duyệt của bạn không hỗ trợ phát video này.
                      </video>
                    )
                  ) : playData.lessonType === 'DOCUMENT' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#f8fafc',
                          padding: '14px 18px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>📄</span>
                          <div>
                            <strong style={{ fontSize: 15, color: '#0f172a' }}>Tài liệu bài học: {currentLesson?.title}</strong>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Định dạng văn bản / PDF học tập</div>
                          </div>
                        </div>
                        {(playData.playUrl || currentLesson?.videoUrl) && (
                          <a
                            href={resolveMediaUrl(playData.playUrl || currentLesson?.videoUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-primary"
                            style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}
                          >
                            ⬇️ Mở / Tải tài liệu
                          </a>
                        )}
                      </div>

                      {(playData.playUrl || currentLesson?.videoUrl)?.toLowerCase().includes('.pdf') ? (
                        <iframe
                          src={resolveMediaUrl(playData.playUrl || currentLesson?.videoUrl)}
                          title={currentLesson?.title || 'Tài liệu PDF'}
                          style={{ width: '100%', height: 520, border: '1px solid #cbd5e1', borderRadius: 8 }}
                        />
                      ) : null}

                      {currentLesson?.content && (
                        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                          {currentLesson.content}
                        </div>
                      )}
                    </div>
                  ) : playData.lessonType === 'QUIZ' ? (
                    <div
                      style={{
                        background: '#f0fdf4',
                        padding: '40px 24px',
                        borderRadius: 12,
                        border: '1px solid #bbf7d0',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>✅</span>
                      <h3 style={{ margin: '0 0 10px', color: '#166534', fontSize: 22 }}>
                        Bài kiểm tra: {currentLesson?.title}
                      </h3>
                      <p style={{ color: '#15803d', fontSize: 14, maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.5 }}>
                        Hãy thực hiện bài kiểm tra này để củng cố kiến thức và ghi nhận tiến độ khóa học của bạn.
                      </p>
                      {(() => {
                        const qId = currentLesson?.content?.match(/^\d+$/)
                          ? currentLesson.content
                          : courseQuizzes.find(q => q.title === currentLesson?.title)?.id || currentLesson?.content;
                        return qId ? (
                          <Link
                            to={`/quizzes/${qId}`}
                            className="button button-primary"
                            style={{
                              padding: '12px 28px',
                              fontSize: 16,
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            🚀 Bắt đầu làm bài Quiz ngay
                          </Link>
                        ) : (
                          <p style={{ color: '#64748b', fontSize: 13 }}>Chưa liên kết bài quiz cụ thể.</p>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 240 }}>
                      <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>📝 Nội dung bài học lý thuyết</h4>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#334155', fontSize: 15 }}>
                        {playData.content || currentLesson?.content || 'Chưa có nội dung văn bản cho bài học này.'}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="learning-media-placeholder">
                  <AutoStoriesOutlined aria-hidden="true" />
                  <p>Chọn một bài học từ danh sách để bắt đầu học.</p>
                </div>
              )}
              {mediaError && mediaError.lessonId === currentLesson?.id && (
                <ErrorState
                  error={new Error('Không thể phát video. Hãy tải lại nội dung để nhận liên kết mới.')}
                  title="Không thể phát bài học"
                  onRetry={() => {
                    setMediaError(null);
                    snapshot.reload();
                  }}
                />
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
                          {Math.round(currentLesson.duration / 60)} phút
                        </span>
                      ) : null}
                      <span>
                        Trạng thái:{' '}
                        <strong>
                          {lessonStatus(selectedProgress) === 'COMPLETED'
                            ? 'Đã hoàn thành'
                            : lessonStatus(selectedProgress) === 'IN_PROGRESS'
                              ? 'Đang học'
                              : 'Chưa bắt đầu'}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <button
                    className={`button ${lessonStatus(selectedProgress) === 'COMPLETED' ? 'button-outline' : 'button-primary'}`}
                    type="button"
                    disabled={updatingLessonId != null || lessonStatus(selectedProgress) === 'COMPLETED'}
                    onClick={completeLesson}
                  >
                    {lessonStatus(selectedProgress) === 'COMPLETED' ? (
                      <>
                        <CheckCircleOutline fontSize="small" aria-hidden="true" />
                        Đã hoàn thành
                      </>
                    ) : updatingLessonId === currentLesson.id ? (
                      'Đang cập nhật...'
                    ) : (
                      'Đánh dấu hoàn thành'
                    )}
                  </button>
                </div>
                {currentLesson.content && playData?.lessonType === 'VIDEO' && (
                  <div className="learning-lesson-notes">
                    <h3>Ghi chú bài giảng</h3>
                    <p>{currentLesson.content}</p>
                  </div>
                )}

                {/* Attached Lesson Resources */}
                <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📎 Tài liệu đính kèm ({lessonResources.length})
                  </h4>

                  {loadingResources ? (
                    <p style={{ fontSize: 13, color: '#64748b' }}>Đang tải danh sách tài liệu...</p>
                  ) : lessonResources.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                      Bài học này không có tệp đính kèm thêm.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {lessonResources.map(res => (
                        <div
                          key={res.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>
                              {res.resourceType === 'PDF' ? '📕' : res.resourceType === 'VIDEO' ? '🎬' : '📄'}
                            </span>
                            <div>
                              <strong style={{ fontSize: 14, color: '#1e293b' }}>{res.title}</strong>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {res.fileName} {res.fileSize ? `• ${(res.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                              </div>
                            </div>
                          </div>
                          {res.downloadUrl && (
                            <a
                              href={resolveMediaUrl(res.downloadUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="button button-soft"
                              style={{ padding: '4px 12px', fontSize: 12, textDecoration: 'none' }}
                            >
                              ⬇️ Tải tài liệu
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </article>

          <aside className="lesson-timeline" aria-label="Nội dung khóa học">
            <div className="lesson-timeline-heading">
              <h2>Nội dung khóa học</h2>
              <p>
                {sections.length} chương, {allLessons.length} bài học
              </p>
            </div>
            {sections.length === 0 && !courseLoading && (
              <div className="learning-empty">
                <p>Khóa học này chưa có bài giảng nào.</p>
              </div>
            )}

            <div style={{ display: 'grid', gap: 16 }}>
              {sections.map((section, sIndex) => (
                <div key={section.id || sIndex} style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                  {/* Section Title */}
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                    Chương {sIndex + 1}: {section.title}
                  </div>

                  {/* Lessons list inside section */}
                  <div style={{ display: 'grid', gap: 1, background: '#f1f5f9' }}>
                    {(section.lessons || []).map((item, lIndex) => {
                      const isSelected = item.id === currentLesson?.id;
                      const isDone = lessonStatus(progressByLesson.get(item.id)) === 'COMPLETED';

                      return (
                        <button
                          key={item.id}
                          className={`lesson-progress-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => openLesson(item.id)}
                          type="button"
                          style={{
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            borderColor: isSelected ? '#3b82f6' : 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            padding: '12px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 14 }}>
                                {item.lessonType === 'VIDEO' ? '🎬' : item.lessonType === 'DOCUMENT' ? '📄' : item.lessonType === 'QUIZ' ? '✅' : '📝'}
                              </span>
                              <strong style={{ fontSize: 13, color: isSelected ? '#1d4ed8' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lIndex + 1}. {item.title}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
                              {item.duration ? <span>{Math.round(item.duration / 60)} phút</span> : null}
                              {item.preview ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Học thử</span> : null}
                            </div>
                          </div>

                          <span style={{ fontSize: 16 }}>
                            {isDone ? '✅' : isSelected ? '▶️' : '⚪'}
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
            <h2>Bài kiểm tra & Đánh giá năng lực</h2>
            {quizzesLoading && <p role="status">Đang tải quiz...</p>}
            {quizError && (
              <ErrorState error={quizError} title="Không thể tải quiz" onRetry={quizzes.reload} />
            )}
            {!quizzesLoading && !quizError && courseQuizzes.length === 0 && (
              <p>Khóa học chưa có quiz được xuất bản.</p>
            )}
            <div className="course-quiz-list">
              {courseQuizzes.map(quiz => (
                <Link className="course-quiz-link" to={`/quizzes/${quiz.id}`} key={quiz.id}>
                  <strong>{quiz.title}</strong>
                  <span>
                    {quiz.timeLimitMinutes ? quiz.timeLimitMinutes + ' phút — ' : ''}Điểm đạt{' '}
                    {quiz.passingScore}%
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
  const { courseId } = useParams();
  const session = useSyncExternalStore(subscribeToSession, getSessionVersion, getSessionVersion);
  return <LearningCoursePage key={courseId + ':' + session} courseId={courseId} />;
}