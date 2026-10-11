import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courseApi } from '../api/courseApi';
import { reviewApi } from '../api/reviewApi';
import StarRating from '../components/StarRating';

export default function AdminReviewPage() {
  const { courseId } = useParams();
  return <CourseReviews key={courseId} courseId={courseId} />;
}

function CourseReviews({ courseId }) {
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, size: 10, totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadData = useCallback(
    (page = 0, isActive = () => true) =>
      Promise.all([courseApi.getById(courseId), reviewApi.adminList(courseId, { page, size: 10 })])
        .then(([courseRes, reviewsRes]) => {
          if (!isActive()) return;

          const cData = courseRes?.data?.data || courseRes?.data || courseRes;
          setCourse(cData);

          const rData = reviewsRes?.data?.data || reviewsRes?.data || reviewsRes;
          const items = rData?.items || rData?.content || (Array.isArray(rData) ? rData : []);
          setReviews(items);
          setPagination({
            page: rData?.page ?? page,
            size: rData?.size ?? 10,
            totalPages: rData?.totalPages ?? 1,
            totalElements: rData?.totalElements ?? items.length,
          });
        })
        .catch(err => {
          if (isActive())
            setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách đánh giá');
        })
        .finally(() => {
          if (isActive()) setLoading(false);
        }),
    [courseId],
  );

  useEffect(() => {
    let active = true;
    loadData(0, () => active);
    return () => {
      active = false;
    };
  }, [loadData]);

  const refreshData = page => {
    setLoading(true);
    setError(null);
    return loadData(page);
  };

  const handleToggleHide = async review => {
    setActionLoading(review.id);
    try {
      if (review.hidden) {
        await reviewApi.show(courseId, review.id);
      } else {
        await reviewApi.hide(courseId, review.id);
      }
      // Reload current page
      await refreshData(pagination.page);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const hiddenCount = reviews.filter(r => r.hidden).length;

  return (
    <section className="section" style={{ minHeight: '80vh', padding: '24px 0 60px' }}>
      <div className="container">
        {/* Header navigation */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
        >
          <div>
            <Link to="/admin/courses" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
              ← Quay lại quản lý khóa học
            </Link>
            <h2 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 700 }}>
              Quản lý đánh giá: {course?.title || `Khóa học #${courseId}`}
            </h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
              Xem và kiểm duyệt đánh giá của học viên. Các review vi phạm có thể bị ẩn khỏi trang public.
            </p>
          </div>
        </div>

        {/* Stats banner */}
        {course && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Đánh giá trung bình</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                ★ {course.avgRating ? Number(course.avgRating).toFixed(1) : '0.0'}
              </div>
            </div>
            <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Tổng số đánh giá</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
                {pagination.totalElements}
              </div>
            </div>
            <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Đánh giá bị ẩn trên trang này</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
                {hiddenCount}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              padding: 16,
              borderRadius: 8,
              color: '#ef4444',
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Reviews list */}
        <div className="course-card" style={{ padding: 24 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>Đang tải đánh giá...</p>
          ) : reviews.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>
              Chưa có đánh giá nào cho khóa học này.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {reviews.map(review => (
                <div
                  key={review.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: review.hidden ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {review.userFullName || `Học viên #${review.userId}`}
                      </span>
                      <StarRating value={review.rating} readonly size={16} />
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                      {review.hidden ? (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          Đã ẩn
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          Hiển thị
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                      {review.comment || <em style={{ color: '#94a3b8' }}>(Không có nhận xét)</em>}
                    </p>
                  </div>

                  <div>
                    <button
                      className="button button-soft"
                      type="button"
                      disabled={actionLoading === review.id}
                      onClick={() => handleToggleHide(review)}
                      style={{
                        fontSize: 13,
                        color: review.hidden ? '#22c55e' : '#ef4444',
                        borderColor: review.hidden ? '#22c55e' : '#ef4444',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {actionLoading === review.id ? 'Đang xử lý...' : review.hidden ? 'Bỏ ẩn' : 'Ẩn review'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                className="button button-soft"
                disabled={pagination.page <= 0 || loading}
                onClick={() => refreshData(pagination.page - 1)}
              >
                Trang trước
              </button>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#64748b',
                }}
              >
                Trang {pagination.page + 1} / {pagination.totalPages}
              </span>
              <button
                className="button button-soft"
                disabled={pagination.page >= pagination.totalPages - 1 || loading}
                onClick={() => refreshData(pagination.page + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
