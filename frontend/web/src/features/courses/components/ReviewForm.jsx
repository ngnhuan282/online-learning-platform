import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useState } from 'react';
import StarRating from './StarRating';
import { reviewApi } from '../api/reviewApi';
import useAuth from '../../auth/hooks/useAuth';

export default function ReviewForm({ courseId, existingReview = null, onSubmitSuccess, onCancel }) {
  useLocale();
  const { user } = useAuth();
  const [previousReview, setPreviousReview] = useState(existingReview);
  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (previousReview !== existingReview) {
    setPreviousReview(existingReview);
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
    } else {
      setRating(5);
      setComment('');
    }
    setError(null);
  }

  const handleSubmit = async e => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError('Vui lòng chọn số sao từ 1 đến 5');
      return;
    }
    if (comment.length > 2000) {
      setError('Nhận xét tối đa 2000 ký tự');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      rating,
      comment,
      userFullName: user?.fullName || 'Học viên',
    };

    try {
      let res;
      if (existingReview?.id) {
        res = await reviewApi.update(courseId, existingReview.id, payload);
      } else {
        res = await reviewApi.create(courseId, payload);
      }
      const data = res?.data?.data || res?.data || res;
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
      if (!existingReview) {
        setRating(5);
        setComment('');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form-box" onSubmit={handleSubmit}>
      <h4>{existingReview ? t('Chỉnh sửa đánh giá của bạn') : t('Viết đánh giá của bạn')}</h4>

      {user?.fullName && (
        <div className="review-author-chip">
          <span>{t('Đang đánh giá với tư cách:')}</span>
          <strong>{user.fullName}</strong>
        </div>
      )}

      {error && (
        <div className="account-feedback is-error" style={{ marginBottom: 14 }}>
          {t(error)}
        </div>
      )}

      <div className="review-rating-row">
        <span>{t('Đánh giá:')}</span>
        <StarRating value={rating} onChange={setRating} size={24} />
        <span style={{ color: '#d97706' }}>{rating} / 5 sao</span>
      </div>

      <div>
        <textarea
          className="review-textarea"
          placeholder={t('Chia sẻ trải nghiệm và cảm nhận của bạn về khóa học này...')}
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={2000}
        />
        <div className="review-counter-row">
          <span>{t('Tối đa 2000 ký tự')}</span>
          <span>{comment.length} / 2000</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? t('Đang gửi...') : existingReview ? t('Cập nhật') : t('Gửi đánh giá')}
        </button>
        {existingReview && onCancel && (
          <button type="button" className="button button-outline" onClick={onCancel} disabled={submitting}>
            {t('Hủy')}
          </button>
        )}
      </div>
    </form>
  );
}
