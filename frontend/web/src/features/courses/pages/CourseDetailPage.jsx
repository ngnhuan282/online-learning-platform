import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { courseApi } from '../api/courseApi';
import { sectionApi } from '../api/sectionApi';
import { reviewApi } from '../api/reviewApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import useAuth from '../../auth/hooks/useAuth';
import { learningApi } from '../../learning/api/learningApi';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import ReviewForm from '../components/ReviewForm';
import { lessonApi } from '../api/lessonApi';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import usePro from '../../pro/hooks/usePro';
import { ROUTES } from '../../../shared/constants/routes';

const formatVND = amount => {
  if (!amount || Number(amount) === 0) return 'Miễn phí';
  return new Intl.NumberFormat(getIntlLocale(), { style: 'currency', currency: 'VND' }).format(
    Number(amount),
  );
};

const unwrapReviewPayload = value => {
  if (!value || typeof value !== 'object') return value ?? null;
  if ('data' in value) return unwrapReviewPayload(value.data);
  return value;
};

const courseDefaults = {
  title: '',
  description: '',
  level: '',
  price: 0,
  originalPrice: 0,
  categoryName: '',
  category: '',
  status: '',
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
  useLocale();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { membership } = usePro();

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
  const [enrollment, setEnrollment] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState(null);
  const hasEnrollment = isAuthenticated && enrollment?.userId === user?.id && enrollment?.courseId === id;
  const expiredPro = hasEnrollment && enrollment.accessSource === 'PRO' && membership && !membership.active;
  const isEnrolled = hasEnrollment && !expiredPro;
  const [activeTab, setActiveTab] = useState('curriculum');

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePreviewLesson, setActivePreviewLesson] = useState(null);
  const [previewPlayData, setPreviewPlayData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const isAdmin = Boolean(user?.roles?.includes('ADMIN') || user?.permissions?.includes('COURSE_UPDATE'));

  const [courseNotFound, setCourseNotFound] = useState(false);
  const [courseError, setCourseError] = useState(null);

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

  const loadMyReview = useCallback(async () => {
    if (!isAuthenticated || user?.id == null) {
      setMyReview(null);
      return;
    }
    const version = getSessionVersion();
    try {
      const res = await reviewApi.myReview(id);
      const data = unwrapReviewPayload(res);
      const validReview =
        data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0
          ? data
          : null;
      if (version === getSessionVersion()) setMyReview(validReview);
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
        const enrolled = data.find(item => String(item.courseId) === id && item.status !== 'CANCELLED');
        setEnrollment(
          enrolled ? { userId: user.id, courseId: id, accessSource: enrolled.accessSource } : null,
        );
      })
      .catch(() => {
        if (active) setEnrollment(null);
      });
    return () => {
      active = false;
    };
  }, [id, isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthLoading) return undefined;
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      setLoading(true);
      await Promise.all([loadCourseData(), loadSections(), loadReviews(0), loadMyReview()]);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, loadCourseData, loadSections, loadReviews, loadMyReview]);

  const handleReviewSuccess = async savedReview => {
    setEditingReview(null);
    setMyReview(savedReview);
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

  const handleEnroll = async () => {
    if (enrolling) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setEnrolling(true);
    setEnrollmentError(null);
    try {
      await learningApi.enroll(Number(id));
      setEnrollment({ userId: user.id, courseId: id });
      navigate(`/learning/${encodeURIComponent(id)}`);
    } catch (err) {
      setEnrollmentError(err);
    } finally {
      setEnrolling(false);
    }
  };

  const handleBuyCourse = async () => {
    const destination = `/checkout?course=${encodeURIComponent(id)}`;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: destination } });
      return;
    }
    navigate(destination);
  };

  const handlePlayLesson = async lesson => {
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
      <div className="course-detail-page">
        <div className="container">
          <div className="empty-courses" role="status">
            <h3>{t('Đang tải khóa học...')}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (courseNotFound) {
    return (
      <section className="status-screen container">
        <div className="status-screen-card">
          <span className="eyebrow-pill">COURSE NOT FOUND</span>
          <h2>{t('Không tìm thấy khóa học')}</h2>
          <p>
            {t('Khóa học với mã ID')} <strong>#{id}</strong>{' '}
            {t('không tồn tại trong hệ thống. Vui lòng chọn một khóa học đang có trong danh sách.')}
          </p>
          <Link to="/courses" className="button button-primary">
            {t('Xem danh sách khóa học')}
          </Link>
        </div>
      </section>
    );
  }

  if (courseError || !course) {
    return (
      <div className="course-detail-page">
        <div className="container">
          <ErrorState
            error={courseError}
            title={t('Không thể tải khóa học')}
            onRetry={async () => {
              setLoading(true);
              await loadCourseData();
              setLoading(false);
            }}
          />
        </div>
      </div>
    );
  }

  const item = course;
  const totalLessons = sections.reduce((sum, sec) => sum + (sec.lessons?.length || 0), 0);
  const isFreeCourse = Number(item.price || 0) === 0;

  return (
    <div className="course-detail-page">
      <div className="container">
        {enrollmentError && (
          <div style={{ marginBottom: 20 }}>
            <ErrorState
              error={enrollmentError}
              title={t('Không thể đăng ký khóa học')}
              onRetry={handleEnroll}
            />
          </div>
        )}

        <div className="course-detail-topbar">
          <Link to="/courses" className="course-back-link">
            {t('← Quay lại danh sách')}
          </Link>
          {isAdmin && (
            <div className="course-admin-shortcuts">
              <Link to={`/admin/courses/${item.id}/curriculum`} className="button button-soft">
                {t('Quản lý giáo trình')}
              </Link>
              <Link to={`/admin/courses/${item.id}/reviews`} className="button button-soft">
                {t('Quản lý đánh giá')}
              </Link>
            </div>
          )}
        </div>

        <div className="course-detail-layout">
          {/* Main Content Column */}
          <div>
            <article className="course-hero-card">
              <div className="course-hero-media">
                <img
                  src={resolveMediaUrl(item.thumbnailUrl || '/images/english-ielts.jpg')}
                  alt={item.title}
                />
              </div>
              <div className="course-hero-header">
                <span className="eyebrow-pill">{item.categoryName || t('Khóa học')}</span>
                <div className="course-hero-rating">
                  <StarRating value={item.avgRating} readonly size={17} showLabel />
                  <span>
                    ({item.reviewCount} {t('đánh giá)')}
                  </span>
                </div>
              </div>
              <h1>{t(item.title)}</h1>
              <p className="course-hero-desc">{t(item.description)}</p>

              <div className="detail-meta">
                <span>
                  {t('Trình độ:')} <strong>{String(item.level || 'Beginner').toUpperCase()}</strong>
                </span>
                <span>
                  {t('Trạng thái:')} <strong>{item.status || 'PUBLISHED'}</strong>
                </span>
                <span>
                  {t('Thời lượng:')}{' '}
                  <strong>
                    {sections.length} {t('chương (')}
                    {totalLessons} {t('bài học)')}
                  </strong>
                </span>
              </div>
            </article>

            {/* Navigation Tabs */}
            <div className="course-tabs-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'curriculum'}
                className={`course-tab-btn ${activeTab === 'curriculum' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('curriculum')}
              >
                {t('Giáo trình')} ({sections.length} {t('chương)')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'reviews'}
                className={`course-tab-btn ${activeTab === 'reviews' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                {t('Đánh giá & Nhận xét')} ({item.reviewCount})
              </button>
            </div>

            {/* Tab 1: Curriculum */}
            {activeTab === 'curriculum' && (
              <section className="course-content-panel">
                <h3 style={{ marginBottom: 16, fontSize: 19, fontWeight: 800 }}>{t('Nội dung khóa học')}</h3>
                {sections.length === 0 ? (
                  <div>
                    <p style={{ color: 'var(--muted)' }}>
                      {t('Khóa học đang được cập nhật chi tiết giáo trình.')}
                    </p>
                    {(item.lessons || courseDefaults.lessons).length > 0 && (
                      <ul style={{ paddingLeft: 18, marginTop: 12, display: 'grid', gap: 8 }}>
                        {(item.lessons || courseDefaults.lessons).map((lesson, index) => (
                          <li key={`${item.id}-lesson-${index}`}>{lesson}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="curriculum-section-list">
                    {sections.map((section, sIndex) => (
                      <div key={section.id} className="curriculum-section-box">
                        <div className="curriculum-section-head">
                          <span>
                            {t('Chương')} {sIndex + 1}: {t(section.title)}
                          </span>
                          <span>
                            {section.lessons?.length || 0} {t('bài học')}
                          </span>
                        </div>
                        {section.lessons && section.lessons.length > 0 && (
                          <div className="curriculum-lessons">
                            {section.lessons.map(lesson => {
                              const interactive = Boolean(lesson.preview || isEnrolled);
                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => handlePlayLesson(lesson)}
                                  className={`curriculum-lesson-row ${interactive ? 'is-interactive' : ''}`}
                                >
                                  <div className="curriculum-lesson-main">
                                    <span className="curriculum-lesson-type">
                                      <Icon
                                        name={lesson.lessonType === 'VIDEO' ? 'play' : 'book'}
                                        size={16}
                                      />
                                    </span>
                                    <span className="curriculum-lesson-title">{t(lesson.title)}</span>
                                    {lesson.preview ? (
                                      <span className="curriculum-preview-pill">{t('Học thử')}</span>
                                    ) : !isEnrolled ? (
                                      <span className="curriculum-lock-badge" title={t('Nội dung trả phí')}>
                                        🔒
                                      </span>
                                    ) : null}
                                  </div>
                                  {lesson.duration ? (
                                    <span className="curriculum-duration">
                                      {Math.round(lesson.duration / 60)} {t('phút')}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tab 2: Reviews */}
            {activeTab === 'reviews' && (
              <section className="course-content-panel">
                <div className="review-summary-banner">
                  <div className="review-summary-score">
                    <div className="review-summary-number">
                      {item.avgRating ? item.avgRating.toFixed(1) : '0.0'}
                    </div>
                    <StarRating value={item.avgRating} readonly size={18} />
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>
                      {item.reviewCount} {t('đánh giá')}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: 6, fontSize: 16.5, fontWeight: 800 }}>
                      {t('Đánh giá từ học viên')}
                    </h4>
                    <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                      {t(
                        'Mỗi học viên chỉ được gửi 1 đánh giá cho khóa học. Đánh giá giúp cải thiện chất lượng bài giảng và hỗ trợ các bạn học sau.',
                      )}
                    </p>
                  </div>
                </div>

                {isAuthenticated ? (
                  myReview && !editingReview ? (
                    <div className="my-review-box">
                      <span className="eyebrow">{t('Đánh giá của bạn')}</span>
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
                  <div className="review-form-box" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    {t('Vui lòng')}{' '}
                    <Link to="/login" className="text-link">
                      {t('đăng nhập')}
                    </Link>{' '}
                    {t('để viết đánh giá cho khóa học này.')}
                  </div>
                )}

                <h4 style={{ margin: '0 0 12px', fontSize: 16.5, fontWeight: 800 }}>
                  {t('Tất cả nhận xét (')}
                  {reviewPagination.totalElements})
                </h4>

                {reviewsLoading ? (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>
                    {t('Đang tải nhận xét...')}
                  </p>
                ) : reviews.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>
                    {t('Chưa có đánh giá nào cho khóa học này. Hãy là người đầu tiên để lại nhận xét!')}
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

                    {reviewPagination.totalPages > 1 && (
                      <div className="catalog-pagination">
                        <button
                          className="button button-outline"
                          disabled={reviewPagination.page <= 0 || reviewsLoading}
                          onClick={() => loadReviews(reviewPagination.page - 1)}
                        >
                          {t('Trang trước')}
                        </button>
                        <span>
                          Trang {reviewPagination.page + 1} / {reviewPagination.totalPages}
                        </span>
                        <button
                          className="button button-outline"
                          disabled={
                            reviewPagination.page >= reviewPagination.totalPages - 1 || reviewsLoading
                          }
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

          {/* Sticky Enrollment Sidebar */}
          <aside className="course-enroll-sidebar">
            <h3>{t('Thông tin khóa học')}</h3>
            <div className="course-enroll-stack">
              <div className="course-price-tag">
                <small>{t('Học phí')}</small>
                <div className={`course-price-value ${isFreeCourse ? 'is-free' : ''}`}>
                  {formatVND(Number(item.price || 0))}
                </div>
                {Number(item.originalPrice || 0) > Number(item.price || 0) && (
                  <div className="course-price-original">
                    <del>{formatVND(Number(item.originalPrice || 0))}</del>
                    <span>
                      {t('Tiết kiệm')} {formatVND(Number(item.originalPrice || 0) - Number(item.price || 0))}
                    </span>
                  </div>
                )}
              </div>

              {isEnrolled ? (
                <button
                  className="button button-success course-cta-btn"
                  type="button"
                  id="btn-continue-learning"
                  onClick={() => navigate(`/learning/${item.id}`)}
                >
                  {t('Tiếp tục học')}
                  <Icon name="arrow" size={18} />
                </button>
              ) : membership?.active && Number(item.price || 0) > 0 ? (
                <button
                  className="button button-primary course-cta-btn"
                  type="button"
                  id="btn-enroll-pro"
                  onClick={handleEnroll}
                  disabled={enrolling || item.status !== 'PUBLISHED'}
                >
                  {t('Học bằng Pro')}
                </button>
              ) : isFreeCourse ? (
                <button
                  className="button button-success course-cta-btn"
                  type="button"
                  id="btn-enroll-free"
                  onClick={handleEnroll}
                  disabled={enrolling || !course || course.status !== 'PUBLISHED'}
                >
                  {t('Đăng ký học miễn phí')}
                  <Icon name="cap" size={18} />
                </button>
              ) : (
                <button
                  className="button button-primary course-cta-btn"
                  type="button"
                  id="btn-buy-course"
                  onClick={handleBuyCourse}
                >
                  {t('Mua khóa học —')} {formatVND(Number(item.price || 0))}
                </button>
              )}

              {Number(item.price || 0) > 0 && !membership?.active && (
                <Link className="button button-outline course-cta-btn" to={ROUTES.PRO}>
                  {t(expiredPro ? 'Gia hạn Pro để tiếp tục học' : 'Hoặc mở khóa với Pro')}
                </Link>
              )}

              <div className="course-perks-list">
                <div>
                  <span className="course-perks-dot">✓</span>
                  <span>
                    {t(
                      enrollment?.accessSource === 'PRO' || (membership?.active && !hasEnrollment)
                        ? 'Quyền học trong thời hạn Pro'
                        : 'Truy cập trọn đời toàn bộ bài giảng',
                    )}
                  </span>
                </div>
                <div>
                  <span className="course-perks-dot">✓</span>
                  <span>{t('Học trên máy tính, điện thoại, tablet')}</span>
                </div>
                <div>
                  <span className="course-perks-dot">✓</span>
                  <span>{t('Hỗ trợ giải đáp từ giảng viên & AI')}</span>
                </div>
                <div>
                  <span className="course-perks-dot">✓</span>
                  <span>{t('Tích lũy XP, chuỗi học & huy hiệu')}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Preview Lesson Modal */}
        {previewModalOpen && (
          <div
            className="preview-modal-backdrop"
            onClick={() => {
              setPreviewModalOpen(false);
              setPreviewPlayData(null);
            }}
          >
            <div className="preview-modal-card" onClick={e => e.stopPropagation()}>
              <div className="preview-modal-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="curriculum-preview-pill">{t('HỌC THỬ MIỄN PHÍ')}</span>
                  <strong>{activePreviewLesson?.title}</strong>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('Đóng')}
                  onClick={() => {
                    setPreviewModalOpen(false);
                    setPreviewPlayData(null);
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="preview-modal-body">
                {previewLoading && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                    <p>{t('Đang cấp link phát bài học bảo mật...')}</p>
                  </div>
                )}

                {previewError && (
                  <div className="account-feedback is-error" style={{ textAlign: 'center' }}>
                    <p>{previewError}</p>
                  </div>
                )}

                {!previewLoading && !previewError && previewPlayData && (
                  <div>
                    {previewPlayData.lessonType === 'VIDEO' ? (
                      previewPlayData.playUrl?.includes('youtube.com') ||
                      previewPlayData.playUrl?.includes('youtu.be') ? (
                        <iframe
                          src={previewPlayData.playUrl
                            .replace('watch?v=', 'embed/')
                            .replace('youtu.be/', 'www.youtube.com/embed/')}
                          title={activePreviewLesson?.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: '100%', height: 380, border: 'none', borderRadius: 12 }}
                        />
                      ) : (
                        <video
                          controls
                          autoPlay
                          controlsList="nodownload"
                          src={resolveMediaUrl(previewPlayData.playUrl)}
                          onError={e => {
                            if (!e.currentTarget.dataset.fallbackTried) {
                              e.currentTarget.dataset.fallbackTried = 'true';
                              e.currentTarget.src = 'https://vjs.zencdn.net/v/oceans.mp4';
                              e.currentTarget.load();
                              e.currentTarget.play().catch(() => {});
                            }
                          }}
                          style={{ width: '100%', borderRadius: 12, maxHeight: 420, background: '#000' }}
                        >
                          {t('Trình duyệt của bạn không hỗ trợ phát video này.')}
                        </video>
                      )
                    ) : (
                      <div
                        style={{
                          background: 'var(--canvas)',
                          padding: 20,
                          borderRadius: 12,
                          maxHeight: 380,
                          overflowY: 'auto',
                        }}
                      >
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                          {previewPlayData.content || t('Nội dung bài học dạng tài liệu/văn bản.')}
                        </p>
                      </div>
                    )}

                    <div className="preview-modal-foot">
                      <small style={{ color: 'var(--muted)' }}>
                        {t('Pre-signed URL bảo vệ có thời hạn:')}{' '}
                        {Math.round(previewPlayData.expiresInSeconds / 60)} {t('phút')}
                      </small>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => {
                          setPreviewModalOpen(false);
                          if (isFreeCourse) handleEnroll();
                          else handleBuyCourse();
                        }}
                      >
                        {isFreeCourse
                          ? t('Đăng ký học toàn bộ')
                          : `${t('Mua khóa học —')} ${formatVND(Number(course?.price || 0))}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  useLocale();
  const { id } = useParams();
  return <CourseDetail key={id} id={id} />;
}
