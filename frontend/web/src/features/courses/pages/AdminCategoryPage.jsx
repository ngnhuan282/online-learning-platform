import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { categoryApi } from '../api/categoryApi';

const emptyForm = {
  name: '',
  description: '',
  active: true,
};

export default function AdminCategoryPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCategories = async () => {
    try {
      setError('');
      const response = await categoryApi.adminList();
      const payload = response?.data ?? response;
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setCategories(list);
    } catch (failure) {
      setError(failure.message || 'Không thể tải danh mục.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        active: form.active,
      };

      if (!payload.name) {
        return;
      }

      let createdOrUpdated;
      if (editingId) {
        const response = await categoryApi.update(editingId, payload);
        createdOrUpdated = response?.data?.data ?? response?.data ?? response ?? null;
        if (createdOrUpdated) {
          setCategories(prev =>
            prev.map(item => (String(item.id) === String(editingId) ? createdOrUpdated : item)),
          );
        }
      } else {
        const response = await categoryApi.create(payload);
        createdOrUpdated = response?.data?.data ?? response?.data ?? response ?? null;
        if (createdOrUpdated) {
          setCategories(prev => [createdOrUpdated, ...prev]);
        }
      }
      resetForm();
      await loadCategories();
    } catch (failure) {
      setError(failure.message || 'Không thể lưu danh mục.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description || '',
      active: category.active !== false,
    });
  }

  async function handleDelete(id) {
    try {
      await categoryApi.delete(id);
      setCategories(prev => prev.filter(item => String(item.id) !== String(id)));
      await loadCategories();
    } catch (failure) {
      setError(failure.message || 'Không thể ẩn danh mục.');
    }
  }

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <button
            type="button"
            className="button button-soft"
            onClick={() => navigate('/admin/courses')}
            style={{
              marginBottom: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 13,
            }}
          >
            ← Quay lại quản lý khóa học
          </button>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ marginTop: 8 }}>Quản lý danh mục</h1>
        </div>

        {error && (
          <p role="alert">
            {error}{' '}
            <button type="button" onClick={loadCategories}>
              Thử lại
            </button>
          </p>
        )}
        <div className="course-grid" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
          <form
            className="course-card"
            onSubmit={handleSubmit}
            style={{ padding: 20, display: 'grid', gap: 14 }}
          >
            <h3>{editingId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h3>
            <label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={event => setForm({ ...form, active: event.target.checked })}
              />{' '}
              Hiển thị danh mục
            </label>

            <input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Tên danh mục"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea' }}
            />

            <textarea
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
              placeholder="Mô tả danh mục"
              rows={4}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #dfe3ea',
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="button button-primary"
                type="submit"
                disabled={saving || !form.name.trim()}
                style={{ paddingLeft: 20, paddingRight: 20, whiteSpace: 'nowrap' }}
              >
                {saving
                  ? editingId
                    ? 'Đang cập nhật...'
                    : 'Đang lưu...'
                  : editingId
                    ? 'Cập nhật danh mục'
                    : 'Lưu danh mục'}
              </button>
              {editingId && (
                <button
                  className="button button-soft"
                  type="button"
                  onClick={resetForm}
                  style={{ paddingLeft: 16, paddingRight: 16, whiteSpace: 'nowrap' }}
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          <div className="course-card" style={{ padding: 20 }}>
            <h3>Danh sách danh mục</h3>
            {loading ? (
              <p>Đang tải danh mục...</p>
            ) : categories.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Chưa có danh mục nào.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e7ebf0' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        fontSize: 13,
                        color: '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      Tên danh mục
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        fontSize: 13,
                        color: '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      Mô tả
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '8px 10px',
                        fontSize: 13,
                        color: '#64748b',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(category => (
                    <tr key={category.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td
                        style={{
                          padding: '10px 10px',
                          fontWeight: 600,
                          fontSize: 14,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {category.name} {category.active === false && <small>(Đã ẩn)</small>}
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          color: '#64748b',
                          fontSize: 13,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {category.description || '—'}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="button button-soft"
                          type="button"
                          onClick={() => handleEdit(category)}
                          style={{ padding: '5px 14px', fontSize: 13, marginRight: 6 }}
                        >
                          Sửa
                        </button>
                        <button
                          className="button button-soft"
                          type="button"
                          onClick={() => handleDelete(category.id)}
                          disabled={category.active === false}
                          style={{
                            padding: '5px 14px',
                            fontSize: 13,
                            color: '#e53e3e',
                            borderColor: '#fed7d7',
                          }}
                        >
                          Ẩn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
