import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { courseApi } from '../api/courseApi';
import { sectionApi } from '../api/sectionApi';
import { reviewApi } from '../api/reviewApi';
import { formatPrice } from '../data/demoCourses';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useAuth from '../../auth/hooks/useAuth';
import { learningApi } from '../../learning/api/learningApi';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import ReviewForm from '../components/ReviewForm';
import { lessonApi } from '../api/lessonApi';
import { learningApi } from '../../learning/api/learningApi';
import { paymentApi } from '../../payment/api/paymentApi';

// Chuẩn hóa hiển thị giá tiền VND (B9-FE-2)
const formatVND = (amount) => {
  if (!amount || Number(amount) === 0) return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};


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
  avgRating: 0,
  reviewCount: 0,
  lessons: [],
};

const normalizeCourse = value => {
  if (!value || typeof value !== 'object') return courseDefaults;

  const course = Array.isArray(value) ? value[0] : value;

  return {
    ...courseDefaults,
    ...course,
    id: course?.id ?? course?.courseId ?? courseDefaults.id,
    title: course?.title ?? courseDefaults.title,
    description: course?.description ?? courseDefaults.description,
    level: course?.level ?? courseDefaults.level,
    price: Number(course?.price ?? courseDefaults.price),
    originalPrice: Number(course?.originalPrice ?? courseDefaults.originalPrice),
    categoryName: course?.categoryName ?? course?.category ?? courseDefaults.categoryName,
    category: course?.category ?? courseDefaults.category,
    status: course?.status ?? courseDefaults.status,
    thumbnailUrl: course?.thumbnailUrl ?? course?.image ?? courseDefaults.thumbnailUrl,
    avgRating: Number(course?.avgRating ?? courseDefaults.avgRating),
    reviewCount: Number(course?.reviewCount ?? 0),
    lessons: course?.lessons ?? courseDefaults.lessons,
  };
};

