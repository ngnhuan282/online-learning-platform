import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import CourseCard from './CourseCard';
import { formatPrice, normalizeSearch } from '../data/demoCourses';
import { categoryApi } from '../api/categoryApi';
import { courseApi } from '../api/courseApi';

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'certificates', label: 'IELTS & Chứng chỉ' },
  { id: 'communication', label: 'Giao tiếp & IT' },
  { id: 'free', label: 'Miễn phí' },
];

const coerceCourse = course => ({
  id: course.id,
  title: course.title,
  description: course.description,
  categoryId: course.categoryId ?? course.category_id ?? null,
  category: course.categoryName || course.category || 'general',
  categories: [course.categoryName || course.category || 'general'],
  group: course.categoryName ? 'communication' : 'certificates',
  tag: course.status || 'Khóa học',
  image: course.thumbnailUrl || '/images/english-ielts.jpg',
  imageAlt: `${course.title} thumbnail`,
  rating: '4.8',
  reviews: '0',
  students: 0,
  hours: 8,
  level: course.level ? String(course.level).toLowerCase() : 'beginner',
  price: Number(course.price ?? 0),
  originalPrice: Number(course.originalPrice ?? course.price ?? 0),
  discount: course.originalPrice && course.price ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100) : 0,
  date: course.createdAt || '2026-09-01',
  keywords: `${course.title} ${course.description}`,
  lessons: [course.description],
});

const normalizeCourseList = response => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload.map(coerceCourse);
  if (Array.isArray(payload?.content)) return payload.content.map(coerceCourse);
  if (Array.isArray(payload?.data?.content)) return payload.data.content.map(coerceCourse);
  if (Array.isArray(payload?.items)) return payload.items.map(coerceCourse);
  if (Array.isArray(payload?.data)) return payload.data.map(coerceCourse);
  return [];
};

const normalizeCategoryList = response => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export default function FeaturedCourses() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [coursesResponse, categoriesResponse] = await Promise.all([
          courseApi.list({ page: 0, size: 20 }),
          categoryApi.list(),
        ]);

        if (isMounted) {
          setCourses(normalizeCourseList(coursesResponse));
          setCategories(normalizeCategoryList(categoriesResponse));
        }
      } catch (error) {
        if (isMounted) {
          setCourses([]);
          setCategories([]);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

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
      (!category || String(course.categoryId) === String(category) || course.category === selectedCategoryName) &&
      (!query ||
        normalizeSearch(`${course.title} ${course.description} ${course.keywords}`).includes(
          normalizeSearch(query),
        )) &&
      (filter !== 'free' || course.price === 0) &&
      (!['certificates', 'communication'].includes(filter) || course.group === filter)
    );
  });
  if (filter === 'popular') filteredCourses = [...filteredCourses].sort((a, b) => b.students - a.students);
  if (filter === 'newest') filteredCourses = [...filteredCourses].sort((a, b) => b.date.localeCompare(a.date));
  function setFilter(value) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('filter');
    else next.set('filter', value);
    setParams(next, { preventScrollReset: true });
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
              {category && <> thuộc {categories.find(item => String(item.id) === String(category))?.name || category}</>}
            </span>
            <button className="text-link" onClick={() => setParams({}, { preventScrollReset: true })}>
              Xóa bộ lọc <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {filteredCourses.length ? (
          <div className="course-grid">
            {filteredCourses.map(course => (
              <CourseCard key={course.id} course={course} onSelect={setSelected} />
            ))}
          </div>
        ) : (
          <div className="empty-courses" role="status">
            <Icon name="search" size={38} />
            <h3>Chưa tìm thấy khóa học phù hợp</h3>
            <p>Hãy thử từ khóa khác hoặc khám phá các khóa học hiện có.</p>
            <button
              className="button button-outline"
              onClick={() => setParams({}, { preventScrollReset: true })}
            >
              Xem tất cả khóa học
            </button>
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
              <img className="detail-image" src={selected.image} alt={selected.title} />
              <h2 className="detail-title">{selected.title}</h2>
              <p>{selected.description}</p>
              <div className="detail-meta">
                <span>★ {selected.rating}</span>
                <span>{selected.hours} giờ học</span>
                <span>{selected.level}</span>
              </div>
              <h3>Bạn sẽ học được gì?</h3>
              <ul className="lesson-list">
                {selected.lessons.map(lesson => (
                  <li key={lesson}>
                    <Icon name="check" size={18} />
                    {lesson}
                  </li>
                ))}
              </ul>
              <div className="detail-enroll">
                <strong>{selected.price ? formatPrice(selected.price) : 'Miễn phí'}</strong>
                <Link
                  className="button button-primary"
                  to={
                    selected.price
                      ? `${ROUTES.CHECKOUT}?course=${encodeURIComponent(selected.id)}`
                      : ROUTES.REGISTER
                  }
                >
                  {selected.price ? 'Thanh toán' : 'Đăng ký học'} <Icon name="arrow" size={17} />
                </Link>
              </div>
              <p className="demo-note">
                Khóa học minh họa. Đăng ký học và thanh toán sẽ được kết nối khi backend sẵn sàng.
              </p>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </section>
  );
}
