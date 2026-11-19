import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import {
  AutoStoriesOutlined,
  DownloadOutlined,
  EmojiEventsOutlined,
  HeadphonesOutlined,
  LocalFireDepartmentOutlined,
  MenuBookOutlined,
  QuizOutlined,
  RateReviewOutlined,
  ScheduleOutlined,
  SchoolOutlined,
  StarOutlined,
  TaskAlt,
} from '@mui/icons-material';
import useAuth from '../../../auth/hooks/useAuth';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import { adminApi } from '../../api/adminApi';
import { LoadState } from '../../components/AdminUi';
import { CommerceTable } from '../../components/CommerceAdminUi';
import BreakdownDonut from '../../components/analytics/BreakdownDonut';
import HorizontalBreakdown from '../../components/analytics/HorizontalBreakdown';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import useAdminPagination from '../../hooks/useAdminPagination';
import { can, money, number } from '../../utils/adminUtils';
import { exportAnalyticsToExcel } from '../analyticsUtils';

const courseStatusMeta = {
  PUBLISHED: { label: 'Đang mở', tone: 'green' },
  DRAFT: { label: 'Bản nháp', tone: 'amber' },
  ARCHIVED: { label: 'Lưu trữ', tone: '' },
};

const levelLabels = {
  BEGINNER: 'Cơ bản (Beginner)',
  INTERMEDIATE: 'Trung cấp (Intermediate)',
  ADVANCED: 'Nâng cao (Advanced)',
};

export default function OverviewAnalyticsTab({ report }) {
  const { user } = useAuth();
  const canViewCourses = can(user, 'COURSE_VIEW');
  const canViewLearning = can(user, 'LEARNING_REPORT_VIEW');

  const load = useCallback(
    async options => {
      if (report === 'progress') {
        const [learningRes, coursesRes] = await Promise.all([
          adminApi.learning(options),
          canViewCourses ? adminApi.courses(options).catch(() => null) : Promise.resolve(null),
        ]);
        return {
          data: {
            ...learningRes.data,
            courseCatalog: coursesRes?.data?.courses ?? coursesRes?.data?.recent ?? [],
          },
        };
      }
      const [coursesRes, learningRes] = await Promise.all([
        adminApi.courses(options),
        canViewLearning ? adminApi.learning(options).catch(() => null) : Promise.resolve(null),
      ]);
      return {
        data: {
          ...coursesRes.data,
          learningProgress: learningRes?.data?.courseProgress ?? [],
        },
      };
    },
    [report, canViewCourses, canViewLearning],
  );

  const { data, error, loading, reload } = useLearningResource(load, null);

  if (loading || error) {
    return <LoadState loading={loading} error={error} retry={reload} />;
  }
  if (!data) {
    return <p className="analytics-chart-empty">Chưa có dữ liệu tổng hợp.</p>;
  }

  return report === 'progress' ? <ProgressReport data={data} /> : <CoursesReport data={data} />;
}

