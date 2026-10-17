# A8 và A9 Auth integration và staging

Branch: `feature/a8-a9-auth-staging`. Ngày kiểm tra: 13/10/2026.

Phạm vi của Nhuận là Auth/User, Gateway, shared API/session/guards và staging.
Course chỉ được sửa tại ranh giới xác thực và cấp nội dung; Learning FE chỉ được sửa để
gọi curriculum thật, bỏ dữ liệu demo trên màn hình riêng tư và dùng progress của Backend.
Payment chỉ được sửa để bật MOCK tường minh, từ chối VNPay chưa triển khai và kiểm tra
enrollment trên trang kết quả. Không viết lại provider, quiz, notification hay storage của owner.

## Đối chiếu kế hoạch và source

Đã đọc [kế hoạch](../specifications/J2EE%20E-Learning%20Plan.xlsx), các sheet Tổng quan,
Gantt 10 tuần, TV1 và Mốc tích hợp, cùng [đặc tả v1.3](../specifications/Tài%20liệu%20đặc%20tả%20E-Learning%20v1.3.docx).
Tên workbook trong repo không có hậu tố `(1)` như yêu cầu, nhưng có đủ các sheet và task A8/A9.
TV1 đặt Integration support ở tuần 7, Staging integration ở tuần 8, Release support ở tuần 9.
Gantt đặt A8 ở tuần 7–8 và A9 ở tuần 8–9. VNPay thuộc D9 tuần 9; AI provider thuộc D10 tuần 10.

Source thực tế dùng Java 21, Spring Boot 4.1.1, Spring Cloud 2025.1.2 và React/Vite JavaScript.
Giữ nguyên phiên bản, cấu trúc package và API thật. Đặc tả đề xuất `/payments/vnpay/create`
và `/payments/vnpay/callback`; source chỉ có `/payments/checkout`, orders/history và MOCK complete.
Không mở callback public khi chưa có implementation xác minh chữ ký.

Remote-tracking `origin/hoang-week-8-9` và `origin/nguyen-week-8-9` không có commit mới ngoài
`main` tại lúc khảo sát. Không fetch/push/merge nhánh bên ngoài trong phiên này.

## Bảng khảo sát và cách xử lý

| Trạng thái trước sửa / vấn đề đã xác minh | File chính | Cách xử lý | Phụ thuộc / kiểm thử |
| --- | --- | --- | --- |
| Đã có một AuthProvider, shared Axios, refresh flight, session generation, guards chờ restore | `features/auth/context/AuthContext.jsx`, `shared/apis/axiosClient.js`, `routes/ProtectedRoute.jsx` | Tái sử dụng; không tạo auth/client khác | Regression FE, Chrome auth/refresh |
| Đã có JWT HS256, issuer/type/role/permissions validation ở các service | `*/security/JwtTokenProvider.java` | Giữ contract hiện tại, tiếp tục truyền Bearer JWT | JWT/RBAC tests, Gateway smoke |
| Course detail/reviews/sections cho Guest xem Draft; curriculum trả cả private text/video | Course `CourseService`, `ReviewService`, `SectionService`, DTOs | Chỉ Published cho Guest/User; private fields null nếu chưa enroll | Tùng; Guest/preview/private smoke |
| Lesson resource và raw media chưa kiểm tra enrollment; Review chỉ kiểm tra userId khác null | Course `LessonResourceService`, `MediaController`, `CourseContentAccess`, `LearningAccessClient` | Gọi Learning bằng JWT đã xác thực; cấp URL sau kiểm tra quyền, Review yêu cầu enrollment | Tùng/Hoàng; 403, ownership, media ticket tests |
| Learning FE dùng ID bài mẫu và fallback data sau lỗi | `LearningPage`, `useLearningResource`, My Courses/Dashboard | Dùng curriculum Course và progress thật; lỗi không tạo bài/enrollment mẫu; bỏ progress 48% cố định | Hoàng; UI regression và Chrome core |
| Payment chấp nhận VNPAY nhưng chỉ trả URL quay về FE | `PaymentProviderPolicy`, `PaymentCoreService`, `.env.example` | MOCK mặc định tắt, stack test bật rõ; VNPAY thiếu config trả 503, có config nhưng thiếu implementation trả 501 | Nguyên; provider policy tests |
| Gateway readiness chỉ phản ánh tiến trình; AI bắt buộc trong backend profile | `CoreDependenciesHealth`, `application.yml`, `compose.yaml` | Readiness kiểm tra bốn core service với timeout 2 giây; AI là profile riêng | Docker health/fault/restart smoke |
| Correlation có sẵn nhưng log thiếu route, downstream request log ở DEBUG; exception message có thể chứa URL | `LoggingFilter`, các `RequestLoggingFilter`, `GlobalExceptionHandler`, Nginx | Log route template/route ID, status/time/request ID; giữ stack frames, bỏ exception message/cause; Nginx error log ở crit | Log kiểm tra không có token/cookie/signature |

