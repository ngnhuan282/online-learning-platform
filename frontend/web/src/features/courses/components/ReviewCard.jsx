import StarRating from './StarRating';

const cardStyles = {
  card: {
    display: 'flex',
    gap: 14,
    padding: '16px 0',
    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  userName: {
    fontWeight: 700,
    fontSize: 15,
    color: '#0f172a',
  },
  youBadge: {
    display: 'inline-block',
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#2563eb',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    marginLeft: 6,
  },
  date: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 400,
  },
  comment: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 1.65,
    margin: '8px 0 0',
    wordBreak: 'break-word',
    fontWeight: 400,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#334155',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 6,
    transition: 'all 0.15s ease',
  },
  hiddenBadge: {
    display: 'inline-block',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    marginLeft: 8,
  },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * ReviewCard — hiển thị một review.
 *
 * Props:
 *   review      — { id, userId, userFullName, rating, comment, hidden, createdAt }
 *   currentUser — đối tượng user hiện tại từ useAuth (để hiển thị đúng tên nếu là review của mình)
 *   isOwner     — true nếu review của user hiện tại
 *   isAdmin     — true nếu user hiện tại là admin
 *   onEdit      — callback khi bấm Sửa
 *   onDelete    — callback khi bấm Xóa
 *   onHide      — callback khi admin bấm Ẩn
 *   onShow      — callback khi admin bấm Hiện
 */
export default function ReviewCard({
  review,
  currentUser = null,
  isOwner = false,
  isAdmin = false,
  onEdit,
  onDelete,
  onHide,
  onShow,
}) {
  const displayName = isOwner
    ? (currentUser?.fullName || review.userFullName || 'Bạn')
    : (review.userFullName || `Người dùng #${review.userId}`);

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div style={cardStyles.card}>
      <div style={cardStyles.avatar}>{initial}</div>
      <div style={cardStyles.body}>
        <div style={cardStyles.header}>
          <span style={cardStyles.userName}>
            {displayName}
            {isOwner && <span style={cardStyles.youBadge}>Bạn</span>}
          </span>
          <StarRating value={review.rating} readonly size={16} />
          <span style={cardStyles.date}>{formatDate(review.createdAt)}</span>
          {review.hidden && <span style={cardStyles.hiddenBadge}>Đã ẩn</span>}
        </div>

        {review.comment && <p style={cardStyles.comment}>{review.comment}</p>}

        <div style={cardStyles.actions}>
          {isOwner && onEdit && (
            <button
              type="button"
              style={cardStyles.actionBtn}
              onClick={() => onEdit(review)}
              onMouseEnter={e => {
                e.target.style.color = '#2563eb';
                e.target.style.borderColor = '#2563eb';
                e.target.style.background = 'rgba(59,130,246,0.08)';
              }}
              onMouseLeave={e => {
                e.target.style.color = '#334155';
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.background = '#f8fafc';
              }}
            >
              ✏️ Sửa
            </button>
          )}
          {isOwner && onDelete && (
            <button
              type="button"
              style={cardStyles.actionBtn}
              onClick={() => onDelete(review.id)}
              onMouseEnter={e => {
                e.target.style.color = '#dc2626';
                e.target.style.borderColor = '#dc2626';
                e.target.style.background = 'rgba(239,68,68,0.08)';
              }}
              onMouseLeave={e => {
                e.target.style.color = '#334155';
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.background = '#f8fafc';
              }}
            >
              🗑️ Xóa
            </button>
          )}
          {isAdmin && !review.hidden && onHide && (
            <button
              type="button"
              style={cardStyles.actionBtn}
              onClick={() => onHide(review.id)}
              onMouseEnter={e => {
                e.target.style.color = '#d97706';
                e.target.style.borderColor = '#d97706';
                e.target.style.background = 'rgba(245,158,11,0.08)';
              }}
              onMouseLeave={e => {
                e.target.style.color = '#334155';
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.background = '#f8fafc';
              }}
            >
              🚫 Ẩn review
            </button>
          )}
          {isAdmin && review.hidden && onShow && (
            <button
              type="button"
              style={cardStyles.actionBtn}
              onClick={() => onShow(review.id)}
              onMouseEnter={e => {
                e.target.style.color = '#16a34a';
                e.target.style.borderColor = '#16a34a';
                e.target.style.background = 'rgba(34,197,94,0.08)';
              }}
              onMouseLeave={e => {
                e.target.style.color = '#334155';
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.background = '#f8fafc';
              }}
            >
              ✅ Bỏ ẩn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
