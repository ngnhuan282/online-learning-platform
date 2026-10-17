# Tích hợp Auth, Course, Learning và Payment

Bản bổ sung A8/A9 ngày 13/10/2026: [báo cáo và hợp đồng](../deployment/A8_A9_REPORT.md),
[checklist có minh chứng](A8_A9_ACCEPTANCE.md). Bản mới kiểm tra Published/enrollment trước
khi cấp private content/media, bật MOCK tường minh, đưa AI sang profile riêng và kiểm tra
core dependencies trong Gateway readiness. Kết quả ngày 11/10 bên dưới là lịch sử kiểm tra trước đó.

Frontend dùng một `AuthProvider`, `/api/v1/users/me` để lấy user hiện tại và một Axios client qua Gateway.
Course miễn phí gọi Learning enrollment; Course trả phí chuyển sang `/checkout?course=<id>`.
Sau thanh toán MOCK thành công, Payment gọi Learning bằng `X-Internal-Service-Token` để tạo enrollment.
Backend từ chối đăng ký trực tiếp khóa trả phí và khóa chưa publish.

## Hợp đồng xác thực

- Các service dùng cùng `JWT_SECRET`, `JWT_ISSUER`, HS256 và `tokenType=access`.
- `role` là claim tương thích cũ: `ADMIN` khi `roles` chứa ADMIN, còn lại là `USER`.
- `roles` chứa toàn bộ role, kể cả role tùy chỉnh. Không tự thêm quyền ADMIN/USER vào role tùy chỉnh.
- `permissions` là danh sách mã quyền; role/permission phải đúng định dạng, tối đa 100 phần tử mỗi claim.
- Token cũ chỉ có `role` vẫn hợp lệ. Claim sai kiểu hoặc `role`/`roles` mâu thuẫn trả 401.
- 401 chỉ refresh một lần qua một request dùng chung. 403 thiếu quyền hiển thị lỗi, giữ phiên đăng nhập.
- Phản hồi thành công hoặc lỗi đến sau logout/đổi tài khoản bị hủy, không cập nhật hay xóa phiên mới.
- Route riêng tư remount khi user ID thay đổi; dữ liệu review/enrollment của Course được gắn với user ID.
- Auth kiểm tra trạng thái tài khoản/quyền quản trị hiện tại trong DB. Course/Learning/Payment kiểm tra
  quyền từ access JWT; thay đổi quyền có hiệu lực ở các service này khi refresh/login lại, hoặc hết TTL
  (mặc định 900 giây). Logout revoke refresh token; access token đã phát còn hợp lệ đến khi hết TTL.

CORS được xử lý tại Gateway trước authentication, gồm cả response lỗi và preflight.
Origin dùng danh sách chính xác phân cách bằng dấu phẩy, không dùng `*` khi gửi cookie.
Frontend local: `VITE_API_URL=http://localhost:8080`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`.

## Chạy staging

Chuẩn bị `.env` từ `.env.example`, đặt các secret và `STAGING_ORIGIN=https://<domain>`.
Compose staging yêu cầu Docker Compose 2.24.4+ và reverse proxy HTTPS trỏ vào
`127.0.0.1:${STAGING_WEB_PORT:-8088}` trên host.

```powershell
docker compose -f compose.yaml -f compose.staging.yaml --profile backend config -q
docker compose -f compose.yaml -f compose.staging.yaml --profile backend up --build -d --wait
```

Web và API dùng cùng origin. Image frontend dùng origin trình duyệt khi `VITE_API_URL` trống.
Nginx hỗ trợ SPA routes, upload tối đa 210 MB và notification SSE không buffering.
Staging không publish cổng MySQL/Gateway; refresh cookie bắt buộc Secure.
Đăng nhập trình duyệt cần HTTPS. Các probe HTTP nội bộ chỉ dùng để kiểm tra health/proxy.

## Health và logging

- `/actuator/health/liveness`: tiến trình còn sống.
- `/actuator/health/readiness`: service sẵn sàng; các business service bao gồm kiểm tra DB.
- `/healthz` trên web: Nginx chạy; kiểm tra `/actuator/health/readiness` qua web để xác nhận API proxy.
- Compose đợi MySQL và service phụ thuộc healthy trước khi start service tiếp theo, theo
  [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).
- MySQL probe dùng TCP để tránh đánh dấu healthy khi temporary server vẫn đang chạy init.
- Log JSON ECS có tên service; `X-Request-ID` đi từ Gateway đến service và các cuộc gọi Course/Payment/Learning.
- Container backend/web giới hạn log 10 MB × 3 file. Không log token, body, query string hay đường dẫn chứa ID.

Cấu hình readiness/liveness dựa trên [Spring Boot Actuator](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html).

