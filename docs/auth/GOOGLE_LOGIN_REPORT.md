# Google Login và liên kết tài khoản — TV1

## Kiến trúc và phạm vi

Java 21, Spring Boot 4.1.1 / Spring Security theo BOM; React 19 / Vite 8 / JSX.
Frontend chỉ gọi Gateway `:8080`; Auth Service `:8081` sở hữu `auth_db`.
Login mật khẩu, JWT claims, `AuthResponse`, refresh rotation, logout và `/users/me`
giữ contract hiện có. Hai phương thức đăng nhập dùng cùng User, roles và permissions.

Đã hỗ trợ local liên kết một Google có email **đã xác minh trùng email local**.
Không gộp hai user, chuyển chủ identity, hủy liên kết, đặt mật khẩu cho Google-only hoặc làm Facebook.
Google Login gặp email trùng vẫn trả `GOOGLE_EMAIL_CONFLICT`, hướng dẫn đăng nhập mật khẩu →
Hồ sơ → Phương thức đăng nhập; không tự liên kết tại màn hình đăng nhập.

## Google Login và LINK

LOGIN giữ luồng đã có: verifier ngẫu nhiên 256 bit của tab → challenge SHA-256 → protected browser
state/nonce của Spring OIDC → mã LOGIN nội bộ hạn **60 giây** → `{code,verifier}` tại `/exchange` →
AuthResponse + refresh cookie HttpOnly. Spring xác minh signature, issuer, audience, expiry và nonce;
chỉ dùng scope `openid email profile`. Xem [Spring OAuth2 Login](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/advanced.html)
và [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).
Không lưu Google access/refresh token; JWT, refresh token, mật khẩu và secret không đi qua URL.

Luồng liên kết:

1. Hồ sơ tải `/users/me/linked-accounts`; local chưa liên kết có nút **Liên kết Google**.
   Google-only hiển thị đúng trạng thái và ẩn form đổi mật khẩu local.
2. Dialog xác nhận mật khẩu hiện tại, có loading/chống submit lặp. Mật khẩu chỉ trong bộ nhớ/request,
   xóa khi gửi/đóng; không lưu storage hay log. Proof LINK lưu riêng `google_link_attempt`,
   không ghi đè `google_login_attempt`.
3. `/auth/google/link/start` yêu cầu JWT, active refresh cookie, password và challenge.
   Backend lấy userId từ principal, khóa refresh/user, kiểm tra trạng thái/password rồi tạo intent
   hạn **5 phút**, gắn userId, session_id, credential_version và challenge.
4. Intent chỉ nằm trong session OAuth do backend tạo. Authorization repository kiểm tra intent,
   challenge và cookie trước redirect. Query userId/email/role/purpose không chọn được target hay purpose.
5. **Dùng chung callback Google đã đăng ký.** Sau xác minh OIDC, nhánh LINK chỉ chuẩn bị mã purpose LINK
   gắn Google sub/email; không tạo user, ghi identity, cấp JWT hay thay refresh cookie tại callback.
6. Frontend callback dùng `flow=link` làm hint UI, chờ AuthContext restore/refresh rồi gửi protected
   `/link/complete` bằng phiên local. Hint/query không quyết định purpose ở backend.
7. Một transaction kiểm tra lại user/status, phiên, credential version, tuổi intent/code, purpose,
   verifier, verified email và identity ownership; insert identity + consume code + xóa intent.
   Thứ tự lock: refresh → user → intent → code → identity.
8. Trả trạng thái, không trả AuthResponse/JWT/Set-Cookie. Quay về Hồ sơ `#sign-in-methods` và tải lại.
   Hủy/lỗi giữ phiên local; thông báo cố định, không hiển thị lỗi thô provider.

Link lại đúng identity trả success `alreadyLinked=true`; identity thuộc user khác hoặc user đã có
Google khác trả 409. Không thay password hash, email, tên, roles hay permissions khi link.
Các service nghiệp vụ tiếp tục nhận cùng JWT subject userId; Auth không đọc DB service khác.

## Migration và chính sách phiên

Giữ nguyên V7; thêm **V8__link_google_accounts.sql**:

- `user_external_identities`: FK user_id, provider, subject VARBINARY(255), verified email,
  linked_at; unique `(provider,provider_subject)` và `(user_id,provider)`. Subject phân biệt hoa/thường.
- Copy identity GOOGLE V7 với **cùng userId**, bỏ hai cột provider cũ trên User. Bảng identity là
  nguồn duy nhất; khả năng login mật khẩu dựa vào password_hash có tồn tại hay không.
- Giữ local hash/profile/role và Google-only password NULL, không sinh mật khẩu mặc định.
  Google-only local login trả `401 GOOGLE_LOGIN_REQUIRED`; đổi password trả `400 LOCAL_PASSWORD_UNAVAILABLE`.
  Dự án chưa có backend reset password; không thêm luồng reset trong thay đổi này.
