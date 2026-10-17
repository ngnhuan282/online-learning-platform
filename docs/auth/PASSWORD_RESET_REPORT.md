# Quên mật khẩu / Đặt lại mật khẩu — 17/10/2026

## Luồng và contract

Frontend gọi shared Axios → Gateway :8080 → Auth :8081 → auth_db. Tái sử dụng BCrypt PasswordEncoder,
chính sách đăng ký (8–72 ký tự, chữ hoa/thường/số, tối đa 72 byte UTF-8), envelope và UI AuthField.
Login, JWT claims, Google identity và ownership nghiệp vụ không thay contract.

| API qua Gateway | Request | Response |
| --- | --- | --- |
| POST `/api/v1/auth/forgot-password` | `{email}` | 200, `data:null`, thông báo chung không xác nhận tài khoản tồn tại hoặc email đã được giao |
| POST `/api/v1/auth/reset-password` | `{token,newPassword,confirmPassword}` | 200 `data:null`, xóa refresh cookie, không tự đăng nhập |

Hai POST này public theo path/method chính xác ở Gateway và Auth; không dùng JWT, không tự gọi refresh
khi lỗi. Các endpoint Google LINK/status vẫn protected. CORS giữ origin chính xác và policy hiện có.

Forgot chỉ hỗ trợ user ACTIVE chưa xóa mềm và **có password_hash**, gồm local đã liên kết Google.
Unknown, Google-only, locked/disabled/deleted đều nhận cùng thông báo 200 khi mail sẵn sàng, không phát
hành token/gửi thư cho các trường hợp này. Email trim/lowercase theo Locale.ROOT, kiểm tra lại địa chỉ
chuẩn hóa chính xác để tránh collation MySQL gộp dấu; chỉ gửi tới email đang lưu trên user.

Giới hạn bền vững theo email đã chuẩn hóa: cách nhau ít nhất 60 giây, tối đa 3 yêu cầu trong cửa sổ
15 phút. Áp dụng cả email không tồn tại, trả 429 PASSWORD_RESET_RATE_LIMITED; restart Auth không xóa quota.
Mỗi yêu cầu mới được chấp nhận thay token cũ ngay khi transaction commit.

Reset token sinh SecureRandom **32 byte**, Base64url 43 ký tự; DB chỉ lưu SHA-256, userId, credential_version
và expiry mặc định **15 phút**. Một user có tối đa một token. Không có endpoint GET tiêu thụ token.
Reset kiểm tra validation trước transaction; sau đó khóa user rồi token, kiểm tra status/capability/version/
expiry, đổi hash bằng encoder hiện có, xóa token, thu hồi **mọi refresh token** và xóa google_link_intents
(cascade mã LINK) trong cùng transaction. Request đồng thời chỉ một request thành công.

Refresh create/rotate/revoke/link cùng khóa user trước refresh để tránh deadlock với bulk revoke khi reset;
projection tìm userId không load entity token trước lock, tránh dùng revoked_at cũ trong JPA cache.
Không đổi token format, rotation/replay policy hay cookie. Đổi password trong Hồ sơ giữ chính sách phiên
hiện có; credential_version làm reset token cũ vô hiệu nếu password đã được đổi bằng cách khác.
Access JWT cũ vẫn theo TTL hiện có; thu hồi refresh không thêm cơ chế blacklist JWT.

Google-only không được tạo mật khẩu qua reset, kể cả token bị chèn thủ công cho user đó. UserId, email,
profile, roles/permissions và external identity giữ nguyên. Auth không truy cập DB Course/Learning/Payment.

## Mail, transaction và privacy

