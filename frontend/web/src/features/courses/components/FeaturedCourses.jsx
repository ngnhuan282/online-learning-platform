import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import ErrorState from '../../../shared/components/ErrorState';
import CourseCard from './CourseCard';
import { normalizeSearch } from '../data/demoCourses';
import useCourseCatalog from '../hooks/useCourseCatalog';

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'certificates', label: 'IELTS & Chứng chỉ' },
  { id: 'communication', label: 'Giao tiếp & IT' },
  { id: 'free', label: 'Miễn phí' },
];

export default function FeaturedCourses() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { courses, categories, loading, error, categoryError, retry } = useCourseCatalog();

  function setParams(next) {
    navigate(
      { pathname: '/', search: new URLSearchParams(next).toString(), hash: '#courses' },
      { preventScrollReset: true },
    );
  }
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'all';
  let filteredCourses = courses.filter(course => {
    const selectedCategoryName = categories.find(item => String(item.id) === String(category))?.name;
    return (
      (!category ||
        String(course.categoryId) === String(category) ||
        course.category === selectedCategoryName) &&
      (!query ||
        normalizeSearch(`${course.title} ${course.description} ${course.keywords}`).includes(
          normalizeSearch(query),
        )) &&
      (filter !== 'free' || course.price === 0) &&
      (!['certificates', 'communication'].includes(filter) || course.group === filter)
    );
  });
  if (filter === 'popular') filteredCourses = [...filteredCourses].sort((a, b) => b.students - a.students);
  if (filter === 'newest')
    filteredCourses = [...filteredCourses].sort((a, b) => b.date.localeCompare(a.date));
  function setFilter(value) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('filter');
    else next.set('filter', value);
    setParams(next);
  }
  return (
    <section className="courses-section" id="courses">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CHẤT LƯỢNG HÀNG ĐẦU</span>
            <h2>Khóa học Tiếng Anh nổi bật</h2>
            <p>Được hàng chục ngàn học viên lựa chọn để chinh phục mục tiêu sự nghiệp.</p>
          </div>
          <div className="course-filters" role="group" aria-label="Lọc khóa học">
            {filters.map(item => (
              <button
                key={item.id}
                className={filter === item.id ? 'selected' : ''}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {(query || category) && (
          <div className="search-results-summary" role="status">
            <span>
              {filteredCourses.length} khóa học {query && <>cho “{query}”</>}
              {category && (
                <> thuộc {categories.find(item => String(item.id) === String(category))?.name || category}</>
              )}
            </span>
            <button className="text-link" onClick={() => setParams({})}>
              Xóa bộ lọc <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {categoryError && <ErrorState error={categoryError} title="Không thể tải danh mục" onRetry={retry} />}
        {error ? (
          <ErrorState error={error} title="Không thể tải khóa học" onRetry={retry} />
        ) : loading ? (
          <div className="empty-courses" role="status">
            <h3>Đang tải khóa học...</h3>
          </div>
        ) : filteredCourses.length ? (
          <div className="course-grid">
            {filteredCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onSelect={c => c?.id && navigate(`/courses/${c.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-courses" role="status">
            <Icon name="search" size={38} />
            <h3>Chưa tìm thấy khóa học phù hợp</h3>
            <p>Hãy thử từ khóa khác hoặc khám phá các khóa học hiện có.</p>
            <button className="button button-outline" onClick={() => setParams({})}>
              Xem tất cả khóa học
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
