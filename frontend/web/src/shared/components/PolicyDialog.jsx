import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import Icon from './Icon';

const content = {
  'Privacy Policy':
    'SGEdu tôn trọng quyền riêng tư của bạn. Chính sách chi tiết về việc thu thập, sử dụng và bảo vệ dữ liệu sẽ được công bố khi nền tảng chính thức hoạt động.',
  'Terms of Service':
    'Nội dung học tập dành cho mục đích học tập cá nhân. Vui lòng tôn trọng bản quyền nội dung và các thành viên trong cộng đồng. Điều khoản dịch vụ đầy đủ sẽ được công bố trước khi nền tảng chính thức hoạt động.',
  Security:
    'Không chia sẻ mật khẩu hay thông tin thanh toán trong các cuộc trò chuyện. Hãy sử dụng mật khẩu riêng cho tài khoản của bạn.',
  'Cookie Preferences': 'Giao diện hiện tại không sử dụng cookie quảng cáo hoặc theo dõi hành vi.',
  'Contact Support':
    'Kênh hỗ trợ tài khoản và khóa học đang được chuẩn bị. Vui lòng quay lại khi nền tảng chính thức hoạt động.',
  'Cộng đồng học viên':
    'Cộng đồng SGEdu English là nơi tìm bạn luyện nói, chia sẻ kinh nghiệm học IELTS, TOEIC và cùng thực hành tiếng Anh mỗi ngày. Tính năng này đang được xây dựng.',
  'Cam kết đầu ra':
    'Mỗi lộ trình có mục tiêu kỹ năng và trình độ rõ ràng. Hãy xem nội dung khóa học để chọn lộ trình phù hợp với nền tảng và thời gian luyện tập của bạn. Thông tin chi tiết về điều kiện cam kết sẽ được công bố khi khóa học chính thức mở đăng ký.',
  'Kiểm tra trình độ':
    'Bài kiểm tra trình độ tiếng Anh đang được chuẩn bị. Trong thời gian chờ, bạn có thể khám phá các lộ trình IELTS, TOEIC, giao tiếp và phát âm trong danh mục khóa học.',
};

export default function PolicyDialog({ topic, onClose }) {
  return (
    <Dialog
      open={Boolean(topic)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="policy-dialog-title"
    >
      <DialogTitle id="policy-dialog-title" className="dialog-heading">
        {topic}
        <button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}>
          <Icon name="close" />
        </button>
      </DialogTitle>
      <DialogContent>
        <p>{content[topic]}</p>
      </DialogContent>
    </Dialog>
  );
}
