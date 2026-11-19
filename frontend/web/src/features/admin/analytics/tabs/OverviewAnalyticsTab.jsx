import useLearningResource from '../../../learning/hooks/useLearningResource';
import { adminApi } from '../../api/adminApi';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';

const reports = {
  courses: {
    load: options => adminApi.courses(options),
    metrics: [
      ['Tổng khóa học', 'total'],
      ['Khóa học đang mở', 'published'],
    ],
  },
  progress: {
    load: options => adminApi.learning(options),
    metrics: [
      ['Lượt ghi danh hợp lệ', 'enrollments'],
      ['Lượt hoàn thành khóa học', 'completed'],
      ['Tỷ lệ hoàn thành', 'completionRate', 'percent'],
    ],
  },
};

export default function OverviewAnalyticsTab({ report }) {
  const { load, metrics } = reports[report];
  const { data, error, loading, reload } = useLearningResource(load, null);
  if (loading) return <p role="status">Đang tải số liệu tổng hợp…</p>;
  if (error) {
    return (
      <div role="alert">
        <p>Không thể tải số liệu tổng hợp.</p>
        <button className="button button-soft" type="button" onClick={reload}>Thử lại</button>
      </div>
    );
  }
  if (!data) return <p role="status">Chưa có dữ liệu tổng hợp.</p>;
  return (
    <div className="analytics-stats-grid">
      {metrics.map(([title, field, format]) => (
        <StatComparisonCard key={field} title={title} value={data[field]} format={format} />
      ))}
    </div>
  );
}
