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

  // Quick Add Category Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState('');

  const handleCreateCategory = async e => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      setCategoryModalError('Vui lòng nhập tên danh mục');
      return;
    }
    setCreatingCategory(true);
    setCategoryModalError('');
    try {
      const res = await categoryApi.create({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim(),
      });
      const created = res?.data?.data ?? res?.data ?? res;
      if (created && created.id) {
        setCategories(prev => [...prev, created]);
        setForm(prev => ({
          ...prev,
          categoryId: String(created.id),
          categoryName: created.name,
        }));
      } else {
        await loadCategories();
      }
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowAddCategoryModal(false);
    } catch (err) {
      setCategoryModalError(err?.response?.data?.message || 'Không thể tạo danh mục mới.');
    } finally {
      setCreatingCategory(false);
    }
  };

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
      setCourses(prev => prev.map(item => String(item.id) === String(id) ? { ...item, status: 'ARCHIVED' } : item));
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="eyebrow">ADMIN</span>
            <h1 style={{ marginTop: 8 }}>Quản lý khóa học</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button button-soft"
              onClick={() => navigate('/admin/categories')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
            >
              Danh sách danh mục
            </button>
          </div>
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

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>
                  Danh mục khóa học
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    aria-label="Danh mục"
                    required
                    value={form.categoryId}
                    onChange={event => setForm({ ...form, categoryId: event.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button button-soft"
                    title="Thêm danh mục mới nhanh"
                    onClick={() => setShowAddCategoryModal(true)}
                    style={{ padding: '0 14px', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600 }}
                  >
                    ➕ Thêm mới
                  </button>
                </div>
              </div>
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
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e7ebf0' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Khóa học</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Giá</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadError && filteredCourses.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '16px 10px', color: '#94a3b8', fontSize: 14 }}>
                      {debouncedKeyword ? 'Không tìm thấy khóa học phù hợp.' : 'Chưa có khóa học được xuất bản.'}
                    </td></tr>
                  )}
                  {filteredCourses.map(course => (
                    <tr key={course.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                          {course.categoryName}
                          <span style={{ margin: '0 5px', color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>&#9733; {Number(course.avgRating || 0).toFixed(1)}</span>
                          <span style={{ color: '#94a3b8', marginLeft: 4 }}>({course.reviewCount || 0} đánh giá)</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatPrice(Number(course.price || 0))}
                      </td>
                      <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button
                          className="button button-soft"
                          type="button"
                          title="Quản lý bài học"
                          onClick={() => navigate(`/admin/courses/${course.id}/curriculum`)}
                          style={{ padding: '5px 11px', fontSize: 12, marginRight: 4 }}
                        >
                          Bài học
                        </button>
                        <button
                          className="button button-soft"
                          type="button"
                          title="Xem đánh giá"
                          onClick={() => navigate(`/admin/courses/${course.id}/reviews`)}
                          style={{ padding: '5px 11px', fontSize: 12, marginRight: 4 }}
                        >
                          Đánh giá
                        </button>
                        {can(user, 'COURSE_UPDATE') && (
                          <button
                            className="button button-soft"
                            type="button"
                            title="Sửa khóa học"
                            onClick={() => handleEdit(course)}
                            style={{ padding: '5px 11px', fontSize: 12, marginRight: 4 }}
                          >
                            Sửa
                          </button>
                        )}
                        {can(user, 'COURSE_DELETE') && (
                          <button
                            className="button button-soft"
                            type="button"
                            title="Lưu trữ khóa học (giữ dữ liệu)"
                            disabled={submitting || deletingId !== null || Boolean(loadError)}
                            onClick={() => handleDelete(course.id)}
                            style={{ padding: '5px 11px', fontSize: 12, color: '#e53e3e', borderColor: '#fed7d7' }}
                          >
                            {deletingId === course.id ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Modal Thêm danh mục nhanh */}
      {showAddCategoryModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => {
            setShowAddCategoryModal(false);
            setCategoryModalError('');
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>➕ Thêm danh mục mới</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setCategoryModalError('');
                }}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {categoryModalError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {categoryModalError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                  Tên danh mục <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ví dụ: Luyện thi VSTEP, Tiếng Anh Du học..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                  Mô tả danh mục
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Mô tả ngắn gọn về đối tượng và mục tiêu của danh mục này..."
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setCategoryModalError('');
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={creatingCategory}
                >
                  {creatingCategory ? 'Đang lưu...' : 'Lưu danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
