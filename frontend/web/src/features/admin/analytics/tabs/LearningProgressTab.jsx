import { useState, useEffect } from 'react';
import {
  AccessTime,
  CheckCircleOutlined,
  Quiz,
  Grade,
  Replay,
  FilterList,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToCsv } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function LearningProgressTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let active = true;
    setLoading(true);
    analyticsApi
      .getLearningProgressAnalytics({ from: range.from, to: range.to, compare })
      .then(res => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, compare]);

  const handleExport = () => {
    if (!data?.learnersDetail) return;
    const columns = [
      { header: 'Mã HV', accessor: 'id' },
      { header: 'Họ và tên', accessor: 'name' },
      { header: 'Email', accessor: 'email' },
      { header: 'Bài hoàn thành', accessor: r => `${r.completedLessons}/${r.totalLessons}` },
      { header: 'Điểm Quiz TB (%)', accessor: 'avgQuizScore' },
      { header: 'Tỷ lệ đạt (%)', accessor: 'quizPassRate' },
      { header: 'Lượt thi lại', accessor: 'retakeCount' },
      { header: 'Thời gian học (giờ)', accessor: 'learningHours' },
      { header: 'Hoạt động gần nhất', accessor: 'lastActive' },
    ];
    exportAnalyticsToCsv(`Tien_do_ket_qua_hoc_tap_${range.from}_${range.to}`, columns, data.learnersDetail);
  };

  useEffect(() => {
    if (onExportReady) {
      onExportReady(() => handleExport);
    }
  }, [data, range]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải dữ liệu tiến độ học tập...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu tiến độ.</p>;
  }

  const { current, previous, learnersDetail } = data;

  // Lọc danh sách học viên
  const filteredLearners = (learnersDetail || []).filter(item => {
    const matchText =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 5 Thẻ KPI Tiến độ & Kết quả học */}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Thời gian học TB"
          icon={<AccessTime />}
          value={`${current.avgLearningHours}h`}
          previousValue={previous ? `${previous.avgLearningHours}h` : null}
          format="raw"
          compare={compare}
        />
        <StatComparisonCard
          title="Bài học đã hoàn thành"
          icon={<CheckCircleOutlined />}
          value={current.totalCompletedLessons}
          previousValue={previous?.totalCompletedLessons}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Điểm Quiz trung bình"
          icon={<Grade />}
          value={current.avgQuizScore}
          previousValue={previous?.avgQuizScore}
          format="percent"
          compare={compare}
        />
        <StatComparisonCard
          title="Tỷ lệ đạt Quiz"
          icon={<Quiz />}
          value={current.quizPassRate}
          previousValue={previous?.quizPassRate}
          format="percent"
          compare={compare}
        />
        <StatComparisonCard
          title="Lượt thi lại Quiz"
          icon={<Replay />}
          value={current.quizRetakeCount}
          previousValue={previous?.quizRetakeCount}
          format="number"
          compare={compare}
        />
      </div>

      {/* Biểu đồ số lượt hoàn thành bài học theo kỳ */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📚 Lượt hoàn thành bài học & bài kiểm tra</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={compare}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          currentColor="#10b981"
          previousColor="#94a3b8"
          valueFormatter={number}
        />
      </div>

      {/* Bảng chi tiết từng học viên */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">👨‍🎓 Chi tiết tiến độ & kết quả từng học viên</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Theo dõi kết quả học tập thực tế, phát hiện sớm các học viên có nguy cơ bỏ cuộc
            </p>
          </div>

          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={handleExport}
          >
            Xuất file Excel
          </button>
        </div>

        {/* Bộ lọc bảng học viên */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Tìm theo tên học viên, email..."
            className="analytics-date-field"
            style={{ flex: '1 1 240px', padding: '8px 12px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="analytics-date-field"
            style={{ padding: '8px 12px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả xếp loại</option>
            <option value="EXCELLENT">Xuất sắc (≥85%)</option>
            <option value="GOOD">Khá tốt (70% - 84%)</option>
            <option value="AVERAGE">Trung bình (60% - 69%)</option>
            <option value="AT_RISK">Cần hỗ trợ (&lt;60%)</option>
          </select>
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Bài hoàn thành</th>
                <th>Điểm Quiz TB</th>
                <th>Tỷ lệ đạt</th>
                <th>Lượt làm lại</th>
                <th>Thời gian học</th>
                <th>Xếp loại</th>
                <th>Hoạt động gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {filteredLearners.length > 0 ? (
                filteredLearners.map(learner => {
                  const percent = Math.round((learner.completedLessons / learner.totalLessons) * 100);
                  return (
                    <tr key={learner.id}>
                      <td>
                        <strong>{learner.name}</strong>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{learner.email}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{learner.completedLessons}/{learner.totalLessons}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>({percent}%)</span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: learner.avgQuizScore >= 80 ? '#166534' : learner.avgQuizScore < 60 ? '#dc2626' : '#0f172a' }}>
                          {learner.avgQuizScore}%
                        </strong>
                      </td>
                      <td>{learner.quizPassRate}%</td>
                      <td>{learner.retakeCount} lần</td>
                      <td><strong>{learner.learningHours} giờ</strong></td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            fontSize: 11,
                            background:
                              learner.status === 'EXCELLENT'
                                ? '#f0fdf4'
                                : learner.status === 'GOOD'
                                ? '#eff6ff'
                                : learner.status === 'AVERAGE'
                                ? '#fefce8'
                                : '#fef2f2',
                            color:
                              learner.status === 'EXCELLENT'
                                ? '#166534'
                                : learner.status === 'GOOD'
                                ? '#1d4ed8'
                                : learner.status === 'AVERAGE'
                                ? '#854d0e'
                                : '#991b1b',
                          }}
                        >
                          {learner.status === 'EXCELLENT'
                            ? 'Xuất sắc'
                            : learner.status === 'GOOD'
                            ? 'Khá tốt'
                            : learner.status === 'AVERAGE'
                            ? 'Trung bình'
                            : 'Nguy cơ bỏ dở'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{learner.lastActive}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    Không tìm thấy học viên nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
