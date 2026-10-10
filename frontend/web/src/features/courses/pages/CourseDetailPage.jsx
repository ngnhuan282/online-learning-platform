import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { courseApi } from '../api/courseApi';
import { sectionApi } from '../api/sectionApi';
import { reviewApi } from '../api/reviewApi';
import { formatPrice } from '../data/demoCourses';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useAuth from '../../auth/hooks/useAuth';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import ReviewForm from '../components/ReviewForm';

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
  avgRating: 4.8,
  reviewCount: 0,
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
    avgRating: Number(course?.avgRating ?? fallbackCourse.avgRating),
    reviewCount: Number(course?.reviewCount ?? 0),
    lessons: course?.lessons ?? fallbackCourse.lessons,
  };
};

function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewPagination, setReviewPagination] = useState({ page: 0, size: 5, totalPages: 1, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false); // Placeholder for T8 Learning Service
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'reviews'

  const isAdmin = Boolean(
    user?.roles?.includes('ADMIN') ||
    user?.permissions?.includes('COURSE_UPDATE')
  );

  const [courseNotFound, setCourseNotFound] = useState(false);

  // Load course details & curriculum
  const loadCourseData = useCallback(async () => {
    try {
      const response = await courseApi.getById(id);
      const payload = response?.data ?? response;
      const item = payload?.data ?? payload?.course ?? payload;
      if (!item) {
        setCourseNotFound(true);
        return;
      }
      setCourse(normalizeCourse(item));
      setCourseNotFound(false);
    } catch (err) {
      if (err?.response?.status === 404) {
        setCourseNotFound(true);
        setCourse(null);
      } else {
        setCourse(fallbackCourse);
      }
    }
  }, [id]);

  const loadSections = useCallback(async () => {
    try {
      const res = await sectionApi.listByCourse(id);
      const data = res?.data?.data || res?.data || res;
      setSections(Array.isArray(data) ? data : []);
    } catch {
      setSections([]);
    }
  }, [id]);

  // Load reviews
  const loadReviews = useCallback(async (page = 0) => {
    setReviewsLoading(true);
    try {
      const res = await reviewApi.list(id, { page, size: 5 });
      const data = res?.data?.data || res?.data || res;
      const items = data?.items || data?.content || (Array.isArray(data) ? data : []);
      setReviews(items);
      setReviewPagination({
        page: data?.page ?? page,
        size: data?.size ?? 5,
        totalPages: data?.totalPages ?? 1,
        totalElements: data?.totalElements ?? items.length,
      });
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  // Load my review if logged in
  const loadMyReview = useCallback(async () => {
    if (!isAuthenticated) {
      setMyReview(null);
      return;
    }
    try {
      const res = await reviewApi.myReview(id);
      const data = res?.data?.data || res?.data || res;
      setMyReview(data || null);
    } catch {
      setMyReview(null);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      loadCourseData(),
      loadSections(),
      loadReviews(0),
      loadMyReview(),
    ]).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [loadCourseData, loadSections, loadReviews, loadMyReview]);

  const handleReviewSuccess = async (savedReview) => {
    setEditingReview(null);
    setMyReview(savedReview);
    // Reload reviews & course to refresh avgRating and reviewCount
    await Promise.all([loadCourseData(), loadReviews(0), loadMyReview()]);
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đánh giá này?')) return;
    try {
      await reviewApi.delete(id, reviewId);
      setMyReview(null);
      setEditingReview(null);
      await Promise.all([loadCourseData(), loadReviews(0)]);
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể xóa đánh giá');
    }
  };

  const handleAdminHide = async (reviewId) => {
    try {
      await reviewApi.hide(id, reviewId);
      await Promise.all([loadCourseData(), loadReviews(reviewPagination.page)]);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    }
  };

  const handleAdminShow = async (reviewId) => {
    try {
      await reviewApi.show(id, reviewId);
      await Promise.all([loadCourseData(), loadReviews(reviewPagination.page)]);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    }
  };

  const handleEnroll = () => {
    // T8 Placeholder
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setIsEnrolled(true);
    alert('Đăng ký khóa học thành công! Bạn có thể bắt đầu học.');
  };

  if (loading) {
    return (
      <main className="container" style={{ padding: '32px 0 80px' }}>
        <div className="empty-courses" role="status">
          <h3>Đang tải khóa học...</h3>
        </div>
      </main>
    );
  }

  if (courseNotFound) {
    return (
      <main className="container" style={{ padding: '60px 0 100px', textAlign: 'center' }}>
        <div className="course-card" style={{ maxWidth: 500, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Không tìm thấy khóa học</h2>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Khóa học với mã ID <strong>#{id}</strong> không tồn tại trong hệ thống. Vui lòng chọn một khóa học đang có trong danh sách.
          </p>
          <Link to="/courses" className="button button-primary" style={{ textDecoration: 'none' }}>
            Xem danh sách khóa học
          </Link>
        </div>
      </main>
    );
  }

  const item = normalizeCourse(course || fallbackCourse);
  const totalLessons = sections.reduce((sum, sec) => sum + (sec.lessons?.length || 0), 0);

  return (
    <main className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/courses" style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Quay lại danh sách
        </Link>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/admin/courses/${item.id}/curriculum`} className="button button-soft" style={{ fontSize: 13, textDecoration: 'none' }}>
              ⚙️ Quản lý giáo trình
            </Link>
            <Link to={`/admin/courses/${item.id}/reviews`} className="button button-soft" style={{ fontSize: 13, textDecoration: 'none' }}>
              ⭐ Quản lý đánh giá
            </Link>
          </div>
        )}
      </div>

      <div className="course-grid" style={{ gridTemplateColumns: '1.4fr 0.6fr', gap: 32 }}>
        {/* Main Content Column */}
        <div>
          <article className="course-card" style={{ padding: 24, marginBottom: 24 }}>
            <img
              src={resolveMediaUrl(item.thumbnailUrl || '/images/english-ielts.jpg')}
              alt={item.title}
              style={{ width: '100%', maxHeight: 380, borderRadius: 12, objectFit: 'cover', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="eyebrow">{item.categoryName || 'Luyện thi IELTS'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarRating value={item.avgRating} readonly size={18} showLabel />
                <span style={{ fontSize: 13, color: '#64748b' }}>({item.reviewCount} đánh giá)</span>
              </div>
            </div>
            <h1 style={{ margin: '8px 0 12px', fontSize: 26, fontWeight: 700 }}>{item.title}</h1>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>{item.description}</p>

            <div className="detail-meta" style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Trình độ: <strong>{String(item.level || 'Beginner').toUpperCase()}</strong></span>
              <span>Trạng thái: <strong>{item.status || 'PUBLISHED'}</strong></span>
              <span>Thời lượng: <strong>{sections.length} chương ({totalLessons} bài học)</strong></span>
            </div>
          </article>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid rgba(148,163,184,0.2)', marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'curriculum' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'curriculum' ? '#3b82f6' : '#64748b',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                marginBottom: -2,
              }}
            >
              📚 Giáo trình ({sections.length} chương)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'reviews' ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === 'reviews' ? '#3b82f6' : '#64748b',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                marginBottom: -2,
              }}
            >
              ⭐ Đánh giá & Nhận xét ({item.reviewCount})
            </button>
          </div>

          {/* Tab 1: Curriculum / Syllabus */}
          {activeTab === 'curriculum' && (
            <section className="course-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Nội dung khóa học</h3>
              {sections.length === 0 ? (
                <div>
                  <p style={{ color: '#64748b' }}>Khóa học đang được cập nhật chi tiết giáo trình.</p>
                  <ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
                    {(item.lessons || fallbackCourse.lessons).map((lesson, index) => (
                      <li key={`${item.id}-lesson-${index}`}>{lesson}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {sections.map((section, sIndex) => (
                    <div
                      key={section.id}
                      style={{
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          background: 'rgba(241, 245, 249, 0.6)',
                          padding: '12px 16px',
                          fontWeight: 600,
                          fontSize: 15,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Chương {sIndex + 1}: {section.title}</span>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
                          {section.lessons?.length || 0} bài học
                        </span>
                      </div>
                      {section.lessons && section.lessons.length > 0 && (
                        <div style={{ padding: '8px 16px' }}>
                          {section.lessons.map((lesson, lIndex) => (
                            <div
                              key={lesson.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: lIndex < section.lessons.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                                fontSize: 14,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{lesson.lessonType === 'VIDEO' ? '🎥' : '📄'}</span>
                                <span>{lesson.title}</span>
                                {lesson.preview && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      background: 'rgba(59, 130, 246, 0.1)',
                                      color: '#3b82f6',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontWeight: 500,
                                    }}
                                  >
                                    Học thử
                                  </span>
                                )}
                              </div>
                              {lesson.duration ? (
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                                  {Math.round(lesson.duration / 60)} phút
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Reviews / Ratings */}
          {activeTab === 'reviews' && (
            <section className="course-card" style={{ padding: 24 }}>
              {/* Summary Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  padding: '20px 24px',
                  borderRadius: 12,
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  marginBottom: 24,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                    {item.avgRating ? item.avgRating.toFixed(1) : '0.0'}
                  </div>
                  <StarRating value={item.avgRating} readonly size={18} />
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {item.reviewCount} đánh giá
                  </div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid rgba(148,163,184,0.2)', paddingLeft: 20 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>Đánh giá từ học viên</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                    Mỗi học viên chỉ được gửi 1 đánh giá cho khóa học. Đánh giá giúp cải thiện chất lượng bài giảng và hỗ trợ các bạn học sau.
                  </p>
                </div>
              </div>

              {/* Review Form / My Review Section */}
              {isAuthenticated ? (
                myReview && !editingReview ? (
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: '#3b82f6', fontSize: 14 }}>
                        Đánh giá của bạn
                      </span>
                    </div>
                    <ReviewCard
                      review={myReview}
                      currentUser={user}
                      isOwner={true}
                      onEdit={rev => setEditingReview(rev)}
                      onDelete={handleDeleteReview}
                    />
                  </div>
                ) : (
                  <ReviewForm
                    courseId={id}
                    existingReview={editingReview}
                    onSubmitSuccess={handleReviewSuccess}
                    onCancel={() => setEditingReview(null)}
                  />
                )
              ) : (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'rgba(241, 245, 249, 0.8)',
                    textAlign: 'center',
                    marginBottom: 24,
                    fontSize: 14,
                    color: '#64748b',
                  }}
                >
                  Vui lòng <Link to="/login" style={{ color: '#3b82f6', fontWeight: 600 }}>đăng nhập</Link> để viết đánh giá cho khóa học này.
                </div>
              )}

              {/* Reviews List */}
              <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
                Tất cả nhận xét ({reviewPagination.totalElements})
              </h4>

              {reviewsLoading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>Đang tải nhận xét...</p>
              ) : reviews.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                  Chưa có đánh giá nào cho khóa học này. Hãy là người đầu tiên để lại nhận xét!
                </p>
              ) : (
                <div>
                  {reviews.map(rev => (
                    <ReviewCard
                      key={rev.id}
                      review={rev}
                      currentUser={user}
                      isOwner={user?.id && String(rev.userId) === String(user.id)}
                      isAdmin={isAdmin}
                      onEdit={r => {
                        setEditingReview(r);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      onDelete={handleDeleteReview}
                      onHide={handleAdminHide}
                      onShow={handleAdminShow}
                    />
                  ))}

                  {/* Reviews Pagination */}
                  {reviewPagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                      <button
                        className="button button-soft"
                        disabled={reviewPagination.page <= 0 || reviewsLoading}
                        onClick={() => loadReviews(reviewPagination.page - 1)}
                      >
                        Trang trước
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, color: '#64748b' }}>
                        Trang {reviewPagination.page + 1} / {reviewPagination.totalPages}
                      </span>
                      <button
                        className="button button-soft"
                        disabled={reviewPagination.page >= reviewPagination.totalPages - 1 || reviewsLoading}
                        onClick={() => loadReviews(reviewPagination.page + 1)}
                      >
                        Trang sau
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar Column */}
        <aside className="course-card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 24 }}>
          <h3>Thông tin khóa học</h3>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <div>
              <small style={{ color: '#64748b' }}>Học phí</small>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>
                {Number(item.price || 0) === 0 ? 'Miễn phí' : formatPrice(Number(item.price || 0))}
              </div>
            </div>
            {Number(item.originalPrice || 0) > Number(item.price || 0) ? (
              <div>
                <small style={{ color: '#64748b' }}>Giá gốc</small>
                <div style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                  {formatPrice(Number(item.originalPrice || 0))}
                </div>
              </div>
            ) : null}

            {/* B7-FE-6 / T8 Enrollment Action Placeholder */}
            {isEnrolled ? (
              <button
                className="button button-success"
                type="button"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => navigate(`/learning/${item.id}`)}
              >
                Tiếp tục học 🚀
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                style={{ width: '100%', padding: '12px' }}
                onClick={handleEnroll}
              >
                {Number(item.price || 0) === 0 ? 'Đăng ký học miễn phí' : 'Mua khóa học ngay'}
              </button>
            )}

            <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: 16, display: 'grid', gap: 10, fontSize: 13, color: '#64748b' }}>
              <div>✅ Truy cập trọn đời toàn bộ bài giảng</div>
              <div>✅ Học trên máy tính, điện thoại, tablet</div>
              <div>✅ Hỗ trợ giải đáp từ giảng viên</div>
              <div>✅ Cấp chứng chỉ hoàn thành khóa học</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default CourseDetailPage;
