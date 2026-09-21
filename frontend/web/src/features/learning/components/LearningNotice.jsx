export default function LearningNotice({ error, usingFallback }) {
  if (!usingFallback) return null;

  return (
    <div className="learning-notice" role="status">
      <strong>Đang hiển thị dữ liệu mẫu.</strong>
      <span>{error?.message || 'Learning Service chưa trả dữ liệu cho màn hình này.'}</span>
    </div>
  );
}
