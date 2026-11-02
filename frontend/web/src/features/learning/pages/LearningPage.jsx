import { useMemo, useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { ROUTES } from '../../../shared/constants/routes';
import { API_PREFIX, AUTH_CHANGED_EVENT } from '../../../shared/constants/appConstants';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
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

  if (snapshot.loading) return <section className="learning-page"><AppLoading label="Đang tải nội dung học..." /></section>;
  if (snapshot.error || !course) return (
    <section className="learning-page">
      <div className="learning-shell">
        <ErrorState
          error={snapshot.error ?? new Error('Không tìm thấy nội dung khóa học.')}
          title={snapshot.error?.status === 403 ? 'Bạn chưa có quyền học khóa này' : 'Không thể mở khóa học'}
          onRetry={snapshot.reload}
        />
      </div>
    </section>
  );

  return (
    <section className="learning-page">
      <div className="learning-shell learning-studio">
        {/* Header with real Course title & navigation */}
        <div className="learning-page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Link
                to={`/courses/${courseId}`}
                style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
              >
                ← Quay lại trang chi tiết
              </Link>
              {course?.level && (
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
            </div>
            <h1 style={{ fontSize: 24, margin: 0, color: '#0f172a' }}>
              {course?.title || `Khóa học #${courseId}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link className="button button-outline" to={`${ROUTES.AI_ASSISTANT}?courseId=${encodeURIComponent(courseId)}${currentLesson ? `&lessonId=${encodeURIComponent(currentLesson.id)}` : ''}`}>
              <AutoAwesomeOutlined fontSize="small" /> Trợ lý AI
            </Link>
            <Link className="button button-outline" to="/my-courses">
              Khóa học của tôi
            </Link>
          </div>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-studio-grid" aria-busy={courseLoading}>
          {/* Main Stage: Video / Content Player */}
          <article
            className="lesson-stage"
            style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}
          >
            {/* Progress Bar Header */}
            <div className="course-progress-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  Tiến độ hoàn thành: {completedCount}/{allLessons.length} bài học
                </span>
                <strong style={{ fontSize: 20 }}>{courseProgress}%</strong>
              </div>
              <ProgressBar value={courseProgress} />
            </div>

            {/* Video / Content Display */}
            <div style={{ margin: '16px 0 24px' }}>
              {playLoading ? (
                <div
                  style={{
                    height: 380,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0f172a',
                    borderRadius: 8,
                    color: '#94a3b8',
                  }}
                >
                  <p>⏳ Đang cấp link phát bài giảng bảo mật...</p>
                </div>
              ) : playError ? (
                <div
                  style={{
                    padding: 24,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    color: '#dc2626',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontWeight: 600 }}>{playError}</p>
                  <button
                    className="button button-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => loadPlayUrl(currentLesson?.id)}
                  >
                    Thử lại
                  </button>
                </div>
              ) : playData ? (
                <div>
                  {playData.lessonType === 'VIDEO' ? (
                    playData.playUrl?.includes('youtube.com') || playData.playUrl?.includes('youtu.be') ? (
                      <iframe
                        src={playData.playUrl
                          .replace('watch?v=', 'embed/')
                          .replace('youtu.be/', 'www.youtube.com/embed/')}
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
                          if (!selectedProgress || selectedProgress.status === 'NOT_STARTED')
                            openLesson(currentLesson.id);
                        }}
                        onError={() => setMediaError({ lessonId: currentLesson.id, url: playData.playUrl })}
                        style={{
                          width: '100%',
                          maxHeight: 460,
                          background: '#000',
                          borderRadius: 8,
                          display: 'block',
                        }}
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
                            rel="noopener noreferrer"
                            className="button button-primary"
                            style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}
                          >
                            Mở tài liệu bài học
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
                      {playData.lessonType === 'DOCUMENT' && isMediaUrl(playData.playUrl) && (
                        <div style={{ marginBottom: 12 }}>
                          <a href={resolveMediaUrl(playData.playUrl)} target="_blank" rel="noopener noreferrer">
                            Mở tài liệu bài học
                          </a>
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#334155', fontSize: 15 }}>
                        {playData.content || currentLesson?.content || 'Chưa có nội dung văn bản cho bài học này.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f1f5f9',
                    borderRadius: 8,
                    color: '#64748b',
                  }}
                >
                  <p>Chọn một bài học từ danh sách bên phải để bắt đầu học.</p>
                </div>
              )}
              {mediaError?.lessonId === currentLesson?.id && (
                <div style={{ marginTop: 16 }}>
                  <ErrorState
                    error={new Error('Không thể tải video từ máy chủ lưu trữ (Supabase Storage / S3). Có thể dự án Supabase đang tạm dừng hoặc tệp media chưa được tải lên.')}
                    title="Không thể phát bài học"
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
                        style={{ fontSize: 13, textDecoration: 'none' }}
                      >
                        🔗 Mở liên kết video trực tiếp
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lesson Title & Completion Controls */}
            {currentLesson && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 14,
                  }}
                >
                  <div>
                    {currentLesson.sectionTitle && (
                      <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                        {currentLesson.sectionTitle}
                      </span>
                    )}
                    <h2 style={{ fontSize: 22, margin: '4px 0 8px', color: '#0f172a' }}>
                      {currentLesson.title}
                    </h2>
                    <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#64748b' }}>
                      {currentLesson.duration ? (
                        <span>⏱️ Thời lượng: {Math.round(currentLesson.duration / 60)} phút</span>
                      ) : null}
                      <span>
                        Trạng thái:{' '}
                        <strong>
                          {lessonStatus(selectedProgress) === 'COMPLETED'
                            ? '✅ Đã hoàn thành'
                            : '⏳ Đang học'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    className={`button ${lessonStatus(selectedProgress) === 'COMPLETED' ? 'button-outline' : 'button-primary'}`}
                    disabled={
                      updatingLessonId === currentLesson.id || lessonStatus(selectedProgress) === 'COMPLETED'
                    }
                    onClick={completeLesson}
                    style={{ minWidth: 160 }}
                  >
                    {lessonStatus(selectedProgress) === 'COMPLETED'
                      ? '✓ Đã hoàn thành'
                      : updatingLessonId === currentLesson.id
                        ? 'Đang cập nhật...'
                        : 'Đánh dấu hoàn thành'}
                  </button>
                </div>

                {currentLesson.content && playData?.lessonType === 'VIDEO' && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: 16,
                      background: '#f8fafc',
                      borderRadius: 8,
                      fontSize: 14,
                      color: '#475569',
                    }}
                  >
                    <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Ghi chú bài giảng:</h4>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentLesson.content}</p>
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
                              rel="noopener noreferrer"
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

          {/* Curriculum Sidebar: Real Sections & Lessons created by Admin */}
          <aside
            className="lesson-timeline"
            style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Nội dung khóa học</h2>

            {sections.length === 0 && !courseLoading && (
              <p style={{ color: '#64748b', fontSize: 14 }}>Khóa học này chưa có bài giảng nào.</p>
            )}

            <div style={{ display: 'grid', gap: 16 }}>
              {sections.map((section, sIndex) => (
                <div
                  key={section.id || sIndex}
                  style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}
                >
                  {/* Section Title */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#1e293b',
                    }}
                  >
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
                              <strong
                                style={{
                                  fontSize: 13,
                                  color: isSelected ? '#1d4ed8' : '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {lIndex + 1}. {item.title}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
                              {item.duration ? <span>{Math.round(item.duration / 60)} phút</span> : null}
                              {item.preview ? (
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Học thử</span>
                              ) : null}
                            </div>
                          </div>

                          <span style={{ fontSize: 16 }}>{isDone ? '✅' : isSelected ? '▶️' : '⚪'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Quizzes Section (TV3) */}
        {!usingFallback && (
          <section className="course-quiz-section" style={{ marginTop: 32 }}>
            <h2>Bài kiểm tra & Đánh giá năng lực</h2>
            {quizzesLoading && <p>Đang tải quiz...</p>}
            {quizError && <ErrorState error={quizError} title="Không thể tải quiz" />}
            {!quizzesLoading && !quizError && courseQuizzes.length === 0 && (
              <p style={{ color: '#64748b' }}>Khóa học chưa có quiz được xuất bản.</p>
            )}
            <div className="course-quiz-list">
              {courseQuizzes.map(quiz => (
                <Link className="course-quiz-link" to={`/quizzes/${quiz.id}`} key={quiz.id}>
                  <strong>{quiz.title}</strong>
                  <span>
                    {quiz.timeLimitMinutes ? quiz.timeLimitMinutes + ' phút · ' : ''}Điểm đạt{' '}
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

