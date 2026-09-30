import { Link } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoLearningDashboard } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';

export default function UserDashboardPage() {
  const { data, error, loading, usingFallback } = useLearningResource(
    learningApi.getDashboard,
    demoLearningDashboard,
  );

  const stats = [
    { label: 'Khóa đang học', value: data.activeEnrollments },
    { label: 'Khóa hoàn thành', value: data.completedEnrollments },
    { label: 'Bài đã xong', value: data.completedLessons },
    { label: 'Thông báo mới', value: data.unreadNotifications },
  ];

  return (
    <section className="learning-page">
      <div className="learning-shell">
        <div className="learning-page-header">
          <div>
            <p>Learning workspace</p>
            <h1>Bảng điều khiển học tập</h1>
          </div>
          <Link className="button button-primary" to="/my-courses">
            Vào khóa học của tôi
          </Link>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="learning-stats" aria-busy={loading}>
          {stats.map(item => (
            <article className="learning-stat-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="learning-grid">
          <article className="learning-panel">
            <div className="learning-panel-heading">
              <h2>Khóa học gần đây</h2>
              <Link to="/my-courses">Xem tất cả</Link>
            </div>
            <div className="learning-list">
              {data.recentEnrollments.map(enrollment => (
                <Link
                  className="learning-row"
                  to={`/learning/${enrollment.courseId}`}
                  key={enrollment.id}
                >
                  <span>Course #{enrollment.courseId}</span>
                  <ProgressBar value={enrollment.status === 'COMPLETED' ? 100 : 48} />
                  <b>{enrollment.status}</b>
                </Link>
              ))}
            </div>
          </article>

          <article className="learning-panel">
            <div className="learning-panel-heading">
              <h2>Quiz gần đây</h2>
            </div>
            <div className="learning-list">
              {data.recentQuizResults.map(result => (
                <Link
                  className="learning-row"
                  to={`/quizzes/attempts/${result.attemptId}/result`}
                  key={result.attemptId}
                >
                  <span>Quiz #{result.quizId}</span>
                  <ProgressBar value={result.score ?? 0} />
                  <b>{result.score ?? 0}%</b>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
