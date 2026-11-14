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
import { formatPrice, normalizeSearch } from '../data/demoCourses';
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
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const { courses, categories, loading, error, categoryError, retry } = useCourseCatalog();
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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // Search with debounce — keeps input responsive, updates URL after 300ms
  const initialQuery = params.get('q') || '';
  const { keyword, setKeyword, debouncedKeyword } = useCourseSearch(initialQuery);

  // Sync debounced keyword → URL param
  useEffect(() => {
    const paramsObj = new URLSearchParams(params);
    if (debouncedKeyword) paramsObj.set('q', debouncedKeyword);
    else paramsObj.delete('q');
    setParams(paramsObj, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword]);

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

  const query = debouncedKeyword;
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'all';
  const selectedCourseId = selected ? numericCourseId(selected) : null;
  const selectedIsEnrolled = selectedCourseId ? enrolledCourseIds.has(selectedCourseId) : false;
  const selectedEnrollLabel = !selectedCourseId
    ? 'Chưa thể ghi danh'
    : selectedIsEnrolled
      ? 'Đã ghi danh'
      : enrollingCourseId === selected?.id
        ? 'Đang ghi danh...'
        : 'Ghi danh miễn phí';

  const filteredCourses = useMemo(() => {
    const selectedCategoryName = categories.find(item => String(item.id) === String(category))?.name;
    const next = courses.filter(course => {
      const matchesCategory =
        !category ||
        String(course.categoryId) === String(category) ||
        course.categoryName === selectedCategoryName ||
        course.category === selectedCategoryName;

      const matchesQuery =
        !query ||
        normalizeSearch(`${course.title || ''} ${course.description || ''} ${course.categoryName || ''} ${course.keywords || ''}`).includes(
          normalizeSearch(query),
        );

      const price = Number(course.price || 0);
      const level = String(course.level || '').toUpperCase();
      let matchesFilter = true;
      if (filter === 'free') matchesFilter = price === 0;
      else if (filter === 'paid') matchesFilter = price > 0;
      else if (filter === 'beginner') matchesFilter = level === 'BEGINNER';
      else if (filter === 'intermediate') matchesFilter = level === 'INTERMEDIATE';
      else if (filter === 'advanced') matchesFilter = level === 'ADVANCED';

      return matchesCategory && matchesQuery && matchesFilter;
    });

    const sort = params.get('sort') || '';
    if (sort === 'rating_desc') return [...next].sort((a, b) => Number(b.avgRating || 0) - Number(a.avgRating || 0));
    if (sort === 'price_asc') return [...next].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === 'price_desc') return [...next].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return next;
  }, [categories, category, courses, filter, query, params]);

  function updateFilters(next) {
    const paramsObj = new URLSearchParams(params);
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

  return (
    <main className="container" style={{ padding: '32px 0 80px' }}>
      <div className="section-heading" style={{ alignItems: 'end' }}>
        <div>
          <span className="eyebrow">KHÓA HỌC</span>
          <h2>Danh sách khóa học</h2>
          <p>Tìm kiếm, lọc và lựa chọn khóa học phù hợp với mục tiêu học tập.</p>
        </div>
        <div className="course-filters" role="group" aria-label="Lọc khóa học">
          {filters.map(item => (
            <button
              key={item.id}
              className={filter === item.id ? 'selected' : ''}
              aria-pressed={filter === item.id}
              onClick={() => updateFilters({ filter: item.id === 'all' ? '' : item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0 20px' }}>
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder="Tìm khóa học theo tên, kỹ năng, nhãn..."
          style={{
            flex: 1,
            minWidth: 240,
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #dfe3ea',
          }}
        />
        <select
          value={category}
          onChange={event => updateFilters({ category: event.target.value })}
          style={{ minWidth: 200, padding: '12px 16px', borderRadius: 10, border: '1px solid #dfe3ea', background: '#fff' }}
        >
          <option value="">Tất cả danh mục ({categories.length})</option>
          {categories.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={params.get('sort') || ''}
          onChange={event => updateFilters({ sort: event.target.value })}
          style={{ minWidth: 180, padding: '12px 16px', borderRadius: 10, border: '1px solid #dfe3ea', background: '#fff' }}
        >
          <option value="">Sắp xếp: Mặc định</option>
          <option value="rating_desc">⭐ Đánh giá cao nhất</option>
          <option value="price_asc">💵 Giá: Thấp đến cao</option>
          <option value="price_desc">💵 Giá: Cao đến thấp</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Hiển thị <strong>{filteredCourses.length}</strong> khóa học phù hợp
        </span>
        {(Boolean(category) || Boolean(query) || (Boolean(filter) && filter !== 'all') || Boolean(params.get('sort'))) && (
          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setParams(new URLSearchParams())}
          >
            ✕ Xóa tất cả bộ lọc
          </button>
        )}
      </div>

      {categoryError && <ErrorState error={categoryError} title="Không thể tải danh mục" onRetry={retry} />}
      {error ? (
        <ErrorState error={error} title="Không thể tải khóa học" onRetry={retry} />
      ) : loading ? (
        <div className="empty-courses" role="status">
          <Icon name="search" size={32} />
          <h3>Đang tải khóa học...</h3>
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
          <h3>Không tìm thấy khóa học phù hợp</h3>
          <p>Hãy đổi bộ lọc hoặc từ khóa để xem thêm khóa học.</p>
        </div>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle className="dialog-heading">
          Thông tin khóa học
          <button className="icon-button" aria-label="Đóng" onClick={() => setSelected(null)}>
            <Icon name="close" />
          </button>
        </DialogTitle>
        {selected && (
          <DialogContent>
            {enrollError && <p role="alert">{enrollError}</p>}
            <img className="detail-image" src={selected.image} alt={selected.title} />
            <h2 className="detail-title">{selected.title}</h2>
            <p>{selected.description}</p>
            <div className="detail-meta">
              <span>★ {selected.rating}</span>
              <span>{selected.hours} giờ học</span>
              <span>{selected.level}</span>
            </div>
            <div className="detail-enroll" style={{ marginBottom: 12 }}>
              <strong>{selected.price ? formatPrice(selected.price) : 'Miễn phí'}</strong>
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
                  Thanh toán
                </button>
              )}
            </div>
            <Link
              className="button button-primary"
              to={`/courses/${selected.id}`}
              onClick={() => setSelected(null)}
              style={{ display: 'inline-flex', textDecoration: 'none' }}
            >
              Xem chi tiết khóa học
            </Link>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

export default CourseListPage;
