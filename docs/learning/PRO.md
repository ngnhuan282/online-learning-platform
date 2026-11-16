# Gói ChitChatGo Pro

Truy cập `/pro` sau khi đăng nhập hoặc nhấn **Mở khóa PRO** trên header. Khi đã kích hoạt, header đổi thành **Pro của bạn**. Trang hồ sơ hiển thị trạng thái và hạn Pro theo giờ Việt Nam.

## Gói và quyền lợi

| Mã | Thời hạn | Giá đã chốt |
| --- | --- | ---: |
| `PRO_MONTH` | 1 tháng | 50.000đ |
| `PRO_QUARTER` | 3 tháng | 120.000đ |
| `PRO_YEAR` | 1 năm | 499.000đ |

Giá lấy từ bảng `payment_db.pro_plans`, không nhận giá hoặc user ID do client tự khai. Mỗi đơn chụp lại mã gói, thời hạn và số tiền tại thời điểm tạo. Giá tham chiếu khi chọn nhiều tháng được tính từ giá gói một tháng, không phải chương trình giảm giá có thời hạn. Chưa có gói trọn đời trong danh mục.

**Miễn phí:** học các khóa miễn phí đã công bố, quiz của các khóa được phép học, tiến độ, XP/streak/phần thưởng, cửa hàng, diễn đàn và bảng xếp hạng.

**Pro:** toàn bộ quyền miễn phí và quyền học tất cả khóa trả phí đang công bố trong thời hạn gói, gồm bài học, quiz và tài liệu thuộc các khóa đó. Chọn **Học bằng Pro** tại chi tiết khóa để ghi danh. Các khóa đã mua riêng và khóa miễn phí giữ quyền truy cập độc lập với Pro.

Quyền Pro được kiểm tra ở Learning Service trên mỗi lần truy cập, không dựa vào nhãn ở frontend hoặc claim tự khai trong JWT. Course Service tiếp tục dùng kiểm tra ghi danh của Learning để cấp quyền media/tài liệu. Quiz cũng kiểm tra quyền Pro còn hạn.

Những chức năng chưa có trong project như tạo bài học từ YouTube, từ vựng/SRS và chấm phát âm không được quảng cáo thành quyền lợi của gói này. Trang không tạo số liệu học viên, lượt học hoặc đồng hồ sale giả.

## Thanh toán và gia hạn

1. Chọn thời hạn và một phương thức đang khả dụng.
2. Xác nhận gói/số tiền, sau đó đi tiếp qua luồng thanh toán hiện có.
3. Khi thanh toán thành công được server xác nhận, Payment gửi yêu cầu cấp Pro sang Learning bằng thông tin đơn và credential nội bộ.
4. Trang kết quả hiển thị giao dịch Pro, có nút xem thành viên. Với VNPay, kết quả trình duyệt không tự cấp quyền; IPN hợp lệ mới xác nhận thanh toán. Quyền đang chờ đồng bộ dùng cơ chế retry hiện có.

MOCK chỉ khả dụng khi bật `PAYMENT_MOCK_ENABLED` để kiểm thử và không phát sinh giao dịch tiền thật. VNPay dùng cấu hình tích hợp hiện có. Các đơn Pro xuất hiện trong lịch sử thanh toán, báo cáo và trang chi tiết quản trị cùng hệ thống đơn hiện tại, được phân loại `productType: PRO`.

Mỗi lần mua có `idempotencyKey`. Gọi lại cùng khóa/người dùng trả lại cùng đơn. Đổi gói hoặc đổi sản phẩm khi dùng lại khóa cũ bị từ chối. Learning lưu một grant duy nhất cho mỗi mã đơn; callback hoặc lần thử lại không cộng thêm thời hạn lần nữa.

Gia hạn cộng vào hạn hiện tại nếu còn hiệu lực; nếu đã hết hạn, bắt đầu từ thời điểm kích hoạt. Tháng được tính theo lịch `Asia/Ho_Chi_Minh`, giữ giờ kích hoạt và làm tròn ngày về cuối tháng khi cần (ví dụ 31/1 cộng một tháng thành 28/2 trong năm không nhuận). Đây là thanh toán một lần cho mỗi gói, không tự động trừ tiền định kỳ.

Hoàn tiền đơn MOCK qua quản trị thu hồi grant của đúng đơn đó và tính lại hạn từ các grant còn lại. Không thu hồi gói/mã khác của người học và không thay đổi quyền của khóa đã mua riêng. VNPay vẫn giữ quy tắc quản trị hiện có: không sửa trạng thái hoặc mô phỏng hoàn tiền bằng giao diện MOCK.

## Hết hạn

Ghi danh phát sinh qua Pro có `access_source = PRO`. Khi hết hạn, server chặn nội dung, media và quiz của các ghi danh này; tiến độ không bị xóa. Sau khi gia hạn có thể tiếp tục từ tiến độ cũ. Nếu mua riêng một khóa đang ghi danh qua Pro, quyền của khóa được chuyển thành quyền mua riêng và không còn phụ thuộc vào Pro.

## Mã kích hoạt

