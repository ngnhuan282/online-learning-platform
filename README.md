# SGSphere – Online Learning Platform

SGSphere là nền tảng học trực tuyến được xây dựng theo kiến trúc **Microservices**. Frontend sử dụng **React + Vite**, Backend sử dụng **Spring Boot**, dữ liệu được lưu trên **MySQL**, và mọi request từ trình duyệt đi qua **API Gateway**.

> Mục tiêu của project: xây dựng một nền tảng học trực tuyến có thể mở rộng theo từng module như Course, Learning, Payment/VNPay, AI Assistant và triển khai cloud sau này.

---

## 1. Tính năng hiện có

- Đăng ký tài khoản.
- Đăng nhập bằng email và mật khẩu.
- Phân quyền `USER` và `ADMIN`.
- Trang thông tin tài khoản tại `/account`.
- Bảo vệ route bằng `ProtectedRoute` và `RoleRoute`.
- Access Token dùng JWT.
- Refresh Token lưu bằng HttpOnly Cookie.
- Tự động refresh access token khi hết hạn.
- Refresh Token Rotation và revoke khi logout.
- Password được mã hóa bằng BCrypt.
- Responsive UI cho desktop và mobile.

Các module Course, Learning, VNPay và AI Assistant sẽ được phát triển ở các milestone tiếp theo.

---

## 2. Kiến trúc hệ thống

```text
React + Vite :5173
      │
      ▼
API Gateway :8080
      │
      ├── Auth Service      :8081 ──► auth_db
      ├── Course Service    :8082 ──► course_db
      ├── Learning Service  :8083 ──► learning_db
      ├── Payment Service   :8084 ──► payment_db
      └── AI Service        :8085 ──► ai_db
```

Frontend **không gọi trực tiếp** các service `8081–8085`.

Frontend chỉ gọi:

```text
http://localhost:8080
```

---

## 3. Công nghệ sử dụng

### Frontend
- React
- Vite
- JavaScript / JSX
- Material UI
- Axios
- React Router

### Backend
- Java 21
- Spring Boot
- Spring Cloud Gateway
- Spring Security
- Spring Data JPA
- Flyway
- JWT
- Maven

### Database & Infrastructure
- MySQL 8.4
- Docker
- Docker Compose

---

## 4. Cấu trúc project

```text
online-learning-platform/
│
├── frontend/
│   └── web/
│       ├── src/
│       ├── package.json
│       └── vite.config.js
│
├── backend/
│   ├── auth-service/
│   ├── course-service/
│   ├── learning-service/
│   ├── payment-service/
│   ├── ai-service/
│   ├── api-gateway/
│   └── pom.xml
│
├── infra/
│   ├── docker/
│   └── mysql/
│
├── docs/
├── compose.yaml
├── .env.example
├── RULES.md
└── README.md
```

---

# 5. Cài đặt nhanh nhất

Nếu máy đã có **Docker Desktop** và **Node.js**, bạn chỉ cần dùng 2 terminal.

## Terminal 1 – Backend + Database

```powershell
cd D:\GitHub\online-learning-platform
docker compose --profile backend up --build -d
```

Kiểm tra:

```powershell
docker compose --profile backend ps
```

## Terminal 2 – Frontend

```powershell
cd D:\GitHub\online-learning-platform\frontend\web
npm ci
npm run dev
```

Mở trình duyệt:

```text
http://localhost:5173
```

Nếu đây là lần đầu setup project, hãy đọc tiếp phần cấu hình `.env` bên dưới.

---

# 6. Chuẩn bị môi trường

Khuyến nghị:

- Node.js 22+
- npm
- Docker Desktop
- Docker Compose
- JDK 21
- Maven 3.9+

Nếu Backend chạy bằng Docker thì không bắt buộc phải dùng Maven để khởi động các service.

Kiểm tra môi trường:

```powershell
node --version
npm --version
docker compose version
docker info
```

Nếu chạy Backend trực tiếp bằng Maven:

```powershell
java -version
mvn -version
```

