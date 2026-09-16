# Project-wide Code Style and Readability Cleanup

Ngày kiểm tra: 16/09/2026. Phạm vi: chỉ định dạng và cải thiện khả năng đọc mã nguồn.

## STYLE AUDIT

Đã rà soát cả 6 module backend, frontend `src`, `tests`, `scripts`, ESLint, Vite,
`package.json`, 7 POM và `.editorconfig` trước khi sửa. Các vấn đề chính:

- Java có constructor, method, annotation và switch bị nén trên một dòng; thiếu dòng trống giữa các method.
- Các chuỗi gọi hàm, lambda, đối số và khai báo exception handler dài, khó đọc.
- Tên handler ngắn, import chưa nhất quán, một số import không sử dụng và tên class đầy đủ trong thân hàm.
- JSX có nhiều prop và object `sx` trên một dòng; CSS có các dòng dài hàng nghìn ký tự.
- JavaScript có object cấu hình dài và ternary nhiều tầng trong phần chọn thông báo lỗi.
- POM dùng lẫn tab và space; dự án chưa có formatter tự động.

Số dòng dài hơn 120 ký tự trong phạm vi đã quét:

| Loại file | Trước | Sau |
| --- | ---: | ---: |
| Java | 88 | 1 |
| JavaScript | 50 | 3 |
| JSX | 107 | 16 |
| MJS | 27 | 7 |
| CSS | 107 | 1 |
| POM XML | 29 | 0 |

Một số chuỗi, URL và nội dung dài được giữ nguyên để tránh thay đổi giá trị.

## FORMATTED

Đã chạy formatter trên toàn bộ 90 file Java, 63 file JS/JSX/MJS, 2 file CSS và 7 POM.
Những file đã đúng định dạng không bị sửa thêm. Có 152 file hiện hữu thay đổi:

| Nhóm | Số file thay đổi |
| --- | ---: |
| Java, bao gồm test của cả 6 module | 87 |
| POM | 7 |
| Frontend JS/JSX/MJS/CSS, bao gồm test, script, ESLint và Vite | 56 |
| `package.json` và lockfile do cài dev dependency | 2 |

Danh sách đầy đủ nằm ở cuối báo cáo. Thêm mới `.prettierrc.json`, `.prettierignore`
và báo cáo này.

## SMALL READABILITY REFACTORS

- Đổi tên 7 method package-local trong mỗi `GlobalExceptionHandler` của 5 service:
  `handleAppException`, `handleValidationException`, `handleConstraintViolation`,
  `handleAccessDenied`, `handleAuthenticationException`, `handleMalformedRequest`,
  `handleUnexpectedException`. Annotation và kiểu tham số xử lý exception giữ nguyên;
  không tìm thấy test hoặc mã nguồn phụ thuộc vào tên cũ.
- Dùng import cho `Instant`, `Set`, `UUID`, `Locale`, các kiểu Spring Security,
  `HttpMethod` và các class cần thiết trong test. Bỏ 5 import `Instant` không sử dụng.
- Thay ternary nhiều tầng trong `normalizeApiError` bằng `if/else` và biến `message`.
  Giữ nguyên thứ tự ưu tiên, nội dung thông báo và dữ liệu lỗi.
- Giữ nguyên các đoạn text con của React khi xuống dòng phần điều khoản trong `AuthForm`.
  Không thay đổi khoảng trắng hiển thị, sự kiện hoặc cấu trúc component.

## TOOLING

- Giữ `.editorconfig` và toàn bộ quy tắc ESLint hiện có.
- Thêm dev dependency: `prettier`, `prettier-plugin-java`, `@prettier/plugin-xml`.
- Cấu hình chung: độ rộng mục tiêu 110 ký tự, LF, 2 space cho frontend/XML,
  4 space cho Java, single quote trong JS và dấu chấm phẩy theo phong cách chủ đạo.
