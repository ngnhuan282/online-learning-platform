import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';

import Icon from '../../../shared/components/Icon';
import useAuth from '../../auth/hooks/useAuth';
import useToast from '../../../shared/hooks/useToast';
import CourseCard from '../components/CourseCard';
import ErrorState from '../../../shared/components/ErrorState';
import useCourseCatalog from '../hooks/useCourseCatalog';
import { learningApi } from '../../learning/api/learningApi';
import { formatPrice } from '../data/demoCourses';
import useCourseSearch from '../hooks/useCourseSearch';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'free', label: 'Miễn phí' },
  { id: 'paid', label: 'Có phí' },
  { id: 'beginner', label: 'Cơ bản (Beginner)' },
  { id: 'intermediate', label: 'Trung cấp (Intermediate)' },
  { id: 'advanced', label: 'Nâng cao (Advanced)' },
];

const numericCourseId = course => {
  const id = Number(course?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

function CourseListPage() {
  useLocale();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'all';
  const catalogParams = useMemo(
    () => ({
      page: Math.max(0, Number.parseInt(params.get('page'), 10) || 0),
      size: 12,
      keyword: params.get('q') || undefined,
      categoryId: params.get('category') || undefined,
      level: ['beginner', 'intermediate', 'advanced'].includes(params.get('filter'))
        ? params.get('filter').toUpperCase()
        : undefined,
      pricing: ['free', 'paid'].includes(params.get('filter')) ? params.get('filter') : undefined,
      sort: params.get('sort') || 'newest',
      minPrice: params.get('minPrice') || undefined,
      maxPrice: params.get('maxPrice') || undefined,
      minRating: params.get('minRating') || undefined,
    }),
    [params],
  );
  const { courses, categories, pagination, loading, error, categoryError, retry } =
    useCourseCatalog(catalogParams);
  const [selected, setSelected] = useState(null);
  const [enrollmentState, setEnrollmentState] = useState(null);
  const enrolledCourseIds =
    user?.id != null && enrollmentState?.userId === user.id ? enrollmentState.ids : new Set();
  const setEnrolledCourseIds = useCallback(
    value =>
      setEnrollmentState(previous => {
        const ids = previous && previous.userId === user?.id ? previous.ids : new Set();
        return { userId: user?.id, ids: typeof value === 'function' ? value(ids) : value };
      }),
    [user?.id],
  );
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const [enrollError, setEnrollError] = useState('');
  const navigate = useNavigate();

  // Search with debounce — keeps input responsive, updates URL after 300ms
  const initialQuery = params.get('q') || '';
  const { keyword, setKeyword, debouncedKeyword } = useCourseSearch(initialQuery);

  // Sync debounced keyword → URL param
  useEffect(() => {
    if (debouncedKeyword === (params.get('q') || '')) return;
    const paramsObj = new URLSearchParams(params);
    if (debouncedKeyword) paramsObj.set('q', debouncedKeyword);
    else paramsObj.delete('q');
    if (debouncedKeyword !== (params.get('q') || '')) paramsObj.delete('page');
    setParams(paramsObj, { replace: true });
  }, [debouncedKeyword, params, setParams]);

  function selectCourse(course) {
    if (course?.id) {
      navigate(`/courses/${course.id}`);
    }
  }

  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated) {
      Promise.resolve().then(() => {
        if (isMounted) setEnrolledCourseIds(new Set());
      });
      return undefined;
    }

    learningApi
      .getMyEnrollments()
      .then(response => {
        const enrollments = response?.data ?? [];
        if (isMounted)
          setEnrolledCourseIds(
            new Set(
              enrollments.filter(item => item.status !== 'CANCELLED').map(item => Number(item.courseId)),
            ),
          );
      })
      .catch(() => {
        if (isMounted) setEnrolledCourseIds(new Set());
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id, setEnrolledCourseIds]);

  const selectedCourseId = selected ? numericCourseId(selected) : null;
  const selectedIsEnrolled = selectedCourseId ? enrolledCourseIds.has(selectedCourseId) : false;
  const selectedEnrollLabel = !selectedCourseId
    ? 'Chưa thể ghi danh'
    : selectedIsEnrolled
      ? 'Đã ghi danh'
      : enrollingCourseId === selected?.id
        ? 'Đang ghi danh...'
        : 'Ghi danh miễn phí';

  const filteredCourses = courses;

  function updateFilters(next) {
    const paramsObj = new URLSearchParams(params);
    if (!Object.hasOwn(next, 'page')) paramsObj.delete('page');
    Object.entries(next).forEach(([key, value]) => {
      if (!value) paramsObj.delete(key);
      else paramsObj.set(key, value);
    });
    setParams(paramsObj);
  }

  async function enrollFreeCourse(course) {
    const courseId = numericCourseId(course);
    if (!courseId) {
      setEnrollError(
        'Khóa học này đang dùng dữ liệu demo nên chưa có mã khóa học từ Course Service để ghi danh.',
      );
      setSelected(course);
      return;
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/courses?${params.toString()}` } });
      return;
    }
    if (course.price !== 0 || enrolledCourseIds.has(courseId)) return;

    const version = getSessionVersion();
    setEnrollError('');
    setEnrollingCourseId(course.id);
    try {
      const response = await learningApi.enroll(courseId);
      if (version !== getSessionVersion()) return;
      const enrollment = response?.data;
      setEnrolledCourseIds(previous => new Set(previous).add(Number(enrollment?.courseId ?? courseId)));
      toast('Đã thêm khóa học vào My Courses.');
      setSelected(null);
      navigate('/my-courses');
    } catch (error) {
      if (version !== getSessionVersion()) return;
      setEnrollError(error.message || 'Không thể ghi danh khóa học.');
      setSelected(course);
    } finally {
      if (version === getSessionVersion()) setEnrollingCourseId(null);
    }
  }

  const hasActiveFilters =
    Boolean(category) ||
    Boolean(query) ||
    (Boolean(filter) && filter !== 'all') ||
    Boolean(params.get('sort')) ||
    params.has('minPrice') ||
    params.has('maxPrice') ||
    params.has('minRating');

  return (
    <div className="catalog-page">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('KHÓA HỌC')}</span>
            <h2>{t('Danh sách khóa học')}</h2>
            <p>{t('Tìm kiếm, lọc và lựa chọn khóa học phù hợp với mục tiêu học tập.')}</p>
          </div>
          <div className="course-filters" role="group" aria-label={t('Lọc khóa học')}>
            {filters.map(item => (
              <button
                key={item.id}
                className={filter === item.id ? 'selected' : ''}
                aria-pressed={filter === item.id}
                onClick={() => updateFilters({ filter: item.id === 'all' ? '' : item.id })}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-filter-panel">
          <div className="catalog-primary-controls">
            <div className="catalog-search-field">
              <Icon name="search" size={19} />
              <input
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder={t('Tìm khóa học theo tên, kỹ năng, nhãn...')}
              />
            </div>
            <select
              className="catalog-select"
              value={category}
              onChange={event => updateFilters({ category: event.target.value })}
            >
              <option value="">
                {t('Tất cả danh mục (')}
                {categories.length})
              </option>
              {categories.map(item => (
                <option key={item.id} value={item.id}>
                  {t(item.name)}
                </option>
              ))}
            </select>
            <select
              className="catalog-select"
              value={params.get('sort') || ''}
              onChange={event => updateFilters({ sort: event.target.value })}
            >
              <option value="">{t('Sắp xếp: Mặc định')}</option>
              <option value="rating_desc">{t('Đánh giá cao nhất')}</option>
              <option value="price_asc">{t('Giá: Thấp đến cao')}</option>
              <option value="price_desc">{t('Giá: Cao đến thấp')}</option>
            </select>
          </div>

          <div className="catalog-secondary-controls">
            <label className="catalog-inline-field">
              <span>{t('Giá từ')}</span>
              <input
                type="number"
                min="0"
                placeholder="0đ"
                aria-label={t('Giá tối thiểu')}
                value={params.get('minPrice') || ''}
                onChange={event => updateFilters({ minPrice: event.target.value })}
              />
            </label>
            <label className="catalog-inline-field">
              <span>{t('Giá đến')}</span>
              <input
                type="number"
                min="0"
                placeholder="VND"
                aria-label={t('Giá tối đa')}
                value={params.get('maxPrice') || ''}
                onChange={event => updateFilters({ maxPrice: event.target.value })}
              />
            </label>
            <label className="catalog-inline-field">
              <span>{t('Đánh giá')}</span>
              <select
                aria-label={t('Đánh giá tối thiểu')}
                value={params.get('minRating') || ''}
                onChange={event => updateFilters({ minRating: event.target.value })}
              >
                <option value="">{t('Tất cả')}</option>
                <option value="4">{t('Từ 4 sao')}</option>
                <option value="3">{t('Từ 3 sao')}</option>
                <option value="2">{t('Từ 2 sao')}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="catalog-results-bar">
          <span className="catalog-results-count">
            {t('Hiển thị')} <strong>{pagination.totalElements}</strong> {t('khóa học phù hợp')}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="button button-soft"
              onClick={() => {
                setKeyword('');
                setParams(new URLSearchParams());
              }}
            >
              {t('✕ Xóa tất cả bộ lọc')}
            </button>
          )}
        </div>

        {categoryError && (
          <ErrorState error={categoryError} title={t('Không thể tải danh mục')} onRetry={retry} />
        )}
        {error ? (
          <ErrorState error={error} title={t('Không thể tải khóa học')} onRetry={retry} />
        ) : loading ? (
          <div className="empty-courses" role="status">
            <Icon name="search" size={32} />
            <h3>{t('Đang tải khóa học...')}</h3>
          </div>
        ) : filteredCourses.length ? (
          <div className="course-grid">
            {filteredCourses.map(course => {
              const courseId = numericCourseId(course);
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  canEnroll={Boolean(courseId)}
                  enrolled={enrolledCourseIds.has(courseId)}
                  enrolling={enrollingCourseId === course.id}
                  onEnroll={enrollFreeCourse}
                  onSelect={selectCourse}
                />
              );
            })}
          </div>
        ) : (
          <div className="empty-courses" role="status">
            <Icon name="search" size={32} />
            <h3>{t('Không tìm thấy khóa học phù hợp')}</h3>
            <p>{t('Hãy đổi bộ lọc hoặc từ khóa để xem thêm khóa học.')}</p>
          </div>
        )}

        {!error && pagination.totalPages > 1 && (
          <nav className="catalog-pagination" aria-label={t('Phân trang khóa học')}>
            <button
              className="button button-outline"
              disabled={loading || pagination.page <= 0}
              onClick={() => updateFilters({ page: String(pagination.page - 1) })}
            >
              {t('Trang trước')}
            </button>
            <span>
              Trang {pagination.page + 1} / {pagination.totalPages}
            </span>
            <button
              className="button button-outline"
              disabled={loading || pagination.page + 1 >= pagination.totalPages}
              onClick={() => updateFilters({ page: String(pagination.page + 1) })}
            >
              Trang sau
            </button>
          </nav>
        )}

        <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
          <DialogTitle className="dialog-heading">
            {t('Thông tin khóa học')}
            <button className="icon-button" aria-label={t('Đóng')} onClick={() => setSelected(null)}>
              <Icon name="close" />
            </button>
          </DialogTitle>
          {selected && (
            <DialogContent>
              {enrollError && (
                <p className="account-feedback is-error" role="alert" style={{ marginBottom: 14 }}>
                  {enrollError}
                </p>
              )}
              <img className="detail-image" src={selected.image} alt={selected.title} />
              <h2 className="detail-title">{t(selected.title)}</h2>
              <p>{t(selected.description)}</p>
              <div className="detail-meta">
                <span>★ {selected.rating}</span>
                <span>
                  {selected.hours} {t('giờ học')}
                </span>
                <span>{selected.level}</span>
              </div>
              <div className="detail-enroll">
                <strong>{selected.price ? formatPrice(selected.price) : t('Miễn phí')}</strong>
                {selected.price === 0 ? (
                  <button
                    className="button button-success"
                    disabled={!selectedCourseId || enrollingCourseId === selected.id || selectedIsEnrolled}
                    onClick={() => enrollFreeCourse(selected)}
                  >
                    {selectedEnrollLabel}
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    onClick={() => navigate(`/checkout?course=${encodeURIComponent(selectedCourseId)}`)}
                  >
                    {t('Thanh toán')}
                  </button>
                )}
              </div>
              <Link
                className="button button-outline"
                to={`/courses/${selected.id}`}
                onClick={() => setSelected(null)}
              >
                {t('Xem chi tiết khóa học')}
              </Link>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}

export default CourseListPage;
