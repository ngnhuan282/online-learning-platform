import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courseApi } from '../api/courseApi';
import { reviewApi } from '../api/reviewApi';
import StarRating from '../components/StarRating';

export default function AdminReviewPage() {
  const { courseId } = useParams();
  return <ReviewsManager key={courseId || 'all'} initialCourseId={courseId} />;
}

function ReviewsManager({ initialCourseId }) {
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || '');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VISIBLE' | 'HIDDEN'
  const [courses, setCourses] = useState([]);
  const [courseDetail, setCourseDetail] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, size: 10, totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Load course list for dropdown filter if not pinned to a specific courseId
  useEffect(() => {
    courseApi
      .list({ size: 100 })
      .then(res => {
        const data = res?.data?.data || res?.data || res;
        const items = data?.items || data?.content || (Array.isArray(data) ? data : []);
        setCourses(items);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(
    (page = 0, courseIdToFetch = selectedCourseId, isActive = () => true) => {
      setLoading(true);
      setError(null);

      const fetchCourse = courseIdToFetch ? courseApi.getById(courseIdToFetch).catch(() => null) : Promise.resolve(null);
      const fetchReviews = reviewApi.adminList(courseIdToFetch || undefined, { page, size: 10 });

      return Promise.all([fetchCourse, fetchReviews])
        .then(([courseRes, reviewsRes]) => {
          if (!isActive()) return;

          if (courseRes) {
            const cData = courseRes?.data?.data || courseRes?.data || courseRes;
            setCourseDetail(cData);
          } else {
            setCourseDetail(null);
          }

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
          if (isActive()) {
            setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách đánh giá');
          }
        })
        .finally(() => {
          if (isActive()) setLoading(false);
        });
    },
    [selectedCourseId],
  );

  useEffect(() => {
    let active = true;
    loadData(0, selectedCourseId, () => active);
    return () => {
      active = false;
    };
  }, [loadData, selectedCourseId]);

  const handleCourseFilterChange = e => {
    const val = e.target.value;
    setSelectedCourseId(val);
  };

  const handleToggleHide = async review => {
    setActionLoading(review.id);
    try {
      await reviewApi.updateVisibility(review.id, !review.hidden);
      await loadData(pagination.page, selectedCourseId);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const displayedReviews = reviews.filter(r => {
    if (statusFilter === 'VISIBLE') return !r.hidden;
    if (statusFilter === 'HIDDEN') return r.hidden;
    return true;
  });

  const hiddenCount = reviews.filter(r => r.hidden).length;

  return (
    <section className="section" style={{ minHeight: '80vh', padding: '24px 0 60px' }}>
      <div className="container">
        {/* Header navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <Link to="/admin/courses" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
                ← Danh sách khóa học
              </Link>
              {initialCourseId && (
                <>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <Link to="/admin/reviews" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>
                    Xem tất cả đánh giá
                  </Link>
                </>
              )}
            </div>
            <h2 style={{ margin: '4px 0', fontSize: 24, fontWeight: 700 }}>
              {courseDetail ? `Đánh giá: ${courseDetail.title}` : 'Quản lý Đánh giá Toàn hệ thống'}
            </h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
              Xem và kiểm duyệt đánh giá của học viên. Các review vi phạm chính sách có thể bị ẩn khỏi trang khóa học công khai.
            </p>
          </div>

          {/* Filter Toolbar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="course-select-filter" style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Lọc theo khóa học:
              </label>
              <select
                id="course-select-filter"
                value={selectedCourseId}
                onChange={handleCourseFilterChange}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  background: '#fff',
                  minWidth: 220,
                  maxWidth: 320,
                }}
              >
                <option value="">-- Tất cả khóa học --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status-select-filter" style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Trạng thái:
              </label>
              <select
                id="status-select-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  background: '#fff',
                }}
              >
                <option value="ALL">Tất cả ({reviews.length})</option>
                <option value="VISIBLE">Hiển thị ({reviews.length - hiddenCount})</option>
                <option value="HIDDEN">Đã ẩn ({hiddenCount})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {courseDetail && (
            <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Đánh giá trung bình</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                ★ {courseDetail.avgRating ? Number(courseDetail.avgRating).toFixed(1) : '0.0'}
              </div>
            </div>
          )}
          <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tổng số đánh giá</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
              {pagination.totalElements}
            </div>
          </div>
          <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Đang hiển thị trên trang này</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
              {reviews.length - hiddenCount}
            </div>
          </div>
          <div className="course-card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Đã ẩn vi phạm</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
              {hiddenCount}
            </div>
          </div>
        </div>

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
          ) : displayedReviews.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>
              {reviews.length === 0
                ? 'Chưa có đánh giá nào được tìm thấy.'
                : 'Không có đánh giá phù hợp với bộ lọc đã chọn.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {displayedReviews.map(review => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {review.userFullName || `Học viên #${review.userId}`}
                      </span>

                      {/* Course Badge if viewing across multiple courses */}
                      {review.courseTitle && (
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 6,
                          }}
                        >
                          📖 {review.courseTitle}
                        </span>
                      )}

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
                onClick={() => loadData(pagination.page - 1, selectedCourseId)}
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
                onClick={() => loadData(pagination.page + 1, selectedCourseId)}
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
