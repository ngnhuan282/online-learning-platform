import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { courseApi } from '../api/courseApi';
import { formatPrice } from '../data/demoCourses';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import { ROUTES } from '../../../shared/constants/routes';

const fallbackCourse = {
  id: 1,
  title: 'IELTS Intensive 7.5+: Bứt phá 4 kỹ năng cùng chuyên gia',
  description: 'Lộ trình luyện thi IELTS chuyên sâu với chiến thuật Writing, Speaking, Reading và Listening để đạt band mục tiêu 7.5+.',
  level: 'Nâng cao',
  price: 1690000,
  originalPrice: 2400000,
  categoryName: 'Luyện thi IELTS',
  category: 'ielts',
  status: 'PUBLISHED',
  thumbnailUrl: '/images/english-ielts.jpg',
  lessons: [
    'Phát triển kỹ năng Writing Task 2',
    'Luyện phản xạ Speaking Part 2 & 3',
    'Mẹo Reading và Listening hiệu quả',
  ],
};

const normalizeCourse = value => {
  if (!value || typeof value !== 'object') return fallbackCourse;

  const course = Array.isArray(value) ? value[0] : value;

  return {
    ...fallbackCourse,
    ...course,
    id: course?.id ?? course?.courseId ?? fallbackCourse.id,
    title: course?.title ?? fallbackCourse.title,
    description: course?.description ?? fallbackCourse.description,
    level: course?.level ?? fallbackCourse.level,
    price: Number(course?.price ?? fallbackCourse.price),
    originalPrice: Number(course?.originalPrice ?? fallbackCourse.originalPrice),
    categoryName: course?.categoryName ?? course?.category ?? fallbackCourse.categoryName,
    category: course?.category ?? fallbackCourse.category,
    status: course?.status ?? fallbackCourse.status,
    thumbnailUrl: course?.thumbnailUrl ?? course?.image ?? fallbackCourse.thumbnailUrl,
    lessons: course?.lessons ?? fallbackCourse.lessons,
  };
};

function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCourse() {
      setLoading(true);
      try {
        const response = await courseApi.getById(id);
        const payload = response?.data ?? response;
        const item = payload?.data ?? payload?.course ?? payload;
        if (isMounted) setCourse(normalizeCourse(item));
      } catch {
        if (isMounted) setCourse(fallbackCourse);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCourse();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="container" style={{ padding: '32px 0 80px' }}>
        <div className="empty-courses" role="status">
          <h3>Đang tải khóa học...</h3>
        </div>
      </main>
    );
  }

  const item = normalizeCourse(course || fallbackCourse);

  return (
    <main className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/courses" style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← Quay lại danh sách
        </Link>
      </div>

      <div className="course-grid" style={{ gridTemplateColumns: '1.4fr 0.6fr' }}>
        <article className="course-card" style={{ padding: 24 }}>
          <img src={resolveMediaUrl(item.thumbnailUrl || '/images/english-ielts.jpg')} alt={item.title} style={{ width: '100%', borderRadius: 12, objectFit: 'cover', marginBottom: 20 }} />
          <span className="eyebrow">{item.categoryName || 'Luyện thi IELTS'}</span>
          <h2 style={{ margin: '12px 0' }}>{item.title}</h2>
          <p>{item.description}</p>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 10 }}>Bạn sẽ học được:</h3>
            <ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
              {(item.lessons || fallbackCourse.lessons).map((lesson, index) => (
                <li key={`${item.id}-lesson-${index}`}>{lesson}</li>
              ))}
            </ul>
          </div>

          <div className="detail-meta" style={{ marginTop: 16 }}>
            <span>Level: {String(item.level || 'Nâng cao').toUpperCase()}</span>
            <span>Status: {item.status || 'PUBLISHED'}</span>
          </div>
        </article>

        <aside className="course-card" style={{ padding: 24, alignSelf: 'start' }}>
          <h3>Thông tin khóa học</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <small>Giá</small>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {Number(item.price || 0) === 0 ? 'Miễn phí' : formatPrice(Number(item.price || 0))}
              </div>
            </div>
            {Number(item.originalPrice || 0) > Number(item.price || 0) ? (
              <div>
                <small>Giá gốc</small>
                <div style={{ textDecoration: 'line-through', color: '#64748b' }}>
                  {formatPrice(Number(item.originalPrice || 0))}
                </div>
              </div>
            ) : null}
            {Number(item.price || 0) > 0 ? (
              <Link
                className="button button-primary"
                to={`${ROUTES.CHECKOUT}?course=${encodeURIComponent(item.id)}`}
              >
                Thanh toán khóa học
              </Link>
            ) : (
              <Link className="button button-primary" to={ROUTES.COURSES}>
                Xem lựa chọn ghi danh
              </Link>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

export default CourseDetailPage;
