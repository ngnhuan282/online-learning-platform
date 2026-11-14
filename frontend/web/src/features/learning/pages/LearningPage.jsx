import { useMemo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
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
                playData.lessonType === 'VIDEO' ? (
                  embedUrl ? (
                    <iframe
                      key={embedUrl}
                      src={embedUrl}
                      title={currentLesson?.title || 'Bài học'}
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
                      onError={() => setMediaError({ lessonId: currentLesson.id })}
                    >
                      Trình duyệt của bạn không hỗ trợ phát video này.
                    </video>
                  )
                ) : (
                  <div className="learning-document">
                    <h3>
                      <DescriptionOutlined fontSize="small" aria-hidden="true" />
                      Tài liệu bài giảng
                    </h3>
                    {playData.lessonType === 'DOCUMENT' && isMediaUrl(playData.playUrl) && (
                      <a href={resolveMediaUrl(playData.playUrl)} target="_blank" rel="noopener noreferrer">
                        Mở tài liệu bài học
                      </a>
                    )}
                    <div className="learning-document-content">
                      {playData.content ||
                        currentLesson?.content ||
                        'Chưa có nội dung văn bản cho bài học này.'}
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
              </>
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
            {sections.map((section, sIndex) => (
              <section key={section.id || sIndex}>
                <h3 className="learning-curriculum-title">
                  Chương {sIndex + 1}: {section.title}
                </h3>
                {(section.lessons || []).map((item, lIndex) => {
                  const isSelected = item.id === currentLesson?.id;
                  const isDone = lessonStatus(progressByLesson.get(item.id)) === 'COMPLETED';
                  const LessonIcon = item.lessonType === 'VIDEO' ? PlayCircleOutline : DescriptionOutlined;
                  return (
                    <button
                      key={item.id}
                      className={`lesson-progress-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => openLesson(item.id)}
                      type="button"
                      disabled={updatingLessonId != null}
                      aria-current={isSelected ? 'step' : undefined}
                      aria-label={`${lIndex + 1}. ${item.title}${isDone ? ', đã hoàn thành' : ''}`}
                    >
                      <LessonIcon fontSize="small" aria-hidden="true" />
                      <div>
                        <strong>
                          {lIndex + 1}. {item.title}
                        </strong>
                        {item.duration ? <small>{Math.round(item.duration / 60)} phút</small> : null}
                        {item.preview && <small>Học thử</small>}
                      </div>
                      {isDone && <CheckCircleOutline fontSize="small" aria-hidden="true" />}
                    </button>
                  );
                })}
              </section>
            ))}
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