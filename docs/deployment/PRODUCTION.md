# Chuẩn bị và vận hành production

Bản này hỗ trợ Guest / User / Admin theo đặc tả v1.3: hồ sơ đầy đủ, quản trị nội dung,
tìm kiếm/phân trang, ghi danh, học/quiz, review, thông báo, thanh toán VNPay, AI và báo cáo.
`compose.production.yaml` là overlay dùng cùng `compose.yaml`, có thể chạy trên VPS
hoặc VM cloud có Docker Compose. Không phụ thuộc một domain hay tài khoản cloud cụ thể.
Chưa triển khai ra Internet hoặc nghiệm thu dịch vụ bên ngoài trong repo.

## 1. Chuẩn bị môi trường thật

- Docker Compose 2.24.4+; Node.js 22 để chạy script vận hành. Máy cần đủ RAM cho MySQL
  và sáu JVM; các giới hạn trong Compose là mức khởi đầu, cần đo theo tải thực tế.
- Domain HTTPS thật và reverse proxy TLS trên host. Web chỉ bind loopback `8088`;
  MySQL/Gateway không publish cổng. Firewall chỉ mở 80/443 và cổng quản trị cần thiết.
- Bucket S3 private hoặc dịch vụ S3 compatible có endpoint HTTPS. Bật versioning/
  backup media ở nhà cung cấp; bản sao lưu SQL không chứa file video.
- SMTP gửi được email đặt lại mật khẩu. Google OAuth, AI và VNPay có thể để tắt;
  muốn cung cấp những chức năng đó phải cấu hình và nghiệm thu từng dịch vụ thật.

Copy `.env.production.example` thành `.env.production`; file thật bị Git ignore.
Điền `PRODUCTION_ORIGIN=https://<domain>` không có dấu `/` cuối, `RELEASE_TAG` là
commit SHA/release duy nhất, và secret riêng cho từng database/JWT/internal token.
Sinh mỗi secret bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Không dùng secret hoặc database demo cho production và không đưa credential vào chat/Git.
Trên Linux, giới hạn quyền đọc file bằng `chmod 600 .env.production`.

