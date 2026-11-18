import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import StarRating from './StarRating';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(getIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
  useLocale();
  const displayName = isOwner
    ? currentUser?.fullName || review.userFullName || 'Bạn'
    : review.userFullName || `Người dùng #${review.userId}`;

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div className="review-item-card">
      <div className="review-item-avatar">{initial}</div>
      <div className="review-item-body">
        <div className="review-item-header">
          <span className="review-item-author">
            {displayName}
            {isOwner && <span className="review-you-pill">{t('Bạn')}</span>}
          </span>
          <StarRating value={review.rating} readonly size={16} />
          <span className="review-item-date">{formatDate(review.createdAt)}</span>
          {review.hidden && <span className="review-hidden-pill">{t('Đã ẩn')}</span>}
        </div>

        {review.comment && <p className="review-item-comment">{review.comment}</p>}

        {(isOwner || isAdmin) && (
          <div className="review-item-actions">
            {isOwner && onEdit && (
              <button type="button" className="review-action-btn" onClick={() => onEdit(review)}>
                {t('Sửa')}
              </button>
            )}
            {isOwner && onDelete && (
              <button
                type="button"
                className="review-action-btn is-danger"
                onClick={() => onDelete(review.id)}
              >
                {t('Xóa')}
              </button>
            )}
            {isAdmin && !review.hidden && onHide && (
              <button type="button" className="review-action-btn" onClick={() => onHide(review.id)}>
                {t('Ẩn review')}
              </button>
            )}
            {isAdmin && review.hidden && onShow && (
              <button type="button" className="review-action-btn" onClick={() => onShow(review.id)}>
                {t('Bỏ ẩn')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
