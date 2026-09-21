import { useEffect, useMemo, useState } from 'react';

import { courseApi } from '../api/courseApi';
import { demoCourses, formatPrice } from '../data/demoCourses';

const emptyForm = {
  title: '',
  description: '',
  categoryName: 'Luyện thi IELTS',
  level: 'beginner',
  price: 0,
  originalPrice: 0,
  thumbnailUrl: '/images/english-ielts.jpg',
};

const coerceCourse = course => ({
  id: course.id ?? course.courseId ?? Date.now(),
  title: course.title ?? 'Khóa học mới',
  description: course.description ?? 'Mô tả khóa học',
  categoryName: course.categoryName ?? course.category ?? 'Luyện thi IELTS',
  level: course.level ?? 'beginner',
  price: Number(course.price ?? 0),
  originalPrice: Number(course.originalPrice ?? course.price ?? 0),
  thumbnailUrl: course.thumbnailUrl ?? course.image ?? '/images/english-ielts.jpg',
  status: course.status ?? 'PUBLISHED',
  createdAt: course.createdAt ?? new Date().toISOString(),
});

export default function AdminCoursePage() {
  const [courses, setCourses] = useState(demoCourses.map(item => coerceCourse(item)));
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCourses = async () => {
      try {
        const response = await courseApi.list({ page: 0, size: 20 });
        const payload = response?.data ?? response;
        const list = payload?.content ?? payload?.data?.content ?? payload?.items ?? [];
        const normalized = Array.isArray(list) && list.length ? list.map(coerceCourse) : demoCourses.map(item => coerceCourse(item));
        if (isMounted) setCourses(normalized);
      } catch (error) {
        if (isMounted) setCourses(demoCourses.map(item => coerceCourse(item)));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalRevenue = useMemo(
    () => courses.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [courses],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        categoryId: 1,
        price: Number(form.price),
        originalPrice: Number(form.originalPrice),
        level: form.level,
        status: 'PUBLISHED',
        thumbnailUrl: form.thumbnailUrl,
      };

      const response = await courseApi.create(payload);
      const savedCourse = response?.data?.data ?? response?.data ?? {
        ...payload,
        id: Date.now(),
        categoryName: form.categoryName,
      };

      setCourses(prev => [coerceCourse(savedCourse), ...prev]);
      setForm(emptyForm);
    } catch (error) {
      const fallbackCourse = {
        ...payload,
        id: Date.now(),
        categoryName: form.categoryName,
        title: form.title || 'Khóa học mới',
        description: form.description || 'Mô tả khóa học',
      };
      setCourses(prev => [coerceCourse(fallbackCourse), ...prev]);
      setForm(emptyForm);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await courseApi.delete(id);
    } catch (error) {
      // Ignore delete failure in demo flow and keep local UI consistent.
    }
    setCourses(prev => prev.filter(item => String(item.id) !== String(id)));
  }

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ marginTop: 8 }}>Quản lý khóa học</h1>
        </div>

        <div className="course-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Tổng khóa học</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>{courses.length}</h3>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Doanh thu ước tính</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>{formatPrice(totalRevenue)}</h3>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Trạng thái</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>Online</h3>
          </div>
        </div>

        <div className="course-grid" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
          <form className="course-card" onSubmit={handleSubmit} style={{ padding: 20, display: 'grid', gap: 14 }}>
            <h3>Thêm khóa học mới</h3>

            <input
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
              placeholder="Tên khóa học"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
            />

            <textarea
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
              placeholder="Mô tả khóa học"
              rows={4}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea', resize: 'vertical' }}
            />

            <input
              value={form.categoryName}
              onChange={event => setForm({ ...form, categoryName: event.target.value })}
              placeholder="Danh mục"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input
                type="number"
                value={form.price}
                onChange={event => setForm({ ...form, price: Number(event.target.value) })}
                placeholder="Giá"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
              />
              <input
                type="number"
                value={form.originalPrice}
                onChange={event => setForm({ ...form, originalPrice: Number(event.target.value) })}
                placeholder="Giá gốc"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
              />
            </div>

            <select
              value={form.level}
              onChange={event => setForm({ ...form, level: event.target.value })}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu khóa học'}
            </button>
          </form>

          <div className="course-card" style={{ padding: 20 }}>
            <h3>Danh sách khóa học</h3>
            {loading ? (
              <p>Đang tải khóa học...</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {courses.map(course => (
                  <div
                    key={course.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      border: '1px solid #e7ebf0',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <strong>{course.title}</strong>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{course.categoryName}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{formatPrice(Number(course.price || 0))}</div>
                    </div>
                    <button className="button button-soft" type="button" onClick={() => handleDelete(course.id)}>
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