## API và quyền truy cập

- FE chỉ gọi Gateway; một access token store trong sessionStorage với memory fallback.
  Refresh token chỉ là HttpOnly cookie, rotation/revoke tại Auth. 401 retry tối đa một lần;
  403 thiếu quyền/enrollment giữ session. ACCOUNT_LOCKED/DISABLED xóa phiên theo cơ chế có sẵn.
- JWT `sub` chứa user ID dạng chuỗi, business service dùng Long. Auth trả `roles` dạng
  `USER`/`ADMIN` hoặc role tùy chỉnh; Backend tạo authority `ROLE_<role>` và permission giữ nguyên.
  Không tự strip `ROLE_` rồi cấp quyền cao hơn cho claim sai. Các JWT contract tests bảo vệ ranh giới này.
- Gateway xóa `X-User-Id`, `X-User-Role`, `X-User-Roles`, `X-Internal-Service-Token` của browser.
  Các service tự xác minh JWT. `/internal/v1/learning/enrollments` không được route qua Gateway;
  Payment gọi trực tiếp bằng secret nội bộ, chỉ có Learning/Payment nhận secret này.
  Nginx trả 404 cho `/internal/`, không fallback SPA hoặc chuyển tiếp đến Learning.
- Guest GET `/courses`, `/courses/{id}`, `/courses/{id}/sections`, reviews và categories:
  catalog Published, lesson metadata và preview. Không trả private content/video cho người chưa enroll.
- Course gọi GET `/api/v1/learning/enrollments/me` tại địa chỉ `LEARNING_SERVICE_URL`, chuyển
  nguyên Authorization đã xác thực và X-Request-ID. Chỉ ACTIVE/COMPLETED có quyền; dependency lỗi trả 503.
  Không đọc learning_db và không dùng userId/role do FE gửi. Course không `depends_on` Learning để tránh vòng khởi động.
- Resource của private lesson yêu cầu enrollment. Resource URL được tạo lại từ objectKey qua storage
  hiện có; S3 dùng presigner của Tùng, local dùng ticket HMAC có hạn 300 giây, gắn với đúng objectKey.
  Ticket là quyền tải tạm thời; người có URL có thể tải trong TTL. Quyền đã cấp không bị thu hồi ngay khi logout.
  URL local thô chỉ cho editor hoặc thumbnail của khóa Published; upload preview có ticket riêng.
- Giá/amount/status/userId từ checkout FE không cấp quyền. Payment lấy giá thật từ Course.
  MOCK complete vẫn yêu cầu JWT đúng chủ sở hữu; chỉ hoạt động khi `PAYMENT_MOCK_ENABLED=true`.
  Admin status SUCCESS cũng phải đi qua provider policy và Payment → Learning.
- Return FE lấy order của chính user từ Backend, bỏ qua `status`, `vnp_ResponseCode` trong query.
  Chỉ hiển thị hành động vào học khi Learning xác nhận đúng course enrollment ACTIVE/COMPLETED.
  Nếu chưa đồng bộ/lỗi thì có nút kiểm tra lại. Session hết hạn đi qua ProtectedRoute và giữ URL return để login lại.

