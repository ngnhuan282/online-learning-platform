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
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

/* ── Mock data cho detail modal (thay bằng API thực khi có) ── */
const learnerDetailMock = {
  userId: 'USR-001',
  name: 'Nguyễn Minh Tuấn',
  email: 'tuan.nguyen@example.com',
  joinedAt: '2026-09-15',
  totalStudyMinutes: 1240,
  lessonsCompleted: 48,
  avgQuizScore: 82.5,
  passRate: 87.5,
  recentLessons: [
    { lessonTitle: 'Bài 12: Thì hiện tại hoàn thành', courseTitle: 'TOEIC Ngữ pháp', completedAt: '2026-11-18', duration: '18 phút', status: 'COMPLETED' },
    { lessonTitle: 'Bài 11: Mệnh đề quan hệ', courseTitle: 'TOEIC Ngữ pháp', completedAt: '2026-11-17', duration: '22 phút', status: 'COMPLETED' },
    { lessonTitle: 'Part 5 - Practice Set 3', courseTitle: 'TOEIC Full Test', completedAt: '2026-11-16', duration: '35 phút', status: 'COMPLETED' },
    { lessonTitle: 'Listening Section 4', courseTitle: 'IELTS Master 6.5+', completedAt: '2026-11-14', duration: '28 phút', status: 'IN_PROGRESS' },
  ],
  quizResults: [
    { quizName: 'Quiz Test 1 - TOEIC Ngữ pháp', attempts: 2, bestScore: 90, passRate: 100, lastAttempt: '2026-11-15' },
    { quizName: 'Quiz Test 2 - TOEIC Ngữ pháp', attempts: 1, bestScore: 75, passRate: 100, lastAttempt: '2026-11-16' },
    { quizName: 'Full Test Practice 1', attempts: 3, bestScore: 82, passRate: 67, lastAttempt: '2026-11-18' },
  ],
};

/* ── Hàm export xlsx cho detail modal ── */
async function exportLearnerDetail(detail) {
  const rows = [
    ['Mã HV', detail.userId],
    ['Họ và tên', detail.name],
    ['Email', detail.email],
    ['Ngày tham gia', detail.joinedAt],
    ['Tổng thời gian học (phút)', detail.totalStudyMinutes],
    ['Bài đã hoàn thành', detail.lessonsCompleted],
    ['Điểm Quiz TB (%)', detail.avgQuizScore],
    ['Tỷ lệ đạt (%)', detail.passRate],
    [],
    ['--- LỊCH SỬ HỌC TẬP GẦN ĐÂY ---'],
    ['Bài học', 'Khóa học', 'Ngày hoàn thành', 'Thời lượng', 'Trạng thái'],
    ...detail.recentLessons.map(l => [l.lessonTitle, l.courseTitle, l.completedAt, l.duration, l.status]),
    [],
    ['--- KẾT QUẢ QUIZ ---'],
    ['Tên Quiz', 'Số lần làm', 'Điểm cao nhất', 'Tỷ lệ đạt (%)', 'Lần làm cuối'],
    ...detail.quizResults.map(q => [q.quizName, q.attempts, q.bestScore, q.passRate, q.lastAttempt]),
  ];
  await exportAnalyticsToExcel(rows, `hoc-vien-${detail.userId}.xlsx`, 'Chi tiết học viên');
}

