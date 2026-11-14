# Báo cáo chuẩn bị production — 15/11/2026

Đã hoàn thiện các phần thiếu được xác định khi rà soát bản merge và chuẩn bị cấu hình
production có thể chuyển giữa VPS/VM cloud. Chưa triển khai lên Internet. Cách cấu hình,
vận hành và nghiệm thu trên môi trường thật nằm trong
[PRODUCTION.md](../deployment/PRODUCTION.md).

## Thay đổi chức năng

- Hồ sơ: lưu avatar URL, số điện thoại, ngày sinh và giới thiệu; kiểm tra dữ liệu tại backend.
  Request cũ chỉ cập nhật họ tên vẫn dùng được; endpoint hồ sơ không cấp quyền đổi role/email.
- Ghi nhớ đăng nhập: refresh cookie HttpOnly có thời hạn khi người dùng chọn ghi nhớ;
  rotation giữ lựa chọn này, logout thu hồi phiên. Access token tiếp tục ở session storage.
- Khởi tạo admin: cấu hình opt-in, chỉ tạo khi chưa có ADMIN; không nâng quyền tài khoản
  email đã tồn tại hoặc đặt lại mật khẩu admin cũ. Không cần seed tài khoản demo.
- Catalog: tìm kiếm/lọc/sắp xếp/phân trang tại database; thêm khoảng giá, đánh giá và
  miễn phí/trả phí. Giao diện tải từng trang và đồng bộ URL/back navigation.
- Quản trị: ẩn/bật lại danh mục; xóa khóa học chuyển sang ARCHIVED, giữ enrollment và
  tiến độ. Học viên đã ghi danh vẫn học được; khóa không còn được bán qua catalog.
  Admin đọc được metadata khóa nháp bằng endpoint riêng.
- VNPay: hỗ trợ redirect tới URL production được cho phép chính xác, yêu cầu HTTPS
  cho callback khi dùng URL live; tiếp tục kiểm tra chữ ký/idempotency tại backend.
- AI: hạn mức theo người dùng/ngày UTC lưu tại MySQL, dùng chung giữa hội thoại/replica;
  request trả từ cache idempotency không trừ thêm lượt, có xử lý tranh chấp đồng thời.
- Giữ các sửa lỗi sau merge ở Learning/Quiz, lọc quiz theo khóa học và quyền MySQL của AI.

## Hạ tầng và mã tái sử dụng

Tạo `compose.production.yaml`, `.env.production.example`, cấu hình Nginx/TLS mẫu và
script `infra/scripts/production*.mjs`. Tiếp tục dùng Compose gốc, các service hiện có,
Flyway, JWT/refresh, AuthContext và Axios dùng chung; không thêm hệ thống xác thực khác.

Production overlay đặt MySQL/Gateway trong mạng nội bộ, web bind loopback, cookie Secure,
tắt MOCK/Swagger, giới hạn tài nguyên và filesystem của backend. Nginx có CSP/HSTS,
rate limit đăng nhập và chỉ tin IP từ proxy được chỉ định. Đã sửa Gateway để xử lý địa chỉ
IP unresolved khi bật forwarded headers, và Nginx phân giải lại DNS khi Gateway thay container.

CLI có preflight không in giá trị secret, build tuần tự, chờ health, sao lưu nén năm schema
kèm SHA256 và restore có xác nhận đúng project. Kiểm tra checksum diễn ra trước khi dừng
service; import lỗi giữ ứng dụng dừng. Workflow integration đã thêm kiểm thử production
overlay và backup/restore trên project riêng; chưa có kết quả chạy GitHub Actions cho diff này.

## Migration và API

| Service | Migration mới | Nội dung |
| --- | --- | --- |
| Auth | V10, V11 | Thông tin hồ sơ; cờ phiên ghi nhớ |
| Course | V8 | Trạng thái hiển thị danh mục |
| AI | V3 | Bảng hạn mức theo ngày |

Các migration chỉ bổ sung schema. Không sửa migration đã áp dụng, reset dữ liệu hay Flyway repair.

- `PUT /api/v1/users/me`: thêm `avatarUrl`, `phone`, `dateOfBirth`, `biography`.
- `POST /api/v1/auth/login`: thêm `rememberMe` tùy chọn; mặc định session cookie.
- `GET /api/v1/courses`: thêm `minPrice`, `maxPrice`, `minRating`, `pricing`;
  giữ các tham số phân trang/tìm kiếm trước đây.