function ProgressReport({ data }) {
  const pagination = useAdminPagination(10);
  const [search, setSearch] = useState('');

  const courseTitleMap = useMemo(() => {
    const map = new Map();
    (data.courseCatalog ?? []).forEach(c => {
      if (c?.id != null) map.set(Number(c.id), c.title);
    });
    return map;
  }, [data.courseCatalog]);

  const enrollments = Number(data.enrollments ?? 0);
  const completed = Number(data.completed ?? 0);
  const activeEnrollments =
    data.activeEnrollments != null ? Number(data.activeEnrollments) : Math.max(0, enrollments - completed);

  const dailySeries = (data.dailyActivity ?? []).map(point => ({
    label: point.label || point.date,
    current: Number(point.activities ?? point.learners ?? 0),
    learners: Number(point.learners ?? 0),
  }));

  const progressRows = useMemo(() => {
    const rows = (data.courseProgress ?? []).map(row => {
      const total = Number(row.enrollments ?? 0);
      const done = Number(row.completed ?? 0);
      const rate = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;
      const title = courseTitleMap.get(Number(row.courseId)) || `Khóa học #${row.courseId}`;
      return {
        id: row.courseId,
        courseId: row.courseId,
        title,
        enrollments: total,
        completed: done,
        active: Number(row.active ?? Math.max(0, total - done)),
        completionRate: rate,
      };
    });
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter(
      row =>
        row.title.toLowerCase().includes(needle) || String(row.courseId).includes(needle),
    );
  }, [data.courseProgress, courseTitleMap, search]);

  const exportReport = () =>
    exportAnalyticsToExcel(
      [
        ['Chỉ số Tiến độ & Kết quả học', 'Giá trị'],
        ['Lượt ghi danh hợp lệ', enrollments],
        ['Lượt hoàn thành khóa học', completed],
        ['Đang theo học', activeEnrollments],
        ['Tỷ lệ hoàn thành (%)', data.completionRate ?? 0],
        ['Bài học đã hoàn thành', data.lessonsCompleted ?? '—'],
        ['Tổng thời gian học (phút)', data.totalStudyMinutes ?? '—'],
        ['Lượt làm Quiz đã chấm', data.quizAttempts ?? '—'],
        ['Tỷ lệ đạt Quiz (%)', data.quizPassRate ?? '—'],
        ['Điểm trung bình Quiz', data.avgQuizScore ?? '—'],
        ['Lượt thi TOEIC đã chấm', data.toeicAttempts ?? '—'],
        ['Điểm trung bình TOEIC (%)', data.avgToeicScore ?? '—'],
        ['Bài nghe Dictation hoàn thành', data.dictationAttempts ?? '—'],
        ['Học viên đang giữ Streak', data.activeStreaks ?? '—'],
        [],
        ['Khóa học', 'Ghi danh', 'Hoàn thành', 'Đang học', 'Tỷ lệ hoàn thành (%)'],
        ...progressRows.map(r => [r.title, r.enrollments, r.completed, r.active, r.completionRate]),
      ],
      'Tien_do_va_ket_qua_hoc.xlsx',
      'Tiến độ học',
    );

  return (
    <div className="analytics-tab-content">
      <div className="analytics-section-actions">
        <div className="analytics-notice-bar" role="status">
          <span>Tổng hợp toàn thời gian từ dữ liệu ghi danh, bài học, quiz, TOEIC và dictation.</span>
        </div>
        <Button variant="outlined" size="small" startIcon={<DownloadOutlined />} onClick={exportReport}>
          Tải báo cáo (.xlsx)
        </Button>
      </div>

      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Lượt ghi danh hợp lệ"
          icon={<SchoolOutlined />}
          value={data.enrollments}
          tone="blue"
          helper={`${number(activeEnrollments)} lượt đang theo học`}
        />
        <StatComparisonCard
          title="Lượt hoàn thành khóa học"
          icon={<TaskAlt />}
          value={data.completed}
          tone="green"
          helper="Đã hoàn thành toàn bộ chương trình"
        />
        <StatComparisonCard
          title="Tỷ lệ hoàn thành"
          icon={<EmojiEventsOutlined />}
          value={data.completionRate}
          format="percent"
          tone="purple"
          helper="Trên tổng lượt ghi danh không bị hủy"
        />
        <StatComparisonCard
          title="Bài học đã hoàn thành"
          icon={<AutoStoriesOutlined />}
          value={data.lessonsCompleted}
          tone="cyan"
          helper={
            data.totalStudyMinutes != null
              ? `${number(data.totalStudyMinutes)} phút học đã ghi nhận`
              : undefined
          }
        />
        <StatComparisonCard
          title="Tỷ lệ đạt Quiz"
          icon={<QuizOutlined />}
          value={data.quizPassRate}
          format="percent"
          tone="amber"
          helper={
            data.quizAttempts != null
              ? `${number(data.quizPassed)} / ${number(data.quizAttempts)} lượt · TB ${number(data.avgQuizScore)} điểm`
              : undefined
          }
        />
        <StatComparisonCard
          title="Luyện TOEIC & Nghe chép"
          icon={<HeadphonesOutlined />}
          value={
            data.toeicAttempts != null || data.dictationAttempts != null
              ? Number(data.toeicAttempts ?? 0) + Number(data.dictationAttempts ?? 0)
              : null
          }
          tone="blue"
          helper={
            data.toeicAttempts != null
              ? `${number(data.toeicAttempts)} TOEIC (TB ${number(data.avgToeicScore)}%) · ${number(data.dictationAttempts)} Dictation`
              : undefined
          }
        />
        <StatComparisonCard
          title="Học viên đang giữ Streak"
          icon={<LocalFireDepartmentOutlined />}
          value={data.activeStreaks}
          tone="red"
          helper="Có chuỗi học liên tiếp từ 1 ngày trở lên"
        />
      </div>

      <div className="analytics-two-col">
        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <ScheduleOutlined fontSize="small" /> Hoạt động học tập 7 ngày gần nhất
              </h3>
              <p className="analytics-card-subtitle">Tổng số lượt hoàn thành bài học / quiz mỗi ngày (giờ VN)</p>
            </div>
          </div>
          <TrendChart
            series={dailySeries}
            compare={false}
            currentLabel="Lượt hoạt động"
            currentColor="#16a34a"
            emptyMessage="Chưa có hoạt động học tập trong 7 ngày qua."
          />
        </section>

        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <EmojiEventsOutlined fontSize="small" /> Tỷ lệ hoàn thành ghi danh
              </h3>
              <p className="analytics-card-subtitle">Phân bổ học viên đã hoàn thành và đang theo học</p>
            </div>
          </div>
          <BreakdownDonut
            items={[
              { label: 'Đã hoàn thành', value: completed, color: '#16a34a' },
              { label: 'Đang theo học', value: activeEnrollments, color: '#2563eb' },
            ]}
            centerLabel="HOÀN THÀNH"
            centerValue={data.completionRate != null ? `${number(data.completionRate)}%` : '0%'}
            emptyMessage="Chưa có lượt ghi danh nào."
          />
        </section>
      </div>

      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Tiến độ theo từng khóa học</h3>
            <p className="analytics-card-subtitle">Thống kê lượt ghi danh và tỷ lệ hoàn thành theo khóa học</p>
          </div>
          <TextField
            size="small"
            label="Tìm khóa học"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              pagination.onChange(0);
            }}
          />
        </div>
        <CommerceTable
          embedded
          paginate
          pagination={pagination}
          rowKey="id"
          rows={progressRows}
          emptyMessage="Chưa có dữ liệu tiến độ theo khóa học."
          columns={[
            ['Khóa học', row => <strong>{row.title}</strong>],
            ['Lượt ghi danh', row => number(row.enrollments)],
            ['Đang học', row => number(row.active)],
            ['Hoàn thành', row => number(row.completed)],
            [
              'Tỷ lệ hoàn thành',
              row => (
                <div className="analytics-inline-progress">
                  <div className="analytics-inline-progress-track">
                    <div
                      className="analytics-inline-progress-fill"
                      style={{ width: `${Math.min(100, row.completionRate)}%` }}
                    />
                  </div>
                  <span>{row.completionRate}%</span>
                </div>
              ),
            ],
          ]}
        />
      </section>
    </div>
  );
}

