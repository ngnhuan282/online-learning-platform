import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { categoryApi } from '../api/categoryApi';
import { courseApi } from '../api/courseApi';
import { formatPrice } from '../data/demoCourses';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../../admin/utils/adminUtils';
import ErrorState from '../../../shared/components/ErrorState';
import MediaUploader from '../components/MediaUploader';
import useCourseSearch from '../hooks/useCourseSearch';
import { normalizeCourseList, normalizeCoursePayload } from '../utils/courseForm';

const PAGE_SIZE = 10;

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  categoryName: '',
  level: 'BEGINNER',
  price: 0,
  originalPrice: 0,
  thumbnailUrl: '/images/english-ielts.jpg',
};

export default function AdminCoursePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const pending = useRef(false);
  const courseRequest = useRef(0);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  // Search
  const { keyword, setKeyword, debouncedKeyword } = useCourseSearch('');

  const loadCategories = useCallback(async (options = {}) => {
    try {
      const response = await categoryApi.list(options);
      if (options.signal?.aborted) return;
      const payload = response?.data ?? response;
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setCategories(list);
      if (!list.length) return;
      setForm(prev => ({
        ...prev,
        categoryId: prev.categoryId || String(list[0].id),
        categoryName: prev.categoryName || list[0].name,
      }));
    } catch (error) {
      if (!options.signal?.aborted && error.code !== 'ERR_CANCELED') setLoadError(error);
    }
  }, []);

  const loadCourses = useCallback(async (page = 0, options = {}) => {
    const request = ++courseRequest.current;
    try {
      const response = await courseApi.adminList({ page, size: PAGE_SIZE }, options);
      if (options.signal?.aborted || request !== courseRequest.current) return false;
      const payload = response?.data ?? response;
      // Extract pagination metadata
      const pageData = payload?.data ?? payload;
      if (pageData?.totalPages !== undefined) {
        setTotalPages(pageData.totalPages);
        setTotalElements(pageData.totalElements ?? 0);
      }
      setCourses(normalizeCourseList(response));
    } catch (error) {
      if (options.signal?.aborted || request !== courseRequest.current || error.code === 'ERR_CANCELED')
        return false;
      setLoadError(error);
    }
    return true;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadAll = async () => {
      await Promise.all([
        loadCategories({ signal: controller.signal }),
        loadCourses(0, { signal: controller.signal }),
      ]);
      if (isMounted) setLoading(false);
    };

    loadAll();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [retry, loadCategories, loadCourses]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setCurrentPage(0);
    setRetry(value => value + 1);
  };

  const changePage = async page => {
    setCurrentPage(page);
    setLoading(true);
    setLoadError(null);
    if (await loadCourses(page)) setLoading(false);
  };

  const totalRevenue = useMemo(
    () => courses.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const q = debouncedKeyword.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      c => c.title.toLowerCase().includes(q) || (c.categoryName || '').toLowerCase().includes(q),
    );
  }, [courses, debouncedKeyword]);

  function resetForm() {
    setForm({
      ...emptyForm,
      categoryId: categories[0] ? String(categories[0].id) : '',
      categoryName: categories[0] ? categories[0].name : '',
    });
    setFormErrors({});
    setEditingId(null);
  }

  function validateForm() {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Tên khóa học không được để trống';
    else if (form.title.trim().length < 5) errors.title = 'Tên khóa học phải có ít nhất 5 ký tự';
    if (!form.description.trim()) errors.description = 'Mô tả không được để trống';
    else if (form.description.trim().length < 10) errors.description = 'Mô tả phải có ít nhất 10 ký tự';
    if (!form.categoryId) errors.categoryId = 'Vui lòng chọn danh mục';
    if (Number(form.price) < 0) errors.price = 'Giá không được âm';
    if (Number(form.originalPrice) < 0) errors.originalPrice = 'Giá gốc không được âm';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending.current || loading || loadError) return;
    if (!validateForm()) return;
    pending.current = true;
    setSubmitting(true);
    setMutationError(null);

    const selectedCategory = categories.find(item => String(item.id) === String(form.categoryId));
    const categoryId = Number(selectedCategory?.id ?? form.categoryId ?? categories[0]?.id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      pending.current = false;
      setSubmitting(false);
      setMutationError(new Error('Vui lòng chọn danh mục hợp lệ.'));
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
      if (editingId) {
        await courseApi.update(editingId, payload);
      } else {
        await courseApi.create(payload);
      }

      resetForm();
      await loadCategories();
      setCurrentPage(0);
      await loadCourses();
    } catch (error) {
      setMutationError(error);
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  function handleEdit(course) {
    const selectedCategory = categories.find(
      item => String(item.id) === String(course.categoryId) || item.name === course.categoryName,
    );
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description,
      categoryId: selectedCategory ? String(selectedCategory.id) : String(categories[0]?.id ?? ''),
      categoryName: course.categoryName || selectedCategory?.name || categories[0]?.name || '',
      level: String(course.level || 'BEGINNER').toUpperCase(),
      price: Number(course.price || 0),
      originalPrice: Number(course.originalPrice || course.price || 0),
      thumbnailUrl: course.thumbnailUrl || '/images/english-ielts.jpg',
    });
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

        {loadError && <ErrorState error={loadError} onRetry={retryLoad} />}
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
          {can(user, editingId ? 'COURSE_UPDATE' : 'COURSE_CREATE') && (
            <form
              className="course-card"
              onSubmit={handleSubmit}
              style={{ padding: 20, display: 'grid', gap: 14 }}
            >
              <h3>{editingId ? 'Chỉnh sửa khóa học' : 'Thêm khóa học mới'}</h3>
              <input
                aria-label="Tên khóa học"
                required
                maxLength={200}
                value={form.title}
                onChange={event => setForm({ ...form, title: event.target.value })}
                placeholder="Tên khóa học"
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: formErrors.title ? '1px solid #ef4444' : '1px solid #dfe3ea',
                }}
              />
              {formErrors.title && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.title}</span>}

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
                  border: formErrors.description ? '1px solid #ef4444' : '1px solid #dfe3ea',
                  resize: 'vertical',
                }}
              />
              {formErrors.description && (
                <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.description}</span>
              )}

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

              <MediaUploader
                folder="thumbnails"
                accept="image/*"
                label="Ảnh đại diện khóa học (Thumbnail)"
                maxSizeMB={10}
                currentUrl={form.thumbnailUrl}
                onUploadSuccess={info =>
                  setForm(prev => ({ ...prev, thumbnailUrl: info.url || info.objectKey }))
                }
              />

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    submitting ||
                    deletingId !== null ||
                    loading ||
                    Boolean(loadError) ||
                    !form.title.trim() ||
                    !form.description.trim() ||
                    !form.categoryId
                  }
                >
                  {submitting
                    ? editingId
                      ? 'Đang cập nhật...'
                      : 'Đang lưu...'
                    : editingId
                      ? 'Cập nhật khóa học'
                      : 'Lưu khóa học'}
                </button>
                {editingId && (
                  <button className="button button-soft" type="button" onClick={resetForm}>
                    Hủy chỉnh sửa
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="course-card" style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0 }}>Danh sách khóa học</h3>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Tìm khóa học..."
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #dfe3ea', minWidth: 180 }}
              />
            </div>
            {loading ? (
              <p>Đang tải khóa học...</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {!loadError && filteredCourses.length === 0 && (
                  <p>
                    {debouncedKeyword
                      ? 'Không tìm thấy khóa học phù hợp.'
                      : 'Chưa có khóa học được xuất bản.'}
                  </p>
                )}
                {filteredCourses.map(course => (
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
                      <div
                        style={{
                          color: '#64748b',
                          fontSize: 13,
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <span>{formatPrice(Number(course.price || 0))}</span>
                        <span>•</span>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                          ★ {Number(course.avgRating || 0).toFixed(1)}
                        </span>
                        <span style={{ color: '#94a3b8' }}>({course.reviewCount || 0} đánh giá)</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="button button-soft"
                        type="button"
                        onClick={() => navigate(`/admin/courses/${course.id}/curriculum`)}
                      >
                        Bài học
                      </button>
                      <button
                        className="button button-soft"
                        type="button"
                        onClick={() => navigate(`/admin/courses/${course.id}/reviews`)}
                      >
                        Đánh giá
                      </button>
                      {can(user, 'COURSE_UPDATE') && (
                        <button
                          className="button button-soft"
                          type="button"
                          onClick={() => handleEdit(course)}
                        >
                          Sửa
                        </button>
                      )}
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
                  </div>
                ))}
              </div>
            )}
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  className="button button-soft"
                  disabled={currentPage === 0 || loading}
                  onClick={() => changePage(Math.max(0, currentPage - 1))}
                  style={{ padding: '6px 14px' }}
                >
                  ← Trước
                </button>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Trang {currentPage + 1} / {totalPages}
                  {totalElements > 0 && <span style={{ marginLeft: 6 }}>({totalElements} khóa học)</span>}
                </span>
                <button
                  className="button button-soft"
                  disabled={currentPage >= totalPages - 1 || loading}
                  onClick={() => changePage(Math.min(totalPages - 1, currentPage + 1))}
                  style={{ padding: '6px 14px' }}
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
