import { useState, useRef } from 'react';
import {
  AttachMoney,
  PeopleAltOutlined,
  MenuBook,
  EmojiEventsOutlined,
  WorkspacePremium,
  DiamondOutlined,
  StorefrontOutlined,
} from '@mui/icons-material';
import AnalyticsFilterBar from '../components/analytics/AnalyticsFilterBar';
import RevenueAnalyticsTab from '../analytics/tabs/RevenueAnalyticsTab';
import LearnersAnalyticsTab from '../analytics/tabs/LearnersAnalyticsTab';
import LearningProgressTab from '../analytics/tabs/LearningProgressTab';
import CoursePerformanceTab from '../analytics/tabs/CoursePerformanceTab';
import ProMembershipTab from '../analytics/tabs/ProMembershipTab';
import GemAnalyticsTab from '../analytics/tabs/GemAnalyticsTab';
import ShopAnalyticsTab from '../analytics/tabs/ShopAnalyticsTab';
import { getPresetRange } from '../analytics/analyticsUtils';
import '../analytics/analytics.css';

const TABS = [
  { id: 'revenue', label: 'Doanh thu & Thanh toán', icon: AttachMoney, phase: 1 },
  { id: 'learners', label: 'Học viên & Tăng trưởng', icon: PeopleAltOutlined, phase: 1 },
  { id: 'progress', label: 'Tiến độ & Kết quả học', icon: EmojiEventsOutlined, phase: 2 },
  { id: 'courses', label: 'Hiệu quả Khóa học', icon: MenuBook, phase: 2 },
  { id: 'pro', label: 'Gói Pro & Mã kích hoạt', icon: WorkspacePremium, phase: 3 },
  { id: 'gems', label: 'Kinh tế Gem', icon: DiamondOutlined, phase: 3 },
  { id: 'shop', label: 'Cửa hàng & Kho đồ', icon: StorefrontOutlined, phase: 3 },
];

export default function AdminStatisticsPage() {
  const [activeTab, setActiveTab] = useState('progress'); // Default to Phase 2 or Revenue
  const [range, setRange] = useState(() => getPresetRange('30d'));
  const [compare, setCompare] = useState(true);
  const exportHandlerRef = useRef(null);

  const handleExport = () => {
    if (exportHandlerRef.current) {
      exportHandlerRef.current();
    }
  };

  return (
    <div className="analytics-container">
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
          📊 Thống kê & Báo cáo
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Theo dõi tổng quan tài chính, tăng trưởng người dùng, tiến độ học tập và hiệu quả các khóa học
        </p>
      </div>

      {/* Tabs Navigation */}
      <nav className="analytics-nav-tabs" aria-label="Phân hệ thống kê">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`analytics-tab-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon style={{ fontSize: 18 }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Filter Bar */}
      <AnalyticsFilterBar
        range={range}
        onRangeChange={setRange}
        compare={compare}
        onCompareChange={setCompare}
        onExport={handleExport}
        exportLabel="Xuất Excel (.xlsx)"
      />

      {/* Tab Panels */}
      {activeTab === 'revenue' && (
        <RevenueAnalyticsTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'learners' && (
        <LearnersAnalyticsTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'progress' && (
        <LearningProgressTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'courses' && (
        <CoursePerformanceTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'pro' && (
        <ProMembershipTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'gems' && (
        <GemAnalyticsTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}

      {activeTab === 'shop' && (
        <ShopAnalyticsTab
          range={range}
          compare={compare}
          onExportReady={fn => {
            exportHandlerRef.current = fn;
          }}
        />
      )}
    </div>
  );
}
