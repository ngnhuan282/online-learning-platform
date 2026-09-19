export default function ProgressBar({ value }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="learning-progress-bar" aria-label={`Tiến độ ${safeValue}%`}>
      <span style={{ width: `${safeValue}%` }} />
    </div>
  );
}
