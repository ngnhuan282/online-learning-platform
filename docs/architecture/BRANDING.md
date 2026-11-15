# ChitChatGo

Tên ứng dụng hiện tại là **ChitChatGo**. Logo chữ dùng `ChitChat` và phần nhấn xanh `Go`; tên hiển thị không thêm hậu tố English. Nội dung Việt–Anh, tiêu đề trình duyệt, metadata, trang quản trị, tài liệu, hình SVG minh họa, email đặt lại mật khẩu và tiêu đề OpenAPI đều dùng thương hiệu này.

Menu avatar dùng icon Material UI cho hồ sơ, quản trị (khi có quyền), thành tích, cửa hàng/kho đồ, xếp hạng, diễn đàn và đăng xuất. Header desktop dùng chữ điều hướng 16px, bộ chọn ngôn ngữ 14px và số dư/chuỗi 16px; chuyển menu thu gọn khi không đủ chiều ngang.

## Tương thích với hệ thống đã chạy

Một số chuỗi tên cũ là định danh kỹ thuật có dữ liệu hoặc cấu hình phụ thuộc, được giữ ổn định:

- JWT issuer `sgedu` trên cả sáu dịch vụ và các kiểm thử hợp đồng xác thực.
- Khóa lưu phiên `sgedu.accessToken`, tùy chọn `sgedu.locale` và tên sự kiện nội bộ hiện có.
- Compose project mặc định `sgsphere-production`, namespace image registry mặc định, các ví dụ triển khai tương ứng. Giữ các giá trị này tránh tạo stack/volume mới khi nâng cấp. Môi trường mới có thể đặt `--project` và `IMAGE_REGISTRY` theo cấu hình triển khai riêng.
- Các giá trị băm định danh dữ liệu seed cũ để việc chạy lại seed không tạo bản ghi trùng.

Các chuỗi này không phải tên thương hiệu hiển thị. Thay đổi chúng cần kế hoạch chuyển phiên hoặc tài nguyên triển khai riêng. Không sửa `.env` thực tế và không sửa các migration đã áp dụng. V8 chỉ đổi tiêu đề thông báo hệ thống mẫu có đúng nội dung gốc; nội dung do người học hoặc quản trị viết được giữ nguyên.

## Kiểm chứng

- `mvn -f backend/pom.xml verify`: 327 kiểm thử đạt, gồm email đặt lại mật khẩu với tiêu đề mới và các hợp đồng JWT hiện có.
- `npm test`: 177/177 kiểm thử frontend đạt.
- `npm run lint` và `npm run build`: đạt; build còn cảnh báo kích thước một số bundle trên 500 kB.
- Chrome: 26 tổ hợp viewport/ngôn ngữ/trạng thái đăng nhập từ 360 đến 1920px, không tràn ngang hoặc chồng điều hướng lên dàn icon. Menu học viên có 6 mục đều có icon; Việt–Anh và tiêu đề trình duyệt đúng tên mới. Không có lỗi JavaScript trong các luồng đã chạy.
- Docker Auth/Learning hoạt động healthy. MySQL áp dụng V8 thành công và thông báo hệ thống mẫu đã mang tên ChitChatGo. Hai tài khoản QA riêng đã được vô hiệu hóa và hồ sơ QA đã được dọn.