/* ── Overlay styles (pure CSS, không dùng MUI Dialog) ── */
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1300,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
};
const modalStyle = {
  background: '#fff', borderRadius: 12,
  width: '100%', maxWidth: 820,
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  display: 'flex', flexDirection: 'column',
};
const modalHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '20px 24px 16px',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky', top: 0, background: '#fff', zIndex: 1,
};
const kpiGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12, padding: '16px 24px',
};
const kpiCardStyle = {
  background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center',
};
const sectionStyle = { padding: '0 24px 20px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle = { background: '#f1f5f9', padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e2e8f0' };
const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

/* ── Learner Detail Modal ── */
function LearnerDetailModal({ learner, onClose }) {
  const detail = { ...learnerDetailMock, name: learner.name, email: learner.email };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {detail.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{detail.email}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Tham gia: {detail.joinedAt} · ID: {detail.userId}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="button button-soft"
              style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => exportLearnerDetail(detail)}
            >
              ⬇️ Xuất Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 22, lineHeight: 1, color: '#64748b', padding: '0 4px',
              }}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={kpiGridStyle}>
          {[
            { label: '⏱ Thời gian học', value: `${Math.floor(detail.totalStudyMinutes / 60)}h ${detail.totalStudyMinutes % 60}p` },
            { label: '✅ Bài hoàn thành', value: detail.lessonsCompleted },
            { label: '📊 Điểm Quiz TB', value: `${detail.avgQuizScore}%` },
            { label: '🎯 Tỷ lệ đạt', value: `${detail.passRate}%` },
          ].map(k => (
            <div key={k.label} style={kpiCardStyle}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Lịch sử học tập */}
        <div style={sectionStyle}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📚 Lịch sử học tập gần đây</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Bài học', 'Khóa học', 'Ngày', 'Thời lượng', 'Trạng thái'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.recentLessons.map((l, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{l.lessonTitle}</td>
                    <td style={tdStyle}><span style={{ fontSize: 12, color: '#6366f1' }}>{l.courseTitle}</span></td>
                    <td style={tdStyle}>{l.completedAt}</td>
                    <td style={tdStyle}>{l.duration}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: l.status === 'COMPLETED' ? '#f0fdf4' : '#fff7ed',
                        color: l.status === 'COMPLETED' ? '#166534' : '#c2410c',
                      }}>
                        {l.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang học'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kết quả Quiz */}
        <div style={sectionStyle}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🎯 Kết quả Quiz</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Tên Quiz', 'Số lần làm', 'Điểm cao nhất', 'Tỷ lệ đạt', 'Lần làm cuối'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.quizResults.map((q, i) => (
                  <tr key={i}>
                    <td style={tdStyle}><strong>{q.quizName}</strong></td>
                    <td style={tdStyle}>{q.attempts} lần</td>
                    <td style={tdStyle}>
                      <strong style={{ color: q.bestScore >= 80 ? '#166534' : q.bestScore < 60 ? '#dc2626' : '#1e293b' }}>
                        {q.bestScore}%
                      </strong>
                    </td>
                    <td style={tdStyle}>{q.passRate}%</td>
                    <td style={tdStyle}>{q.lastAttempt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LearningProgressTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLearner, setSelectedLearner] = useState(null);

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

  const handleExport = async () => {
    if (!data?.learnersDetail) return;
    const header = [
      'Mã HV', 'Họ và tên', 'Email', 'Bài hoàn thành',
      'Điểm Quiz TB (%)', 'Tỷ lệ đạt (%)', 'Lượt thi lại',
      'Thời gian học (giờ)', 'Hoạt động gần nhất',
    ];
    const dataRows = data.learnersDetail.map(r => [
      r.id, r.name, r.email,
      `${r.completedLessons}/${r.totalLessons}`,
      r.avgQuizScore, r.quizPassRate, r.retakeCount,
      r.learningHours, r.lastActive,
    ]);
    await exportAnalyticsToExcel(
      [header, ...dataRows],
      `Tien_do_ket_qua_hoc_tap_${range.from}_${range.to}.xlsx`,
    );
  };

  useEffect(() => {
    if (onExportReady) {
      onExportReady(async () => handleExport());
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
      {/* Detail Modal */}
      {selectedLearner && (
        <LearnerDetailModal learner={selectedLearner} onClose={() => setSelectedLearner(null)} />
      )}
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
                <th></th>
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
                      <td>
                        <button
                          type="button"
                          className="button button-soft"
                          style={{ fontSize: 12, padding: '3px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => setSelectedLearner(learner)}
                        >
                          👁️ Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
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
