import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import Brand from './Brand';
import Icon from './Icon';
import PolicyDialog from './PolicyDialog';
import { ROUTES } from '../constants/routes';

const footerPolicies = [
  { label: 'Chính sách bảo mật', topic: 'Privacy Policy' },
  { label: 'Điều khoản dịch vụ', topic: 'Terms of Service' },
  { label: 'Cam kết đầu ra', topic: 'Cam kết đầu ra' },
  { label: 'Liên hệ tư vấn', topic: 'Contact Support' },
];
const bottomPolicies = [
  { label: 'Chính sách bảo mật', topic: 'Privacy Policy' },
  { label: 'Điều khoản sử dụng', topic: 'Terms of Service' },
  { label: 'Bảo mật thông tin', topic: 'Security' },
  { label: 'Hỗ trợ kỹ thuật', topic: 'Contact Support' },
];
const courses = [
  { name: 'Luyện thi IELTS 7.5+', query: 'IELTS' },
  { name: 'TOEIC Cấp tốc 850+', query: 'TOEIC' },
  { name: 'Tiếng Anh CNTT & Tech', query: 'English for Developers' },
  { name: 'Tiếng Anh Du lịch', query: 'Du lịch' },
  { name: 'Tiếng Anh Thương mại', query: 'Tiếng Anh Thương mại' },
];

export default function SiteFooter() {
  useLocale();
  const [info, setInfo] = useState(null);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <Brand />
            <p>
              {t(
                'Nền tảng đào tạo Tiếng Anh chuẩn quốc tế thế hệ mới. Lộ trình phản xạ khoa học, tương tác thực tế cùng giáo viên bản ngữ và trợ lý AI hỗ trợ học tập.',
              )}
            </p>
            <div className="social-links">
              <Link aria-label={t('Cộng đồng ChitChatGo')} to={ROUTES.COMMUNITY}>
                <Icon name="globe" size={18} />
              </Link>
              <a href="/#courses" aria-label={t('Khóa học tiếng Anh')}>
                <Icon name="book" size={18} />
              </a>
              <Link to={ROUTES.AI_ASSISTANT} aria-label={t('Luyện tiếng Anh cùng trợ lý AI')}>
                <Icon name="headset" size={18} />
              </Link>
            </div>
          </div>
          <div className="footer-column">
            <h3>{t('Khóa học Tiếng Anh')}</h3>
            {courses.map(course => (
              <Link key={course.name} to={`/?q=${encodeURIComponent(course.query)}#courses`}>
                {t(course.name)}
              </Link>
            ))}
          </div>
          <div className="footer-column">
            <h3>{t('Nền tảng')}</h3>
            <a href="/#benefits">{t('Về chúng tôi')}</a>
            <Link to={ROUTES.AI_ASSISTANT}>{t('Trợ lý AI')}</Link>
            <button onClick={() => setInfo('Kiểm tra trình độ')}>{t('Kiểm tra trình độ')}</button>
            <Link to={ROUTES.COMMUNITY}>{t('Cộng đồng học viên')}</Link>
            <Link to={ROUTES.LEADERBOARD}>{t('Bảng xếp hạng')}</Link>
            <button onClick={() => setInfo('Contact Support')}>{t('Hỗ trợ học viên')}</button>
          </div>
          <div className="footer-column">
            <h3>{t('Thanh toán & Bảo mật')}</h3>
            <p>{t('Hỗ trợ thanh toán qua cổng VNPay & thẻ quốc tế.')}</p>
            <div className="payment-methods">
              <span>VNPAY-QR</span>
              <span>VISA</span>
              <span>MasterCard</span>
            </div>
            {footerPolicies.map(item => (
              <button key={item.topic} onClick={() => setInfo(item.topic)}>
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 ChitChatGo. All rights reserved.</span>
          <div>
            {bottomPolicies.map(item => (
              <button key={item.topic} onClick={() => setInfo(item.topic)}>
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PolicyDialog topic={info} onClose={() => setInfo(null)} />
    </footer>
  );
}