---

# 7. Cấu hình Backend

Đi tới thư mục root:

```powershell
cd D:\GitHub\online-learning-platform
```

Nếu chưa có `.env`:

```powershell
Copy-Item .env.example .env
```

Các biến bắt buộc:

```dotenv
MYSQL_ROOT_PASSWORD=
AUTH_DB_PASSWORD=
COURSE_DB_PASSWORD=
LEARNING_DB_PASSWORD=
PAYMENT_DB_PASSWORD=
AI_DB_PASSWORD=

JWT_SECRET=
JWT_ISSUER=learnsphere
JWT_ACCESS_TOKEN_SECONDS=900

REFRESH_TOKEN_EXPIRATION_SECONDS=604800
REFRESH_COOKIE_SECURE=false

CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Các biến tích hợp chưa dùng có thể để trống:

```dotenv
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
AWS_REGION=
AWS_S3_BUCKET=
AI_API_KEY=
```

## Tạo secret ngẫu nhiên

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Chạy nhiều lần để tạo các password/secret khác nhau.

> Không commit file `.env` lên Git.

---

# 8. Cấu hình Frontend

Đi tới:

```powershell
cd D:\GitHub\online-learning-platform\frontend\web
```

Nếu chưa có `.env`:

```powershell
Copy-Item .env.example .env
```

Nội dung cần có:

```dotenv
VITE_API_URL=http://localhost:8080
```

Đúng:

```text
http://localhost:8080
```

Không dùng:

```text
http://localhost:8080/api/v1
```

---

# 9. Chạy toàn bộ Backend

Đứng ở thư mục root:

```powershell
cd D:\GitHub\online-learning-platform
```

Lần đầu hoặc sau khi sửa code Backend:

```powershell
docker compose --profile backend up --build -d
```

Các lần sau nếu không cần build lại:

```powershell
docker compose --profile backend up -d
```

Kiểm tra:

```powershell
docker compose --profile backend ps
```

Kết quả mong đợi:

```text
elearning-mysql                               healthy
online-learning-platform-auth-service-1      Up
online-learning-platform-course-service-1    Up
online-learning-platform-learning-service-1  Up
online-learning-platform-payment-service-1   Up
online-learning-platform-ai-service-1        Up
online-learning-platform-api-gateway-1       Up
```

---

# 10. Chạy Frontend

Mở terminal khác:

```powershell
cd D:\GitHub\online-learning-platform\frontend\web
```

Cài dependency lần đầu:

```powershell
npm ci
```

Chạy Vite:

```powershell
npm run dev
```

Hoặc cố định port `5173`:

```powershell
npm run dev -- --port 5173 --strictPort
```

Truy cập:

```text
http://localhost:5173
```

---

# 11. Các địa chỉ local

| Thành phần | Địa chỉ |
|---|---|
| Frontend | `http://localhost:5173` |
| API Gateway | `http://localhost:8080` |
| MySQL | `127.0.0.1:3306` |

Các port `8081–8085` là port nội bộ của các microservice khi chạy bằng Docker Compose.

---

# 12. Kiểm tra hệ thống sau khi chạy

## Gateway

```powershell
curl.exe -i http://localhost:8080/actuator/health
```

Kết quả mong đợi:

```json
{"status":"UP"}
```

## Database

```powershell
docker compose exec mysql mysql -uroot -p
```

Trong MySQL:

```sql
SHOW DATABASES;
```

Nên có:

```text
auth_db
course_db
learning_db
payment_db
ai_db
```

Thoát:

```sql
exit;
```

---

# 13. Test đăng ký và đăng nhập

## Đăng ký

Mở:

```text
http://localhost:5173/register
```

Ví dụ:

```text
Họ tên: Nguyen Van A
Email: test@example.com
Password: Abcdef12
Confirm Password: Abcdef12
```

Tài khoản mới mặc định được gán role:

```text
USER
```

Nếu email đã tồn tại, Backend trả lỗi:

```text
EMAIL_ALREADY_EXISTS
```