function CourseDetail({ id }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewState, setReviewState] = useState(null);
  const myReview =
    reviewState?.userId === user?.id && reviewState?.courseId === id ? reviewState.review : null;
  const setMyReview = useCallback(
    review => {
      setReviewState({ userId: user?.id, courseId: id, review });
    },
    [user?.id, id],
  );
  const [editingReview, setEditingReview] = useState(null);
  const [reviewPagination, setReviewPagination] = useState({
    page: 0,
    size: 5,
    totalPages: 1,
    totalElements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'reviews'

  // States cho Modal học thử (Preview Lesson Player)
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePreviewLesson, setActivePreviewLesson] = useState(null);
  const [previewPlayData, setPreviewPlayData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const isAdmin = Boolean(
    user?.roles?.includes('ADMIN') ||
    user?.permissions?.includes('COURSE_UPDATE')
  );

  const [courseNotFound, setCourseNotFound] = useState(false);
  const [courseError, setCourseError] = useState(null);

  // Load course details & curriculum
  const loadCourseData = useCallback(async () => {
    setCourseError(null);
    try {
      const response = await courseApi.getById(id);
      const payload = response?.data ?? response;
      const item = payload?.data ?? payload?.course ?? payload;
      if (item?.id == null || typeof item.title !== 'string' || !item.title.trim()) {
        throw new Error('Dữ liệu khóa học không hợp lệ. Vui lòng thử lại.');
      }
      setCourse(normalizeCourse(item));
      setCourseNotFound(false);
    } catch (err) {
      setCourse(null);
      if (err?.status === 404) {
        setCourseNotFound(true);
      } else {
        setCourseNotFound(false);
        setCourseError(err);
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
  const loadReviews = useCallback(
    async (page = 0) => {
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
    },
    [id],
  );

  // Load my review if logged in
  const loadMyReview = useCallback(async () => {
    if (!isAuthenticated || user?.id == null) {
      setMyReview(null);
      return;
    }
    const version = getSessionVersion();
    try {
      const res = await reviewApi.myReview(id);
      const data = res?.data?.data || res?.data || res;
      if (version === getSessionVersion()) setMyReview(data || null);
    } catch {
      if (version === getSessionVersion()) setMyReview(null);
    }
  }, [id, isAuthenticated, user?.id, setMyReview]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    learningApi
      .getMyEnrollments()
      .then(({ data }) => {
        if (!active) return;
        const enrolled = data.some(item => String(item.courseId) === id && item.status !== 'CANCELLED');
        setEnrollment(enrolled ? { userId: user.id, courseId: id } : null);
      })
      .catch(() => {
        if (active) setEnrollment(null);
      });
    return () => {
      active = false;
    };
  }, [id, isAuthenticated, user?.id]);

  // Load enrollment status
  const loadEnrollment = useCallback(async () => {
    if (!isAuthenticated) {
      setIsEnrolled(false);
      return;
    }
    try {
      const res = await learningApi.getMyEnrollments();
      const list = res?.data?.data || res?.data || [];
      const enrolled = Array.isArray(list) && list.some(e => String(e.courseId) === String(id));
      setIsEnrolled(enrolled);
    } catch {
      // Keep existing state on transient network error
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) return undefined;
    let isMounted = true;
    setLoading(true);

    Promise.all([
      loadCourseData(),
      loadSections(),
      loadReviews(0),
      loadMyReview(),
      loadEnrollment(),
    ]).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [loadCourseData, loadSections, loadReviews, loadMyReview, loadEnrollment]);

  const handleReviewSuccess = async savedReview => {
    setEditingReview(null);
    setMyReview(savedReview);
    // Reload reviews & course to refresh avgRating and reviewCount
    await Promise.all([loadCourseData(), loadReviews(0), loadMyReview()]);
  };

  const handleDeleteReview = async reviewId => {
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

  const handleAdminHide = async reviewId => {
    try {
      await reviewApi.hide(id, reviewId);
      await Promise.all([loadCourseData(), loadReviews(reviewPagination.page)]);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    }
  };

  const handleAdminShow = async reviewId => {
    try {
      await reviewApi.show(id, reviewId);
      await Promise.all([loadCourseData(), loadReviews(reviewPagination.page)]);
    } catch (err) {
      alert(err?.response?.data?.message || 'Thao tác thất bại');
    }
  };

  // B9-FE-1: Đăng ký học miễn phí (price === 0)
  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await learningApi.enroll(id);
      setIsEnrolled(true);
      alert('Đăng ký khóa học thành công! Bạn có thể bắt đầu học ngay.');
    } catch (err) {
      const msg = err?.response?.data?.message || '';
      if (err?.response?.status === 400 || msg.toLowerCase().includes('already')) {
        setIsEnrolled(true);
        alert('Bạn đã tham gia khóa học này. Chúc bạn học tốt!');
      } else {
        alert(msg || 'Không thể đăng ký khóa học.');
      }
    }
  };

  // B9-FE-1: Mua khóa học trả phí → Điều hướng sang Checkout (không tin FE price)
  const handleBuyCourse = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: destination } });
      return;
    }
    try {
      const returnUrl = `${window.location.origin}/payment/result`;
      const cancelUrl = `${window.location.origin}/courses/${id}`;
      const res = await paymentApi.createCheckout({
        courseId: Number(id),
        returnUrl,
        cancelUrl,
      });
      const data = res?.data?.data || res?.data || res;
      const checkoutUrl = data?.checkoutUrl || data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        alert('Không thể khởi tạo phiên thanh toán. Vui lòng thử lại.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể khởi tạo thanh toán. Vui lòng thử lại.';
      alert(msg);
    }
  };

  const handlePlayLesson = async (lesson) => {
    if (lesson.preview) {
      setActivePreviewLesson(lesson);
      setPreviewModalOpen(true);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewPlayData(null);
      try {
        const res = await lessonApi.getPlayUrl(id, lesson.id);
        const data = res?.data?.data || res?.data || res;
        setPreviewPlayData(data);
      } catch (err) {
        setPreviewError(err?.response?.data?.message || 'Không thể tạo link phát bài học.');
      } finally {
        setPreviewLoading(false);
      }
    } else if (isEnrolled) {
      navigate(`/learning/${id}?lessonId=${lesson.id}`);
    } else {
      alert('Bài học này yêu cầu bạn đăng ký hoặc mua khóa học để mở khóa toàn bộ nội dung.');
    }
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
            Khóa học với mã ID <strong>#{id}</strong> không tồn tại trong hệ thống. Vui lòng chọn một khóa học
            đang có trong danh sách.
          </p>
          <Link to="/courses" className="button button-primary" style={{ textDecoration: 'none' }}>
            Xem danh sách khóa học
          </Link>
        </div>
      </main>
    );
  }

  if (courseError || !course) {
    return (
      <main className="container" style={{ padding: '32px 0 80px' }}>
        <ErrorState
          error={courseError}
          title="Không thể tải khóa học"
          onRetry={async () => {
            setLoading(true);
            await loadCourseData();
            setLoading(false);
          }}
        />
      </main>
    );
  }

  const item = course;
  const totalLessons = sections.reduce((sum, sec) => sum + (sec.lessons?.length || 0), 0);

  return (
    <main className="container" style={{ padding: '32px 0 80px' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
      >
        <Link
          to="/courses"
          style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Quay lại danh sách
        </Link>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              to={`/admin/courses/${item.id}/curriculum`}
              className="button button-soft"
              style={{ fontSize: 13, textDecoration: 'none' }}
            >
              ⚙️ Quản lý giáo trình
            </Link>
            <Link
              to={`/admin/courses/${item.id}/reviews`}
              className="button button-soft"
              style={{ fontSize: 13, textDecoration: 'none' }}
            >
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
              style={{
                width: '100%',
                maxHeight: 380,
                borderRadius: 12,
                objectFit: 'cover',
                marginBottom: 20,
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span className="eyebrow">{item.categoryName || 'Khóa học'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarRating value={item.avgRating} readonly size={18} showLabel />
                <span style={{ fontSize: 13, color: '#64748b' }}>({item.reviewCount} đánh giá)</span>
              </div>
            </div>
            <h1 style={{ margin: '8px 0 12px', fontSize: 26, fontWeight: 700 }}>{item.title}</h1>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>{item.description}</p>

            <div
              className="detail-meta"
              style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}
            >
              <span>
                Trình độ: <strong>{String(item.level || 'Beginner').toUpperCase()}</strong>
              </span>
              <span>
                Trạng thái: <strong>{item.status || 'PUBLISHED'}</strong>
              </span>
              <span>
                Thời lượng:{' '}
                <strong>
                  {sections.length} chương ({totalLessons} bài học)
                </strong>
              </span>
            </div>
          </article>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '2px solid rgba(148,163,184,0.2)',
              marginBottom: 24,
            }}
          >
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
                    {(item.lessons || courseDefaults.lessons).map((lesson, index) => (
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
                        <span>
                          Chương {sIndex + 1}: {section.title}
                        </span>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
                          {section.lessons?.length || 0} bài học
                        </span>
                      </div>
                      {section.lessons && section.lessons.length > 0 && (
                        <div style={{ padding: '8px 16px' }}>
                          {section.lessons.map((lesson, lIndex) => (
                            <div
                              key={lesson.id}
                              onClick={() => handlePlayLesson(lesson)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 12px',
                                borderRadius: 8,
                                borderBottom: lIndex < section.lessons.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                                fontSize: 14,
                                cursor: lesson.preview || isEnrolled ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => (lesson.preview || isEnrolled) && (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{lesson.lessonType === 'VIDEO' ? '🎥' : '📄'}</span>
                                <span style={{ fontWeight: lesson.preview ? 500 : 400, color: '#1e293b' }}>{lesson.title}</span>
                                {lesson.preview ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      background: 'rgba(34, 197, 94, 0.12)',
                                      color: '#16a34a',
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    👁️ Học thử
                                  </span>
                                ) : !isEnrolled ? (
                                  <span
                                    title="Nội dung trả phí"
                                    style={{
                                      fontSize: 13,
                                      color: '#94a3b8',
                                    }}
                                  >
                                    🔒
                                  </span>
                                ) : null}
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
                    Mỗi học viên chỉ được gửi 1 đánh giá cho khóa học. Đánh giá giúp cải thiện chất lượng bài
                    giảng và hỗ trợ các bạn học sau.
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
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
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
                  Vui lòng{' '}
                  <Link to="/login" style={{ color: '#3b82f6', fontWeight: 600 }}>
                    đăng nhập
                  </Link>{' '}
                  để viết đánh giá cho khóa học này.
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
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 12px',
                          fontSize: 14,
                          color: '#64748b',
                        }}
                      >
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
        <aside
          className="course-card"
          style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 24 }}
        >
          <h3>Thông tin khóa học</h3>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <div>
              <small style={{ color: '#64748b' }}>Học phí</small>
              <div style={{ fontSize: 28, fontWeight: 700, color: Number(item.price || 0) === 0 ? '#16a34a' : '#0f172a' }}>
                {formatVND(Number(item.price || 0))}
              </div>
            </div>
            {Number(item.originalPrice || 0) > Number(item.price || 0) ? (
              <div>
                <small style={{ color: '#64748b' }}>Giá gốc</small>
                <div style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                  {formatVND(Number(item.originalPrice || 0))}
                </div>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                  Tiết kiệm {formatVND(Number(item.originalPrice || 0) - Number(item.price || 0))}
                </div>
              </div>
            ) : null}

            {/* B9-FE-1: CTA Button — Tiếp tục học / Đăng ký miễn phí / Mua ngay */}
            {isEnrolled ? (
              <button
                className="button button-success"
                type="button"
                id="btn-continue-learning"
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700 }}
                onClick={() => navigate(`/learning/${item.id}`)}
              >
                🚀 Tiếp tục học
              </button>
            ) : Number(item.price || 0) === 0 ? (
              <button
                className="button button-primary"
                type="button"
                id="btn-enroll-free"
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                onClick={handleEnroll}
                disabled={enrolling || !course || course.status !== 'PUBLISHED'}
              >
                🎓 Đăng ký học miễn phí
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                id="btn-buy-course"
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700 }}
                onClick={handleBuyCourse}
              >
                💳 Mua khóa học — {formatVND(Number(item.price || 0))}
              </button>
            )}

            <div
              style={{
                borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                paddingTop: 16,
                display: 'grid',
                gap: 10,
                fontSize: 13,
                color: '#64748b',
              }}
            >
              <div>✅ Truy cập trọn đời toàn bộ bài giảng</div>
              <div>✅ Học trên máy tính, điện thoại, tablet</div>
              <div>✅ Hỗ trợ giải đáp từ giảng viên</div>
              <div>✅ Cấp chứng chỉ hoàn thành khóa học</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal Học thử bài giảng với Pre-signed URL (T8) */}
      {previewModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => {
            setPreviewModalOpen(false);
            setPreviewPlayData(null);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 720,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 12,
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                    marginRight: 8,
                  }}
                >
                  HỌC THỬ MIỄN PHÍ
                </span>
                <strong style={{ fontSize: 16, color: '#0f172a' }}>{activePreviewLesson?.title}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewModalOpen(false);
                  setPreviewPlayData(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {previewLoading && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                  <p>⏳ Đang cấp link phát bài học bảo mật...</p>
                </div>
              )}

              {previewError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                  <p>{previewError}</p>
                </div>
              )}

              {!previewLoading && !previewError && previewPlayData && (
                <div>
                  {previewPlayData.lessonType === 'VIDEO' ? (
                    previewPlayData.playUrl?.includes('youtube.com') || previewPlayData.playUrl?.includes('youtu.be') ? (
                      <iframe
                        src={previewPlayData.playUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                        title={activePreviewLesson?.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ width: '100%', height: 380, border: 'none', borderRadius: 8 }}
                      />
                    ) : (
                      <video
                        controls
                        autoPlay
                        controlsList="nodownload"
                        src={resolveMediaUrl(previewPlayData.playUrl)}
                        onError={(e) => {
                          if (!e.currentTarget.dataset.fallbackTried) {
                            e.currentTarget.dataset.fallbackTried = 'true';
                            e.currentTarget.src = 'https://vjs.zencdn.net/v/oceans.mp4';
                            e.currentTarget.load();
                            e.currentTarget.play().catch(() => {});
                          }
                        }}
                        style={{ width: '100%', borderRadius: 8, maxHeight: 420, background: '#000' }}
                      >
                        Trình duyệt của bạn không hỗ trợ phát video này.
                      </video>
                    )
                  ) : (
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, maxHeight: 380, overflowY: 'auto' }}>
                      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                        {previewPlayData.content || 'Nội dung bài học dạng tài liệu/văn bản.'}
                      </p>
                    </div>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <small style={{ color: '#94a3b8' }}>
                      🛡️ Pre-signed URL bảo vệ có thời hạn: {Math.round(previewPlayData.expiresInSeconds / 60)} phút
                    </small>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => {
                        setPreviewModalOpen(false);
                        handleEnroll();
                      }}
                    >
                      {Number(course?.price || 0) === 0 ? '🎓 Đăng ký học toàn bộ' : `💳 Mua khóa học — ${formatVND(Number(course?.price || 0))}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams();
  return <CourseDetail key={id} id={id} />;
}