- `refresh_tokens.session_id`: backfill token_hash để cookie cũ còn hợp lệ; login mới tạo ID ngẫu nhiên,
  rotation giữ cùng ID. Raw refresh vẫn chỉ trong cookie HttpOnly, DB chỉ lưu hash.
- `users.credential_version`, `google_link_intents` và metadata LINK/purpose trên `oauth_login_codes`.
  FK code → intent có ON DELETE CASCADE; dọn dữ liệu hết hạn khi phát hành tương ứng.

LINK cần JWT và cookie còn hiệu lực của **đúng phiên khởi tạo**. Rotation giữ session_id nên vẫn
hoàn tất được. Đổi tài khoản, login lại thành phiên khác, logout, cookie hết hạn/bị thu hồi chặn intent cũ.
Logout xóa intent của session; admin thu hồi refresh khi khóa/xóa user cũng chặn completion.
Đổi password tăng credential_version và xóa mọi intent của user; refresh sessions giữ chính sách hiện có.

Session tạm `GOOGLE_OAUTH_SESSION`: HttpOnly, SameSite=Lax, path `/api/v1/auth/google`, tối đa 5 phút,
chỉ giữ state/nonce/challenge/intent; callback hủy session. NullSecurityContextRepository không lưu
API authentication. Một browser có một OAuth flow đang hoạt động; start mới thay session tạm cũ.
Restart Auth giữa luồng cần bắt đầu lại; scale nhiều instance cần sticky routing/shared Spring Session.
Intent/code nằm trong DB, được consume nguyên tử và unique constraints chống duplicate.

## API contract

Tất cả path dưới có tiền tố `/api/v1`, dùng envelope `success/message/data/timestamp` hiện có.

| Method / path | Contract |
| --- | --- |
| POST `/auth/google/start` | Public `{challenge}` → `{authorizationPath}`; reset session OAuth tạm |
| GET `/auth/google/authorize/google?challenge=…` | Browser redirect, purpose từ backend session |
| GET `/auth/google/callback/google` | Callback chung LOGIN/LINK, Spring OIDC xử lý |
| POST `/auth/google/exchange` | Public `{code,verifier}` purpose LOGIN → AuthResponse + refresh cookie |
| GET `/users/me/linked-accounts` | JWT/user active → `{passwordEnabled,google:null\|{email,linkedAt}}` |
| POST `/auth/google/link/start` | JWT + refresh cookie, `{currentPassword,challenge}` → `{authorizationPath}` |
| POST `/auth/google/link/complete` | JWT + cùng phiên refresh, `{code,verifier}` → `{alreadyLinked,linkedAccounts}` |

LINK/status được bảo vệ ở Gateway và Auth, không mở wildcard public. Frontend dùng shared Axios
có bearer và retry refresh. LINK nằm ngoài ENDPOINTS.auth (danh sách public bỏ bearer của interceptor).
Response mới/callback có no-store; frontend callback có Referrer-Policy no-referrer.

| HTTP / code | Ý nghĩa |
| --- | --- |
| 400 GOOGLE_LINK_PASSWORD_INVALID / GOOGLE_LINK_LOCAL_REQUIRED | Sai mật khẩu / Google-only không có local password |
| 400 GOOGLE_LINK_EMAIL_MISMATCH / GOOGLE_IDENTITY_INVALID | Email không trùng, chưa xác minh hoặc identity không hợp lệ |
| 400 GOOGLE_LINK_EXPIRED / GOOGLE_LINK_INVALID | Intent hết hạn/đổi password; mã sai/hết hạn/replay/purpose/verifier |
| 409 GOOGLE_LINK_SESSION_INVALID | Cookie thiếu/thu hồi hoặc khác user/phiên khởi tạo |
| 409 GOOGLE_IDENTITY_IN_USE / GOOGLE_ACCOUNT_ALREADY_LINKED | Identity thuộc user khác / user đã có Google khác |
| 401 UNAUTHENTICATED | JWT thiếu/sai; giữ cơ chế refresh protected API |
| 403 ACCOUNT_LOCKED / ACCOUNT_DISABLED | Trạng thái hiện tại không cho phép |
| 503 GOOGLE_LOGIN_UNAVAILABLE | Chưa bật/cấu hình Google |

`/exchange` từ chối mã LINK bằng 401; `/link/complete` từ chối mã LOGIN bằng 400.

## .env và khởi động

Đã kiểm tra theo trạng thái, không in giá trị hay sửa `.env`:

