import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import useNotifications from '../hooks/useNotifications';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';

const emptyEnrollments = [];

export default function MyCoursesPage() {
  const notifications = useNotifications();
  const { data, error, loading, reload } = useLearningResource(
    learningApi.getMyEnrollments,
    emptyEnrollments,
    notifications.revision,
  );
  const [details, setDetails] = useState({});

  useEffect(() => {
    let active = true;
    Promise.allSettled(
      data.map(enrollment =>
        enrollment.status === 'CANCELLED'
          ? Promise.resolve(null)
          : learningApi.getLearningCourse(enrollment.courseId),
      ),
    ).then(results => {
      if (!active) return;
      const next = {};
      results.forEach((result, index) => {
        next[data[index].courseId] =
          result.status === 'fulfilled' ? { course: result.value?.data } : { error: result.reason };
      });
      setDetails(next);
    });
    return () => {
      active = false;
    };
  }, [data]);

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
        {loading && <AppLoading label="Đang tải khóa học đã ghi danh..." />}
        {error && <ErrorState error={error} title="Không thể tải khóa học của tôi" onRetry={reload} />}
        {!loading && !error && data.length === 0 && (
          <p>
            Bạn chưa ghi danh khóa học nào. <Link to="/courses">Khám phá khóa học</Link>
          </p>
        )}
        <div className="my-course-grid" aria-busy={loading}>
          {data.map(enrollment => {
            const detail = details[enrollment.courseId];
            return (
              <article className="my-course-card" key={enrollment.id}>
                <div>
                  <span className="learning-chip">
                    {enrollment.status === 'COMPLETED'
                      ? 'Hoàn thành'
                      : enrollment.status === 'CANCELLED'
                        ? 'Đã hủy'
                        : 'Đang học'}
                  </span>
                  <h2>{detail?.course?.title || 'Khóa học #' + enrollment.courseId}</h2>
                </div>
                {detail?.course && (
                  <>
                    <ProgressBar value={detail.course.progressPercent} />
                    <p>
                      {detail.course.progressPercent}% · {detail.course.completedLessons}/
                      {detail.course.totalLessons} bài
                    </p>
                  </>
                )}
                {detail?.error && (
                  <ErrorState error={detail.error} title="Không thể tải tiến độ" onRetry={reload} />
                )}
                <div className="my-course-meta">
                  <span>Ghi danh: {new Date(enrollment.enrolledAt).toLocaleDateString('vi-VN')}</span>
                  {enrollment.lastAccessedAt && (
                    <span>Truy cập: {new Date(enrollment.lastAccessedAt).toLocaleDateString('vi-VN')}</span>
                  )}
                </div>
                {enrollment.status !== 'CANCELLED' && (
                  <Link className="button button-primary" to={'/learning/' + enrollment.courseId}>
                    Tiếp tục học
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
