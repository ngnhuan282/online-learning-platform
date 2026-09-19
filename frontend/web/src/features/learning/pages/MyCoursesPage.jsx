import { Link } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoLearningDashboard } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';

export default function MyCoursesPage() {
  const fallback = demoLearningDashboard.recentEnrollments;
  const { data, error, loading, usingFallback } = useLearningResource(
    learningApi.getMyEnrollments,
    fallback,
  );

  return (
    <section className="learning-page">
      <div className="learning-shell">
        <div className="learning-page-header">
          <div>
            <p>My Courses</p>
            <h1>Khóa học của tôi</h1>
          </div>
          <Link className="button button-outline" to="/dashboard">
            Bảng điều khiển
          </Link>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="my-course-grid" aria-busy={loading}>
          {data.map(enrollment => (
            <article className="my-course-card" key={enrollment.id}>
              <div>
                <span className="learning-chip">{enrollment.status}</span>
                <h2>Course #{enrollment.courseId}</h2>
                <p>Contract đã sẵn sàng để gắn metadata khóa học từ Course Service.</p>
              </div>
              <ProgressBar value={enrollment.status === 'COMPLETED' ? 100 : 48} />
              <Link className="button button-primary" to={`/learning/${enrollment.courseId}`}>
                Tiếp tục học
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
