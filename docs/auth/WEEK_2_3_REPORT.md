# Bàn giao Auth tuần 2–3

Ngày kiểm tra: 21/09/2026.

## Kết quả theo yêu cầu

Các thành phần Auth đã tồn tại trong dự án được sử dụng lại. Lần thực hiện này bổ sung validation, sửa lỗi khởi tạo router và chạy lại kiểm thử trên mã nguồn hiện tại.

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

- Thêm `validation/Utf8Size.java` và `Utf8SizeValidator.java`: kiểm tra số byte UTF-8 ngay trên trường mật khẩu. Thay kiểm tra dạng thuộc tính `passwordWithinByteLimit`, để Global Exception Handler trả đúng tên trường `password` cho frontend.
- Cập nhật `RegisterRequest`: mật khẩu đăng ký tối thiểu 8 ký tự, có chữ hoa ASCII, chữ thường ASCII và số, tối đa 72 byte UTF-8; đồng bộ với yêu cầu đã hiển thị trên form.
- Cập nhật `authValidation.js`: form login cũng phát hiện mật khẩu quá 72 byte. Quy tắc độ mạnh chỉ áp dụng khi đăng ký; tài khoản cũ vẫn đăng nhập bằng BCrypt hash hiện có.
- Sửa `app/router.jsx`: bổ sung import `UserLayout` và `ProtectedRoute` bị thiếu, tránh lỗi khi khởi tạo ứng dụng.
- Thêm 4 test frontend trong `tests/auth-validation.test.js`; bổ sung test backend cho mật khẩu yếu, giới hạn byte ASCII/Unicode, tên trường lỗi, không lưu đăng ký không hợp lệ và đăng nhập tài khoản cũ.
- Mở rộng `scripts/auth-e2e.mjs` để kiểm tra validation trực tiếp qua Gateway, kể cả khi bỏ qua form.
- Cập nhật hợp đồng validation trong [API_CONVENTIONS.md](../architecture/API_CONVENTIONS.md).

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| `mvn -f backend/pom.xml verify -B -ntp` | BUILD SUCCESS cho toàn bộ backend; 66 test đạt tại thời điểm chạy |
| `mvn -f backend/auth-service/pom.xml verify -B -ntp` | BUILD SUCCESS; 31 test đạt sau khi thêm test tương thích tài khoản cũ |
| `npm test` tại `frontend/web` | 29 test đạt |
| `npm run build` | Đạt sau khi sửa router |
| ESLint cho router, Auth, guards, Axios và các test/script thay đổi | Đạt |
| `npm run lint` toàn frontend | Còn 5 lỗi có sẵn trong module Course, chi tiết bên dưới |
| Build và khởi động lại container `auth-service` | Thành công, sử dụng MySQL hiện có |
| `node scripts/auth-e2e.mjs` | 15 mục kiểm tra đạt trên Chrome headless, React, Gateway và Auth/MySQL thật |
| `git diff --check` | Đạt |

E2E hoàn tất lúc `2026-09-21T15:00:19.610Z`. Bao gồm đăng ký/đăng nhập, mặc định USER, token thiếu/sai, email trùng, khôi phục phiên qua `/me`, logout, route guard, giao diện mobile và không có exception JavaScript trong trình duyệt.

Backend integration tests dùng H2. E2E riêng dùng MySQL thông qua Auth Service; hai loại bằng chứng được ghi riêng. Không tạo tài khoản ADMIN trong database thật; trường hợp ADMIN được kiểm tra bằng test backend và test component frontend.

Bằng chứng cục bộ (file ignored): `.tmp/week23-backend-verify.log`, `.tmp/week23-auth-verify.log`, `.tmp/week23-docker-build.log`, `.tmp/week23-e2e.log`, `.tmp/week23-lint.log`, `.tmp/auth-e2e/results.json` và ảnh trong `.tmp/auth-e2e/`.

## Giới hạn còn lại

Lint toàn frontend còn 4 lỗi ở `AdminCoursePage.jsx` (3 biến `error` không dùng và `payload` ngoài phạm vi) và 1 biến `error` không dùng ở `CourseListPage.jsx`. Các lỗi này thuộc module Course; lint phần Auth và router đã đạt.

Refresh token/rotation/logout phía server đã có và được giữ tương thích. Social login, quên mật khẩu và chức năng ghi nhớ đăng nhập dài hạn chưa được triển khai trong phạm vi tuần 2–3 này.

Không thêm migration mới, không thay đổi dữ liệu người dùng hiện có. E2E tạo tài khoản test riêng trong MySQL cục bộ. Không commit hoặc push thay đổi.

## Chạy và kiểm tra lại

Tại root, dùng `docker compose --profile backend up --build -d` để chạy backend. Tại `frontend/web`, dùng `npm run dev` và mở `/register`, `/login`, `/account`, `/admin` tại địa chỉ Vite hiển thị. `VITE_API_URL` phải trỏ tới Gateway (`http://localhost:8080`).

Để chạy lại E2E, dừng tiến trình đang giữ port 5173 nếu có, sau đó tại `frontend/web` chạy `npm run build` và `node scripts/auth-e2e.mjs`. Script tự phục vụ frontend và mở Chrome headless.
