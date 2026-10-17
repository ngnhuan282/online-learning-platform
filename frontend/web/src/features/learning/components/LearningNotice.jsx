export default function LearningNotice({ error, usingFallback }) {
  if (!usingFallback && !error) return null;

  return (
    <div className="learning-notice" role="status">
      <strong>{usingFallback ? 'Đang hiển thị dữ liệu mẫu.' : 'Không thể tải dữ liệu học tập.'}</strong>
      <span>{error?.message || 'Learning Service chưa trả dữ liệu cho màn hình này.'}</span>
    </div>
  );
}
