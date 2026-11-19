import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import {
  AttachMoney,
  DiamondOutlined,
  DownloadOutlined,
  EmojiEventsOutlined,
  MenuBook,
  PeopleAltOutlined,
  StorefrontOutlined,
  WorkspacePremium,
} from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import useAuth from '../../auth/hooks/useAuth';
import { PageHeading } from '../components/AdminUi';
import { can } from '../utils/adminUtils';
import { commerceReports } from '../analytics/commerceReports';
import CommerceAnalyticsTab from '../analytics/tabs/CommerceAnalyticsTab';
import LearnersAnalyticsTab from '../analytics/tabs/LearnersAnalyticsTab';
import OverviewAnalyticsTab from '../analytics/tabs/OverviewAnalyticsTab';
import RevenueAnalyticsTab from '../analytics/tabs/RevenueAnalyticsTab';
import '../analytics/analytics.css';

const tabs = [
  ['revenue', 'Doanh thu & Thanh toán', AttachMoney, 'PAYMENT_REPORT_VIEW'],
  ['learners', 'Học viên & Tăng trưởng', PeopleAltOutlined, 'DASHBOARD_VIEW'],
  ['progress', 'Tiến độ & Kết quả học', EmojiEventsOutlined, 'LEARNING_REPORT_VIEW'],
  ['courses', 'Hiệu quả Khóa học', MenuBook, 'COURSE_VIEW'],
  ['pro', 'Gói Pro & Mã kích hoạt', WorkspacePremium, 'PRO_MEMBER_VIEW'],
  ['gems', 'Kinh tế Gem', DiamondOutlined, 'ENGAGEMENT_VIEW'],
  ['shop', 'Cửa hàng & Kho đồ', StorefrontOutlined, 'SHOP_VIEW'],
];

export default function AdminStatisticsPage() {
  useLocale();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('revenue');
  const [exportReport, setExportReport] = useState(null);
  const onExportReady = useCallback(handler => setExportReport(() => handler), []);
  const visibleTabs = tabs.filter(([, , , permission]) => can(user, permission));
  const activeTab = visibleTabs.some(([id]) => id === selectedTab) ? selectedTab : visibleTabs[0]?.[0];
  const hasSummary = activeTab === 'progress' || activeTab === 'courses';

  return (
    <div className="analytics-container">
      <PageHeading
        title="Thống kê & Báo cáo"
        description="Theo dõi doanh thu, tăng trưởng học viên, tiến độ học tập, khóa học và kinh tế trong hệ thống."
      >
        {exportReport && (
          <Button variant="contained" startIcon={<DownloadOutlined />} onClick={exportReport}>
            {t('Xuất Excel')}
          </Button>
        )}
      </PageHeading>

      <nav className="analytics-nav-tabs" aria-label="Phân hệ thống kê">
        {visibleTabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={`analytics-tab-btn${activeTab === id ? ' is-active' : ''}`}
            aria-pressed={activeTab === id}
            onClick={() => {
              setExportReport(null);
              setSelectedTab(id);
            }}
          >
            <Icon fontSize="small" />
            {t(label)}
          </button>
        ))}
      </nav>

      {activeTab === 'revenue' && <RevenueAnalyticsTab onExportReady={onExportReady} />}
      {activeTab === 'learners' && <LearnersAnalyticsTab onExportReady={onExportReady} />}
      {hasSummary && <OverviewAnalyticsTab key={activeTab} report={activeTab} />}
      {commerceReports[activeTab] && (
        <CommerceAnalyticsTab key={activeTab} report={activeTab} onExportReady={onExportReady} />
      )}
    </div>
  );
}
