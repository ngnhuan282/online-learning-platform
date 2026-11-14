import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import LearningHeader from '../components/LearningHeader';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import useLearningResource from '../hooks/useLearningResource';
import useNotifications from '../hooks/useNotifications';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import { formatDate } from '../../../shared/utils/formatDate';

const EMPTY_ENROLLMENTS = [];

export default function MyCoursesPage() {
  const notifications = useNotifications();
  const { data, error, loading, reload } = useLearningResource(
    learningApi.getMyEnrollments,
    EMPTY_ENROLLMENTS,
    notifications.revision,
  );
  const [details, setDetails] = useState({ enrollments: null, values: {} });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    data.forEach(enrollment => {
      if (enrollment.status === 'CANCELLED') return;
      const updateDetail = value => {
        if (!active) return;
        setDetails(previous => ({
          enrollments: data,
          values: {
            ...(previous.enrollments === data ? previous.values : {}),
            [enrollment.courseId]: value,
          },
        }));
      };
      // Render each course as it arrives; a slow request must not hide the other courses' progress.
      Promise.resolve()
        .then(
          () => active && learningApi.getLearningCourse(enrollment.courseId, { signal: controller.signal }),
        )
        .then(response => updateDetail({ course: response?.data }))
        .catch(error => updateDetail({ error }));
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [data]);

  const visibleEnrollments = data.filter(enrollment => {
    const detail = details.enrollments === data ? details.values[enrollment.courseId] : null;
    const title = detail?.course?.title || enrollment.course?.title || 'Khóa học #' + enrollment.courseId;
    return (
      (!status || enrollment.status === status) &&
      title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
    );
  });

  return (
    <section className="learning-page">
      <div className="learning-shell">
        <LearningHeader
          title="Khóa học của tôi"
          description="Tất cả khóa học và tiến độ học của bạn ở một nơi."
        >
          <Link className="button button-outline" to="/dashboard">
            Bảng điều khiển
          </Link>
        </LearningHeader>

        {loading && <AppLoading label="Đang tải khóa học đã ghi danh..." />}

        {error && <ErrorState error={error} title="Không thể tải khóa học của tôi" onRetry={reload} />}

        {!loading && !error && data.length === 0 && (
          <div className="learning-empty">
            <AutoStoriesOutlined aria-hidden="true" />
            <p>
              Bạn chưa ghi danh khóa học nào. <Link to="/courses">Khám phá khóa học</Link>
            </p>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="learning-collection-toolbar">
            <span>
              {visibleEnrollments.length} / {data.length} khóa học
            </span>
            <div className="learning-collection-search">
              <input
                type="search"
                aria-label="Tìm khóa học đã ghi danh"
                placeholder="Tìm khóa học..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select
                aria-label="Trạng thái khóa học"
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang học</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
          </div>
        )}

        {!loading && !error && data.length > 0 && visibleEnrollments.length === 0 && (
          <div className="learning-empty">
            <p>Không có khóa học phù hợp.</p>
            <button
              className="button button-outline"
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        <div className="my-course-grid" aria-busy={loading}>
          {visibleEnrollments.map(enrollment => {
            const detail = details.enrollments === data ? details.values[enrollment.courseId] : null;
            const title = detail?.course?.title || enrollment.course?.title;
            const description = detail?.course?.description || enrollment.course?.description;

            return (
              <article className="my-course-card" key={enrollment.id}>
                <div>
                  <div className="learning-course-title">
                    <span
                      className={`learning-chip ${enrollment.status === 'COMPLETED' ? 'is-success' : enrollment.status === 'CANCELLED' ? 'is-cancelled' : ''}`}
                    >
                      {enrollment.status === 'COMPLETED'
                        ? 'Hoàn thành'
                        : enrollment.status === 'CANCELLED'
                          ? 'Đã hủy'
                          : 'Đang học'}
                    </span>
                    <AutoStoriesOutlined aria-hidden="true" />
                  </div>
                  <h2>{title || 'Khóa học #' + enrollment.courseId}</h2>
                  {description && <p>{description}</p>}
                </div>

                {detail?.course && (
                  <div className="my-course-progress">
                    <ProgressBar value={detail.course.progressPercent} />
                    <p>
                      {detail.course.progressPercent}% hoàn thành — {detail.course.completedLessons}/
                      {detail.course.totalLessons} bài
                    </p>
                  </div>
                )}

                {detail?.error && (
                  <ErrorState error={detail.error} title="Không thể tải tiến độ" onRetry={reload} />
                )}

                {enrollment.status !== 'CANCELLED' && !detail && <p role="status">Đang tải tiến độ...</p>}

                <div className="my-course-meta">
                  <span>Ghi danh: {formatDate(enrollment.enrolledAt, { dateStyle: 'short' })}</span>
                  {enrollment.lastAccessedAt && (
                    <span>Truy cập: {formatDate(enrollment.lastAccessedAt, { dateStyle: 'short' })}</span>
                  )}
                </div>

                {enrollment.status !== 'CANCELLED' && (
                  <Link className="button button-primary" to={'/learning/' + enrollment.courseId}>
                    {enrollment.status === 'COMPLETED' ? 'Ôn tập khóa học' : 'Tiếp tục học'}
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
