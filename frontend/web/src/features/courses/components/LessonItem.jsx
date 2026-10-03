export default function LessonItem({
  lesson,
  lessonTypeLabel,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onManageResources,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        marginBottom: 6,
        border: '1px solid #f1f5f9',
        background: '#fff',
      }}
    >
      <span style={{ fontSize: 12, color: '#64748b', minWidth: 80, whiteSpace: 'nowrap' }}>
        {lessonTypeLabel}
      </span>

      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14 }}>
          {lesson.title}
          {lesson.preview && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#eff6ff',
                color: '#2563eb',
              }}
            >
              Preview
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          title="Lên trên"
          disabled={isFirst}
          onClick={onMoveUp}
          style={{ background: 'none', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', color: isFirst ? '#cbd5e1' : '#475569', fontSize: 14 }}
        >
          ▲
        </button>
        <button
          type="button"
          title="Xuống dưới"
          disabled={isLast}
          onClick={onMoveDown}
          style={{ background: 'none', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer', color: isLast ? '#cbd5e1' : '#475569', fontSize: 14 }}
        >
          ▼
        </button>
        <button
          type="button"
          title="Tài liệu đính kèm"
          onClick={() => onManageResources && onManageResources(lesson)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px' }}
        >
          📎
        </button>
        <button
          type="button"
          title="Sửa bài học"
          onClick={onEdit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px' }}
        >
          ✏️
        </button>
        <button
          type="button"
          title="Xóa bài học"
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px', color: '#dc2626' }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