- `.prettierignore` loại trừ dependency, build output, wrapper, asset, SQL và file tạm.
- Không thêm Maven formatter plugin; dependency runtime và phiên bản package hiện hữu không đổi.
- Lockfile được npm cập nhật, không chỉnh thủ công.

Chạy từ `frontend/web`:

```sh
npm run format
npm run format:check
npm run format:backend
npm run format:backend:check
```

## UNCHANGED BY DESIGN

- JWT claims, cách tạo/kiểm tra token, role checks và security matchers.
- Refresh token rotation, transaction, locking, thời hạn, cookie và logout/revocation.
- Axios single-flight refresh, retry, endpoint exclusion và bảo vệ race condition.
- AuthContext, route guards, đường dẫn API/React, HTTP status và response fields.
- Schema/migration SQL, cấu hình CORS và cấu hình chạy Docker.
- Thiết kế giao diện, nội dung, CSS declarations, ảnh và asset.
- Các test và assertion hiện hữu; không xóa, bỏ qua hoặc làm yếu test.
- Cấu trúc package và ranh giới microservice; không tạo shared library.
- `README.md` giữ nguyên phần giới thiệu tính năng và hướng dẫn cài đặt.

## TEST RESULTS

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run format:check` | PASS |
| `npm run format:backend:check` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 25/25, không skip |
| `mvn -f backend/pom.xml verify -B -ntp` | BUILD SUCCESS: 63/63, không skip |
| `docker compose --profile backend up --build -d` | PASS: build và khởi động thành công |
| `docker compose --profile backend ps` | 7 container Up; MySQL healthy |
| Gateway `/actuator/health` | UP |
| `node scripts/auth-e2e.mjs` | PASS: 14 mục kiểm tra trên Chrome, Gateway và MySQL thật |

Backend: Auth 28 test; Course, Learning, Payment, AI và Gateway mỗi module 7 test.
Browser E2E bao gồm đăng ký, đăng nhập, `/me`, khôi phục phiên khi reload,
chặn USER vào trang admin, đăng xuất, lỗi nhập liệu và bố cục mobile không tràn ngang.
Không có browser runtime exception.

Log kiểm tra lưu cục bộ trong `.tmp/style-cleanup/`: `frontend-build.log`,
`frontend-lint.log`, `frontend-tests.log`, `backend-verify.log`, `docker-build.log`,
`docker-status.log`, `auth-e2e.log`, `format-check.log`, `format-backend-check.log`.

## BEHAVIOR CHANGE CHECK

**Không thay đổi chức năng, API, database schema, security, refresh-token behavior,
route behavior hoặc thiết kế UI. Không thêm tính năng mới.**

Đối chiếu toàn bộ file với snapshot trước khi sửa:

- Java giữ nguyên token mã nguồn sau khi loại khác biệt định dạng, import, các tên
  handler đã nêu, dấu phẩy cuối enum/array và cặp ngoặc bao biểu thức `return` do formatter thêm.
  Điều kiện, thứ tự thực thi, annotation và giá trị literal giữ nguyên.
- 62/63 file JS/JSX/MJS có AST sau biên dịch JSX tương đương, bỏ qua metadata vị trí/comment.
  File còn lại là `errorUtils.js`; kiểm tra đối chiếu 10 trường hợp cho kết quả tương đương.
- Cả 2 file CSS có kết quả định dạng chuẩn hóa giống bản gốc.
- Cây XML của 7 POM không đổi. Các file SQL, cấu hình ứng dụng, Compose, hạ tầng,
  asset, `.editorconfig`, `.env.example` và README trong snapshot giữ nguyên byte.
- Các dependency runtime, script hiện hữu và entry package hiện hữu trong lockfile giữ nguyên.

Diff đầy đủ lưu ở `.tmp/style-cleanup/changes.diff`; kết quả đối chiếu nguồn ở
`safety-review.log`, `frontend-ast-check.log`, `readability-css-check.log` trong cùng thư mục.
Đối chiếu hành vi dựa trên mã nguồn, AST và kiểm thử; không khẳng định JAR hoặc
class file giống từng byte giữa các lần build.

## WARNINGS

- Lượt `npm test` đầu gặp `EPERM` khi nhiều Vite instance đồng thời đổi tên thư mục cache
  sau thay đổi config/lockfile trên Windows. Chạy lại nguyên lệnh đã qua đủ 25 test;
  không sửa test hay cấu hình runtime để né lỗi.
- Log test còn cảnh báo cổng HMR `24678` đang được dùng và prop `alignItems` trong
  môi trường test. Backend có cảnh báo phiên bản H2 được Flyway kiểm chứng và Java agent.
  Các cảnh báo này không làm lượt kiểm tra cuối thất bại; chưa sửa vì ngoài phạm vi style.
- Workspace không có metadata Git; diff được tạo từ snapshot lưu trước khi chỉnh sửa.
  Snapshot và log thuộc `.tmp/` đã được ignore, không phải file cần đưa vào repository.

## Danh sách file hiện hữu đã thay đổi


### backend

- [backend/pom.xml](../backend/pom.xml)

### backend/ai-service

- [backend/ai-service/pom.xml](../backend/ai-service/pom.xml)
- [backend/ai-service/src/main/java/com/elearning/ai/AiServiceApplication.java](../backend/ai-service/src/main/java/com/elearning/ai/AiServiceApplication.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/exception/AppException.java](../backend/ai-service/src/main/java/com/elearning/ai/common/exception/AppException.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/exception/ErrorCode.java](../backend/ai-service/src/main/java/com/elearning/ai/common/exception/ErrorCode.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/exception/GlobalExceptionHandler.java](../backend/ai-service/src/main/java/com/elearning/ai/common/exception/GlobalExceptionHandler.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiError.java](../backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiError.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiResponse.java](../backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiResponse.java)
- [backend/ai-service/src/main/java/com/elearning/ai/common/response/PageResponse.java](../backend/ai-service/src/main/java/com/elearning/ai/common/response/PageResponse.java)
- [backend/ai-service/src/main/java/com/elearning/ai/security/JwtAuthenticationFilter.java](../backend/ai-service/src/main/java/com/elearning/ai/security/JwtAuthenticationFilter.java)
- [backend/ai-service/src/main/java/com/elearning/ai/security/JwtTokenProvider.java](../backend/ai-service/src/main/java/com/elearning/ai/security/JwtTokenProvider.java)
- [backend/ai-service/src/main/java/com/elearning/ai/security/SecurityConfig.java](../backend/ai-service/src/main/java/com/elearning/ai/security/SecurityConfig.java)
- [backend/ai-service/src/main/java/com/elearning/ai/security/SecurityErrorHandler.java](../backend/ai-service/src/main/java/com/elearning/ai/security/SecurityErrorHandler.java)
- [backend/ai-service/src/test/java/com/elearning/ai/AiServiceApplicationTests.java](../backend/ai-service/src/test/java/com/elearning/ai/AiServiceApplicationTests.java)

### backend/api-gateway

- [backend/api-gateway/pom.xml](../backend/api-gateway/pom.xml)
- [backend/api-gateway/src/main/java/com/elearning/gateway/ApiGatewayApplication.java](../backend/api-gateway/src/main/java/com/elearning/gateway/ApiGatewayApplication.java)
- [backend/api-gateway/src/main/java/com/elearning/gateway/config/CorsConfig.java](../backend/api-gateway/src/main/java/com/elearning/gateway/config/CorsConfig.java)
- [backend/api-gateway/src/main/java/com/elearning/gateway/exception/GatewayExceptionHandler.java](../backend/api-gateway/src/main/java/com/elearning/gateway/exception/GatewayExceptionHandler.java)
- [backend/api-gateway/src/main/java/com/elearning/gateway/filter/AuthenticationFilter.java](../backend/api-gateway/src/main/java/com/elearning/gateway/filter/AuthenticationFilter.java)
- [backend/api-gateway/src/main/java/com/elearning/gateway/filter/LoggingFilter.java](../backend/api-gateway/src/main/java/com/elearning/gateway/filter/LoggingFilter.java)
- [backend/api-gateway/src/main/java/com/elearning/gateway/security/JwtTokenProvider.java](../backend/api-gateway/src/main/java/com/elearning/gateway/security/JwtTokenProvider.java)
- [backend/api-gateway/src/test/java/com/elearning/gateway/ApiGatewayApplicationTests.java](../backend/api-gateway/src/test/java/com/elearning/gateway/ApiGatewayApplicationTests.java)
- [backend/api-gateway/src/test/java/com/elearning/gateway/GatewayExceptionHandlerTests.java](../backend/api-gateway/src/test/java/com/elearning/gateway/GatewayExceptionHandlerTests.java)

### backend/auth-service

- [backend/auth-service/pom.xml](../backend/auth-service/pom.xml)
- [backend/auth-service/src/main/java/com/elearning/auth/AuthServiceApplication.java](../backend/auth-service/src/main/java/com/elearning/auth/AuthServiceApplication.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/exception/AppException.java](../backend/auth-service/src/main/java/com/elearning/auth/common/exception/AppException.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/exception/ErrorCode.java](../backend/auth-service/src/main/java/com/elearning/auth/common/exception/ErrorCode.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/exception/GlobalExceptionHandler.java](../backend/auth-service/src/main/java/com/elearning/auth/common/exception/GlobalExceptionHandler.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiError.java](../backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiError.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiResponse.java](../backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiResponse.java)
- [backend/auth-service/src/main/java/com/elearning/auth/common/response/PageResponse.java](../backend/auth-service/src/main/java/com/elearning/auth/common/response/PageResponse.java)
- [backend/auth-service/src/main/java/com/elearning/auth/controller/AuthController.java](../backend/auth-service/src/main/java/com/elearning/auth/controller/AuthController.java)
- [backend/auth-service/src/main/java/com/elearning/auth/controller/UserController.java](../backend/auth-service/src/main/java/com/elearning/auth/controller/UserController.java)
- [backend/auth-service/src/main/java/com/elearning/auth/dto/AuthResponse.java](../backend/auth-service/src/main/java/com/elearning/auth/dto/AuthResponse.java)
- [backend/auth-service/src/main/java/com/elearning/auth/dto/LoginRequest.java](../backend/auth-service/src/main/java/com/elearning/auth/dto/LoginRequest.java)
- [backend/auth-service/src/main/java/com/elearning/auth/dto/RegisterRequest.java](../backend/auth-service/src/main/java/com/elearning/auth/dto/RegisterRequest.java)
- [backend/auth-service/src/main/java/com/elearning/auth/dto/UserResponse.java](../backend/auth-service/src/main/java/com/elearning/auth/dto/UserResponse.java)
- [backend/auth-service/src/main/java/com/elearning/auth/entity/enums/RoleName.java](../backend/auth-service/src/main/java/com/elearning/auth/entity/enums/RoleName.java)
- [backend/auth-service/src/main/java/com/elearning/auth/entity/enums/UserStatus.java](../backend/auth-service/src/main/java/com/elearning/auth/entity/enums/UserStatus.java)
- [backend/auth-service/src/main/java/com/elearning/auth/entity/RefreshToken.java](../backend/auth-service/src/main/java/com/elearning/auth/entity/RefreshToken.java)
- [backend/auth-service/src/main/java/com/elearning/auth/entity/Role.java](../backend/auth-service/src/main/java/com/elearning/auth/entity/Role.java)
- [backend/auth-service/src/main/java/com/elearning/auth/entity/User.java](../backend/auth-service/src/main/java/com/elearning/auth/entity/User.java)
- [backend/auth-service/src/main/java/com/elearning/auth/repository/UserRepository.java](../backend/auth-service/src/main/java/com/elearning/auth/repository/UserRepository.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/CustomUserDetailsService.java](../backend/auth-service/src/main/java/com/elearning/auth/security/CustomUserDetailsService.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/JwtAuthenticationFilter.java](../backend/auth-service/src/main/java/com/elearning/auth/security/JwtAuthenticationFilter.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/JwtTokenProvider.java](../backend/auth-service/src/main/java/com/elearning/auth/security/JwtTokenProvider.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/RefreshTokenCookie.java](../backend/auth-service/src/main/java/com/elearning/auth/security/RefreshTokenCookie.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/SecurityConfig.java](../backend/auth-service/src/main/java/com/elearning/auth/security/SecurityConfig.java)
- [backend/auth-service/src/main/java/com/elearning/auth/security/SecurityErrorHandler.java](../backend/auth-service/src/main/java/com/elearning/auth/security/SecurityErrorHandler.java)
- [backend/auth-service/src/main/java/com/elearning/auth/service/impl/AuthServiceImpl.java](../backend/auth-service/src/main/java/com/elearning/auth/service/impl/AuthServiceImpl.java)
- [backend/auth-service/src/main/java/com/elearning/auth/service/impl/RefreshTokenServiceImpl.java](../backend/auth-service/src/main/java/com/elearning/auth/service/impl/RefreshTokenServiceImpl.java)
- [backend/auth-service/src/main/java/com/elearning/auth/service/RefreshTokenService.java](../backend/auth-service/src/main/java/com/elearning/auth/service/RefreshTokenService.java)
- [backend/auth-service/src/test/java/com/elearning/auth/AuthFlowTests.java](../backend/auth-service/src/test/java/com/elearning/auth/AuthFlowTests.java)
- [backend/auth-service/src/test/java/com/elearning/auth/AuthServiceApplicationTests.java](../backend/auth-service/src/test/java/com/elearning/auth/AuthServiceApplicationTests.java)
- [backend/auth-service/src/test/java/com/elearning/auth/RefreshTokenTests.java](../backend/auth-service/src/test/java/com/elearning/auth/RefreshTokenTests.java)

### backend/course-service

- [backend/course-service/pom.xml](../backend/course-service/pom.xml)
- [backend/course-service/src/main/java/com/elearning/course/common/exception/AppException.java](../backend/course-service/src/main/java/com/elearning/course/common/exception/AppException.java)
- [backend/course-service/src/main/java/com/elearning/course/common/exception/ErrorCode.java](../backend/course-service/src/main/java/com/elearning/course/common/exception/ErrorCode.java)
- [backend/course-service/src/main/java/com/elearning/course/common/exception/GlobalExceptionHandler.java](../backend/course-service/src/main/java/com/elearning/course/common/exception/GlobalExceptionHandler.java)
- [backend/course-service/src/main/java/com/elearning/course/common/response/ApiError.java](../backend/course-service/src/main/java/com/elearning/course/common/response/ApiError.java)
- [backend/course-service/src/main/java/com/elearning/course/common/response/ApiResponse.java](../backend/course-service/src/main/java/com/elearning/course/common/response/ApiResponse.java)
- [backend/course-service/src/main/java/com/elearning/course/common/response/PageResponse.java](../backend/course-service/src/main/java/com/elearning/course/common/response/PageResponse.java)
- [backend/course-service/src/main/java/com/elearning/course/CourseServiceApplication.java](../backend/course-service/src/main/java/com/elearning/course/CourseServiceApplication.java)
- [backend/course-service/src/main/java/com/elearning/course/security/JwtAuthenticationFilter.java](../backend/course-service/src/main/java/com/elearning/course/security/JwtAuthenticationFilter.java)
- [backend/course-service/src/main/java/com/elearning/course/security/JwtTokenProvider.java](../backend/course-service/src/main/java/com/elearning/course/security/JwtTokenProvider.java)
- [backend/course-service/src/main/java/com/elearning/course/security/SecurityConfig.java](../backend/course-service/src/main/java/com/elearning/course/security/SecurityConfig.java)
- [backend/course-service/src/main/java/com/elearning/course/security/SecurityErrorHandler.java](../backend/course-service/src/main/java/com/elearning/course/security/SecurityErrorHandler.java)
- [backend/course-service/src/test/java/com/elearning/course/CourseServiceApplicationTests.java](../backend/course-service/src/test/java/com/elearning/course/CourseServiceApplicationTests.java)

### backend/learning-service

- [backend/learning-service/pom.xml](../backend/learning-service/pom.xml)
- [backend/learning-service/src/main/java/com/elearning/learning/common/exception/AppException.java](../backend/learning-service/src/main/java/com/elearning/learning/common/exception/AppException.java)
- [backend/learning-service/src/main/java/com/elearning/learning/common/exception/ErrorCode.java](../backend/learning-service/src/main/java/com/elearning/learning/common/exception/ErrorCode.java)
- [backend/learning-service/src/main/java/com/elearning/learning/common/exception/GlobalExceptionHandler.java](../backend/learning-service/src/main/java/com/elearning/learning/common/exception/GlobalExceptionHandler.java)
- [backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiError.java](../backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiError.java)
- [backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiResponse.java](../backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiResponse.java)
- [backend/learning-service/src/main/java/com/elearning/learning/common/response/PageResponse.java](../backend/learning-service/src/main/java/com/elearning/learning/common/response/PageResponse.java)
- [backend/learning-service/src/main/java/com/elearning/learning/LearningServiceApplication.java](../backend/learning-service/src/main/java/com/elearning/learning/LearningServiceApplication.java)
- [backend/learning-service/src/main/java/com/elearning/learning/security/JwtAuthenticationFilter.java](../backend/learning-service/src/main/java/com/elearning/learning/security/JwtAuthenticationFilter.java)
- [backend/learning-service/src/main/java/com/elearning/learning/security/JwtTokenProvider.java](../backend/learning-service/src/main/java/com/elearning/learning/security/JwtTokenProvider.java)
- [backend/learning-service/src/main/java/com/elearning/learning/security/SecurityConfig.java](../backend/learning-service/src/main/java/com/elearning/learning/security/SecurityConfig.java)
- [backend/learning-service/src/main/java/com/elearning/learning/security/SecurityErrorHandler.java](../backend/learning-service/src/main/java/com/elearning/learning/security/SecurityErrorHandler.java)
- [backend/learning-service/src/test/java/com/elearning/learning/LearningServiceApplicationTests.java](../backend/learning-service/src/test/java/com/elearning/learning/LearningServiceApplicationTests.java)

### backend/payment-service

- [backend/payment-service/pom.xml](../backend/payment-service/pom.xml)
- [backend/payment-service/src/main/java/com/elearning/payment/common/exception/AppException.java](../backend/payment-service/src/main/java/com/elearning/payment/common/exception/AppException.java)
- [backend/payment-service/src/main/java/com/elearning/payment/common/exception/ErrorCode.java](../backend/payment-service/src/main/java/com/elearning/payment/common/exception/ErrorCode.java)
- [backend/payment-service/src/main/java/com/elearning/payment/common/exception/GlobalExceptionHandler.java](../backend/payment-service/src/main/java/com/elearning/payment/common/exception/GlobalExceptionHandler.java)
- [backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiError.java](../backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiError.java)
- [backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiResponse.java](../backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiResponse.java)
- [backend/payment-service/src/main/java/com/elearning/payment/common/response/PageResponse.java](../backend/payment-service/src/main/java/com/elearning/payment/common/response/PageResponse.java)
- [backend/payment-service/src/main/java/com/elearning/payment/PaymentServiceApplication.java](../backend/payment-service/src/main/java/com/elearning/payment/PaymentServiceApplication.java)
- [backend/payment-service/src/main/java/com/elearning/payment/security/JwtAuthenticationFilter.java](../backend/payment-service/src/main/java/com/elearning/payment/security/JwtAuthenticationFilter.java)
- [backend/payment-service/src/main/java/com/elearning/payment/security/JwtTokenProvider.java](../backend/payment-service/src/main/java/com/elearning/payment/security/JwtTokenProvider.java)
- [backend/payment-service/src/main/java/com/elearning/payment/security/SecurityConfig.java](../backend/payment-service/src/main/java/com/elearning/payment/security/SecurityConfig.java)
- [backend/payment-service/src/main/java/com/elearning/payment/security/SecurityErrorHandler.java](../backend/payment-service/src/main/java/com/elearning/payment/security/SecurityErrorHandler.java)
- [backend/payment-service/src/test/java/com/elearning/payment/PaymentServiceApplicationTests.java](../backend/payment-service/src/test/java/com/elearning/payment/PaymentServiceApplicationTests.java)

### frontend/web

- [frontend/web/eslint.config.js](../frontend/web/eslint.config.js)
- [frontend/web/package-lock.json](../frontend/web/package-lock.json)
- [frontend/web/package.json](../frontend/web/package.json)
- [frontend/web/scripts/auth-e2e.mjs](../frontend/web/scripts/auth-e2e.mjs)
- [frontend/web/scripts/refresh-scenarios.mjs](../frontend/web/scripts/refresh-scenarios.mjs)
- [frontend/web/src/app/App.jsx](../frontend/web/src/app/App.jsx)
- [frontend/web/src/app/providers.jsx](../frontend/web/src/app/providers.jsx)
- [frontend/web/src/app/router.jsx](../frontend/web/src/app/router.jsx)
- [frontend/web/src/features/ai-assistant/components/AiTutorSection.jsx](../frontend/web/src/features/ai-assistant/components/AiTutorSection.jsx)
- [frontend/web/src/features/auth/api/authApi.js](../frontend/web/src/features/auth/api/authApi.js)
- [frontend/web/src/features/auth/components/AuthField.jsx](../frontend/web/src/features/auth/components/AuthField.jsx)
- [frontend/web/src/features/auth/components/AuthForm.jsx](../frontend/web/src/features/auth/components/AuthForm.jsx)
- [frontend/web/src/features/auth/components/ForgotPasswordDialog.jsx](../frontend/web/src/features/auth/components/ForgotPasswordDialog.jsx)
- [frontend/web/src/features/auth/components/SocialAuthButtons.jsx](../frontend/web/src/features/auth/components/SocialAuthButtons.jsx)
- [frontend/web/src/features/auth/context/AuthContext.jsx](../frontend/web/src/features/auth/context/AuthContext.jsx)
- [frontend/web/src/features/auth/pages/AccountPage.jsx](../frontend/web/src/features/auth/pages/AccountPage.jsx)
- [frontend/web/src/features/auth/pages/LoginPage.jsx](../frontend/web/src/features/auth/pages/LoginPage.jsx)
- [frontend/web/src/features/auth/pages/RegisterPage.jsx](../frontend/web/src/features/auth/pages/RegisterPage.jsx)
- [frontend/web/src/features/auth/schemas/authValidation.js](../frontend/web/src/features/auth/schemas/authValidation.js)
- [frontend/web/src/features/auth/styles/auth.css](../frontend/web/src/features/auth/styles/auth.css)
- [frontend/web/src/features/courses/components/CourseCard.jsx](../frontend/web/src/features/courses/components/CourseCard.jsx)
- [frontend/web/src/features/courses/components/FeaturedCourses.jsx](../frontend/web/src/features/courses/components/FeaturedCourses.jsx)
- [frontend/web/src/features/courses/data/demoCourses.js](../frontend/web/src/features/courses/data/demoCourses.js)
- [frontend/web/src/features/courses/pages/CourseListPage.jsx](../frontend/web/src/features/courses/pages/CourseListPage.jsx)
- [frontend/web/src/features/home/components/BenefitsSection.jsx](../frontend/web/src/features/home/components/BenefitsSection.jsx)
- [frontend/web/src/features/home/components/CategorySection.jsx](../frontend/web/src/features/home/components/CategorySection.jsx)
- [frontend/web/src/features/home/components/HeroSection.jsx](../frontend/web/src/features/home/components/HeroSection.jsx)
- [frontend/web/src/index.css](../frontend/web/src/index.css)
- [frontend/web/src/layouts/AdminLayout.jsx](../frontend/web/src/layouts/AdminLayout.jsx)
- [frontend/web/src/layouts/MainLayout.jsx](../frontend/web/src/layouts/MainLayout.jsx)
- [frontend/web/src/layouts/UserLayout.jsx](../frontend/web/src/layouts/UserLayout.jsx)
- [frontend/web/src/main.jsx](../frontend/web/src/main.jsx)
- [frontend/web/src/pages/HomePage.jsx](../frontend/web/src/pages/HomePage.jsx)
- [frontend/web/src/routes/ProtectedRoute.jsx](../frontend/web/src/routes/ProtectedRoute.jsx)
- [frontend/web/src/routes/RoleRoute.jsx](../frontend/web/src/routes/RoleRoute.jsx)
- [frontend/web/src/shared/apis/axiosClient.js](../frontend/web/src/shared/apis/axiosClient.js)
- [frontend/web/src/shared/apis/endpoints.js](../frontend/web/src/shared/apis/endpoints.js)
- [frontend/web/src/shared/components/AppLoading.jsx](../frontend/web/src/shared/components/AppLoading.jsx)
- [frontend/web/src/shared/components/Brand.jsx](../frontend/web/src/shared/components/Brand.jsx)
- [frontend/web/src/shared/components/ConfirmDialog.jsx](../frontend/web/src/shared/components/ConfirmDialog.jsx)
- [frontend/web/src/shared/components/EmptyState.jsx](../frontend/web/src/shared/components/EmptyState.jsx)
- [frontend/web/src/shared/components/ErrorState.jsx](../frontend/web/src/shared/components/ErrorState.jsx)
- [frontend/web/src/shared/components/Icon.jsx](../frontend/web/src/shared/components/Icon.jsx)
- [frontend/web/src/shared/components/PageHeader.jsx](../frontend/web/src/shared/components/PageHeader.jsx)
- [frontend/web/src/shared/components/PolicyDialog.jsx](../frontend/web/src/shared/components/PolicyDialog.jsx)
- [frontend/web/src/shared/components/SiteFooter.jsx](../frontend/web/src/shared/components/SiteFooter.jsx)
- [frontend/web/src/shared/components/SiteHeader.jsx](../frontend/web/src/shared/components/SiteHeader.jsx)
- [frontend/web/src/shared/components/StatusChip.jsx](../frontend/web/src/shared/components/StatusChip.jsx)
- [frontend/web/src/shared/constants/routes.js](../frontend/web/src/shared/constants/routes.js)
- [frontend/web/src/shared/utils/errorUtils.js](../frontend/web/src/shared/utils/errorUtils.js)
- [frontend/web/src/shared/utils/formatDate.js](../frontend/web/src/shared/utils/formatDate.js)
- [frontend/web/src/shared/utils/storage.js](../frontend/web/src/shared/utils/storage.js)
- [frontend/web/src/shared/utils/tokenUtils.js](../frontend/web/src/shared/utils/tokenUtils.js)
- [frontend/web/src/styles/theme.js](../frontend/web/src/styles/theme.js)
- [frontend/web/tests/auth.test.js](../frontend/web/tests/auth.test.js)
- [frontend/web/tests/foundation.test.js](../frontend/web/tests/foundation.test.js)
- [frontend/web/tests/refresh.test.js](../frontend/web/tests/refresh.test.js)
- [frontend/web/vite.config.js](../frontend/web/vite.config.js)