| Biến | Trạng thái |
| --- | --- |
| GOOGLE_LOGIN_ENABLED, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Đã có; Google bật |
| GOOGLE_REDIRECT_URI, GOOGLE_FRONTEND_ORIGIN | Đã có |
| JWT_SECRET, AUTH_DB_PASSWORD, CORS_ALLOWED_ORIGINS | Đã có |
| INTERNAL_SERVICE_TOKEN | **Chưa có**, bắt buộc để Compose parse toàn stack |
| STAGING_ORIGIN | Chưa có; chỉ cần staging overlay |

Tái sử dụng Web OAuth client đã nhập, đăng ký chính xác:
`http://localhost:8080/api/v1/auth/google/callback/google`.
Frontend result `/auth/google/callback` không phải URI đăng ký Google. Dùng cùng hostname localhost,
frontend origin `http://localhost:5173`, CORS chính xác; không trộn localhost/127.0.0.1.
Consent screen External/Testing cần email demo trong Test users. Frontend chỉ có
`VITE_API_URL=http://localhost:8080`, không có secret.

Để chạy toàn stack, bổ sung INTERNAL_SERVICE_TOKEN ngẫu nhiên ít nhất 32 byte trong `.env`;
Learning/Payment dùng cùng giá trị. Không gửi token, mật khẩu hoặc Client Secret vào chat.

```powershell
docker compose --profile backend config -q
docker compose --profile backend up --build -d
docker compose --profile backend ps
cd frontend/web
npm ci
npm run dev
```

Flyway nâng dữ liệu tại chỗ; không chạy down -v, sửa V1–V7 hay tạo lại user. DB cũ cần quyền DDL
theo `infra/mysql/03-auth-migrations.sql`. Java/Maven/IDE không tự đọc `.env`; đặt env như README.
Nếu môi trường có LOG_FORMAT=json, đặt LOG_FORMAT=ecs cho tiến trình.
Phiên triển khai chỉ truyền placeholder INTERNAL_SERVICE_TOKEN trong tiến trình để parse/build/recreate
Auth/Gateway (hai service không nhận biến này); không ghi `.env`, không deploy Learning/Payment bằng placeholder.

Staging dùng STAGING_ORIGIN HTTPS, đăng ký callback cùng origin, bật Secure cookie và CORS chính xác.
Nginx giữ Cookie/Set-Cookie/query cho `/api/**`; không log callback query hoặc bật body/wire logging.
Chain OAuth giữ CSRF mặc định; LINK giữ bearer + JSON + proof + cookie và policy CORS/CSRF chung.

## Kiểm thử và demo

GoogleLoginTests dùng HTTP OIDC provider cục bộ và ID token RSA, qua filter Spring thật; không gọi Google.
Bao phủ LOGIN/LINK, state/nonce/signature/issuer/audience/expiry, verified email, password/JWT/user/session,
ownership, one Google/user, purpose, expiry/replay/concurrency, rotation/logout/password change, hủy và
locked/disabled/deleted/Google-only. Migration test nâng V7→V8 với user/hash/profile/role/cookie cũ.
Gateway test protected LINK/status. Frontend test proof riêng, bearer/refresh retry, StrictMode,
restore trước complete, giữ tài khoản khi hủy/đổi user và trạng thái Hồ sơ.

```powershell
mvn -f backend/auth-service/pom.xml verify
mvn -f backend/pom.xml verify
cd frontend/web
npm run lint
npm test
npm run build
```

Windows có thể cần socket path ngắn đã tồn tại:
`'-DargLine=-Djdk.net.unixdomain.tmpdir=D:/GitHub/online-learning-platform/.tmp'`.
Phiên chạy dùng thêm -Xmx384m / -XX:ActiveProcessorCount=2, Netty worker=2 và MAVEN_OPTS cùng giới hạn.

MySQL test phải dùng **hai schema test riêng**: GOOGLE_TEST_DB_URL, GOOGLE_MIGRATION_TEST_DB_URL,
GOOGLE_TEST_DB_USERNAME, GOOGLE_TEST_DB_PASSWORD; chạy `-Dtest=GoogleLoginTests,GoogleIdentityMigrationTests`.
Migration test cần schema rỗng riêng vì chạy V7 trước V8; không trỏ database đang sử dụng.

Ca `linkedLoginRetainsRealCoursesEnrollmentsProgressAndPaymentHistory` chỉ bật khi có
GOOGLE_BUSINESS_GATEWAY_URL tới stack test riêng; GOOGLE_BUSINESS_TEST_JWT_SECRET trùng secret
Gateway/Course/Learning/Payment. Auth test dùng OIDC cục bộ/DB test. Ca này tạo course free/paid,
enrollment, completed progress và thanh toán MOCK qua API, link/logout/login hai cách rồi so dữ liệu.
Mặc định skip; không bật trên stack thật. Auth không đọc trực tiếp DB nghiệp vụ.