- `GET /api/v1/admin/categories` và `GET /api/v1/admin/courses/{id}`: endpoint quản trị mới.
- DELETE danh mục/khóa học giữ nguyên đường dẫn, đổi sang ẩn/lưu trữ; category response
  có `active`, cập nhật danh mục cho phép bật lại. Đã cập nhật giao diện và kiểm thử tương ứng.

## Kết quả kiểm chứng

| Hạng mục | Kết quả |
| --- | --- |
| Backend verify | 317 ca: 316 đạt, 1 bỏ qua do thiếu `GOOGLE_BUSINESS_GATEWAY_URL`; không lỗi |
| Chi tiết backend | Auth 91, Course 82, Learning 51, Payment 50, AI 28, Gateway 15 |
| Frontend toàn bộ | 168/168 đạt |
| Frontend sau chỉnh sửa cuối về phiên/tìm kiếm | 41/41 hồi quy đạt; lint và production build đạt |
| MySQL thật | AI 14/14 gồm quota đồng thời/replay; VNPay 17/17 gồm callback/giao dịch |
| Preflight production | 4/4 ca kiểm thử cấu hình đạt |
| Production overlay | Tám container healthy trên project test riêng; API smoke đạt |
| Nâng cấp stack local hiện có | Bảy container healthy, Gateway readiness UP; số lượng bản ghi 19 bảng nghiệp vụ khớp trước/sau migration |
| Backup/restore | Khôi phục năm schema, số lượng dữ liệu đối chiếu khớp; file sai checksum bị từ chối |
| Chrome qua HTTPS localhost | Hồ sơ lưu lại; Secure/HttpOnly cookie khôi phục phiên; phân trang 12 + 1 và back hoạt động; không lỗi JS/5xx hoặc tràn ngang ở viewport mobile đã kiểm tra |

Toàn bộ frontend chạy trước những chỉnh sửa cuối về phiên/tìm kiếm; nhóm hồi quy 41 ca,
build/lint và kiểm tra Chrome được chạy sau đó. MySQL VNPay dùng callback đã ký với fixture
và Learning stub, không gửi giao dịch tới merchant. HTTPS Chrome dùng certificate tự ký
local được pin riêng cho test, không chứng minh certificate/domain công khai.

Minh chứng local được giữ trong `.tmp/` (Git ignore): `production-auth-final.log`,
`production-backend-final-remaining.log`, `production-gateway-final.log`,
`production-frontend-tests.log`, `production-frontend-final-regression.log`,
`production-ai-mysql.log`, `production-vnpay-mysql.log`, `production-smoke.json`,
`production-backup-smoke.log`, `production-browser/report.json`.

Đã sao lưu stack local trước nâng cấp vào
`.tmp/local-before-production-20261115.sql.gz` kèm manifest checksum. Đã xác nhận phiên bản
schema mới Auth 11, Course 8, AI 3; Learning 4 và Payment 3 giữ nguyên. Dữ liệu local được
giữ lại, không seed/reset. Project test `production-integration` cùng volume test đã được dọn
sau kiểm chứng; bản sao lưu local không nằm trong Git.

## Điều kiện còn cần trước khi mở production

Chọn host/domain, cấu hình HTTPS và trusted proxy thực tế; cung cấp secret riêng,
bucket S3 private và SMTP gửi/nhận được. Nghiệm thu media/reset email trên domain thật.
Nếu bật Google, VNPay hoặc AI, cần cấu hình tài khoản và nghiệm thu với provider tương ứng.
Chưa gọi provider AI thật, gửi mail thật, kiểm tra bucket production hoặc thanh toán tiền thật.
Hoàn tiền tự động chưa được tích hợp; cần quy trình với merchant khi vận hành bán khóa trả phí.

Vite còn cảnh báo chunk lớn hơn 500 kB; build thành công, nên đo tải thực tế để quyết định
tách bundle. Cần cấu hình giám sát, lịch backup/retention và kiểm tra tải theo quy mô deploy.
Các giới hạn tài nguyên hiện tại là cấu hình ban đầu, chưa phải kết quả kiểm thử tải production.
