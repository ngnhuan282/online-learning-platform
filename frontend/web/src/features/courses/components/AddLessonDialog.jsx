import { useState } from 'react';
import { buildLessonPayload, normalizeLessonFormData } from '../utils/lessonForm';
import MediaUploader from './MediaUploader';

const LESSON_TYPES = [
  { value: 'VIDEO', label: '🎬 Video bài giảng' },
  { value: 'DOCUMENT', label: '📄 Tài liệu (PDF/Doc)' },
  { value: 'TEXT', label: '📝 Bài viết lý thuyết' },
  { value: 'QUIZ', label: '✅ Bài kiểm tra / Quiz' },
];

export default function AddLessonDialog({ initialLesson = null, mode = 'create', onConfirm, onCancel }) {
  const [previousLesson, setPreviousLesson] = useState(initialLesson);
  const [form, setForm] = useState(() => normalizeLessonFormData(initialLesson ?? {}));
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (previousLesson !== initialLesson) {
    setPreviousLesson(initialLesson);
    setForm(normalizeLessonFormData(initialLesson ?? {}));
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setValidationError('');

    const payload = buildLessonPayload(form);

    if (!payload.title) {
      setValidationError('Vui lòng nhập tiêu đề bài học.');
      return;
    }

    if (payload.lessonType === 'VIDEO' && !payload.videoUrl) {
      setValidationError('Bài học dạng Video yêu cầu nhập Video URL hoặc object key.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(payload);
    } catch (err) {
      setValidationError(
        err?.response?.data?.message ||
          err?.message ||
          (mode === 'edit' ? 'Không thể cập nhật bài học.' : 'Không thể tạo bài học.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isEditMode = mode === 'edit';

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
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
          {isEditMode ? 'Sửa bài học' : 'Thêm bài học mới'}
        </h3>

        {validationError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label
              htmlFor="lesson-title"
              style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}
            >
              Tiêu đề bài học <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="lesson-title"
              type="text"
              autoFocus
              required
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="VD: Tổng quan về Spring Boot MVC"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                htmlFor="lesson-type"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}
              >
                Loại bài học <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="lesson-type"
                value={form.lessonType}
                onChange={e => updateField('lessonType', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              >
                {LESSON_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="lesson-duration"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}
              >
                Thời lượng (giây)
              </label>
              <input
                id="lesson-duration"
                type="number"
                min="0"
                value={form.duration}
                onChange={e => updateField('duration', Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="VD: 300"
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
          </div>

          {form.lessonType === 'VIDEO' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <MediaUploader
                folder="videos"
                accept="video/*"
                label="Tải video bài giảng lên máy chủ"
                maxSizeMB={200}
                currentUrl={form.videoUrl}
                onUploadSuccess={info => updateField('videoUrl', info.url || info.objectKey)}
              />
              <div>
                <label
                  htmlFor="lesson-video-url"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Video URL / Object Key <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="lesson-video-url"
                  type="text"
                  required
                  value={form.videoUrl}
                  onChange={e => updateField('videoUrl', e.target.value)}
                  placeholder="https://... hoặc s3://courses/videos/lesson1.mp4"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="lesson-content"
              style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}
            >
              Nội dung chi tiết / Hướng dẫn
            </label>
            <textarea
              id="lesson-content"
              rows={4}
              value={form.content}
              onChange={e => updateField('content', e.target.value)}
              placeholder="Nội dung bài viết, link tài liệu đính kèm..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="lesson-preview"
              type="checkbox"
              checked={form.preview}
              onChange={e => updateField('preview', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="lesson-preview" style={{ fontSize: 14, cursor: 'pointer', userSelect: 'none' }}>
              Cho phép học thử (Preview miễn phí cho Guest)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="button button-soft" onClick={onCancel} disabled={submitting}>
              Hủy
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!form.title.trim() || submitting}
            >
              {submitting
                ? isEditMode
                  ? 'Đang lưu...'
                  : 'Đang thêm...'
                : isEditMode
                  ? 'Lưu thay đổi'
                  : 'Tạo bài học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