Các business service vẫn sử dụng quyền từ JWT đến khi hết TTL/refresh/login lại (mặc định 900 giây).
Auth kiểm tra trạng thái tài khoản và quyền hiện tại trong DB. Logout revoke refresh cookie;
access JWT đã phát và media ticket còn hiệu lực đến hết TTL. Không thay đổi thiết kế revoke trong task này.

## Chạy staging local trên PowerShell

Tại root repo, tạo secret ngẫu nhiên vào file bị Git ignore, không ghi đè file đã có:

```powershell
node infra/scripts/create-integration-env.mjs .tmp/a8-a9.env
docker compose --env-file .tmp/a8-a9.env -p auth-integration --profile backend config -q
docker compose --env-file .tmp/a8-a9.env -p auth-integration --profile backend up --build -d --wait --wait-timeout 300
docker compose --env-file .tmp/a8-a9.env -p auth-integration exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot < /seed/seed-data.sql'
node infra/scripts/integration-smoke.mjs --demo
node infra/scripts/runtime-smoke.mjs --isolated
```

Stack riêng dùng MySQL 13306, Gateway 18080 và MOCK bật tường minh. Demo seed chỉ dùng trên DB test.
Runtime smoke chủ động dừng/khởi động Payment và MySQL của **auth-integration** để kiểm tra readiness,
liveness và dữ liệu còn nguyên; chạy trước overlay staging, khi stack test không có tác vụ khác.
Không thay `.env` đang sử dụng, không xóa volume hiện tại. Các DB/schema/user và migrations tiếp tục
theo Compose/Flyway hiện có; task này không thêm hoặc đổi migration đã áp dụng.

```powershell
docker compose --env-file .tmp/a8-a9.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend config -q
docker compose --env-file .tmp/a8-a9.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend up --build -d --wait --wait-timeout 300
node infra/scripts/staging-smoke.mjs --demo
docker compose --env-file .tmp/a8-a9.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend ps
docker compose --env-file .tmp/a8-a9.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend logs --tail=100 api-gateway course-service learning-service payment-service
docker compose --env-file .tmp/a8-a9.env -p auth-integration -f compose.yaml -f compose.staging.yaml --profile backend stop
```

Web ở `http://localhost:18088` dùng same-origin `/api`; SPA refresh không 404. Staging overlay
không publish MySQL/Gateway, cookie luôn Secure. Các probe HTTP test proxy/health/cookie attributes;
trình duyệt cần HTTPS reverse proxy cho đăng nhập staging. Chỉ `VITE_API_URL` không nhạy cảm ở FE.
AI skeleton tùy chọn: thêm `--profile ai` bên cạnh `--profile backend`; không cần AI provider key cho core.

Chạy Chrome E2E ở local profile trước overlay staging (cần Chrome và Node 22):

```powershell
cd frontend/web
$env:VITE_API_URL = 'http://localhost:18080'
npm run build
$env:E2E_GATEWAY_URL = 'http://localhost:18080'
node scripts/auth-e2e.mjs --core --demo
$env:E2E_COMPOSE_PROJECT = 'auth-integration'
$env:E2E_COMPOSE_ENV_FILE = '.tmp/a8-a9-refresh.env'
node scripts/auth-e2e.mjs --refresh
```

Các fixture là khóa/bài/user/giao dịch dùng cho test, không đại diện dữ liệu của đội hoặc VNPay thật.
Refresh E2E cần TTL 5 giây, khác TTL bình thường 900 giây. Trước lệnh `--refresh`, từ root tạo
`node infra/scripts/create-refresh-env.mjs` rồi chạy
`docker compose --env-file .tmp/a8-a9-refresh.env -p auth-integration --profile backend up -d --wait`.
Sau test, dùng lại `.tmp/a8-a9.env` với cùng lệnh Compose để khôi phục TTL. Driver SQL và Vite
phải trỏ cùng stack với Gateway; script từ chối Gateway tùy chỉnh nếu chưa đặt E2E_COMPOSE_PROJECT.
Smoke dùng origin dev mặc định; có thể đặt `SMOKE_BASE_URL`, `SMOKE_ORIGIN`,
`SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` để dùng Gateway/origin/test admin khác.

