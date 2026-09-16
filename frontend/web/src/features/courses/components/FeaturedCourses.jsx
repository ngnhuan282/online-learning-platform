import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import Icon from '../../../shared/components/Icon';
import CourseCard from './CourseCard';
import { categories, demoCourses, formatPrice, normalizeSearch } from '../data/demoCourses';

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'certificates', label: 'IELTS & Chứng chỉ' },
  { id: 'communication', label: 'Giao tiếp & IT' },
  { id: 'free', label: 'Miễn phí' },
];

export default function FeaturedCourses() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  function setParams(next) {
    navigate(
      { pathname: '/', search: new URLSearchParams(next).toString(), hash: '#courses' },
      { preventScrollReset: true },
    );
  }
  const [selected, setSelected] = useState(null);
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'all';
  let courses = demoCourses.filter(
    course =>
      (!category || course.categories.includes(category)) &&
      (!query ||
        normalizeSearch(`${course.title} ${course.description} ${course.keywords}`).includes(
          normalizeSearch(query),
        )) &&
      (filter !== 'free' || course.price === 0) &&
      (!['certificates', 'communication'].includes(filter) || course.group === filter),
  );
  if (filter === 'popular') courses = [...courses].sort((a, b) => b.students - a.students);
  if (filter === 'newest') courses = [...courses].sort((a, b) => b.date.localeCompare(a.date));
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
              {courses.length} khóa học {query && <>cho “{query}”</>}
              {category && <> thuộc {categories.find(item => item.id === category)?.name || category}</>}
            </span>
            <button className="text-link" onClick={() => setParams({}, { preventScrollReset: true })}>
              Xóa bộ lọc <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {courses.length ? (
          <div className="course-grid">
            {courses.map(course => (
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
                <Link className="button button-primary" to="/register">
                  Đăng ký học <Icon name="arrow" size={17} />
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
