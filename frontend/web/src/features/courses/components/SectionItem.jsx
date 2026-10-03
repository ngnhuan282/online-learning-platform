import { useState } from 'react';
import LessonItem from './LessonItem';

const LESSON_TYPE_LABEL = {
  VIDEO: '🎬 Video',
  DOCUMENT: '📄 Tài liệu',
  TEXT: '📝 Bài viết',
  QUIZ: '✅ Quiz',
};

export default function SectionItem({
  section,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLessonUp,
  onMoveLessonDown,
  onManageResources,
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title);
  const [saving, setSaving] = useState(false);

  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === section.title) {
      setEditing(false);
      setTitleInput(section.title);
      return;
    }
    setSaving(true);
    try {
      await onUpdate({ title: trimmed, orderIndex: section.orderIndex });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setEditing(false);
      setTitleInput(section.title);
    }
  };

  const lessons = section.lessons ?? [];

  return (
    <div
      className="course-card"
      style={{ padding: 0, overflow: 'hidden', border: '1px solid #e7ebf0', borderRadius: 12 }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          background: '#f8fafc',
          borderBottom: expanded ? '1px solid #e7ebf0' : 'none',
        }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, color: '#475569' }}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Title or input */}
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              disabled={saving}
              aria-label="Tên chương"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #94a3b8',
                fontSize: 15,
                fontWeight: 600,
              }}
            />
          ) : (
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {section.title}
              <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, fontSize: 13 }}>
                ({lessons.length} bài)
              </span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            title="Di chuyển lên"
            disabled={isFirst}
            onClick={onMoveUp}
            style={{ background: 'none', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', color: isFirst ? '#cbd5e1' : '#475569', fontSize: 16 }}
          >
            ▲
          </button>
          <button
            type="button"
            title="Di chuyển xuống"
            disabled={isLast}
            onClick={onMoveDown}
            style={{ background: 'none', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer', color: isLast ? '#cbd5e1' : '#475569', fontSize: 16 }}
          >
            ▼
          </button>
          <button
            type="button"
            title="Sửa tên chương"
            onClick={() => { setEditing(true); setTitleInput(section.title); }}
            className="button button-soft"
            style={{ padding: '4px 12px', fontSize: 13 }}
          >
            ✏️ Sửa
          </button>
          <button
            type="button"
            title="Xóa chương"
            onClick={onDelete}
            className="button button-soft"
            style={{ padding: '4px 12px', fontSize: 13, color: '#dc2626' }}
          >
            🗑️ Xóa
          </button>
        </div>
      </div>

      {/* Lessons */}
      {expanded && (
        <div style={{ padding: '10px 18px 14px' }}>
          {lessons.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Chưa có bài học.</p>
          )}
          {lessons.map((lesson, idx) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              lessonTypeLabel={LESSON_TYPE_LABEL[lesson.lessonType] ?? lesson.lessonType}
              isFirst={idx === 0}
              isLast={idx === lessons.length - 1}
              onEdit={() => onEditLesson(lesson)}
              onDelete={() => onDeleteLesson(lesson.id)}
              onMoveUp={() => onMoveLessonUp(lesson)}
              onMoveDown={() => onMoveLessonDown(lesson)}
              onManageResources={onManageResources}
            />
          ))}
          <button
            id={`btn-add-lesson-${section.id}`}
            type="button"
            className="button button-soft"
            onClick={onAddLesson}
            style={{ marginTop: 8, fontSize: 13, width: '100%' }}
          >
            + Thêm bài học
          </button>
        </div>
      )}
    </div>
  );
}
