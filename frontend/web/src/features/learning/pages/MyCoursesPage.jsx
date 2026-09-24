import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoLearningDashboard } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';
import { courseApi } from '../../courses/api/courseApi';

export default function MyCoursesPage() {
  const fallback = demoLearningDashboard.recentEnrollments;
  const { data, error, loading, usingFallback } = useLearningResource(
    learningApi.getMyEnrollments,
    fallback,
  );
  const [coursesById, setCoursesById] = useState({});

  useEffect(() => {
    let active = true;
    const courseIds = [...new Set(data.map(enrollment => enrollment.courseId).filter(Boolean))];
    if (loading || !courseIds.length || usingFallback) {
      Promise.resolve().then(() => {
        if (active) setCoursesById({});
      });
      return undefined;
    }

    Promise.allSettled(courseIds.map(courseId => courseApi.getById(courseId))).then(results => {
      if (!active) return;
      const next = {};
      results.forEach(result => {
        const course = result.status === 'fulfilled' ? result.value?.data : null;
        if (course?.id) next[course.id] = course;
      });
      setCoursesById(next);
    });

    return () => {
      active = false;
    };
  }, [data, loading, usingFallback]);

  const enrollments = useMemo(
    () =>
      data.map(enrollment => ({
        ...enrollment,
        course: coursesById[enrollment.courseId],
      })),
    [coursesById, data],
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
          {enrollments.map(enrollment => (
            <article className="my-course-card" key={enrollment.id}>
              <div>
                <span className="learning-chip">{enrollment.status}</span>
                <h2>{enrollment.course?.title || `Course #${enrollment.courseId}`}</h2>
                <p>
                  {enrollment.course?.description ||
                    'Khóa học đã được ghi danh và sẵn sàng để tiếp tục học.'}
                </p>
              </div>
              <ProgressBar value={enrollment.status === 'COMPLETED' ? 100 : 48} />
              <div className="my-course-meta">
                <span>Ghi danh: {new Date(enrollment.enrolledAt).toLocaleDateString('vi-VN')}</span>
                {enrollment.lastAccessedAt && (
                  <span>Truy cập: {new Date(enrollment.lastAccessedAt).toLocaleDateString('vi-VN')}</span>
                )}
              </div>
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
