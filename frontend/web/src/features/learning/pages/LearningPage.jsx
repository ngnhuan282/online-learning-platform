import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import useToast from '../../../shared/hooks/useToast';
import ErrorState from '../../../shared/components/ErrorState';
import AppLoading from '../../../shared/components/AppLoading';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import '../styles/quiz.css';

const statusLabel = status =>
  ({ COMPLETED: 'Đã hoàn thành', IN_PROGRESS: 'Đang học' })[status] || 'Chưa bắt đầu';

function LearningCoursePage({ courseId }) {
  const toast = useToast();
  const loadCourse = useCallback(options => learningApi.getLearningCourse(courseId, options), [courseId]);
  const loadQuizzes = useCallback(() => learningApi.getCourseQuizzes(courseId), [courseId]);
  const emptyQuizzes = useMemo(() => [], []);
  const course = useLearningResource(loadCourse, null);
  const quizzes = useLearningResource(loadQuizzes, emptyQuizzes);
  const [selectedId, setSelectedId] = useState(null);
  const [changes, setChanges] = useState({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const lessons = useMemo(
    () =>
      [...(course.data?.sections ?? [])]
        .sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id)
        .flatMap(section =>
          [...section.lessons]
            .sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id)
            .map(lesson => ({ ...lesson, sectionTitle: section.title })),
        ),
    [course.data],
  );
  const progressByLesson = new Map((course.data?.progress ?? []).map(item => [item.lessonId, item]));
  Object.values(changes).forEach(item => {
    // A refreshed completion from another tab takes precedence over an older local access.
    if (progressByLesson.get(item.lessonId)?.status !== 'COMPLETED') {
      progressByLesson.set(item.lessonId, item);
    }
  });
  const selected = lessons.find(item => item.id === selectedId) ?? lessons[0];
  const selectedProgress = progressByLesson.get(selected?.id);
  const completed = lessons.filter(item => progressByLesson.get(item.id)?.status === 'COMPLETED').length;
  const percent = lessons.length ? Math.round((completed * 100) / lessons.length) : 0;

  async function updateLesson(lesson, complete = false) {
    if (busy || !lesson) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = complete
        ? await learningApi.markLessonComplete(courseId, lesson.id)
        : await learningApi.accessLesson(courseId, lesson.id);
      setChanges(previous => ({ ...previous, [lesson.id]: response.data }));
      setSelectedId(lesson.id);
      if (complete) toast('Đã đánh dấu hoàn thành bài học.');
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="learning-page">
      <div className="learning-shell learning-studio">
        <div className="learning-page-header">
          <div>
            <p>Learning Page</p>
            <h1>{course.data?.title || 'Khóa học #' + courseId}</h1>
          </div>
          <Link className="button button-outline" to="/my-courses">
            Khóa học của tôi
          </Link>
        </div>
        {course.loading && <AppLoading label="Đang tải nội dung học..." />}
        {course.error && (
          <ErrorState error={course.error} title="Không thể mở khóa học" onRetry={course.reload} />
        )}
        {actionError && <ErrorState error={actionError} title="Không thể cập nhật bài học" />}
        {!course.loading && !course.error && course.data && (
          <>
            <div className="learning-studio-grid" aria-busy={busy}>
              <article className="lesson-stage">
                <div className="course-progress-summary">
                  <span>
                    Tiến độ khóa học — {completed}/{lessons.length} bài
                  </span>
                  <strong>{percent}%</strong>
                  <ProgressBar value={percent} />
                </div>
                {!selected ? (
                  <p>Khóa học chưa có bài học.</p>
                ) : (
                  <>
                    <h2>{selected.title}</h2>
                    <p>{statusLabel(selectedProgress?.status)}</p>
                    {selected.lessonType === 'VIDEO' && selected.videoUrl && (
                      <video
                        key={selected.id}
                        controls
                        preload="metadata"
                        className="learning-video"
                        src={resolveMediaUrl(selected.videoUrl)}
                        onPlay={() => {
                          if (!selectedProgress || selectedProgress.status === 'NOT_STARTED')
                            updateLesson(selected);
                        }}
                      />
                    )}
                    {selected.content && <div className="learning-lesson-content">{selected.content}</div>}
                    {selected.lessonType !== 'VIDEO' && selected.videoUrl && (
                      <a href={resolveMediaUrl(selected.videoUrl)} target="_blank" rel="noreferrer">
                        Mở tài liệu bài học
                      </a>
                    )}
                    <button
                      className="button button-primary"
                      disabled={busy || selectedProgress?.status === 'COMPLETED'}
                      onClick={() => updateLesson(selected, true)}
                    >
                      {selectedProgress?.status === 'COMPLETED'
                        ? 'Đã hoàn thành'
                        : busy
                          ? 'Đang cập nhật...'
                          : 'Đánh dấu hoàn thành'}
                    </button>
                  </>
                )}
              </article>
              <aside className="lesson-timeline">
                <h2>Nội dung khóa học</h2>
                {lessons.map(lesson => (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={busy}
                    className={'lesson-progress-item ' + (lesson.id === selected?.id ? 'is-selected' : '')}
                    onClick={() => updateLesson(lesson)}
                  >
                    <div>
                      <strong>{lesson.title}</strong>
                      <span>
                        {lesson.sectionTitle} · {statusLabel(progressByLesson.get(lesson.id)?.status)}
                      </span>
                    </div>
                    <ProgressBar value={progressByLesson.get(lesson.id)?.progressPercent ?? 0} />
                  </button>
                ))}
              </aside>
            </div>
            <section className="course-quiz-section">
              <h2>Bài kiểm tra</h2>
              {quizzes.loading && <p>Đang tải quiz...</p>}
              {quizzes.error && (
                <ErrorState error={quizzes.error} title="Không thể tải quiz" onRetry={quizzes.reload} />
              )}
              {!quizzes.loading && !quizzes.error && quizzes.data.length === 0 && (
                <p>Khóa học chưa có quiz được xuất bản.</p>
              )}
              <div className="course-quiz-list">
                {quizzes.data.map(quiz => (
                  <Link className="course-quiz-link" to={'/quizzes/' + quiz.id} key={quiz.id}>
                    <strong>{quiz.title}</strong>
                    <span>
                      {quiz.timeLimitMinutes ? quiz.timeLimitMinutes + ' phút · ' : ''}Điểm đạt{' '}
                      {quiz.passingScore}%
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

export default function LearningPage() {
  const { courseId } = useParams();
  return <LearningCoursePage key={courseId} courseId={courseId} />;
}