```powershell
docker compose --profile backend ps
docker compose --profile backend logs --tail=100 api-gateway learning-service payment-service
curl.exe --fail http://localhost:8080/actuator/health/readiness
```

## Kiểm thử và kiểm tra trước merge

```powershell
mvn -B -ntp -f backend/pom.xml clean verify
cd frontend/web
npm test
npm run build
npm run lint
```

Workflow `.github/workflows/integration.yml` chạy lint với `--max-warnings=0`, test/build frontend,
verify cả sáu backend, sau đó chạy smoke test trên MySQL thật và build staging web.
Các lỗi lint trong Course đã được sửa; giữ nguyên cấu hình và các rule ESLint.

Từ root repo, tạo stack **riêng** để test (tạo user/course và giao dịch MOCK dùng một lần):

```powershell
node infra/scripts/create-integration-env.mjs
docker compose --env-file .tmp/integration.env -p auth-integration --profile backend up --build -d --wait --wait-timeout 300
docker compose --env-file .tmp/integration.env -p auth-integration exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot < /seed/seed-data.sql'
node infra/scripts/integration-smoke.mjs --demo
```

Sau smoke backend, kiểm tra overlay staging trên cùng stack dùng một lần:

```powershell
docker compose --env-file .tmp/integration.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend up --build -d --wait --wait-timeout 300
node infra/scripts/staging-smoke.mjs --demo
docker compose --env-file .tmp/integration.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend down -v
```

Lệnh cuối chỉ dọn project test `auth-integration` và volume dùng một lần của project đó.

Script env sinh secret ngẫu nhiên trong `.tmp` bị Git ignore và từ chối ghi đè file đã có.
Stack riêng dùng MySQL 13306 và Gateway 18080. Không chạy demo seed/smoke trên DB staging đang dùng.
Smoke kiểm tra CORS, JWT, USER/ADMIN, chống giả identity header, đăng ký miễn phí, checkout idempotency,
Payment → Learning, refresh rotation và revoke sau logout. Chỉ dùng provider MOCK, không gọi VNPay thật.

Shell script MySQL phải có LF theo `.gitattributes`; checkout Windows cũ có CRLF có thể làm init dừng
với `bad interpreter`. Nếu init đã dừng, không đổi mật khẩu rồi kỳ vọng Compose cập nhật user trong volume cũ.
Khôi phục init bằng DBA trên đúng DB test hoặc dùng volume test mới; giữ nguyên volume hệ thống đang dùng.

## Migration sau merge

Learning trước đây có hai file V2 gây Flyway không thể start. Giữ V2 notifications và đổi migration Payment
chưa áp dụng trên DB kiểm tra sang `V3__add_payment_enrollment_source.sql`, giữ nguyên SQL.
Course V6 chưa áp dụng thành công trên MySQL do cú pháp `IF NOT EXISTS`; đã dùng `CREATE INDEX` chuẩn.
Course bật `ddl-auto=validate`, bỏ password/JWT secret mặc định để không âm thầm lệch Auth.

Trước khi cập nhật DB từ nhánh khác, kiểm tra `flyway_schema_history` của Learning/Course.
DB đã áp dụng bản Payment V2 hoặc Course V6 với checksum khác cần kế hoạch đối chiếu schema/lịch sử riêng;
không tự `repair`, không đổi migration đã áp dụng trên các DB đó. Fresh DB và DB lịch sử V1 dùng chuỗi
migration hiện tại. Dùng `clean verify` sau đổi tên migration để xóa file V2 cũ còn trong `target/classes`.

## Kết quả kiểm tra ngày 11/10/2026

- Backend: `clean verify` cả sáu service, 163 test pass. Course verify lại sau sửa V6: 55 test pass.
- Frontend: 55 test pass; production build pass; ESLint toàn repo và Prettier trên các file frontend sửa trong task pass.
- Compose local/staging: `config -q` pass; 8 container staging healthy.
- MySQL 8.4 thật: integration smoke và staging smoke đều pass, gồm Payment MOCK → Learning.
- Lint toàn repo: đã sửa đủ 11 lỗi và 3 warning; `npm run lint -- --max-warnings=0` pass.
- Bổ sung 7 test giao diện cho reset form lesson/review, preview upload, phản hồi đến muộn,
  phân trang khóa học và tải lại sau kiểm duyệt review. Helper chuẩn hóa khóa học nằm trong
  `features/courses/utils/courseForm.js`; component không export helper để giữ Fast Refresh hoạt động.
- Chưa triển khai lên domain staging bên ngoài và chưa chạy VNPay thật; workflow CI được thêm vào repo,
  chưa chạy trên GitHub trong phiên này. Stack test dùng một lần được dọn sau khi kiểm tra.
