import { Link } from 'react-router-dom';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import ChecklistOutlined from '@mui/icons-material/ChecklistOutlined';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import QuizOutlined from '@mui/icons-material/QuizOutlined';
import LearningHeader from '../components/LearningHeader';
import ErrorState from '../../../shared/components/ErrorState';
import AppLoading from '../../../shared/components/AppLoading';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import useNotifications from '../hooks/useNotifications';

const emptyDashboard = {
  activeEnrollments: 0,
  completedEnrollments: 0,
  completedLessons: 0,
  recentEnrollments: [],
  recentQuizResults: [],
};

const enrollmentLabels = { ACTIVE: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };

export default function UserDashboardPage() {
  const notifications = useNotifications();
  const { data, error, loading, reload } = useLearningResource(
    learningApi.getDashboard,
    emptyDashboard,
    notifications.revision,
  );

  const stats = [
    { label: 'Khóa đang học', value: data.activeEnrollments, Icon: AutoStoriesOutlined },
    { label: 'Khóa hoàn thành', value: data.completedEnrollments, Icon: TaskAltOutlined },
    { label: 'Bài đã xong', value: data.completedLessons, Icon: ChecklistOutlined },
    {
      label: 'Thông báo mới',
      value: notifications.error ? '—' : (notifications.summary.unreadCount ?? '—'),
      notification: true,
      Icon: NotificationsNone,
    },
  ];

  return (
    <section className="learning-page">
      <div className="learning-shell">
        <LearningHeader
          title="Bảng điều khiển học tập"
          description="Tiếp tục hành trình học và theo dõi kết quả của bạn."
        >
          <Link className="button button-primary" to="/my-courses">
            Vào khóa học của tôi
            <ArrowForwardRounded fontSize="small" aria-hidden="true" />
          </Link>
        </LearningHeader>

        {loading && <AppLoading label="Đang tải bảng điều khiển..." />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {notifications.error && (
          <ErrorState
            error={notifications.error}
            title="Không thể tải thông báo"
            onRetry={notifications.refresh}
          />
        )}

        <div className="learning-stats" aria-busy={loading}>
          {stats.map(({ Icon, ...item }) => (
            <article className="learning-stat-card" key={item.label}>
              <div className="learning-stat-heading">
                <span>{item.label}</span>
                <Icon fontSize="small" aria-hidden="true" />
              </div>
              <strong>{!item.notification && (loading || error) ? '—' : item.value}</strong>
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
              {!loading && !error && data.recentEnrollments.length === 0 && (
                <div className="learning-empty">
                  <AutoStoriesOutlined aria-hidden="true" />
                  <p>Bạn chưa ghi danh khóa học nào.</p>
                  <Link to="/courses">Khám phá khóa học</Link>
                </div>
              )}
              {data.recentEnrollments.map(enrollment =>
                enrollment.status === 'CANCELLED' ? (
                  <div className="learning-row" key={enrollment.id}>
                    <span>Khóa học #{enrollment.courseId}</span>
                    <b className="learning-chip">{enrollmentLabels[enrollment.status]}</b>
                  </div>
                ) : (
                  <Link className="learning-row" to={`/learning/${enrollment.courseId}`} key={enrollment.id}>
                    <span>Khóa học #{enrollment.courseId}</span>
                    <b className={`learning-chip ${enrollment.status === 'COMPLETED' ? 'is-success' : ''}`}>
                      {enrollmentLabels[enrollment.status] ?? enrollment.status}
                    </b>
                  </Link>
                ),
              )}
            </div>
          </article>

          <article className="learning-panel">
            <div className="learning-panel-heading">
              <h2>Quiz gần đây</h2>
            </div>
            <div className="learning-list">
              {!loading && !error && data.recentQuizResults.length === 0 && (
                <div className="learning-empty">
                  <QuizOutlined aria-hidden="true" />
                  <p>Bạn chưa có kết quả quiz.</p>
                  <span>Kết quả sẽ xuất hiện sau khi bạn nộp bài.</span>
                </div>
              )}
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