Demo Google thật, cần người dùng chọn tài khoản/consent:

1. Đăng nhập local có email Google đã xác minh; ghi nhận userId/profile/roles/permissions,
   khóa học, tiến độ và lịch sử thanh toán. Không chụp token/password/secret.
2. Hồ sơ → Phương thức đăng nhập → Liên kết Google → nhập mật khẩu hiện tại trong dialog.
3. Chọn Google cùng email; trở về Hồ sơ thấy email đã liên kết, vẫn cùng userId.
4. Đăng xuất → Đăng nhập Google → đối chiếu cùng userId/profile/quyền/dữ liệu nghiệp vụ.
5. Đăng xuất → đăng nhập mật khẩu cũ → đối chiếu lại cùng userId và dữ liệu.
6. Thử sai password, Google khác email, hủy consent, logout/khóa user giữa luồng; không tạo user/identity sai.

Chỉ nghiệm thu Google end-to-end sau demo thật; mock OIDC không thay thế bước này.

## Kết quả ngày 15/10/2026

| Kiểm tra | Kết quả |
| --- | --- |
| `mvn -f backend/auth-service/pom.xml verify` | BUILD SUCCESS, 69 test qua; 1 ca business tùy chọn skip và được chạy riêng bên dưới |
| `mvn -f backend/pom.xml verify` | BUILD SUCCESS cả 6 service, 197 test qua / 1 skip: Auth 69, Course 60, Learning 29, Payment 20, AI 7, Gateway 12 |
| OIDC/liên kết + migration H2 | 20 test qua, nằm trong verify Auth |
| OIDC/liên kết + migration MySQL 8.4 riêng | 20 test qua; container test đã dọn |
| Ca business qua Gateway/Course/Learning/Payment/MySQL riêng | Qua hai lần; course free/paid, 2 enrollment, completed progress, private course content và payment history giữ nguyên khi login Google/mật khẩu cùng userId; payment dùng MOCK, OIDC dùng provider test RSA |
| Frontend npm test | 69 test qua |
| Frontend lint / build | Qua; Vite cảnh báo bundle >500 kB |
| Compose `config -q`, Docker build Auth/Gateway | Qua, dùng placeholder chỉ để parse biến INTERNAL_SERVICE_TOKEN đang thiếu |
| Recreate Auth/Gateway với keys `.env` | Đã áp dụng; Auth healthy, Flyway V8; snapshot user/password hash/profile/role/refresh cũ không đổi |
| Gateway với cấu hình Google thật | LINK/status thiếu JWT trả 401; start/authorize trả redirect 302 tới accounts.google.com, dùng đúng client ID/callback, có state/nonce/scopes; callback hủy được xử lý qua Gateway |
| `git diff --check` | Qua (line endings theo cấu hình repository) |
| Google thật / staging thật | Chưa chạy, chưa nghiệm thu end-to-end |

Các container của stack test `google-link-check` được dừng sau kiểm tra; dữ liệu/volume thật không bị xóa.
Auth và Gateway thật được giữ chạy sau kiểm tra. Course/Learning/Payment thật đã dừng từ trước phiên này,
không bị recreate; vì vậy **readiness tổng hợp của Gateway chưa UP**, dù các route Auth trên :8080 hoạt động.
Để chạy đầy đủ nghiệp vụ và readiness, bổ sung INTERNAL_SERVICE_TOKEN rồi khởi động backend như hướng dẫn.
STAGING_ORIGIN chưa có, chưa kiểm tra staging thật. Không in Compose resolved config hoặc secret.

Lượt kiểm tra với credentials thật mới xác nhận cấu hình được nạp và redirect/cancel qua Gateway;
chưa chọn tài khoản Google, chưa đổi authorization code thật lấy ID token hoặc link Google thật.
Thực hiện demo bên trên trong trình duyệt để nghiệm thu phần này.

## File chính

| Nhóm | Thay đổi |
| --- | --- |
| DB/identity | V8, UserExternalIdentity/Repository, User; GoogleIdentityService dùng nguồn identity mới |
| LINK/API | GoogleLinkController/Service, LinkedAccountsResponse, UserController status |
| OAuth tái sử dụng | GoogleOAuth2Config, GoogleLoginCodeService, GoogleLoginController; callback/purpose |
| Phiên/password | RefreshToken/RefreshTokenServiceImpl session_id; UserServiceImpl hủy intent khi đổi password |
| Frontend | SignInMethods, AccountPage, GoogleCallbackPage, googleLogin utils, authApi/userApi/endpoints/styles |
| Tests | GoogleLoginTests, GoogleIdentityMigrationTests, AuthFlowTests, Gateway, frontend auth.test.js |
| Infra Google đã có | .env.example, Compose local/staging, nginx.conf; keys thật trong .env ngoài Git |
