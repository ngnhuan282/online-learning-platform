import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoCourseProgress } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';

export default function LearningPage() {
  const { courseId } = useParams();
  const loadProgress = useCallback(() => learningApi.getCourseProgress(courseId), [courseId]);
  const { data, error, loading, usingFallback } = useLearningResource(
    loadProgress,
    demoCourseProgress,
  );

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
            <div className="lesson-player">
              <span>16:9</span>
              <strong>Nội dung bài học</strong>
            </div>
            <h2>Không gian học tập</h2>
            <p>
              Skeleton tuần 1 giữ contract tiến độ bài học, sẵn sàng gắn video, tài liệu và ghi chú ở
              các tuần sau.
            </p>
          </article>

          <aside className="lesson-timeline">
            <h2>Tiến độ bài học</h2>
            {data.map(item => (
              <article className="lesson-progress-item" key={item.id}>
                <div>
                  <strong>Lesson #{item.lessonId}</strong>
                  <span>{item.status}</span>
                </div>
                <ProgressBar value={item.progressPercent} />
              </article>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}