## Đăng nhập

Mở:

```text
http://localhost:5173/login
```

Sau khi đăng nhập thành công:

- access token được lưu qua storage abstraction của Frontend;
- refresh token nằm trong HttpOnly Cookie;
- `/api/v1/users/me` được dùng để lấy thông tin user;
- access token hết hạn sẽ tự động được refresh;
- logout sẽ revoke refresh token của phiên hiện tại.

---

# 14. Auth API hiện có

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
```

---

# 15. Test nhanh Register API bằng PowerShell

```powershell
$body = @{
    fullName = "Nhuan Nguyen"
    email    = "test123456@gmail.com"
    password = "Abcdef12"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

Nếu thành công sẽ nhận response có:

```text
success = True
```

---

# 16. Build và Test

## Frontend

```powershell
cd frontend\web
npm run build
npm run lint
npm test
```

## Backend

Tại root project:

```powershell
mvn -f backend/pom.xml verify
```

Riêng Auth Service:

```powershell
mvn -f backend/auth-service/pom.xml verify
```

Riêng Gateway:

```powershell
mvn -f backend/api-gateway/pom.xml verify
```

---

# 17. Xem log Backend

Toàn bộ Backend:

```powershell
docker compose --profile backend logs -f
```

Auth Service:

```powershell
docker compose logs -f auth-service
```

API Gateway:

```powershell
docker compose logs -f api-gateway
```

100 dòng cuối của Auth:

```powershell
docker compose logs --tail=100 auth-service
```

---

# 18. Dừng và chạy lại hệ thống

Dừng nhưng giữ container:

```powershell
docker compose --profile backend stop
```

Chạy lại:

```powershell
docker compose --profile backend start
```

Dừng và remove container:

```powershell
docker compose --profile backend down
```

## Cẩn thận với `down -v`

```powershell
docker compose down -v
```

Lệnh này xóa volume MySQL và có thể làm mất:

- tài khoản đã đăng ký;
- refresh token;
- dữ liệu test;
- dữ liệu Course/Learning/Payment sau này.

Chỉ dùng khi bạn chắc chắn muốn reset database.

---

# 19. Chạy Backend trực tiếp bằng Maven / IDE

Thông thường nên dùng Docker Compose.

Nếu muốn debug một service trong IntelliJ, có thể chỉ chạy MySQL bằng Docker:

```powershell
docker compose --profile backend stop
docker compose up -d mysql
```

Ví dụ chạy Auth Service:

```powershell
$env:JWT_SECRET = "<JWT_SECRET>"
$env:AUTH_DB_PASSWORD = "<AUTH_DB_PASSWORD>"

mvn -f backend/auth-service/pom.xml spring-boot:run
```

> Java/Maven không tự đọc file `.env`.

Nếu dùng IntelliJ, thêm các biến môi trường vào Run Configuration.

---

# 20. Workflow phát triển khuyến nghị

## Khi chủ yếu làm Frontend

```powershell
# Backend + DB
docker compose --profile backend up -d

# Frontend
cd frontend\web
npm run dev
```

## Khi vừa sửa Backend

```powershell
docker compose --profile backend up --build -d
```

## Khi chỉ debug Auth Service

Có thể dùng:

```text
MySQL        → Docker
Auth Service → IntelliJ / Maven
Gateway      → Docker / IntelliJ
Frontend     → Vite
```

Không bắt buộc phải chạy toàn bộ microservice nếu chỉ đang debug một module.

---

# 21. Lỗi thường gặp

## `npm ERR! enoent Could not read package.json`

Bạn đang chạy npm sai thư mục.

Sai:

```powershell
cd frontend
npm run dev
```

Đúng:

```powershell
cd frontend\web
npm run dev
```

## Port 5173 đang bị sử dụng

```powershell
netstat -ano | findstr :5173
```

Sau đó:

```powershell
taskkill /PID <PID> /F
```

## Docker không kết nối được Engine

```powershell
docker info
```

Nếu lỗi, mở Docker Desktop và chờ Engine khởi động hoàn tất.

## Compose báo thiếu biến môi trường

```powershell
docker compose --profile backend config -q
```

Kiểm tra lại `.env` ở thư mục root.

## Gateway trả `503 Service Unavailable`

```powershell
docker compose --profile backend ps
```

Sau đó xem log service tương ứng:

```powershell
docker compose logs --tail=100 auth-service
```

## Frontend bị CORS

Kiểm tra Frontend:

```dotenv
VITE_API_URL=http://localhost:8080
```

Backend:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Sau khi sửa `.env`, restart FE/BE.

## Console có `/auth/refresh 401` khi chưa đăng nhập

Frontend có thể thử restore session khi khởi động. Nếu không có refresh cookie hợp lệ thì `401` có thể là hành vi bình thường của trạng thái Guest.

Khi debug, hãy kiểm tra request thực sự liên quan:

```text
/api/v1/auth/register
/api/v1/auth/login
/api/v1/users/me
```

## `EMAIL_ALREADY_EXISTS`

Email đã tồn tại trong `auth_db`. Hãy sử dụng email khác.

## Flyway báo thiếu quyền

Đăng nhập MySQL:

```powershell
docker compose exec mysql mysql -uroot -p
```

Sau đó:

```sql
SOURCE /docker-entrypoint-initdb.d/03-auth-migrations.sql;
exit;
```

Restart Auth:

```powershell
docker compose restart auth-service
```

---

# 22. Lưu ý bảo mật

Không commit:

```text
.env
JWT_SECRET
database password
VNPay secret
AWS secret
AI API key
```

Refresh Token:

- không lưu trong localStorage;
- không lưu trong sessionStorage;
- không trả trong JSON;
- chỉ sử dụng HttpOnly Cookie;
- database chỉ lưu hash.

Khi deploy HTTPS:

```dotenv
REFRESH_COOKIE_SECURE=true
```

---

# 23. Trạng thái hiện tại

```text
Foundation                     ✅
Auth Register/Login            ✅
JWT Access Token               ✅
Refresh Token                  ✅
Refresh Token Rotation         ✅
Automatic Token Refresh        ✅
Server-side Logout             ✅
USER / ADMIN authorization     ✅

Course Public Catalog          🚧 Next
Course Detail                  ⬜
Admin Course Management        ⬜
Enrollment / Learning          ⬜
Quiz                           ⬜
VNPay                          ⬜
AI Assistant                   ⬜
AWS Deployment                 ⬜
```

---

# 24. Tài liệu liên quan

Trong thư mục `docs/`:

```text
API_CONVENTIONS.md
FOUNDATION_AUDIT.md
FOUNDATION_REPORT.md
AUTH_REPORT.md
REFRESH_TOKEN_REPORT.md
DESIGN.md
```

Quy tắc phát triển toàn project:

```text
RULES.md
```

---

# 25. Quick Commands

## Chạy toàn bộ Backend + DB

```powershell
cd D:\GitHub\online-learning-platform
docker compose --profile backend up -d
```

## Build lại Backend

```powershell
docker compose --profile backend up --build -d
```

## Chạy Frontend

```powershell
cd D:\GitHub\online-learning-platform\frontend\web
npm run dev
```

## Kiểm tra Backend

```powershell
docker compose --profile backend ps
```

## Dừng Backend

```powershell
docker compose --profile backend down
```

---

## Dữ liệu mẫu cho toàn hệ thống

Sau khi backend đã tạo schema bằng Flyway, chạy tại root:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\mysql\seed.ps1
```

File `infra/mysql/05-seed-data.sql` bổ sung 5 bản ghi mẫu mỗi bảng nghiệp vụ, riêng `roles` giữ 2 role hợp lệ `USER`/`ADMIN`. Hướng dẫn, tài khoản demo và lưu ý với database cũ: [infra/mysql/README.md](infra/mysql/README.md).

## SGSphere

**Learn without limits. Build skills for your future.**
