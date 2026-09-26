import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';

import Icon from '../../../shared/components/Icon';
import CourseCard from '../components/CourseCard';
import { categoryApi } from '../api/categoryApi';
import { courseApi } from '../api/courseApi';
import { formatPrice, normalizeSearch } from '../data/demoCourses';

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

function CourseListPage() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
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
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'all';

  const filteredCourses = useMemo(() => {
    const selectedCategoryName = categories.find(item => String(item.id) === String(category))?.name;
    const next = courses.filter(course => {
      const matchesCategory = !category || String(course.categoryId) === String(category) || course.category === selectedCategoryName;
      const matchesQuery =
        !query ||
        normalizeSearch(`${course.title} ${course.description} ${course.keywords}`).includes(
          normalizeSearch(query),
        );
      const matchesFree = filter !== 'free' || course.price === 0;
      const matchesGroup =
        !['certificates', 'communication'].includes(filter) || course.group === filter;
      return matchesCategory && matchesQuery && matchesFree && matchesGroup;
    });

    if (filter === 'popular') return [...next].sort((a, b) => b.students - a.students);
    if (filter === 'newest') return [...next].sort((a, b) => b.date.localeCompare(a.date));
    return next;
  }, [category, courses, filter, query]);

  function updateFilters(next) {
    const paramsObj = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) paramsObj.delete(key);
      else paramsObj.set(key, value);
    });
    setParams(paramsObj);
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

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0 28px' }}>
        <input
          value={query}
          onChange={event => updateFilters({ q: event.target.value.trim() })}
          placeholder="Tìm khóa học theo tên, kỹ năng, nhãn..."
          style={{ flex: 1, minWidth: 240, padding: '12px 16px', borderRadius: 10, border: '1px solid #dfe3ea' }}
        />
        <select
          value={category}
          onChange={event => updateFilters({ category: event.target.value })}
          style={{ minWidth: 220, padding: '12px 16px', borderRadius: 10, border: '1px solid #dfe3ea' }}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-courses" role="status">
          <Icon name="search" size={32} />
          <h3>Đang tải khóa học...</h3>
        </div>
      ) : filteredCourses.length ? (
        <div className="course-grid">
          {filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} onSelect={setSelected} />
          ))}
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
