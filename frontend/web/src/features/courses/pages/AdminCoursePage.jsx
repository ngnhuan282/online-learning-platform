import { useEffect, useMemo, useRef, useState } from 'react';

import { courseApi } from '../api/courseApi';
import { formatPrice } from '../data/demoCourses';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../../admin/utils/adminUtils';
import ErrorState from '../../../shared/components/ErrorState';

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  level: 'BEGINNER',
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
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const pending = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCourses = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [response, categoryResponse] = await Promise.all([
          courseApi.adminList({ page: 0, size: 20 }, { signal: controller.signal }),
          courseApi.categories({ signal: controller.signal }),
        ]);
        if (!Array.isArray(response.data?.content) || !Array.isArray(categoryResponse.data))
          throw new Error('Dữ liệu khóa học không hợp lệ. Vui lòng thử lại.');
        if (isMounted) {
          setCourses(response.data.content.map(coerceCourse));
          setCategories(categoryResponse.data);
        }
      } catch (error) {
        if (isMounted && error.code !== 'ERR_CANCELED') setLoadError(error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCourses();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [retry]);

  const totalRevenue = useMemo(
    () => courses.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [courses],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending.current || loading || loadError) return;
    pending.current = true;
    setSubmitting(true);
    setMutationError(null);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        categoryId: Number(form.categoryId),
        price: Number(form.price),
        originalPrice: Number(form.originalPrice),
        level: form.level,
        status: 'PUBLISHED',
        thumbnailUrl: form.thumbnailUrl,
      };

      const response = await courseApi.create(payload);
      const savedCourse = response.data;
      if (savedCourse?.id == null) throw new Error('Máy chủ chưa xác nhận lưu khóa học.');

      setCourses(prev => [coerceCourse(savedCourse), ...prev]);
      setForm(emptyForm);
    } catch (error) {
      setMutationError(error);
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (pending.current) return;
    pending.current = true;
    setDeletingId(id);
    setMutationError(null);
    try {
      await courseApi.delete(id);
      setCourses(prev => prev.filter(item => String(item.id) !== String(id)));
    } catch (error) {
      setMutationError(error);
    } finally {
      pending.current = false;
      setDeletingId(null);
    }
  }

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ marginTop: 8 }}>Quản lý khóa học</h1>
        </div>

        {loadError && <ErrorState error={loadError} onRetry={() => setRetry(value => value + 1)} />}
        {mutationError && <ErrorState title="Không thể lưu thay đổi" error={mutationError} />}

        <div className="course-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Tổng khóa học</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>{courses.length}</h3>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Tổng giá niêm yết đang hiển thị</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>{formatPrice(totalRevenue)}</h3>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small>Trạng thái</small>
            <h3 style={{ fontSize: 28, margin: '8px 0' }}>
              {loading ? 'Đang tải' : loadError ? 'Lỗi kết nối' : 'Đã tải'}
            </h3>
          </div>
        </div>

        <div className="course-grid" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
          {can(user, 'COURSE_CREATE') && (
            <form
              className="course-card"
              onSubmit={handleSubmit}
              style={{ padding: 20, display: 'grid', gap: 14 }}
            >
              <h3>Thêm khóa học mới</h3>

              <input
                aria-label="Tên khóa học"
                required
                maxLength={200}
                value={form.title}
                onChange={event => setForm({ ...form, title: event.target.value })}
                placeholder="Tên khóa học"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
              />

              <textarea
                aria-label="Mô tả khóa học"
                required
                maxLength={2000}
                value={form.description}
                onChange={event => setForm({ ...form, description: event.target.value })}
                placeholder="Mô tả khóa học"
                rows={4}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #dfe3ea',
                  resize: 'vertical',
                }}
              />

              <select
                aria-label="Danh mục"
                required
                value={form.categoryId}
                onChange={event => setForm({ ...form, categoryId: event.target.value })}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
              >
                <option value="">Chọn danh mục</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {!loading && !loadError && categories.length === 0 && <p>Chưa có danh mục để tạo khóa học.</p>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input
                  type="number"
                  aria-label="Giá"
                  min={0}
                  value={form.price}
                  onChange={event => setForm({ ...form, price: Number(event.target.value) })}
                  placeholder="Giá"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
                />
                <input
                  type="number"
                  aria-label="Giá gốc"
                  min={0}
                  value={form.originalPrice}
                  onChange={event => setForm({ ...form, originalPrice: Number(event.target.value) })}
                  placeholder="Giá gốc"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
                />
              </div>

              <select
                aria-label="Trình độ"
                value={form.level}
                onChange={event => setForm({ ...form, level: event.target.value })}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>

              <button
                className="button button-primary"
                type="submit"
                disabled={
                  submitting || deletingId !== null || loading || Boolean(loadError) || !form.categoryId
                }
              >
                {submitting ? 'Đang lưu...' : 'Lưu khóa học'}
              </button>
            </form>
          )}

          <div className="course-card" style={{ padding: 20 }}>
            <h3>Danh sách khóa học</h3>
            {loading ? (
              <p>Đang tải khóa học...</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {!loadError && courses.length === 0 && <p>Chưa có khóa học được xuất bản.</p>}
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
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        {formatPrice(Number(course.price || 0))}
                      </div>
                    </div>
                    {can(user, 'COURSE_DELETE') && (
                      <button
                        className="button button-soft"
                        type="button"
                        disabled={submitting || deletingId !== null || Boolean(loadError)}
                        onClick={() => handleDelete(course.id)}
                      >
                        {deletingId === course.id ? 'Đang xóa...' : 'Xóa'}
                      </button>
                    )}
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
