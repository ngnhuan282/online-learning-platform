import LearningNotice from '../components/LearningNotice';
import { learningApi } from '../api/learningApi';
import { demoLearningDashboard } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';

export default function NotificationsPage() {
  const fallback = demoLearningDashboard.notifications;
  const { data, error, loading, usingFallback } = useLearningResource(
    learningApi.getNotifications,
    fallback,
  );

  return (
    <section className="learning-page">
      <div className="learning-shell">
        <div className="learning-page-header">
          <div>
            <p>Notifications</p>
            <h1>Thông báo học tập</h1>
          </div>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <div className="notification-list" aria-busy={loading}>
          {data.map(notification => (
            <article className={`notification-item ${notification.read ? '' : 'is-unread'}`} key={notification.id}>
              <span className="learning-chip">{notification.type}</span>
              <h2>{notification.title}</h2>
              <p>{notification.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
