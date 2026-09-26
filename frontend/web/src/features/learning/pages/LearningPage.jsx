import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoCourseProgress } from '../data/learningDemoData';
import useToast from '../../../shared/hooks/useToast';

const DEFAULT_LESSON_IDS = [1, 2, 3, 4, 5];

const progressValue = item => item?.progressPercent ?? 0;

const lessonStatus = item => item?.status ?? 'NOT_STARTED';

export default function LearningPage() {
  const { courseId } = useParams();
  const toast = useToast();
  const [progressItems, setProgressItems] = useState(demoCourseProgress);
  const [selectedLessonId, setSelectedLessonId] = useState(DEFAULT_LESSON_IDS[0]);
  const [loading, setLoading] = useState(true);
  const [updatingLessonId, setUpdatingLessonId] = useState(null);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });

    learningApi
      .getCourseProgress(courseId)
      .then(response => {
        if (!active) return;
        const next = response?.data ?? [];
        setProgressItems(next);
        setUsingFallback(false);
        if (next[0]?.lessonId) setSelectedLessonId(next[0].lessonId);
      })
      .catch(error => {
        if (!active) return;
        setProgressItems(demoCourseProgress);
        setError(error);
        setUsingFallback(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [courseId]);

  const progressByLesson = useMemo(() => {
    const next = new Map();
    progressItems.forEach(item => next.set(item.lessonId, item));
    return next;
  }, [progressItems]);

  const lessons = useMemo(() => {
    const ids = new Set(DEFAULT_LESSON_IDS);
    progressItems.forEach(item => ids.add(item.lessonId));
    return [...ids].sort((a, b) => a - b).map(lessonId => ({
      lessonId,
      progress: progressByLesson.get(lessonId),
    }));
  }, [progressByLesson, progressItems]);

  const selectedProgress = progressByLesson.get(selectedLessonId);
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

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-studio-grid" aria-busy={loading}>
          <article className="lesson-stage">
            <div className="course-progress-summary">
              <span>Tiến độ khóa học</span>
              <strong>{courseProgress}%</strong>
              <ProgressBar value={courseProgress} />
            </div>
            <div className="lesson-player">
              <span>Lesson #{selectedLessonId}</span>
              <strong>{lessonStatus(selectedProgress) === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang học'}</strong>
            </div>
            <h2>Lesson #{selectedLessonId}</h2>
            <p>
              Mở bài học sẽ ghi nhận trạng thái đang học. Khi bạn hoàn tất nội dung, hãy đánh dấu hoàn
              thành để cập nhật Course Progress.
            </p>
            <button
              className="button button-primary"
              disabled={
                loading ||
                usingFallback ||
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
                className={`lesson-progress-item ${
                  item.lessonId === selectedLessonId ? 'is-selected' : ''
                }`}
                key={item.lessonId}
                onClick={() => openLesson(item.lessonId)}
                type="button"
              >
                <div>
                  <strong>Lesson #{item.lessonId}</strong>
                  <span>{lessonStatus(item.progress)}</span>
                </div>
                <ProgressBar value={progressValue(item.progress)} />
              </button>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}