`spring-boot-starter-mail` theo BOM Boot 4.1.1, JavaMailSender, MimeMessage tiếng Việt UTF-8.
SMTP authentication, STARTTLS enable + **required**, kiểm tra tên server TLS, connection/read/write timeout
5000 ms; không cấu hình trust-all. Tham khảo [Spring Boot Email](https://docs.spring.io/spring-boot/reference/io/email.html).

`MAIL_ENABLED=false`, thiếu username/password/from/host, URL không hợp lệ hoặc không có sender →
mọi email hợp lệ nhận **503 PASSWORD_RESET_UNAVAILABLE**, không lookup user/phát hành token/queue mail.
Ứng dụng vẫn khởi động, login/Google/refresh vẫn dùng được. Mail không tham gia readiness của Auth khi
feature chưa cấu hình; không test-connect SMTP ở startup. RESET_TOKEN_TTL_MINUTES nhận 1–60, mặc định 15.

Sau transaction phát hành token mới, worker có giới hạn (2 thread, queue 100) gửi mail; **không giữ
transaction DB khi chờ SMTP**. Cả địa chỉ không đủ điều kiện cũng qua queue no-op để lỗi queue không
tiết lộ user. Queue đầy trả 503 và bỏ token của yêu cầu đó. SMTP thất bại được log bằng tên loại lỗi,
không log exception message, email/password/token/provider detail; chỉ xóa đúng hash thất bại, không xóa
token thay thế của yêu cầu mới hơn. Response đã tiếp nhận vẫn chung để không lộ tài khoản qua lỗi SMTP.

200 forgot **không chứng minh gửi/giao mail thành công**. Cần kiểm tra inbox/spam khi thử Gmail thật.
Queue chỉ ở bộ nhớ, không lưu raw token vào outbox/DB; restart có thể mất job chưa gửi, user cần yêu cầu
lại sau cooldown. Token và bucket cũ được dọn mỗi giờ; bucket giữ tối đa khoảng 24 giờ.

Email dùng FRONTEND_RESET_URL cố định + `#token=…`, không lấy host/redirect từ request.
Fragment không được gửi tới web server. Trang `/reset-password` giữ token trong component memory,
xóa fragment khỏi history khi mở, không gọi API cho đến khi nhập mật khẩu hợp lệ và nhấn submit.
Không lưu token/password vào storage, analytics hay log; passwords được xóa sau submit. Nginx route
reset có Cache-Control no-store, Referrer-Policy no-referrer. Không bật mail/body/wire debug logging.

## File và migration

V9__password_reset.sql chỉ thêm `password_reset_tokens` (PK/FK user_id, unique token_hash) và
`password_reset_rate_limits` (hash email, counters/timestamps/index); không sửa V1–V8 hay xóa dữ liệu.

| Nhóm | File chính |
| --- | --- |
| Auth | PasswordResetController/Service, ForgotPasswordRequest, ResetPasswordRequest, PasswordResetConfig/Properties |
| Phiên | RefreshTokenRepository/ServiceImpl, khóa user-first trong status/delete và Google LINK |
| Security | SecurityConfig, JwtAuthenticationFilter, Gateway AuthenticationFilter: thêm đúng hai POST public |
| Cấu hình | Auth application.yml/pom.xml, compose.yaml/staging, .env.example; không đổi .env thật |
| Frontend | ForgotPasswordPage, ResetPasswordPage, authApi/endpoints/routes, shared authValidation; thay dialog placeholder bằng link trang |
| Tests | PasswordResetTests, PasswordResetUnconfiguredTests, AuthFlowTests, Gateway tests, password-reset.test.js, auth-validation.test.js |

File mẫu INTERNAL_SERVICE_TOKEN để trống; giá trị `.env` hiện có giữ nguyên. MAIL_USERNAME/MAIL_PASSWORD
chưa có trong `.env` lúc triển khai; không chờ credentials để hoàn thành code/test.

## Lấy Gmail credentials và bật gửi thật

1. Đăng nhập Gmail dùng làm sender → Google Account → **Security & sign-in** → **2-Step Verification**,
   bật và hoàn tất hướng dẫn. Xem [hướng dẫn Google](https://support.google.com/accounts/answer/185839?hl=en).
2. Mở [App Passwords](https://myaccount.google.com/apppasswords), xác minh lại nếu được hỏi,
   tạo app tên `SGEdu Auth`. Lưu mật khẩu ứng dụng 16 ký tự mà Google hiển thị.
   App Password yêu cầu 2-Step Verification; một số tài khoản tổ chức, security-key-only hoặc Advanced
   Protection có thể không có lựa chọn này. Xem [Google App Passwords](https://support.google.com/accounts/answer/185833?hl=en).
3. Thêm các biến còn thiếu vào `.env` root, giữ giá trị khác nguyên vẹn:

```dotenv
MAIL_ENABLED=true
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-sender@gmail.com
MAIL_PASSWORD=<app-password-vua-tao>
MAIL_FROM=your-sender@gmail.com
FRONTEND_RESET_URL=http://localhost:5173/reset-password
RESET_TOKEN_TTL_MINUTES=15
```

MAIL_PASSWORD là App Password, nhập liền 16 ký tự (bỏ khoảng cách trình bày), không dùng mật khẩu Gmail
thông thường. MAIL_FROM dùng cùng Gmail sender để tránh lỗi quyền gửi. Không commit `.env`, đưa MAIL_PASSWORD
vào VITE_* hoặc gửi secret vào chat. Đổi mật khẩu Google có thể thu hồi App Password; tạo lại nếu cần.

Tại PowerShell, thư mục `D:\GitHub\online-learning-platform`:

```powershell
$env:LOG_FORMAT='ecs'
docker compose --profile backend config -q
docker compose --profile backend up --build -d auth-service api-gateway
docker compose --profile backend ps
```

Không dùng `docker compose restart` để áp dụng env mới; cần up/recreate. Không chạy config không có -q
vì cấu hình resolved chứa secrets. Không chạy down -v. Flyway tự nâng V9 khi Auth khởi động.

```powershell
cd frontend/web
npm run dev
```

Frontend chỉ cần VITE_API_URL=http://localhost:8080. Chạy qua localhost đồng nhất cho web/Gateway.
Staging overlay tự dùng STAGING_ORIGIN HTTPS + `/reset-password`; phải đặt origin public thật.

**Maven/IDE không tự đọc `.env`.** Cách chạy chính ở trên là Compose, tự nạp `.env` root.
Nếu chạy Auth bằng IDE, đặt các biến trong Run Configuration → Environment variables; thêm AUTH_DB_URL
trỏ MySQL host:3306, AUTH_DB_USERNAME=auth_app, AUTH_DB_PASSWORD và JWT_SECRET hiện có. Nếu chạy Maven,
đặt cùng các biến bằng `$env:NAME='value'` trong tiến trình PowerShell trước lệnh
`mvn -f backend/auth-service/pom.xml spring-boot:run`; dùng Read-Host để nhập secret trong máy,
không dán secret vào lệnh/chat. Không chạy hai Auth cùng port 8081.

## Demo Gmail thật

1. Dùng một tài khoản local có email nhận được thư; tài khoản local đã link Google cũng được.
2. Login → Quên mật khẩu → nhập email → gửi. Trạng thái chung là tiếp nhận, chưa phải xác nhận giao thư.
3. Kiểm tra inbox/spam của email user, mở link trong 15 phút. Mở link chỉ hiển thị form.
4. Nhập password mới + xác nhận → thành công → quay về login; mật khẩu cũ không dùng được, mới dùng được.
5. Thử link lần nữa hoặc link cũ sau yêu cầu mới: phải từ chối. Refresh của các phiên cũ phải 401.
6. Đối chiếu userId/roles/Google linked account và dữ liệu học tập/thanh toán không đổi.
7. Thử email unknown/Google-only: UI vẫn trả thông báo chung, không tạo password cho Google-only.

Có thể tiếp nhận yêu cầu qua PowerShell mà không đưa reset token/password vào terminal:

```powershell
$recipient = Read-Host 'Email tai khoan local de thu'
$body = @{ email = $recipient } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/auth/forgot-password' -ContentType 'application/json' -Body $body
```

Sau đó mở link trong email và nhập password trong UI. SMTP sai credentials có log loại
MailAuthenticationException, network/TLS có lỗi MailSendException hoặc MessagingException; không in nội dung
exception/mail để debug. Nếu không thấy App Password, kiểm tra điều kiện ở tài liệu Google hoặc admin tổ chức.

## Kiểm thử đã chạy

| Kiểm tra thực tế | Kết quả |
| --- | --- |
| Auth `clean verify` | BUILD SUCCESS; 87 test qua / 1 ca business Google tùy chọn skip |
| Backend toàn bộ `clean verify` | BUILD SUCCESS cả 6 service; 215 test qua / 1 skip (Auth 87, Course 60, Learning 29, Payment 20, AI 7, Gateway 12) |
| MySQL 8.4, ba schema riêng | 36 test qua / 1 skip: reset 16, OIDC/linking 19, migration 1; V7→V9 giữ user/hash/profile/role/refresh; container test đã dọn |
| Mail binding test bổ sung | Qua; JavaMailSenderImpl thật nhận auth, STARTTLS required, hostname verification và connection/read/write timeout 5000 ms; không trust-all; không kết nối SMTP |
| Frontend lint / test / build | Qua; 86 test, Vite còn cảnh báo bundle lớn >500 kB |
| Compose local/staging `config -q` | Qua; staging chỉ dùng origin mẫu trong tiến trình để kiểm tra cấu hình |
| Docker build Auth/Gateway | Qua, image Auth cuối có kiểm tra email canonical |
| Runtime Auth/Gateway | Đã recreate, cả hai healthy; Flyway V9 thành công |
| Bảo toàn DB hiện có khi migrate | Snapshot user/hash/profile/roles/Google identity/refresh không đổi; không xóa DB/volume |
| API thật qua Gateway, chưa có SMTP credentials | Forgot 503 cùng code cho mọi email hợp lệ, không có token/quota được tạo; reset token giả trả 400 đúng code |
| Nginx với frontend production build, container riêng | nginx -t qua; /reset-password HTTP 200 + no-store/no-referrer; /forgot-password HTTP 200; container test đã dọn |
| Source / secrets | git diff --check qua; V1–V8 không sửa; không có giá trị secret thật trong source thay đổi; không sửa .env thật |
| Gmail thật / staging thật | **Chưa chạy**, đang chờ credentials và môi trường thật; chưa nghiệm thu gửi Gmail |

Các lượt test Windows dùng LOG_FORMAT=ecs, MAVEN_OPTS `-Xmx384m -XX:ActiveProcessorCount=2` và argLine
`-Xmx512m -XX:ActiveProcessorCount=2 -Dio.netty.eventLoopThreads=2 -Dreactor.netty.ioWorkerCount=2
-Djdk.net.unixdomain.tmpdir=D:/GitHub/online-learning-platform/.tmp`. Cần tạo thư mục socket ngắn này.
Class test do IDE ghi đè chứa "Unresolved compilation problems" ở lượt đầu đã được loại bằng clean build;
không sửa business logic để né lỗi cache. Test mail dùng JavaMailSender mock, không liên hệ Gmail.

Để lặp lại ca MySQL, đặt PASSWORD_RESET_TEST_DB_URL/USERNAME/PASSWORD trỏ schema test riêng;
GoogleLoginTests dùng GOOGLE_TEST_DB_URL/USERNAME/PASSWORD và migration dùng GOOGLE_MIGRATION_TEST_DB_URL
tới schema rỗng khác. Không dùng auth_db thật cho tests thay đổi dữ liệu. Chạy
`mvn -f backend/auth-service/pom.xml '-Dtest=PasswordResetTests,GoogleLoginTests,GoogleIdentityMigrationTests' clean test`.

Backend test bao phủ token hash/TTL/replay, request mới, validation/confirmation/UTF-8, Google-only,
status/capability thay đổi, SMTP fail/slow/old-failure race, rate limit/concurrency, reset đua rotation,
thu hồi mọi refresh + intent LINK, bảo toàn user/role/identity, mail disabled/missing và collation MySQL.
Frontend test thao tác input/submit thật trên JSDOM: loading, chống gửi lặp, thiếu proof/expiry/replay,
Strip history, không lưu token/password, không auto-refresh public API, không hiển thị lỗi provider.
