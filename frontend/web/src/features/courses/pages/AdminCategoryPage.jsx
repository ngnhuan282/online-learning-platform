import { useEffect, useState } from 'react';

import { categoryApi } from '../api/categoryApi';

const emptyForm = {
  name: '',
  description: '',
};

export default function AdminCategoryPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    } catch (error) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
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
      };

      if (!payload.name) {
        return;
      }

      let createdOrUpdated;
      if (editingId) {
        const response = await categoryApi.update(editingId, payload);
        createdOrUpdated = response?.data?.data ?? response?.data ?? response ?? null;
        if (createdOrUpdated) {
          setCategories(prev => prev.map(item => (String(item.id) === String(editingId) ? createdOrUpdated : item)));
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
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description || '',
    });
  }

  async function handleDelete(id) {
    try {
      await categoryApi.delete(id);
      setCategories(prev => prev.filter(item => String(item.id) !== String(id)));
      await loadCategories();
    } catch (error) {
      // no-op for demo flow
    }
  }

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ marginTop: 8 }}>Quản lý danh mục</h1>
        </div>

        <div className="course-grid" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
          <form className="course-card" onSubmit={handleSubmit} style={{ padding: 20, display: 'grid', gap: 14 }}>
            <h3>Thêm danh mục mới</h3>

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
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dfe3ea', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="button button-primary" type="submit" disabled={saving || !form.name.trim()}>
                {saving ? (editingId ? 'Đang cập nhật...' : 'Đang lưu...') : (editingId ? 'Cập nhật danh mục' : 'Lưu danh mục')}
              </button>
              {editingId && (
                <button className="button button-soft" type="button" onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </form>

          <div className="course-card" style={{ padding: 20 }}>
            <h3>Danh sách danh mục</h3>
            {loading ? (
              <p>Đang tải danh mục...</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {categories.map(category => (
                  <div
                    key={category.id}
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
                      <strong>{category.name}</strong>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{category.description || 'Không có mô tả'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="button button-soft" type="button" onClick={() => handleEdit(category)}>
                        Sửa
                      </button>
                      <button className="button button-soft" type="button" onClick={() => handleDelete(category.id)}>
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
