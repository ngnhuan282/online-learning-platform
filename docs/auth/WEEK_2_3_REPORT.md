# Bàn giao Auth tuần 2–3

Ngày kiểm tra: 22/09/2026.

## Kết quả theo yêu cầu

Các thành phần A2/A3 đã có trong dự án được sử dụng lại và kiểm tra trên mã nguồn hiện tại. Lần này hoàn thiện Global Exception Handler cho tham số sai kiểu và giữ trang đích xuyên suốt đăng ký/đăng nhập; bổ sung kiểm thử tái hiện cả hai lỗi trước khi sửa.

| Yêu cầu | Thành phần triển khai | Kết quả xác minh |
| --- | --- | --- |
| Auth DB | `backend/auth-service/src/main/resources/db/migration/`: bảng `users`, `roles`, `user_roles`; role `USER`/`ADMIN` | Test migration đạt; E2E dùng Auth kết nối MySQL thật |
| Register/Login | `AuthController`, `AuthServiceImpl`, DTO và repository trong `backend/auth-service` | Đăng ký 201, đăng nhập 200, email trùng 409, sai thông tin 401; không nhận quyền ADMIN từ người đăng ký |
| JWT | `JwtTokenProvider`, `JwtAuthenticationFilter`, `SecurityConfig`; Gateway xác minh token | Test chữ ký, token hết hạn, thiếu/sai token, claims và phân quyền đạt |
| BCrypt | `PasswordEncoder` và trường `users.password_hash` | Test kiểm tra hash và đăng nhập với mật khẩu đúng; không trả password/hash trong DTO |
| Validation | Bean Validation trên DTO, `Utf8Size`, `authValidation.js` | Kiểm tra mật khẩu, email, họ tên và giới hạn byte; lỗi mật khẩu trả về `errors.password` |
| Global Exception Handler | `GlobalExceptionHandler`, `AppException`, `ErrorCode`, `SecurityErrorHandler` | Lỗi MVC và lỗi Spring Security dùng response envelope; các test lỗi và quyền truy cập đạt |
| FE Login/Register | `frontend/web/src/features/auth/` | Form gọi API thật qua Gateway; báo lỗi email trùng/sai mật khẩu và thông báo thành công |
| Auth state | `AuthContext`, `useAuth`, token/storage helpers | Lưu access token, lấy user từ server, khôi phục phiên, logout và xử lý request đến muộn |
| Axios interceptor | `frontend/web/src/shared/apis/axiosClient.js` | Gắn Bearer token, chuẩn hóa lỗi, refresh khi 401, retry một lần, dùng chung refresh cho request đồng thời |
| ProtectedRoute/RoleRoute | `frontend/web/src/routes/`, `UserLayout`, `AdminLayout`, `app/router.jsx` | Khách được chuyển tới login; USER bị chặn ở ADMIN; test component cho phép ADMIN |

## Code bổ sung và sửa

- `GlobalExceptionHandler`: bắt `MethodArgumentTypeMismatchException`, trả HTTP 400 / `VALIDATION_ERROR` với tên tham số trong `errors`, không trả giá trị bị từ chối hoặc chi tiết chuyển kiểu Java. Trước bản sửa, các request này trả HTTP 500.
- `AuthServiceApplicationTests`: thêm kiểm thử HTTP cho `id`, `page`, `size` và `status` sai kiểu hoặc vượt miền số nguyên. Kiểm tra status, response envelope và không lộ chi tiết nội bộ.
- `AuthForm`: giữ `location.state.from` khi chuyển giữa login/register và sau đăng ký thành công. Luồng `/account?tab=profile#details` → login → register → login nay quay về đúng URL ban đầu. Kiểm tra URL nội bộ hiện có vẫn được áp dụng trước điều hướng.
- `scripts/auth-e2e.mjs`: bổ sung luồng trang được bảo vệ → login/register qua lại → đăng ký → đăng nhập; xác nhận cả pathname, query và hash. Kiểm thử đã thất bại với code cũ và đạt sau bản sửa.
- Cập nhật [API_CONVENTIONS.md](../architecture/API_CONVENTIONS.md). Không tạo infrastructure Auth, Axios hoặc migration trùng lặp.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| `mvn -f backend/pom.xml verify -B -ntp` | BUILD SUCCESS cho toàn bộ backend; 74 test đạt, gồm 38 test Auth |
| `mvn -f backend/auth-service/pom.xml verify -B -ntp` | BUILD SUCCESS; 38 test đạt |
| `npm test` tại `frontend/web` | 29 test đạt |
| `npm run build` | Đạt |
| `npm run lint` toàn frontend | Đạt |
| Build và khởi động lại container `auth-service` | Thành công, sử dụng MySQL hiện có |
| `node scripts/auth-e2e.mjs` | 16 mục kiểm tra đạt trên Chrome headless, React, Gateway và Auth/MySQL thật |
| `git diff --check` | Đạt |

E2E hoàn tất lúc `2026-09-22T13:55:08.747Z`. Bao gồm đăng ký/đăng nhập, giữ trang đích, mặc định USER, token thiếu/sai, email trùng, khôi phục phiên qua `/me`, logout, route guard, giao diện mobile và không có exception JavaScript trong trình duyệt.

Backend integration tests dùng H2. E2E riêng dùng MySQL thông qua Auth Service; hai loại bằng chứng được ghi riêng. Không tạo tài khoản ADMIN trong database thật; trường hợp ADMIN được kiểm tra bằng test backend và test component frontend.

Bằng chứng cục bộ (file ignored): `.tmp/backend-final-verify.log`, `.tmp/week23-auth-verify.log`, `.tmp/week23-current-docker.log`, `.tmp/week23-e2e.log`, `.tmp/auth-e2e/results.json` và ảnh trong `.tmp/auth-e2e/`. Log tái hiện lỗi trước bản sửa: `.tmp/week23-parameter-before.log`, `.tmp/week23-redirect-before.log`.

## Giới hạn còn lại

Các lỗi lint được ghi nhận ngày 21/09 không còn xuất hiện trên mã nguồn hiện tại. Một số lần chạy trong sandbox bị chặn tạo tiến trình hoặc đọc migration; chạy lại ngoài sandbox đã kiểm tra được đầy đủ. Lần E2E ngay sau khi cập nhật container nhận 503 trong lúc Auth khởi động; lần chạy sau khi service sẵn sàng đạt đủ 16 mục.

Refresh token/rotation/logout phía server đã có và được giữ tương thích. Social login, quên mật khẩu và chức năng ghi nhớ đăng nhập dài hạn chưa được triển khai trong phạm vi tuần 2–3 này.

Không thêm migration mới, không thay đổi dữ liệu người dùng hiện có. E2E tạo tài khoản test riêng trong MySQL cục bộ. Không commit hoặc push thay đổi.

## Chạy và kiểm tra lại

Tại root, dùng `docker compose --profile backend up --build -d` để chạy backend. Tại `frontend/web`, dùng `npm run dev` và mở `/register`, `/login`, `/account`, `/admin` tại địa chỉ Vite hiển thị. `VITE_API_URL` phải trỏ tới Gateway (`http://localhost:8080`).

Để chạy lại E2E, dừng tiến trình đang giữ port 5173 nếu có, sau đó tại `frontend/web` chạy `npm run build` và `node scripts/auth-e2e.mjs`. Script tự phục vụ frontend và mở Chrome headless.
