# ChitChatGo

Tên ứng dụng hiện tại là **ChitChatGo**. Logo chữ dùng `ChitChat` và phần nhấn xanh `Go`; tên hiển thị không thêm hậu tố English. Nội dung Việt–Anh, tiêu đề trình duyệt, metadata, trang quản trị, tài liệu, hình SVG minh họa, email đặt lại mật khẩu và tiêu đề OpenAPI đều dùng thương hiệu này.

Menu avatar dùng icon Material UI cho hồ sơ, quản trị (khi có quyền), thành tích, cửa hàng/kho đồ, Pro, xếp hạng, diễn đàn và đăng xuất. Header desktop dùng chữ điều hướng 16px, bộ chọn ngôn ngữ 14px và số dư/chuỗi 16px.

Header luôn hiển thị **Khóa học**, **Danh mục**, **Lợi ích**, **Trang chủ**, **Tiện ích khác**. Khi thiếu chiều ngang, các mục xuống hàng; không dùng nút ba gạch để ẩn điều hướng. Dropdown **Tiện ích khác** có icon, gồm diễn đàn, bảng xếp hạng, cửa hàng; sau đăng nhập có thêm khóa của tôi, thanh toán và trợ lý AI. Các trang yêu cầu đăng nhập vẫn dùng route guard hiện có. Dropdown hỗ trợ bàn phím, Escape, nhấn ngoài để đóng và đánh dấu trang hiện tại.

Header không còn nút **Bắt đầu miễn phí**; logo vẫn dẫn về trang chính. Nút **Mở khóa PRO** có icon vương miện, nền gradient xanh–tím và chỉ hiện sau đăng nhập; trên thiết bị nhỏ dùng nút vương miện gọn. Nút dẫn đến `/pro` để chọn gói và thanh toán; khi đã kích hoạt, đổi thành **Pro của bạn**. Người chưa đăng nhập vẫn thấy nút **Đăng nhập**, kể cả trên điện thoại. Xem [PRO.md](../learning/PRO.md).

Bộ chọn ngôn ngữ dùng menu Material UI đồng bộ với header, có cờ Việt/Anh và dấu chọn ngôn ngữ hiện tại. Menu mở dưới nút, căn phải, hỗ trợ bàn phím/Escape và tự đóng sau khi chọn. Không dùng danh sách `<select>` mặc định của hệ điều hành; lựa chọn vẫn lưu bằng cơ chế `sgedu.locale` hiện có.

## Tương thích với hệ thống đã chạy

Một số chuỗi tên cũ là định danh kỹ thuật có dữ liệu hoặc cấu hình phụ thuộc, được giữ ổn định:

- JWT issuer `sgedu` trên cả sáu dịch vụ và các kiểm thử hợp đồng xác thực.
- Khóa lưu phiên `sgedu.accessToken`, tùy chọn `sgedu.locale` và tên sự kiện nội bộ hiện có.
- Compose project mặc định `sgsphere-production`, namespace image registry mặc định, các ví dụ triển khai tương ứng. Giữ các giá trị này tránh tạo stack/volume mới khi nâng cấp. Môi trường mới có thể đặt `--project` và `IMAGE_REGISTRY` theo cấu hình triển khai riêng.
- Các giá trị băm định danh dữ liệu seed cũ để việc chạy lại seed không tạo bản ghi trùng.

Các chuỗi này không phải tên thương hiệu hiển thị. Thay đổi chúng cần kế hoạch chuyển phiên hoặc tài nguyên triển khai riêng. Không sửa `.env` thực tế và không sửa các migration đã áp dụng. V8 chỉ đổi tiêu đề thông báo hệ thống mẫu có đúng nội dung gốc; nội dung do người học hoặc quản trị viết được giữ nguyên.

## Kiểm chứng lần đổi thương hiệu

- `mvn -f backend/pom.xml verify`: 327 kiểm thử đạt, gồm email đặt lại mật khẩu với tiêu đề mới và các hợp đồng JWT hiện có.
- `npm test`: 177/177 kiểm thử frontend đạt.
- `npm run lint` và `npm run build`: đạt; build còn cảnh báo kích thước một số bundle trên 500 kB.
- Chrome: 26 tổ hợp viewport/ngôn ngữ/trạng thái đăng nhập từ 360 đến 1920px, không tràn ngang hoặc chồng điều hướng lên dàn icon. Menu học viên có 6 mục đều có icon; Việt–Anh và tiêu đề trình duyệt đúng tên mới. Không có lỗi JavaScript trong các luồng đã chạy.
- Docker Auth/Learning hoạt động healthy. MySQL áp dụng V8 thành công và thông báo hệ thống mẫu đã mang tên ChitChatGo. Hai tài khoản QA riêng đã được vô hiệu hóa và hồ sơ QA đã được dọn.

## Kiểm chứng header luôn hiển thị (16/11/2026)

- Chrome: 48 tổ hợp từ 360 đến 1920px, Việt–Anh, khách và tài khoản đăng nhập. Cả 5 mục chính luôn nhìn thấy; không có nút ba gạch, tràn ngang hoặc chồng mục điều hướng lên nhau/cụm icon.
- Dropdown đăng nhập có 6 mục kèm icon. Đánh dấu đúng trang đang mở; chọn mục chuyển trang và đóng menu. Enter mở menu, Escape đóng và trả focus về nút, nhấn ngoài đóng menu. Không có lỗi JavaScript trong luồng kiểm tra.
- Dropdown ngôn ngữ mới đã kiểm tra trên Chrome: cờ/dấu chọn đúng, phím mũi tên và Enter đổi ngôn ngữ, Escape trả focus về nút; lưu lựa chọn Việt–Anh, menu trên điện thoại nằm trong viewport. Kiểm tra lại 48 tổ hợp header sau thay đổi này đều đạt.
- 20 kiểm thử frontend liên quan đến header, dropdown ngôn ngữ, diễn đàn/cửa hàng và Pro đều đạt sau cập nhật. Test SSR bỏ qua CSS do Emotion chèn khi đọc nhãn; môi trường JSDOM có `Node` để kiểm tra điều hướng focus của menu Material UI.
- Lint và production build đạt; build giữ cảnh báo kích thước bundle trên 500 kB. Kiểm chứng backend/Pro được ghi riêng tại [PRO.md](../learning/PRO.md).
