import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { courseApi } from '../../courses/api/courseApi';
import { sectionApi } from '../../courses/api/sectionApi';
import { lessonApi } from '../../courses/api/lessonApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useToast from '../../../shared/hooks/useToast';
import ErrorState from '../../../shared/components/ErrorState';
import '../styles/quiz.css';

const progressValue = item => item?.progressPercent ?? 0;
const lessonStatus = item => item?.status ?? 'NOT_STARTED';

export default function LearningPage() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  // Course & Curriculum state from course-service
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [courseLoading, setCourseLoading] = useState(true);

  // Learning progress state from learning-service
  const [progressItems, setProgressItems] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [updatingLessonId, setUpdatingLessonId] = useState(null);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Active lesson play data (pre-signed URL, video/content)
  const [playData, setPlayData] = useState(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState(null);

  // Quizzes state
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  const [quizError, setQuizError] = useState(null);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  // 1. Load Course details & Sections/Lessons from course-service
  useEffect(() => {
    let active = true;
    setCourseLoading(true);

    Promise.all([
      courseApi.getById(courseId).catch(() => null),
      sectionApi.listByCourse(courseId).catch(() => null),
    ]).then(([courseRes, sectionsRes]) => {
      if (!active) return;
      const cData = courseRes?.data?.data || courseRes?.data || courseRes;
      if (cData) setCourse(cData);

      const sData = sectionsRes?.data?.data || sectionsRes?.data || [];
      const validSections = Array.isArray(sData) ? sData : [];
      setSections(validSections);

      // Determine initial lesson to select
      const allLessons = validSections.flatMap(s => s.lessons || []);
      const urlLessonId = searchParams.get('lessonId');
      if (urlLessonId && allLessons.some(l => String(l.id) === String(urlLessonId))) {
        setSelectedLessonId(Number(urlLessonId));
      } else if (allLessons.length > 0) {
        setSelectedLessonId(allLessons[0].id);
      }
    }).finally(() => {
      if (active) setCourseLoading(false);
    });

    return () => {
      active = false;
    };
  }, [courseId, searchParams]);

  // 2. Load Learning Progress from learning-service
  useEffect(() => {
    let active = true;
    learningApi
      .getCourseProgress(courseId)
      .then(response => {
        if (!active) return;
        const next = response?.data ?? [];
        setProgressItems(next);
        setUsingFallback(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err);
        setUsingFallback(true);
      });

    return () => {
      active = false;
    };
  }, [courseId]);

  // 3. Load Course Quizzes
  useEffect(() => {
    if (courseLoading || usingFallback) return;
    let active = true;
    setQuizzesLoading(true);
    learningApi
      .getCourseQuizzes(courseId)
      .then(response => {
        if (!active) return;
        setCourseQuizzes(response.data ?? []);
        setQuizError(null);
      })
      .catch(loadError => {
        if (!active) return;
        setCourseQuizzes([]);
        setQuizError(loadError);
      })
      .finally(() => {
        if (active) setQuizzesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [courseId, courseLoading, usingFallback]);

  // Flat list of all lessons in this course
  const allLessons = useMemo(() => {
    const list = [];
    sections.forEach(sec => {
      (sec.lessons || []).forEach(l => {
        list.push({ ...l, sectionTitle: sec.title });
      });
    });
    return list;
  }, [sections]);

  // Currently selected lesson object
  const currentLesson = useMemo(() => {
    if (!selectedLessonId) return allLessons[0] || null;
    return allLessons.find(l => String(l.id) === String(selectedLessonId)) || allLessons[0] || null;
  }, [allLessons, selectedLessonId]);

  // Progress mapping
  const progressByLesson = useMemo(() => {
    const next = new Map();
    progressItems.forEach(item => next.set(item.lessonId, item));
    return next;
  }, [progressItems]);

  const selectedProgress = currentLesson ? progressByLesson.get(currentLesson.id) : null;
  const completedCount = allLessons.filter(l => lessonStatus(progressByLesson.get(l.id)) === 'COMPLETED').length;
  const courseProgress = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  // 4. Load Play URL whenever selected lesson changes
  const loadPlayUrl = useCallback(async (lessonId) => {
    if (!lessonId) return;
    setPlayLoading(true);
    setPlayError(null);
    try {
      const res = await lessonApi.getPlayUrl(courseId, lessonId);
      const data = res?.data?.data || res?.data || res;
      setPlayData(data);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể tải link phát bài học.';
      setPlayError(msg);
      setPlayData(null);
    } finally {
      setPlayLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (currentLesson?.id) {
      loadPlayUrl(currentLesson.id);
    }
  }, [currentLesson?.id, loadPlayUrl]);

  function mergeProgress(nextProgress) {
    setProgressItems(previous => {
      const exists = previous.some(item => item.lessonId === nextProgress.lessonId);
      if (exists) {
        return previous.map(item => (item.lessonId === nextProgress.lessonId ? nextProgress : item));
      }
      return [...previous, nextProgress].sort((a, b) => a.lessonId - b.lessonId);
    });
  }

  async function openLesson(lessonId) {
    setSelectedLessonId(lessonId);
    setSearchParams({ lessonId: String(lessonId) }, { replace: true });

    if (usingFallback) return;
    setUpdatingLessonId(lessonId);
    try {
      const response = await learningApi.accessLesson(courseId, lessonId);
      if (response?.data) mergeProgress(response.data);
    } catch (err) {
      setError(err);
    } finally {
      setUpdatingLessonId(null);
    }
  }

  async function completeLesson() {
    if (!currentLesson?.id) return;
    setUpdatingLessonId(currentLesson.id);
    try {
      const response = await learningApi.markLessonComplete(courseId, currentLesson.id);
      if (response?.data) mergeProgress(response.data);
      toast('Đã đánh dấu hoàn thành bài học.');
    } catch (err) {
      setError(err);
    } finally {
      setUpdatingLessonId(null);
    }
  }

  return (
    <section className="learning-page">
      <div className="learning-shell learning-studio">
        {/* Header with real Course title & navigation */}
        <div className="learning-page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Link to={`/courses/${courseId}`} style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                ← Quay lại trang chi tiết
              </Link>
              {course?.level && (
                <span style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569' }}>
                  {course.level}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 24, margin: 0, color: '#0f172a' }}>
              {course?.title || `Khóa học #${courseId}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link className="button button-outline" to="/my-courses">
              Khóa học của tôi
            </Link>
          </div>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-studio-grid" aria-busy={courseLoading}>
          {/* Main Stage: Video / Content Player */}
          <article className="lesson-stage" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Progress Bar Header */}
            <div className="course-progress-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Tiến độ hoàn thành: {completedCount}/{allLessons.length} bài học</span>
                <strong style={{ fontSize: 20 }}>{courseProgress}%</strong>
              </div>
              <ProgressBar value={courseProgress} />
            </div>

            {/* Video / Content Display */}
            <div style={{ margin: '16px 0 24px' }}>
              {playLoading ? (
                <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', borderRadius: 8, color: '#94a3b8' }}>
                  <p>⏳ Đang cấp link phát bài giảng bảo mật...</p>
                </div>
              ) : playError ? (
                <div style={{ padding: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600 }}>{playError}</p>
                  <button className="button button-primary" style={{ marginTop: 12 }} onClick={() => loadPlayUrl(currentLesson?.id)}>
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
                  ) : (
                    <div style={{ background: '#f8fafc', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 240 }}>
                      <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>📄 Tài liệu bài giảng</h4>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                        {playData.content || currentLesson?.content || 'Chưa có nội dung văn bản cho bài học này.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: 8, color: '#64748b' }}>
                  <p>Chọn một bài học từ danh sách bên phải để bắt đầu học.</p>
                </div>
              )}
            </div>

            {/* Lesson Title & Completion Controls */}
            {currentLesson && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
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
                        Trạng thái: <strong>{lessonStatus(selectedProgress) === 'COMPLETED' ? '✅ Đã hoàn thành' : '⏳ Đang học'}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    className={`button ${lessonStatus(selectedProgress) === 'COMPLETED' ? 'button-outline' : 'button-primary'}`}
                    disabled={updatingLessonId === currentLesson.id || lessonStatus(selectedProgress) === 'COMPLETED'}
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
                  <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#475569' }}>
                    <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Ghi chú bài giảng:</h4>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentLesson.content}</p>
                  </div>
                )}
              </div>
            )}
          </article>

          {/* Curriculum Sidebar: Real Sections & Lessons created by Admin */}
          <aside className="lesson-timeline" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Nội dung khóa học</h2>

            {sections.length === 0 && !courseLoading && (
              <p style={{ color: '#64748b', fontSize: 14 }}>Khóa học này chưa có bài giảng nào.</p>
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
                                {item.lessonType === 'VIDEO' ? '🎬' : item.lessonType === 'DOCUMENT' ? '📄' : '📝'}
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
                    {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} phút · ` : ''}Điểm đạt{' '}
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