ADMIN vào `/admin/pro-codes` để tạo mã 1/3/12 tháng, đặt hạn sử dụng tùy chọn và xem 100 mã gần nhất. Mỗi mã dùng một lần cho một tài khoản; nhập lại bởi đúng tài khoản đó không cộng thời gian thêm.

- Mã được tạo bằng `SecureRandom` 128 bit. Database chỉ lưu SHA-256 và bốn ký tự cuối.
- Mã đầy đủ chỉ được trả khi tạo và hiển thị một lần; tải lại trang chỉ thấy bản che. Nếu mất mã đầy đủ, thu hồi mã chưa dùng và tạo mã mới.
- Có thể thu hồi mã chưa dùng. Mã đã dùng, hết hạn hoặc thu hồi không thể chuyển sang tài khoản khác.
- Tối đa 6 lần thử kích hoạt mỗi tài khoản trong 15 phút. Giới hạn lưu trong database và không bị mất khi request sai mã rollback.
- Request/response chứa mã ghi đè `toString()` để tránh in mã thô vào log xử lý của Spring.

## API

Các API trình duyệt yêu cầu JWT và đi qua Gateway, lấy người dùng từ principal.

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/api/v1/payments/pro/plans` | Danh mục gói và giá server |
| POST | `/api/v1/payments/pro/checkout` | `planCode`, `provider`, `idempotencyKey`, `returnUrl`, `cancelUrl` |
| GET | `/api/v1/learning/pro/me` | `active`, `expiresAt`, `planCode`, `serverTime` |
| POST | `/api/v1/learning/pro/redeem` | `{ "code": "CCG-..." }` |
| GET / POST | `/api/v1/learning/admin/pro/codes` | ADMIN xem bản che hoặc tạo mã |
| DELETE | `/api/v1/learning/admin/pro/codes/{id}` | ADMIN thu hồi mã chưa sử dụng |

API nội bộ `/internal/v1/learning/pro/grants` và `/internal/v1/learning/pro/revocations` dùng `X-Internal-Service-Token` hiện có. JWT người dùng hoặc quyền ADMIN không thay thế credential này. Gateway không mở route nội bộ ra trình duyệt.

Các mã lỗi đáng chú ý: `INVALID_ACTIVATION_CODE` (400), `ACTIVATION_RATE_LIMITED` (429), `PRO_REQUIRED`/`FORBIDDEN` (403), `CONFLICT` (409). Không trả thông tin ai đã dùng một mã không hợp lệ cho người thử mã.

## Migration và chạy local

- Payment **V4**: danh mục gói, phân loại sản phẩm/ảnh chụp thời hạn trên đơn, cho phép dòng sản phẩm Pro không có `courseId`.
- Learning **V9**: thành viên, ledger cấp/thu hồi, mã kích hoạt, giới hạn thử mã và nguồn quyền trên ghi danh.
- Không sửa migration đã áp dụng, không truy cập chéo database giữa các business service.

```powershell
docker compose --profile backend up --build -d learning-service payment-service
cd frontend/web
npm run dev
```

## Kiểm thử

Backend kiểm tra giá/snapshot từ server, khóa tạo đơn chống trùng, callback VNPay có chữ ký và đúng số tiền, retry kích hoạt, gia hạn theo lịch, grant/callback trùng, hoàn tiền, mã một lần, phân quyền quản trị, hết hạn mã/Pro và giữ quyền mua riêng. Frontend kiểm tra giá ba kỳ, đổi ngôn ngữ, thử lại cùng khóa giao dịch, kích hoạt mã, quản trị chỉ hiển thị mã đầy đủ một lần và kết quả thanh toán Pro.

Kết quả kiểm tra ngày 16/11/2026:

- Toàn bộ backend: **339 test đạt**, không có lỗi; frontend: **185 test đạt**. Lint và production build đạt. Build còn cảnh báo kích thước bundle trên 500 kB.
- Trình duyệt với MySQL thật: chọn gói tháng, thanh toán MOCK, cập nhật header/thành viên, mở bài học và quiz trả phí; callback lặp không cộng hạn thêm.
- Quản trị tạo mã 3 tháng, chỉ hiển thị mã đầy đủ khi phát hành; người học kích hoạt và gia hạn. Dùng lại cùng mã không cộng thêm, tài khoản khác bị từ chối.
- Hoàn tiền chỉ thu hồi thời hạn của đúng đơn; mã đã kích hoạt vẫn có hiệu lực. Pro hết hạn chặn bài học, quiz và media; mua riêng khóa học khôi phục truy cập và giữ tiến độ.
- Kiểm tra giao diện Việt/Anh từ 360 đến 1920 px, không tràn ngang và không có lỗi JavaScript trong luồng kiểm thử.

Trong lần kiểm tra này, Docker build gặp gián đoạn tải dependency từ Maven Central. Dịch vụ local được chạy bằng JAR đã build và kiểm thử, đóng gói vào runtime image hiện có. Learning V9 và Payment V4 đã áp dụng thành công trên MySQL. Thanh toán MOCK chỉ bật tạm trong QA rồi khôi phục về `false`; không sửa `.env` và không thực hiện giao dịch tiền thật. VNPay được kiểm tra bằng IPN có chữ ký trong integration test, chưa giao dịch với ngân hàng thật.
