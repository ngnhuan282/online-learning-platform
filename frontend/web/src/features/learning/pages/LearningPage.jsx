import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { sectionApi } from '../../courses/api/sectionApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useToast from '../../../shared/hooks/useToast';
import ErrorState from '../../../shared/components/ErrorState';
import '../styles/quiz.css';

const progressValue = item => item?.progressPercent ?? 0;

const lessonStatus = item => item?.status ?? 'NOT_STARTED';

export default function LearningPage() {
  const { courseId } = useParams();
  const toast = useToast();
  const [progressItems, setProgressItems] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingLessonId, setUpdatingLessonId] = useState(null);
  const [error, setError] = useState(null);
  const usingFallback = Boolean(error);
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  const [quizError, setQuizError] = useState(null);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });

    Promise.all([learningApi.getCourseProgress(courseId), sectionApi.listByCourse(courseId)])
      .then(([response, sections]) => {
        if (!active) return;
        const next = response?.data ?? [];
        setProgressItems(next);
        const items = sections.data.flatMap(section => section.lessons ?? []);
        setCurriculum(items);
        setSelectedLessonId(items[0]?.id ?? null);
      })
      .catch(error => {
        if (!active) return;
        setProgressItems([]);
        setCurriculum([]);
        setError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [courseId]);

  useEffect(() => {
    if (loading || usingFallback) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setQuizzesLoading(true);
      setCourseQuizzes([]);
      setQuizError(null);
    });
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
  }, [courseId, loading, usingFallback]);

  const progressByLesson = useMemo(() => {
    const next = new Map();
    progressItems.forEach(item => next.set(item.lessonId, item));
    return next;
  }, [progressItems]);

  const lessons = useMemo(() => {
    return curriculum.map(lesson => ({
      ...lesson,
      lessonId: lesson.id,
      progress: progressByLesson.get(lesson.id),
    }));
  }, [progressByLesson, curriculum]);

  const selectedProgress = progressByLesson.get(selectedLessonId);
  const selectedLesson = curriculum.find(lesson => lesson.id === selectedLessonId);
  const completedCount = lessons.filter(item => lessonStatus(item.progress) === 'COMPLETED').length;
  const courseProgress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

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
    if (usingFallback) return;
    setUpdatingLessonId(lessonId);
    try {
      const response = await learningApi.accessLesson(courseId, lessonId);
      mergeProgress(response.data);
    } catch (error) {
      setError(error);
    } finally {
      setUpdatingLessonId(null);
    }
  }

  async function completeLesson() {
    if (usingFallback || !selectedLessonId) return;
    setUpdatingLessonId(selectedLessonId);
    try {
      const response = await learningApi.markLessonComplete(courseId, selectedLessonId);
      mergeProgress(response.data);
      toast('Đã đánh dấu hoàn thành bài học.');
    } catch (error) {
      setError(error);
    } finally {
      setUpdatingLessonId(null);
    }
  }

  return (
    <section className="learning-page">
      <div className="learning-shell learning-studio">
        <div className="learning-page-header">
          <div>
            <p>Learning Page</p>
            <h1>Course #{courseId}</h1>
          </div>
          <Link className="button button-outline" to="/my-courses">
            Khóa học của tôi
          </Link>
        </div>

        {error && (
          <ErrorState
            error={error}
            title={error.status === 403 ? 'Bạn chưa có quyền học khóa này' : 'Không thể tải bài học'}
          />
        )}

        {!error && (
          <div className="learning-studio-grid" aria-busy={loading}>
            <article className="lesson-stage">
              <div className="course-progress-summary">
                <span>Tiến độ khóa học</span>
                <strong>{courseProgress}%</strong>
                <ProgressBar value={courseProgress} />
              </div>
              <div className="lesson-player">
                {selectedLesson?.videoUrl && (
                  <video controls src={resolveMediaUrl(selectedLesson.videoUrl)} />
                )}
                <span>Lesson #{selectedLessonId}</span>
                <strong>
                  {lessonStatus(selectedProgress) === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang học'}
                </strong>
              </div>
              <h2>{selectedLesson?.title ?? 'Đang tải bài học'}</h2>
              {selectedLesson?.content && <p>{selectedLesson.content}</p>}
              <p>
                Mở bài học sẽ ghi nhận trạng thái đang học. Khi bạn hoàn tất nội dung, hãy đánh dấu hoàn thành
                để cập nhật Course Progress.
              </p>
              <button
                className="button button-primary"
                disabled={
                  loading ||
                  usingFallback ||
                  !selectedLessonId ||
                  updatingLessonId === selectedLessonId ||
                  lessonStatus(selectedProgress) === 'COMPLETED'
                }
                onClick={completeLesson}
              >
                {lessonStatus(selectedProgress) === 'COMPLETED'
                  ? 'Đã hoàn thành'
                  : updatingLessonId === selectedLessonId
                    ? 'Đang cập nhật...'
                    : 'Đánh dấu hoàn thành'}
              </button>
            </article>

            <aside className="lesson-timeline">
              <h2>Tiến độ bài học</h2>
              {lessons.map(item => (
                <button
                  className={`lesson-progress-item ${item.lessonId === selectedLessonId ? 'is-selected' : ''}`}
                  key={item.lessonId}
                  onClick={() => openLesson(item.lessonId)}
                  type="button"
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{lessonStatus(item.progress)}</span>
                  </div>
                  <ProgressBar value={progressValue(item.progress)} />
                </button>
              ))}
            </aside>
          </div>
        )}
        {!usingFallback && (
          <section className="course-quiz-section">
            <h2>Bài kiểm tra</h2>
            {quizzesLoading && <p>Đang tải quiz...</p>}
            {quizError && <ErrorState error={quizError} title="Không thể tải quiz" />}
            {!quizzesLoading && !quizError && courseQuizzes.length === 0 && (
              <p>Khóa học chưa có quiz được xuất bản.</p>
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