`TRUSTED_PROXY_CIDR` phải là IP/CIDR thực tế của reverse proxy mà container web nhìn thấy,
không phải `0.0.0.0/0`. Mẫu cấu hình TLS host ở
[`tls-proxy.conf.example`](../../infra/docker/tls-proxy.conf.example).
Thay hostname/certificate và xác minh IP thật trước khi mở traffic. Reverse proxy phải
ghi đè header từ client; giới hạn đăng nhập dùng IP đã được xác nhận, không tin header
do trình duyệt tự khai. Cấu hình dựa trên [NGINX limit_req](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
và [Spring Boot forwarded headers](https://docs.spring.io/spring-boot/how-to/webserver.html).

S3 trên AWS có thể dùng IAM role: để trống cả hai access key. Với credentials tường minh,
điền đủ cặp và chỉ cấp quyền cần thiết trong bucket. Không dùng tài khoản RustFS demo.
`AWS_ENDPOINT_URL`/`AWS_PUBLIC_ENDPOINT_URL` chỉ dùng khi cần endpoint S3 compatible;
trình duyệt phải truy cập được endpoint public qua HTTPS.

## 2. Kiểm tra cấu hình, tạo admin và khởi động

```powershell
node infra/scripts/production.mjs check --env-file .env.production --project sgsphere-production
node infra/scripts/production.mjs up --env-file .env.production --project sgsphere-production
node infra/scripts/production.mjs status --env-file .env.production --project sgsphere-production
```

Script kiểm tra cấu hình mà không in secret; `up` build image có release tag và đợi
health check. Container backend dùng non-root user, filesystem chỉ đọc, `/tmp` riêng,
drop capabilities và giới hạn RAM/PID; xem [Docker Compose services](https://docs.docker.com/reference/compose-file/services/).
Không chạy seed demo ở production. Flyway tự nâng schema bằng migration mới.
Volume AI cũ thiếu quyền DDL cần [script nâng quyền theo phạm vi ai_db](../../infra/mysql/README.md).

Lần đầu, bật `BOOTSTRAP_ADMIN_ENABLED=true`, cung cấp email chưa được sử dụng và
mật khẩu 12+ ký tự có HOA/thường/số, tối đa 72 byte UTF-8. Bootstrap chỉ tạo khi chưa
có tài khoản mang role ADMIN; không reset mật khẩu hoặc tự nâng quyền một email đã có.
Sau khi đăng nhập thành công, đặt cờ về `false`, xóa hai giá trị bootstrap khỏi env
và chạy lại `up`. Không cần giữ tài khoản/mật khẩu mặc định công khai.

Khi nâng từ database cũ, các migration mới là Auth V10/V11, Course V8 và AI V3.
Chúng bổ sung cột/bảng, không xóa dữ liệu hay sửa migration đã áp dụng. Nếu Flyway
báo checksum khác, dừng nâng cấp để đối chiếu lịch sử và bản sao lưu; không tự `repair`.

## 3. Bật tích hợp

| Tích hợp | Cấu hình và nghiệm thu |
| --- | --- |
| Email | `MAIL_ENABLED=true`, host/port/user/password/from; kiểm tra gửi, nhận và dùng link reset trên domain thật. SMTP được yêu cầu STARTTLS, kiểm tra certificate. |
| Google | `GOOGLE_LOGIN_ENABLED=true`, client ID/secret; đăng ký callback `${PRODUCTION_ORIGIN}/api/v1/auth/google/callback/google` tại Google, kiểm tra login và liên kết tài khoản. |
| VNPay | Dùng merchant/secret production được cấp; URL live được hỗ trợ là `https://pay.vnpay.vn/vpcpay.html`. Xác nhận URL/contract với merchant. Sandbox credentials không được preflight chấp nhận như thanh toán thật. Đăng ký IPN `${PRODUCTION_ORIGIN}/api/v1/payments/vnpay/ipn`; return `/api/v1/payments/vnpay/return`; result `/payment/result` được overlay tự cấu hình. |
| AI | Điền cả key/model, đặt `AI_DAILY_REQUEST_LIMIT`. Hạn mức theo user/ngày UTC được lưu trong DB, dùng chung giữa các hội thoại/replica. Cache idempotency không tiêu thêm lượt; request đã gọi provider vẫn tính lượt khi lỗi để hạn chế retry tiêu phí. |

Để trống cả cặp cấu hình VNPay hoặc AI sẽ tắt chức năng tương ứng; lịch sử vẫn đọc được.
Không mở bán khóa trả phí trước khi merchant/IPN được nghiệm thu. Không có thao tác
gán SUCCESS từ trình duyệt; callback phải được xác minh. Nghiệm thu live gồm thanh toán,
hủy/thất bại, callback lặp và Payment → Enrollment; chỉ thực hiện giao dịch thật khi
người vận hành đã cho phép số tiền/tài khoản cụ thể. Không có tích hợp refund tự động;
trạng thái provider không được giả lập bằng thao tác quản trị.

## 4. Hành vi đã hoàn thiện

- Hồ sơ có avatar URL HTTP(S), điện thoại, ngày sinh không ở tương lai và tiểu sử;
  kiểm tra ở backend, không cho sửa role/email bằng endpoint hồ sơ.
- “Ghi nhớ đăng nhập” chỉ làm refresh cookie HttpOnly có Max-Age theo TTL. Rotation
  giữ lựa chọn; mặc định vẫn là session cookie, access token vẫn ở session storage.
- Tìm kiếm chạy tại DB, trả tổng số/trang đúng với keyword, danh mục, level, giá,
  miễn phí/trả phí và mức đánh giá; UI chỉ tải trang đang xem.
- Xóa khóa học chuyển sang ARCHIVED; các bảng và enrollment không bị xóa. Khóa học
  rời catalog, không mua mới, học viên đã ghi danh vẫn học và lưu tiến độ được.
- Xóa danh mục chuyển sang ẩn, có thể bật lại ở admin; không cascade xóa khóa học.
  Ẩn danh mục chỉ bỏ danh mục khỏi bộ lọc công khai, không thu hồi quyền học.

## 5. Sao lưu và khôi phục

Tạo thư mục backup riêng có quyền truy cập hạn chế, ví dụ `backups/` đã bị Git ignore.
Dùng tên file mới cho mỗi lần chạy; script từ chối ghi đè.

```powershell
node infra/scripts/production.mjs backup --env-file .env.production --project sgsphere-production --file backups/before-release.sql.gz
```

Backup dùng một consistent snapshot cho năm schema, gồm Flyway và các tham chiếu
nghiệp vụ. Giữ cả `.sql.gz` và `.sql.gz.json` chứa SHA256. File chứa dữ liệu cá nhân,
password hash và thông tin nghiệp vụ: mã hóa khi lưu/chuyển, sao chép ra ngoài host,
giới hạn quyền đọc, đặt lịch/retention phù hợp. Backup S3/video dùng versioning hoặc
quy trình riêng của bucket. Chạy thử restore định kỳ trên stack tách biệt.

```powershell
node infra/scripts/production.mjs restore --env-file .env.production --project sgsphere-production --file backups/before-release.sql.gz --confirm-project sgsphere-production
```

Restore thay thế dữ liệu của target đã chỉ định: kiểm tra checksum trước khi dừng
ứng dụng, giữ MySQL để import, sau đó khởi động/đợi health. Nếu import lỗi, ứng dụng
được giữ dừng để tránh tiếp tục ghi vào dữ liệu chưa khôi phục xong. Chặn traffic
trước khi restore và kiểm tra đăng nhập/khóa học/giao dịch trước khi mở lại.
Không dùng `docker compose down -v` trên stack đang chứa dữ liệu thật.

Rollback image: giữ image/tag của release trước, đổi `RELEASE_TAG` và dùng Compose
`up -d --no-build --wait`. Không tự downgrade database hoặc trỏ code cũ vào schema
không tương thích. Với migration không tương thích, dùng bản sao lưu và kế hoạch
khôi phục đã thử trên stack riêng; Flyway validation vẫn phải bật.

## 6. Kiểm tra trước khi mở traffic

1. `check` đạt; tất cả service healthy; HTTPS/certificate/redirect đúng domain.
2. Header CSP/HSTS/nosniff, cookie Secure/HttpOnly/SameSite đúng; không truy cập được
   MySQL, Gateway trực tiếp, internal paths hoặc Swagger từ Internet.
3. Đăng ký/đăng nhập, ghi nhớ phiên, đổi/reset mật khẩu và Google (nếu bật) hoạt động.
4. Tạo/preview/publish khóa học, media private, ghi danh miễn phí, học/quiz/progress,
   review, thông báo và phân quyền admin hoạt động qua HTTPS.
5. VNPay/SMTP/S3/AI thật được nghiệm thu tương ứng trước khi quảng bá chức năng.
6. Backup và restore thử đạt; có giám sát readiness, 5xx, restart/OOM, dung lượng DB,
   hạn mức AI và giao dịch SUCCESS còn chờ activation. Log không ghi secret/query.

Chạy tự động trong repo:

```powershell
mvn -f backend/pom.xml verify -B -ntp
cd frontend/web
npm run lint -- --max-warnings=0
npm test
npm run build
```

`node --test infra/scripts/production-env.test.mjs` kiểm tra các ràng buộc cấu hình.
`production-smoke.mjs --test-stack` chỉ được dùng trên stack local có thể bỏ đi,
với `PRODUCTION_SMOKE_ENV_FILE` trỏ đến env fixture. Test không thay cho nghiệm thu
HTTPS và nhà cung cấp thật. Không chạy driver fixture vào database production.
