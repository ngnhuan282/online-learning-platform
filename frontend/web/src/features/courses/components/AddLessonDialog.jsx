import { useState, useEffect } from 'react';
import { buildLessonPayload, normalizeLessonFormData } from '../utils/lessonForm';
import MediaUploader from './MediaUploader';
import { learningApi } from '../../learning/api/learningApi';

const LESSON_TYPES = [
  { value: 'VIDEO', label: '🎬 Video bài giảng' },
  { value: 'DOCUMENT', label: '📄 Tài liệu (PDF/Doc)' },
  { value: 'TEXT', label: '📝 Bài viết lý thuyết' },
  { value: 'QUIZ', label: '✅ Bài kiểm tra / Quiz' },
];

export default function AddLessonDialog({
  courseId = null,
  initialLesson = null,
  mode = 'create',
  onConfirm,
  onCancel,
}) {
  const [previousLesson, setPreviousLesson] = useState(initialLesson);
  const [form, setForm] = useState(() => normalizeLessonFormData(initialLesson ?? {}));
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [contentTab, setContentTab] = useState('edit'); // 'edit' | 'preview'
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchQuizzes() {
      setLoadingQuizzes(true);
      try {
        // Admin dialog should load all available quizzes via admin endpoint
        const adminRes = await learningApi.getAdminQuizzes();
        const list = adminRes?.data?.data ?? adminRes?.data ?? [];
        if (active) {
          setAvailableQuizzes(
            Array.isArray(list)
              ? list.filter(quiz => courseId == null || String(quiz.courseId) === String(courseId))
              : [],
          );
        }
      } catch (err) {
        console.warn('Could not load quizzes for lesson picker:', err);
      } finally {
        if (active) setLoadingQuizzes(false);
      }
    }
    fetchQuizzes();
    return () => {
      active = false;
    };
  }, [courseId]);

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

    if (payload.lessonType === 'DOCUMENT' && !payload.videoUrl && !payload.content) {
      setValidationError('Vui lòng tải lên tệp tài liệu hoặc nhập đường dẫn tài liệu.');
      return;
    }

    if (payload.lessonType === 'QUIZ' && !payload.content) {
      setValidationError('Vui lòng chọn một bài Quiz từ danh sách.');
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

          {form.lessonType === 'DOCUMENT' && (
            <div style={{ display: 'grid', gap: 8, padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <MediaUploader
                folder="documents"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                label="Tải lên tệp tài liệu bài học (PDF, Word, Slide...)"
                maxSizeMB={50}
                currentUrl={form.videoUrl}
                onUploadSuccess={info => {
                  updateField('videoUrl', info.url || info.objectKey);
                  if (!form.title) {
                    const rawName = (info.fileName || '').replace(/\.[^/.]+$/, '');
                    updateField('title', rawName);
                  }
                }}
              />
              <div>
                <label
                  htmlFor="lesson-doc-url"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Đường dẫn tài liệu / Object Key
                </label>
                <input
                  id="lesson-doc-url"
                  type="text"
                  value={form.videoUrl}
                  onChange={e => updateField('videoUrl', e.target.value)}
                  placeholder="https://... hoặc tệp tài liệu đã tải lên"
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

          {form.lessonType === 'QUIZ' && (
            <div style={{ display: 'grid', gap: 10, padding: 14, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div>
                <label
                  htmlFor="lesson-quiz-picker"
                  style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 6 }}
                >
                  Chọn bài Quiz từ danh sách đã tạo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {loadingQuizzes ? (
                  <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Đang tải danh sách Quiz...</p>
                ) : availableQuizzes.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#b45309' }}>
                    Chưa có bài quiz nào được tạo. Vui lòng vào trang <strong>Quản lý Quiz</strong> để tạo bài kiểm tra trước.
                  </div>
                ) : (
                  <>
                    <select
                      id="lesson-quiz-picker"
                      value={(() => {
                        const direct = String(form.content || '').trim();
                        if (direct && availableQuizzes.some(q => String(q.id) === direct)) return direct;
                        const byTitle = availableQuizzes.find(q => q.title === form.title);
                        return byTitle ? String(byTitle.id) : direct;
                      })()}
                      onChange={e => {
                        const quizId = e.target.value;
                        const selected = availableQuizzes.find(q => String(q.id) === String(quizId));
                        updateField('content', quizId);
                        if (selected) {
                          if (!form.title || form.title.startsWith('Quiz:') || form.title === '') {
                            updateField('title', selected.title);
                          }
                          if (selected.timeLimitMinutes && (!form.duration || form.duration === 0)) {
                            updateField('duration', selected.timeLimitMinutes * 60);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #86efac',
                        background: '#fff',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">-- Chọn bài kiểm tra / Quiz --</option>
                      {availableQuizzes.map(q => (
                        <option key={q.id} value={String(q.id)}>
                          {q.title} ({q.questions?.length ?? q.totalQuestions ?? 0} câu hỏi - Điểm đạt {q.passingScore}%)
                        </option>
                      ))}
                    </select>

                    {(() => {
                      const currentQuizId = String(form.content || '').trim();
                      const quiz = availableQuizzes.find(q => String(q.id) === currentQuizId || q.title === form.title);
                      if (!quiz) return null;
                      return (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 13, color: '#065f46' }}>
                          ✅ <strong>{quiz.title}</strong> — {quiz.questions?.length ?? quiz.totalQuestions ?? 0} câu hỏi • Thời gian: {quiz.timeLimitMinutes || 15} phút • Điểm đạt: {quiz.passingScore}%
                        </div>
                      );
                    })()}
                  </>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#15803d' }}>
                  💡 Khi học viên học đến bài này, hệ thống sẽ mở bài kiểm tra đã chọn để học viên làm bài.
                </p>
              </div>
            </div>
          )}

          {/* Content field / Text editor for VIDEO, DOCUMENT, and TEXT lessons only */}
          {form.lessonType !== 'QUIZ' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label
                  htmlFor="lesson-content"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  {form.lessonType === 'TEXT' ? 'Nội dung bài học (Hỗ trợ Markdown / HTML)' : 'Nội dung chi tiết / Hướng dẫn'}
                </label>

                {form.lessonType === 'TEXT' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setContentTab('edit')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        background: contentTab === 'edit' ? '#3b82f6' : '#f8fafc',
                        color: contentTab === 'edit' ? '#fff' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Soạn thảo
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentTab('preview')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        background: contentTab === 'preview' ? '#3b82f6' : '#f8fafc',
                        color: contentTab === 'preview' ? '#fff' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      👁️ Xem trước
                    </button>
                  </div>
                )}
              </div>

              {form.lessonType === 'TEXT' && contentTab === 'edit' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    padding: '6px 8px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderBottom: 'none',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => updateField('content', (form.content || '') + '\n### Tiêu đề bài học\n')}
                    style={{ fontSize: 11, padding: '2px 6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                  >
                    H3 Tiêu đề
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('content', (form.content || '') + ' **in đậm** ')}
                    style={{ fontSize: 11, padding: '2px 6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('content', (form.content || '') + ' *in nghiêng* ')}
                    style={{ fontSize: 11, padding: '2px 6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontStyle: 'italic' }}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('content', (form.content || '') + '\n- Ý 1\n- Ý 2\n- Ý 3\n')}
                    style={{ fontSize: 11, padding: '2px 6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                  >
                    • Danh sách
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('content', (form.content || '') + '\n```java\n// Code snippet\n```\n')}
                    style={{ fontSize: 11, padding: '2px 6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    &lt;/&gt; Code
                  </button>
                </div>
              )}

              {form.lessonType === 'TEXT' && contentTab === 'preview' ? (
                <div
                  style={{
                    minHeight: 120,
                    maxHeight: 240,
                    overflowY: 'auto',
                    padding: 12,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {form.content ? (
                    <div>{form.content}</div>
                  ) : (
                    <em style={{ color: '#94a3b8' }}>Chưa có nội dung để xem trước...</em>
                  )}
                </div>
              ) : (
                <textarea
                  id="lesson-content"
                  rows={form.lessonType === 'TEXT' ? 6 : 4}
                  value={form.content}
                  onChange={e => updateField('content', e.target.value)}
                  placeholder={
                    form.lessonType === 'TEXT'
                      ? 'Nhập nội dung bài học lý thuyết tại đây... (Hỗ trợ định dạng văn bản)'
                      : 'Nội dung bài viết, link tài liệu đính kèm...'
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: form.lessonType === 'TEXT' && contentTab === 'edit' ? '0 0 8px 8px' : 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              )}
            </div>
          )}

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