## Health logging và xử lý lỗi

`/actuator/health/readiness` của Gateway DOWN/503 khi một core service không sẵn sàng;
liveness vẫn UP khi process sống. Readiness business service bao gồm DB. Chi tiết health luôn ẩn,
không mở env/configprops/loggers. Healthcheck backend dùng curl được cài trong image,
Nginx dùng wget có trong Alpine; MySQL dùng truy vấn TCP SELECT 1.
Thiết kế health groups và profile dựa trên [Spring Boot](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)
và [Docker Compose profiles](https://docs.docker.com/compose/how-tos/profiles/).

X-Request-ID do Gateway sinh, gửi xuống từng service và REST call Course/Payment/Learning.
Log ECS giữ service name và route template, không query/body/header/token/cookie hay signature.
Backend còn stack frames để tìm vị trí lỗi; không ghi exception message hoặc nested causes chứa URL/SQL.
Container log có rotation 10 MB × 3; Nginx access log chỉ method/status/time/request ID.

- 401: kiểm tra JWT secret/issuer/type/exp và refresh cookie. FE tự refresh tối đa một lần.
- 403 Enrollment: kiểm tra ACTIVE/COMPLETED của user thật; không logout để xử lý thiếu quyền.
- 503 SERVICE_UNAVAILABLE: kiểm tra readiness, tên service Docker và correlation ID ở hai đầu gọi REST.
- PAYMENT_MOCK_DISABLED: chỉ bật MOCK trên stack test nếu muốn demo; không nhầm với Sandbox.
- PAYMENT_CONFIGURATION_ERROR: thiếu VNPay credentials. FEATURE_NOT_IMPLEMENTED: credentials có nhưng
  D9 chưa được bàn giao; không tạo order giả hoặc callback public để test pass.
- Media 403 sau 300 giây: tải lại curriculum/resource để nhận URL mới; không đưa JWT vào query string.

## Bàn giao owner và merge

- Tùng: review Course access adapter; hoàn thiện B8 video objectKey ổn định và cấp lại S3 URL khi hết hạn.
  Source hiện lưu videoUrl trực tiếp, có thể là URL ngoài hoặc presigned URL từ lúc upload;
  task bảo vệ khi trả DTO nhưng chưa thay schema/storage hay thu hồi URL đã cấp. S3 E2E cần bucket/credentials
  và video metadata contract của owner. Không lưu private media ở public bucket/URL ngoài.
- Hoàng: review curriculum thật/empty error states và contract enrollments/me; hoàn thiện kiểm tra
  lesson thực sự thuộc course trong progress (source hiện kiểm tra enrollment rồi nhận lessonId).
  Quiz/notification nghiệp vụ giữ nguyên; callback VNPay cùng lúc và retry phải được UAT với D9/C9.
- Nguyên: bàn giao D9 signed URL, return/IPN/callback paths/methods/DTO, hash + amount + merchant/order
  verification, idempotency và notification contract. Sau đó mới mở **đúng** guest callback ở Gateway/Payment.
  Khi ký đã hợp lệ, callback không yêu cầu JWT browser; ownership vẫn áp dụng orders/history/checkout.

Không có conflict marker hoặc unmerged index tại lúc khảo sát. Khi ghép nhánh owner, review router,
shared client, SecurityConfig, application.yml, POM/package lock, Compose và Flyway history theo hành vi.
Không chọn hàng loạt ours/theirs. Chạy lại verify/build/lint/core smoke sau merge; chạy paid Sandbox khi D9 sẵn sàng.
PR cần ít nhất một thành viên review; repo hiện chưa có nhánh develop local/remote-tracking.
Nội dung PR và checklist ở [A8_A9_PR.md](A8_A9_PR.md). Chưa commit/push/merge chính thức.

## Minh chứng nghiệm thu

Kết quả cuối cùng và các lệnh đã chạy được ghi trong [A8_A9_ACCEPTANCE.md](../testing/A8_A9_ACCEPTANCE.md).
Phân biệt E2E MOCK thật (React/Gateway/services/MySQL) với contract/unit test và VNPay chưa kiểm chứng.
