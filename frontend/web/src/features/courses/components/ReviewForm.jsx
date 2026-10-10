import { useState, useEffect } from 'react';
import StarRating from './StarRating';
import { reviewApi } from '../api/reviewApi';
import useAuth from '../../auth/hooks/useAuth';

const formStyles = {
  container: {
    background: '#ffffff',
    borderRadius: 12,
    padding: 22,
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    marginBottom: 24,
  },
  title: {
    margin: '0 0 14px',
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
  },
  authorBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 13,
    color: '#334155',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  ratingText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: 600,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 100,
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 1.6,
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
  },
  counterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
    fontSize: 12,
    color: '#64748b',
  },
  actions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  submitBtn: {
    padding: '9px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 500,
    fontSize: 14,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
  },
};

/**
 * ReviewForm — Form tạo hoặc cập nhật đánh giá khóa học.
 *
 * Props:
 *   courseId        — ID khóa học
 *   existingReview  — review hiện tại (nếu đang ở chế độ sửa)
 *   onSubmitSuccess — callback(review) sau khi lưu thành công
 *   onCancel        — callback khi hủy sửa
 */
export default function ReviewForm({
  courseId,
  existingReview = null,
  onSubmitSuccess,
  onCancel,
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
    } else {
      setRating(5);
      setComment('');
    }
    setError(null);
  }, [existingReview]);

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
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể gửi đánh giá. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form style={formStyles.container} onSubmit={handleSubmit}>
      <h4 style={formStyles.title}>
        {existingReview ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá của bạn'}
      </h4>

      {user?.fullName && (
        <div style={formStyles.authorBanner}>
          <span>Đang đánh giá với tư cách:</span>
          <strong>{user.fullName}</strong>
        </div>
      )}

      {error && <div style={formStyles.error}>{error}</div>}

      <div style={formStyles.ratingRow}>
        <span style={formStyles.ratingText}>Đánh giá:</span>
        <StarRating value={rating} onChange={setRating} size={24} />
        <span style={{ ...formStyles.ratingText, fontWeight: 700, color: '#d97706' }}>
          {rating} / 5 sao
        </span>
      </div>

      <div>
        <textarea
          style={formStyles.textarea}
          placeholder="Chia sẻ trải nghiệm và cảm nhận của bạn về khóa học này..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={2000}
        />
        <div style={formStyles.counterRow}>
          <span>Tối đa 2000 ký tự</span>
          <span>{comment.length} / 2000</span>
        </div>
      </div>

      <div style={formStyles.actions}>
        <button
          type="submit"
          style={formStyles.submitBtn}
          disabled={submitting}
        >
          {submitting ? 'Đang gửi...' : existingReview ? 'Cập nhật' : 'Gửi đánh giá'}
        </button>
        {existingReview && onCancel && (
          <button
            type="button"
            style={formStyles.cancelBtn}
            onClick={onCancel}
            disabled={submitting}
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