function CoursesReport({ data }) {
  const pagination = useAdminPagination(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const progressMap = useMemo(() => {
    const map = new Map();
    (data.learningProgress ?? []).forEach(p => {
      if (p?.courseId != null) map.set(Number(p.courseId), p);
    });
    return map;
  }, [data.learningProgress]);

  useEffect(() => {
    pagination.onChange(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const rawCourses = useMemo(
    () => (data.courses && data.courses.length ? data.courses : data.recent ?? []),
    [data.courses, data.recent],
  );

  const filteredCourses = useMemo(() => {
    return rawCourses
      .map(c => {
        const prog = progressMap.get(Number(c.id));
        return {
          ...c,
          enrollments: prog ? Number(prog.enrollments ?? 0) : null,
          completedEnrollments: prog ? Number(prog.completed ?? 0) : null,
        };
      })
      .filter(c => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const needle = search.trim().toLowerCase();
        return (
          String(c.title ?? '').toLowerCase().includes(needle) ||
          String(c.categoryName ?? '').toLowerCase().includes(needle)
        );
      });
  }, [rawCourses, progressMap, statusFilter, search]);

  const categories = (data.categories ?? []).map(c => ({
    label: c.name,
    value: Number(c.count ?? 0),
  }));

  const levels = (data.levels ?? []).map((item, idx) => ({
    label: levelLabels[item.level] || item.level,
    value: Number(item.count ?? 0),
    color: ['#2563eb', '#0ea5e9', '#8b5cf6'][idx % 3],
  }));

  const pricingBreakdown =
    data.freeCourses != null || data.paidCourses != null
      ? [
          { label: 'Khóa học có phí', value: Number(data.paidCourses ?? 0), color: '#2563eb' },
          { label: 'Khóa học miễn phí', value: Number(data.freeCourses ?? 0), color: '#16a34a' },
        ]
      : [];

  const exportReport = () =>
    exportAnalyticsToExcel(
      [
        ['Chỉ số Hiệu quả Khóa học', 'Giá trị'],
        ['Tổng khóa học', data.total],
        ['Khóa học đang mở', data.published],
        ['Bản nháp', data.draft ?? '—'],
        ['Lưu trữ', data.archived ?? '—'],
        ['Tổng bài học', data.totalLessons ?? '—'],
        ['Tổng đánh giá hiển thị', data.totalReviews ?? '—'],
        ['Điểm đánh giá TB', data.avgRating ?? '—'],
        [],
        ['Khóa học', 'Danh mục', 'Trình độ', 'Trạng thái', 'Giá (VND)', 'Số bài học', 'Đánh giá TB', 'Lượt đánh giá'],
        ...filteredCourses.map(c => [
          c.title,
          c.categoryName || '—',
          c.level || '—',
          courseStatusMeta[c.status]?.label || c.status,
          Number(c.price ?? 0),
          c.lessonCount ?? '—',
          c.avgRating ?? 0,
          c.reviewCount ?? 0,
        ]),
      ],
      'Hieu_qua_khoa_hoc.xlsx',
      'Khóa học',
    );

  const inactiveCourses = Number(data.draft ?? 0) + Number(data.archived ?? 0);

  return (
    <div className="analytics-tab-content">
      <div className="analytics-section-actions">
        <div className="analytics-notice-bar" role="status">
          <span>Thống kê toàn bộ danh mục khóa học, nội dung bài giảng, phân bố trình độ và đánh giá học viên.</span>
        </div>
        <Button variant="outlined" size="small" startIcon={<DownloadOutlined />} onClick={exportReport}>
          Tải báo cáo (.xlsx)
        </Button>
      </div>

      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Tổng khóa học"
          icon={<MenuBookOutlined />}
          value={data.total}
          tone="blue"
          helper="Toàn bộ khóa học trong danh mục"
        />
        <StatComparisonCard
          title="Khóa học đang mở"
          icon={<TaskAlt />}
          value={data.published}
          tone="green"
          helper={
            data.total > 0
              ? `Chiếm ${Math.round((Number(data.published ?? 0) / Number(data.total)) * 1000) / 10}% tổng khóa học`
              : undefined
          }
        />
        <StatComparisonCard
          title="Nháp & Lưu trữ"
          icon={<AutoStoriesOutlined />}
          value={data.draft != null || data.archived != null ? inactiveCourses : null}
          tone="amber"
          helper={
            data.draft != null
              ? `${number(data.draft)} nháp · ${number(data.archived)} lưu trữ`
              : undefined
          }
        />
        <StatComparisonCard
          title="Tổng số bài học"
          icon={<SchoolOutlined />}
          value={data.totalLessons}
          tone="cyan"
          helper="Tổng bài giảng trên tất cả chương học"
        />
        <StatComparisonCard
          title="Đánh giá trung bình"
          icon={<StarOutlined />}
          value={data.avgRating}
          tone="purple"
          helper={
            data.totalReviews != null
              ? `Từ ${number(data.totalReviews)} đánh giá công khai`
              : undefined
          }
        />
      </div>

      <div className="analytics-two-col">
        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <MenuBookOutlined fontSize="small" /> Phân bố khóa học theo danh mục
              </h3>
              <p className="analytics-card-subtitle">Số lượng khóa học thuộc từng nhóm danh mục</p>
            </div>
          </div>
          <BreakdownDonut
            items={categories}
            centerLabel="KHÓA HỌC"
            centerValue={number(data.total)}
            emptyMessage="Chưa có phân bố danh mục."
          />
        </section>

        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <RateReviewOutlined fontSize="small" /> Phân bố trình độ & Mô hình giá
              </h3>
              <p className="analytics-card-subtitle">Cơ cấu khóa học theo cấp độ và hình thức miễn phí / trả phí</p>
            </div>
          </div>
          <HorizontalBreakdown items={levels} emptyMessage="Chưa có dữ liệu trình độ." />
          {pricingBreakdown.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
              <HorizontalBreakdown items={pricingBreakdown} />
            </div>
          )}
        </section>
      </div>

      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Danh sách hiệu quả khóa học</h3>
            <p className="analytics-card-subtitle">Chi tiết trạng thái, học phí, bài học và đánh giá · Dùng chung bộ phân trang quản trị</p>
          </div>
        </div>

        <div className="analytics-table-toolbar">
          <TextField
            size="small"
            label="Tìm tên khóa học hoặc danh mục"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <MenuItem value="ALL">Tất cả trạng thái</MenuItem>
            <MenuItem value="PUBLISHED">Đang mở</MenuItem>
            <MenuItem value="DRAFT">Bản nháp</MenuItem>
            <MenuItem value="ARCHIVED">Lưu trữ</MenuItem>
          </TextField>
        </div>

        <CommerceTable
          embedded
          paginate
          pagination={pagination}
          rowKey="id"
          rows={filteredCourses}
          emptyMessage="Chưa có khóa học phù hợp."
          columns={[
            [
              'Khóa học',
              c => (
                <div>
                  <strong>{c.title}</strong>
                  {c.categoryName ? <small>{c.categoryName}</small> : null}
                </div>
              ),
            ],
            ['Trình độ', c => levelLabels[c.level] || c.level || '—'],
            [
              'Trạng thái',
              c => {
                const meta = courseStatusMeta[c.status] || { label: c.status, tone: '' };
                return <span className={`admin-pill ${meta.tone}`}>{meta.label}</span>;
              },
            ],
            ['Học phí', c => (Number(c.price) === 0 ? <span className="admin-pill green">Miễn phí</span> : money(c.price))],
            ['Bài học', c => (c.lessonCount != null ? number(c.lessonCount) : '—')],
            ...(progressMap.size > 0
              ? [['Ghi danh', c => (c.enrollments != null ? `${number(c.enrollments)} (${number(c.completedEnrollments)} xong)` : '0')]]
              : []),
            [
              'Đánh giá',
              c =>
                c.reviewCount > 0 ? (
                  <span>
                    ★ {c.avgRating} <small style={{ display: 'inline' }}>({number(c.reviewCount)})</small>
                  </span>
                ) : (
                  'Chưa có'
                ),
            ],
          ]}
        />
      </section>
    </div>
  );
}
