import { Link } from 'react-router-dom';
import { useState } from 'react';
import Brand from './Brand';
import Icon from './Icon';
import PolicyDialog from './PolicyDialog';

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
  { name: 'Phát âm chuẩn IPA Mỹ', query: 'Phát âm chuẩn Mỹ' },
  { name: 'Tiếng Anh Thương mại', query: 'Tiếng Anh Thương mại' },
];

export default function SiteFooter() {
  const [info, setInfo] = useState(null);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <Brand />
            <p>
              Nền tảng đào tạo Tiếng Anh chuẩn quốc tế thế hệ mới. Lộ trình phản xạ khoa học, tương tác thực
              tế cùng giáo viên bản ngữ và gia sư AI chấm phát âm 24/7.
            </p>
            <div className="social-links">
              <button
                aria-label="Cộng đồng SGEdu English"
                onClick={() => setInfo('Cộng đồng học viên')}
              >
                <Icon name="globe" size={18} />
              </button>
              <a href="/#courses" aria-label="Khóa học tiếng Anh">
                <Icon name="book" size={18} />
              </a>
              <a href="/#ai-tutor" aria-label="Luyện tiếng Anh cùng trợ lý AI">
                <Icon name="headset" size={18} />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h3>Khóa học Tiếng Anh</h3>
            {courses.map(course => (
              <Link key={course.name} to={`/?q=${encodeURIComponent(course.query)}#courses`}>
                {course.name}
              </Link>
            ))}
          </div>
          <div className="footer-column">
            <h3>Nền tảng</h3>
            <a href="/#benefits">Về chúng tôi</a>
            <a href="/#ai-tutor">Trợ lý AI Speaking</a>
            <button onClick={() => setInfo('Kiểm tra trình độ')}>Kiểm tra trình độ</button>
            <button onClick={() => setInfo('Cộng đồng học viên')}>Cộng đồng học viên</button>
            <button onClick={() => setInfo('Contact Support')}>Hỗ trợ học viên</button>
          </div>
          <div className="footer-column">
            <h3>Thanh toán & Bảo mật</h3>
            <p>Hỗ trợ thanh toán qua cổng VNPay & thẻ quốc tế.</p>
            <div className="payment-methods">
              <span>VNPAY-QR</span>
              <span>VISA</span>
              <span>MasterCard</span>
            </div>
            {footerPolicies.map(item => (
              <button key={item.topic} onClick={() => setInfo(item.topic)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 SGEdu English. All rights reserved.</span>
          <div>
            {bottomPolicies.map(item => (
              <button key={item.topic} onClick={() => setInfo(item.topic)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PolicyDialog topic={info} onClose={() => setInfo(null)} />
    </footer>
  );
}
