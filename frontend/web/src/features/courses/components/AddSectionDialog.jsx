import { useState } from 'react';

export default function AddSectionDialog({ onConfirm, onCancel }) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({ title: title.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="course-card"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Thêm chương mới</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="section-title"
              style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}
            >
              Tên chương <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="section-title"
              type="text"
              autoFocus
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: Chương 1: Giới thiệu khóa học"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="button button-soft"
              onClick={onCancel}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!title.trim() || submitting}
            >
              {submitting ? 'Đang thêm...' : 'Tạo chương'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
