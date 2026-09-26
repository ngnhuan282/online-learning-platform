import { useEffect, useMemo, useState } from 'react';

import { categoryApi } from '../api/categoryApi';
import { courseApi } from '../api/courseApi';
import { demoCourses, formatPrice } from '../data/demoCourses';

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  categoryName: '',
  level: 'beginner',
  price: 0,
  originalPrice: 0,
  thumbnailUrl: '/images/english-ielts.jpg',
};

const coerceCourse = course => ({
  id: course.id ?? course.courseId ?? Date.now(),
  title: course.title ?? 'Khóa học mới',
  description: course.description ?? 'Mô tả khóa học',
  categoryId: course.categoryId ?? course.category_id ?? null,
  categoryName: course.categoryName ?? course.category ?? 'Luyện thi IELTS',
  level: course.level ?? 'beginner',
  price: Number(course.price ?? 0),
  originalPrice: Number(course.originalPrice ?? course.price ?? 0),
  thumbnailUrl: course.thumbnailUrl ?? course.image ?? '/images/english-ielts.jpg',
  status: course.status ?? 'PUBLISHED',
  createdAt: course.createdAt ?? new Date().toISOString(),
});

export const normalizeCourseList = response => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload.map(coerceCourse);
  if (Array.isArray(payload?.content)) return payload.content.map(coerceCourse);
  if (Array.isArray(payload?.data?.content)) return payload.data.content.map(coerceCourse);
  if (Array.isArray(payload?.items)) return payload.items.map(coerceCourse);
  if (Array.isArray(payload?.data)) return payload.data.map(coerceCourse);
  return [];
};

export const normalizeCoursePayload = payload => ({
  ...payload,
  level: payload.level ? String(payload.level).toUpperCase() : undefined,
  status: payload.status ? String(payload.status).toUpperCase() : 'PUBLISHED',
  categoryId: Number(payload.categoryId),
  price: Number(payload.price ?? 0),
  originalPrice: Number(payload.originalPrice ?? 0),
  thumbnailUrl: payload.thumbnailUrl || '/images/english-ielts.jpg',
});

export default function AdminCoursePage() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = async () => {
    try {
      const response = await categoryApi.list();
      const payload = response?.data ?? response;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      setCategories(list);
      if (!list.length) return;
      setForm(prev => ({
        ...prev,
        categoryId: prev.categoryId || String(list[0].id),
        categoryName: prev.categoryName || list[0].name,
      }));
    } catch (error) {
      setCategories([]);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await courseApi.list({ page: 0, size: 20 });
      setCourses(normalizeCourseList(response));
    } catch (error) {
      setCourses([]);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      await Promise.all([loadCategories(), loadCourses()]);
      if (isMounted) setLoading(false);
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalRevenue = useMemo(
    () => courses.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [courses],
  );

  function resetForm() {
    setForm({ ...emptyForm, categoryId: categories[0] ? String(categories[0].id) : '', categoryName: categories[0] ? categories[0].name : '' });
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const selectedCategory = categories.find(item => String(item.id) === String(form.categoryId));
    const categoryId = Number(selectedCategory?.id ?? form.categoryId ?? categories[0]?.id);

    if (!categoryId && !categories.length) {
      setSubmitting(false);
      return;
    }

    const payload = normalizeCoursePayload({
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId,
      price: Number(form.price || 0),
      originalPrice: Number(form.originalPrice || 0),
      level: form.level,
      status: 'PUBLISHED',
      thumbnailUrl: form.thumbnailUrl || '/images/english-ielts.jpg',
    });

    try {
      let savedCourse;
      if (editingId) {
        const response = await courseApi.update(editingId, payload);
        savedCourse = response?.data?.data ?? response?.data ?? response ?? { ...payload, id: editingId };
      } else {
        const response = await courseApi.create(payload);
        savedCourse = response?.data?.data ?? response?.data ?? response ?? { ...payload, id: Date.now() };
      }

      resetForm();
      await loadCategories();
      await loadCourses();
    } catch (error) {
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(course) {
    const selectedCategory = categories.find(item => String(item.id) === String(course.categoryId) || item.name === course.categoryName);
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description,
      categoryId: selectedCategory ? String(selectedCategory.id) : String(categories[0]?.id ?? ''),
      categoryName: course.categoryName || selectedCategory?.name || categories[0]?.name || '',
      level: course.level || 'beginner',
      price: Number(course.price || 0),
      originalPrice: Number(course.originalPrice || course.price || 0),
      thumbnailUrl: course.thumbnailUrl || '/images/english-ielts.jpg',
    });
  }

  async function handleDelete(id) {
    try {
      await courseApi.delete(id);
    } catch (error) {
      // Ignore delete failure and refresh from the server to keep the UI honest.
    }
    await loadCourses();
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

            <select
              value={form.categoryId}
              onChange={event => {
                const nextCategory = categories.find(item => String(item.id) === String(event.target.value));
                setForm({
                  ...form,
                  categoryId: event.target.value,
                  categoryName: nextCategory?.name ?? form.categoryName,
                });
              }}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
            >
              {!form.categoryId && <option value="">Chọn danh mục</option>}
              {categories.map(category => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>

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

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="button button-primary" type="submit" disabled={submitting || !form.title.trim() || !form.description.trim() || !form.categoryId}>
                {submitting ? (editingId ? 'Đang cập nhật...' : 'Đang lưu...') : (editingId ? 'Cập nhật khóa học' : 'Lưu khóa học')}
              </button>
              {editingId && (
                <button className="button button-soft" type="button" onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="button button-soft" type="button" onClick={() => handleEdit(course)}>
                        Sửa
                      </button>
                      <button className="button button-soft" type="button" onClick={() => handleDelete(course.id)}>
                        Xóa
                      </button>
                    </div>
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
