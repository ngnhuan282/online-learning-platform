# Dữ liệu mẫu SGSphere

File duy nhất chứa dữ liệu mẫu: [`05-seed-data.sql`](05-seed-data.sql), dùng cho MySQL 8.4 sau khi các service đã chạy Flyway. Schema do migration quản lý; seed không tạo lại bảng nghiệp vụ và không sửa `flyway_schema_history`.

## Số lượng và phạm vi

| Database | Bảng | Số bản ghi mẫu mỗi bảng |
| --- | --- | --- |
| `auth_db` | `users`, `user_roles`, `refresh_tokens` | 5 |
| `auth_db` | `roles` | 2: `USER`, `ADMIN`, có sẵn từ migration |
| `course_db` | `categories`, `courses` | 5 |
| `learning_db` | `enrollments`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, `notifications` | 5 |
| `payment_db` | `orders`, `order_items`, `payments`, `payment_transactions` | 5 |
| `ai_db` | Chưa có entity/bảng nghiệp vụ trong mã nguồn | Không tạo bảng giả |

Tổng cộng **87 bản ghi trong 18 bảng** trên database mới đã migrate. Không thêm role ngoài enum để đủ 5 và không seed bảng lịch sử Flyway. Trên database có dữ liệu, seed bổ sung 5 bản ghi mẫu mỗi bảng; tổng số dòng thực tế có thể lớn hơn 5.

ID mẫu là `900001`–`900005`. Mỗi tài khoản có một role: tài khoản quản trị có `ADMIN`, bốn học viên có `USER`. Các quan hệ user/course/enrollment/order/payment/quiz khớp nhau. Mỗi quiz có một câu hỏi và một lựa chọn đúng để giữ đúng số lượng 5 dòng ở mọi bảng; đây là dữ liệu kiểm tra tối giản. Điểm quiz là 100, tương ứng với câu trả lời đúng. `lesson_id` là mã tham chiếu mẫu vì Course chưa có bảng lessons.

## Khởi tạo trên database mới

Chuẩn bị `.env` theo README ở root. Tại thư mục dự án:

```powershell
docker compose --profile backend up --build -d
powershell -ExecutionPolicy Bypass -File .\infra\mysql\seed.ps1
```

Script chờ tối đa 120 giây cho các bảng/migration, copy file SQL vào container, rồi chạy bằng tài khoản root và mật khẩu đã cấu hình trong container. Kết quả cuối liệt kê số bản ghi mẫu từng bảng.

Seed là bước chủ động: Compose chỉ mount file ở `/seed/05-seed-data.sql`, **không chạy seed trong `/docker-entrypoint-initdb.d`**. Nhờ đó Flyway tạo bảng trước, không xung đột khi khởi tạo MySQL mới.

Nếu cần chạy SQL trực tiếp bằng MySQL client:

```powershell
docker compose cp infra/mysql/05-seed-data.sql mysql:/tmp/sgsphere-demo-seed.sql
docker compose exec mysql mysql --default-character-set=utf8mb4 -uroot -p
```

Nhập `MYSQL_ROOT_PASSWORD`, rồi tại dấu nhắc `mysql>`:

```sql
SOURCE /tmp/sgsphere-demo-seed.sql;
EXIT;
```

Không dùng `--force`: cần dừng khi gặp lỗi. Seed dùng procedure tạm và transaction xuyên các database InnoDB; lỗi trong quá trình chèn sẽ rollback mọi bản ghi mẫu của lần chạy đó.

## Database đã có dữ liệu

- Không cần xóa volume. Seed không `DELETE`, `TRUNCATE`, tắt khóa ngoại hoặc ghi đè bản ghi đã tồn tại.
- Chạy lại không nhân đôi dữ liệu, không đặt lại mật khẩu/trạng thái tài khoản. Nếu ID mẫu bị chiếm bởi đối tượng khác hoặc email/slug trùng ở ID khác, lần seed bị hủy và rollback.
- Các schema phải phù hợp với entity/migration hiện tại. Nếu từng dùng seed cũ để tạo bảng, có thể thiếu cột (ví dụ `refresh_tokens.revoked_at`) hoặc thiếu lịch sử Flyway. Seed mới không tự sửa schema cũ và không tự baseline. Cần đối chiếu schema, sao lưu rồi thực hiện chuyển đổi migration phù hợp trước khi chạy; không bật baseline toàn hệ thống hoặc xóa volume để né lỗi.
- Course nay có Flyway V1 để tạo `categories` và `courses` trên schema trống. Database Course cũ chưa có lịch sử Flyway cần được xử lý chuyển đổi như trên trước khi khởi động bằng phiên bản này.
- Quyền DDL mới chỉ được tự cấp trên volume mới. Với volume đang dùng, chạy các lệnh dưới bằng root nếu Course/Learning chưa có quyền migration, rồi khởi động lại service tương ứng:

```powershell
docker compose cp infra/mysql/04-course-migrations.sql mysql:/tmp/04-course-migrations.sql
docker compose cp infra/mysql/04-learning-migrations.sql mysql:/tmp/04-learning-migrations.sql
docker compose exec mysql mysql -uroot -p
```

```sql
SOURCE /tmp/04-course-migrations.sql;
SOURCE /tmp/04-learning-migrations.sql;
EXIT;
```

## Tài khoản mẫu

| Email | Mật khẩu demo | Role |
| --- | --- | --- |
| `demo.admin@example.com` | `Admin123` | `ADMIN` |
| `demo.an@example.com` | `User123!` | `USER` |
| `demo.binh@example.com` | `User123!` | `USER` |
| `demo.chi@example.com` | `User123!` | `USER` |
| `demo.dung@example.com` | `User123!` | `USER` |

Đây là tài khoản demo với mật khẩu công khai, chỉ dùng trong môi trường phát triển. SQL lưu BCrypt hash, không lưu mật khẩu thuần trong cột database. Năm refresh token mẫu đã hết hạn và bị thu hồi; đăng nhập thật sẽ tạo token mới. Thanh toán mẫu đều dùng provider `MOCK`, không gọi VNPay. API Payment hiện vẫn trả `501 FEATURE_NOT_IMPLEMENTED`; seed dữ liệu không triển khai các API còn thiếu này.

## Kiểm chứng độc lập

```powershell
mvn -f backend/pom.xml verify -B -ntp
docker compose --profile backend build auth-service course-service learning-service payment-service
python infra/mysql/verify-seed.py
```

Script kiểm chứng tạo MySQL 8.4 và bốn service trên network Docker riêng, dùng mật khẩu ngẫu nhiên và JAR vừa build. Kiểm tra migration thật, Hibernate validation, số bản ghi, chạy lại, xung đột ID/email và rollback xuyên database. Cuối cùng đăng nhập cả năm tài khoản và đọc dữ liệu qua API Auth/Course/Learning. Dữ liệu Payment được kiểm tra bằng SQL (quan hệ đơn hàng, số tiền, trạng thái, enum và enrollment), đồng thời xác nhận API hiện trả 501 theo code stub. Các container/network kiểm thử được dọn sau khi kết thúc; database đang dùng của dự án không bị chạm tới.
