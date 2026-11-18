import { useState, useEffect } from 'react';
import {
  AppRegistration,
  CheckCircle,
  Star,
  WarningAmber,
  LightbulbOutlined,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function CoursePerformanceTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    analyticsApi
      .getCoursePerformanceAnalytics({ from: range.from, to: range.to, compare })
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
    if (!data?.coursesTable) return;
    const header = [
      'ID Khóa học', 'Tên khóa học', 'Danh mục',
      'Lượt đăng ký', 'Tỷ lệ hoàn thành (%)',
      'Đánh giá (sao)', 'Số lượt đánh giá',
    ];
    const dataRows = data.coursesTable.map(c => [
      c.id, c.title, c.category, c.enrollments,
      c.completionRate, c.avgRating, c.reviewsCount,
    ]);
    await exportAnalyticsToExcel(
      [header, ...dataRows],
      `Hieu_qua_khoa_hoc_${range.from}_${range.to}.xlsx`,
      'Hiệu quả khóa học'
    );
  };

  useEffect(() => {
    if (onExportReady) {
      onExportReady(async () => handleExport());
    }
  }, [data, range]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải thống kê hiệu quả khóa học...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu khóa học.</p>;
  }

  const { current, previous, coursesTable, dropOffLessons } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 4 Thẻ KPI Hiệu quả khóa học */}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Lượt đăng ký mới"
          icon={<AppRegistration />}
          value={current.totalEnrollments}
          previousValue={previous?.totalEnrollments}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Tỷ lệ hoàn thành TB"
          icon={<CheckCircle />}
          value={current.avgCompletionRate}
          previousValue={previous?.avgCompletionRate}
          format="percent"
          compare={compare}
        />
        <StatComparisonCard
          title="Đánh giá trung bình"
          icon={<Star />}
          value={`${current.avgCourseRating} ★`}
          previousValue={previous ? `${previous.avgCourseRating} ★` : null}
          format="raw"
          compare={compare}
        />
        <StatComparisonCard
          title="Tỷ lệ bỏ dở TB"
          icon={<WarningAmber />}
          value={current.avgDropOffRate}
          previousValue={previous?.avgDropOffRate}
          format="percent"
          compare={compare}
        />
      </div>

      {/* Biểu đồ phân bổ khóa học quan tâm */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📊 Khóa học được quan tâm nhất (Lượt đăng ký)</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={compare}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          currentColor="#6366f1"
          previousColor="#94a3b8"
          valueFormatter={number}
        />
      </div>

      {/* Bảng hiệu quả chi tiết từng khóa học */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📚 Đánh giá hiệu quả từng khóa học</h3>
          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={handleExport}
          >
            Xuất file Excel
          </button>
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Danh mục</th>
                <th>Lượt đăng ký</th>
                <th>Tỷ lệ hoàn thành</th>
                <th>Đánh giá</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {coursesTable && coursesTable.length > 0 ? (
                coursesTable.map(course => (
                  <tr key={course.id}>
                    <td><strong>{course.title}</strong></td>
                    <td>
                      <span className="badge" style={{ fontSize: 11, background: '#f1f5f9', color: '#475569' }}>
                        {course.category}
                      </span>
                    </td>
                    <td><strong>{number(course.enrollments)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 60,
                            height: 6,
                            background: '#e2e8f0',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${course.completionRate}%`,
                              height: '100%',
                              background: course.completionRate >= 65 ? '#16a34a' : '#ca8a04',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{course.completionRate}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#eab308', fontSize: 14 }}>★</span>
                        <strong>{course.avgRating}</strong>
                        <span style={{ fontSize: 11, color: '#64748b' }}>({course.reviewsCount})</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: 11,
                          background:
                            course.status === 'POPULAR'
                              ? '#f0fdf4'
                              : course.status === 'GOOD'
                              ? '#eff6ff'
                              : '#fef2f2',
                          color:
                            course.status === 'POPULAR'
                              ? '#166534'
                              : course.status === 'GOOD'
                              ? '#1d4ed8'
                              : '#991b1b',
                        }}
                      >
                        {course.status === 'POPULAR'
                          ? 'Bán chạy nhất'
                          : course.status === 'GOOD'
                          ? 'Ổn định'
                          : 'Cần cải thiện'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    Chưa có dữ liệu khóa học.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân tích bài học có tỷ lệ bỏ dở cao nhất */}
      <div className="analytics-section-card" style={{ borderLeft: '4px solid #ef4444' }}>
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningAmber style={{ color: '#ef4444' }} />
              Các bài học có tỷ lệ bỏ dở cao nhất (Cần cải thiện nội dung)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Xác định các bài học khiến học viên dừng chuỗi học tập để biên soạn lại video hoặc điều chỉnh độ khó bài tập
            </p>
          </div>
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Tên bài học</th>
                <th>Khóa học</th>
                <th>Tỷ lệ bỏ dở</th>
                <th>Lượt thoát</th>
                <th>Thời lượng xem TB</th>
                <th>Gợi ý cải tiến từ hệ thống</th>
              </tr>
            </thead>
            <tbody>
              {dropOffLessons && dropOffLessons.length > 0 ? (
                dropOffLessons.map(lesson => (
                  <tr key={lesson.id}>
                    <td><strong style={{ color: '#b91c1c' }}>{lesson.lessonTitle}</strong></td>
                    <td style={{ fontSize: 13, color: '#475569' }}>{lesson.courseTitle}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ fontSize: 12, fontWeight: 700, background: '#fef2f2', color: '#991b1b' }}
                      >
                        {lesson.dropOffRate}%
                      </span>
                    </td>
                    <td><strong>{number(lesson.dropCount)}</strong></td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{lesson.avgTimeSpent}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#334155' }}>
                        <LightbulbOutlined fontSize="small" style={{ color: '#ca8a04', marginTop: 1, flexShrink: 0 }} />
                        <span>{lesson.actionSuggestion}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    Không có bài học nào bị bỏ dở bất thường.
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
