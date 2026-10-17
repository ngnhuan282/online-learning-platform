# Kiểm tra runtime sau merge — 17/10/2026

Đã kiểm tra `main` tại `4fcb79a`, sửa các lỗi merge và khởi động lại backend bằng image mới.
Trong phạm vi kiểm tra, cả sáu service và MySQL đều healthy, không restart/OOM,
không có exception JavaScript hoặc HTTP 5xx khi duyệt 42 lượt trang bằng Chrome.

| Vị trí | Lỗi tìm thấy | Cách sửa |
| --- | --- | --- |
| `AdminCoursePage.jsx` | Callback ghép sai cú pháp, thiếu tham số `options` | Khôi phục callback ổn định và hỗ trợ hủy request |
| `CourseDetailPage.jsx` | Import trùng; thiếu defaults, state ghi danh và đích checkout; ghi danh dùng thông báo chặn thay vì điều hướng | Khôi phục state theo user/course, chờ khôi phục phiên, ghi danh rồi mở trang học, chuyển khóa trả phí tới checkout hiện có |
| `LearningPage.jsx` | Hai component mặc định và hai đoạn JSX bị ghép lẫn; nhiều biến không tồn tại | Hợp nhất trang, giữ giao diện và tải curriculum/progress qua API Learning có kiểm tra quyền; giữ chức năng phát bài học và quiz |
| `PaymentResultPage.jsx` | Trùng `paymentStatus`, thiếu state; tự gọi ghi danh khóa trả phí từ frontend | Dùng trạng thái backend; giữ kiểm tra quyền học của MOCK và cơ chế kích hoạt VNPay hiện có |
| Course Service | `ReviewService` thiếu dependency `access`; kiểm tra ghi danh không chuyển tiếp JWT | Tái sử dụng `CourseContentAccess`; chuyển tiếp Bearer token khi lấy quyền phát bài học |
| Media download | URL curriculum/upload dùng `signature` bị kiểm tra như URL mới dùng `token` | Hỗ trợ cả hai dạng chữ ký; giữ kiểm tra quyền khi thiếu/sai chữ ký |
| Payment Service | Thiếu import/dependency; client Course trùng gọi phương thức không tồn tại | Dùng `CourseSnapshotProvider` hiện có, khôi phục `PaymentProviderPolicy`, bỏ client trùng không có caller |
| Cấu hình Payment | Compose bỏ mất `PAYMENT_MOCK_ENABLED`; API luôn báo MOCK khả dụng | Truyền lại biến với mặc định `false`, trả trạng thái phương thức theo cấu hình thực tế |
| Test sau merge | Một số JWT vẫn dùng issuer cũ; profile test chưa bật MOCK cho các ca mô phỏng | Đồng bộ issuer `sgedu`; chỉ bật MOCK trong profile test; giữ các assertion nghiệp vụ và kiểm tra quyền |

## Migration và dữ liệu

V7 Course mới merge có `DELETE` trên toàn bộ reviews, resources, lessons, sections,
courses và categories, sau đó đặt lại ID và nạp dữ liệu mẫu. Điều này sẽ làm mất dữ liệu
và phá các tham chiếu khóa học từ Learning/Payment khi khởi động bản mới.

Đã truy vấn Flyway trên MySQL và xác nhận Course mới ở V6, chưa áp dụng V7 cũ.
Vì vậy, V7 được chuyển thành migration không thay đổi dữ liệu; việc nạp demo vẫn
là thao tác chủ động qua `infra/mysql/seed-data.sql`. Không sửa migration đã áp dụng,
không chạy `repair`, không xóa volume hoặc dữ liệu.

Sau nâng cấp, Flyway ghi nhận Auth V9, Course V7, Learning V4 và Payment V3 thành công.
Số lượng user, khóa học, ghi danh, tiến độ, đơn hàng và giao dịch không đổi.
Checksum cả sáu bảng Course cũng giữ nguyên sau khởi động và kiểm tra trình duyệt.

Nếu database khác đã áp dụng **bản V7 cũ**, cần đối chiếu lịch sử/checksum và bản sao lưu
trước khi áp dụng thay đổi này. Không tự động repair hoặc chạy lại script xóa/nạp demo.

## Kết quả xác minh

| Kiểm tra | Kết quả |
| --- | --- |
| Backend Maven reactor `clean verify` và kiểm tra Course sau sửa V7 | 267 test: 266 đạt, 1 test Google tùy chọn bỏ qua |
| Frontend `npm run lint`, `npm test`, `npm run build` | Đạt; 112/112 test |
| Docker build | Sáu backend và image frontend/Nginx build thành công |
| Docker `up --wait` | Sáu backend và MySQL healthy; restart = 0, không OOM |
| Nginx `nginx -t` | Đạt |
| Compose local/staging `config -q` | Đạt; staging chỉ kiểm tra cấu hình, không triển khai HTTPS |
| Gateway readiness/liveness | HTTP 200; API công khai 200, API bảo vệ trả 401 khi thiếu token |
| Chrome production | 30 lượt trang ADMIN/khách và 12 lượt trang USER, gồm trang học và quiz; 0 exception, 0 HTTP 5xx |
| Dữ liệu MySQL | Giữ nguyên số dòng nghiệp vụ và checksum các bảng Course |

Đã thêm test hồi quy cho JWT chuyển tiếp tới Learning, hai dạng URL media và nâng cấp
V6 → V7 với khóa học có sẵn. Không gọi Gmail/Google OAuth hoặc thực hiện giao dịch VNPay thật
trong lần kiểm tra runtime này. Build frontend còn cảnh báo kích thước bundle trên 500 kB;
cảnh báo này không làm build thất bại.

Các backend được giữ chạy trên bản sửa. Container Nginx dùng riêng cho kiểm tra đã được
dọn để trả lại cổng 5173 cho Vite. `.env` và các credentials được giữ nguyên; chưa tạo commit.
