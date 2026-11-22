# Schema tổng hợp & Dữ liệu mẫu ChitChatGo

## Kiến trúc 2 tầng (File A tổng hợp + File con trong từng service)

1. **File A tổng hợp (chạy 1 file duy nhất là có đủ 5 DB, 71 bảng và dữ liệu mẫu)**:
   - [`infra/mysql/seed-data.sql`](seed-data.sql)
   - Phần 1 tạo đầy đủ 5 database (`auth_db`, `course_db`, `learning_db`, `payment_db`, `ai_db`) và **71 bảng InnoDB** (với đầy đủ khóa chính, khóa ngoại, `CHECK`, `UNIQUE` và `INDEX` khai báo inline trong `CREATE TABLE IF NOT EXISTS`), khớp 100% với hợp của 5 file migration service.
   - Phần 2 chạy stored procedure giao dịch `seed_chitchatgo_data()` để nạp dữ liệu hệ thống nền (`roles`, `permissions`, `role_permissions`, `community_topics`, `shop_items`, `engagement_settings`, `engagement_reward_rules`, `pro_plans`) và toàn bộ dữ liệu mẫu (**tối thiểu 15 dòng cho mọi bảng nghiệp vụ**).
2. **File migration con trong từng service (gộp gọn 1 file duy nhất/service)**:
   - `backend/auth-service/src/main/resources/db/migration/V1__init_auth_schema.sql` (`auth_db` — 12 bảng)
   - `backend/course-service/src/main/resources/db/migration/V1__init_course_schema.sql` (`course_db` — 6 bảng)
   - `backend/learning-service/src/main/resources/db/migration/V1__init_learning_schema.sql` (`learning_db` — 43 bảng)
   - `backend/payment-service/src/main/resources/db/migration/V1__init_payment_schema.sql` (`payment_db` — 6 bảng)
   - `backend/ai-service/src/main/resources/db/migration/V1__init_ai_schema.sql` (`ai_db` — 4 bảng)

Cả 5 service đều đã bật `spring.flyway.baseline-on-migrate: true` với `baseline-version: 1`, nên bạn có thể chọn **một trong các cách** sau, cách nào cũng chạy ổn:

### Cách 0 (khuyên dùng): Chỉ 1 lệnh Docker Compose

`compose.yaml` đã gắn `seed-data.sql` vào `/docker-entrypoint-initdb.d/03-seed-data.sql`. Khi volume `mysql_data` **còn trống** (lần chạy đầu, hoặc sau `down -v`), MySQL tự tạo 5 DB, 5 user, 71 bảng và nạp dữ liệu mẫu trước khi báo healthy; sau đó các service khởi động, Flyway tạo baseline V1 và Hibernate kiểm tra schema.

```powershell
docker compose --profile backend up --build -d
```

> Nếu volume đã có dữ liệu cũ thì MySQL sẽ bỏ qua toàn bộ script init. Muốn tạo lại từ đầu, chạy `docker compose --profile backend down -v` trước (lệnh này **xóa sạch** dữ liệu cũ).

### Cách 1: Chạy độc lập 1 file duy nhất trên MySQL 8.4 trắng (không cần khởi chạy service trước)

```powershell
mysql --default-character-set=utf8mb4 -uroot -p < infra/mysql/seed-data.sql
```

Hoặc trên container `mysql` của Docker Compose:

```powershell
docker compose up -d --wait mysql
docker compose cp infra/mysql/seed-data.sql mysql:/tmp/chitchatgo-seed.sql
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 --batch -uroot < /tmp/chitchatgo-seed.sql'
```

Nếu sau đó khởi động 5 Spring Boot service, Flyway sẽ tự nhận diện schema đã tồn tại, tạo baseline ở `V1`, và Hibernate `ddl-auto: validate` xác thực toàn bộ 71 bảng.

### Cách 2: Khởi động backend để Flyway tạo bảng trước, rồi nạp `seed-data.sql`

```powershell
docker compose down -v
docker compose --profile backend up --build -d --wait
docker compose cp infra/mysql/seed-data.sql mysql:/tmp/chitchatgo-seed.sql
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 --batch -uroot < /tmp/chitchatgo-seed.sql'
```

Các lệnh `CREATE DATABASE IF NOT EXISTS` và `CREATE TABLE IF NOT EXISTS` sẽ giữ nguyên bảng và bảng lịch sử `flyway_schema_history` hiện có, sau đó procedure `seed_chitchatgo_data()` nạp dữ liệu mẫu trong 1 transaction (rollback toàn bộ nếu có xung đột ID/khóa tự nhiên).

## Tài khoản mẫu

| Email | Mật khẩu | Quyền / trạng thái |
| --- | --- | --- |
| `admin@gmail.com` | `Admin123` | `ADMIN` + `USER`, `ACTIVE` |
| `user@gmail.com` | `User123` | `USER`, `ACTIVE` |
| `tran.thi.b@elearning.com` | `User123!` | `USER`, `ACTIVE` |
| `le.van.c@elearning.com` | `User123!` | `USER`, `ACTIVE` |
| `pham.thi.d@elearning.com` | `User123!` | `USER`, `LOCKED` |
| `hoang.van.e@elearning.com` | `User123!` | `USER`, `ACTIVE` |
| 12 học viên `@chitchatgo.vn` khác | `User123!` | `USER`, `ACTIVE` |

Đây là thông tin đăng nhập công khai dành cho phát triển (mật khẩu lưu dạng BCrypt hash). Seed tìm user theo email và role theo tên, giữ nguyên ID và tên hồ sơ đã tồn tại.

## Quy mô dữ liệu mẫu (tối thiểu 15 bản ghi/bảng)

Toàn bộ **68/68 bảng nghiệp vụ & RBAC** trên cả 5 database đạt **≥ 15 dòng** (tổng **1.559 bản ghi**), chỉ giữ nguyên 3 bảng hệ thống/singleton (`auth_db.roles` [2], `learning_db.engagement_settings` [1], `learning_db.learning_admin_actor_locks` [0]):

| Database | Dữ liệu sau khi chạy `seed-data.sql` |
| --- | --- |
| `auth_db` | 18 `users`, 19 `user_roles`, 54 `permissions`, 54 `role_permissions`, 18 `refresh_tokens` (hết hạn/thu hồi), 16 `admin_audit_logs`, 15 `user_external_identities`, 15 `google_link_intents`, 15 `oauth_login_codes`, 15 `password_reset_tokens`, 15 `password_reset_rate_limits` |
| `course_db` | 15 `categories`, 18 `courses` (16 `PUBLISHED`, 1 `DRAFT`, 1 `ARCHIVED`), 36 `sections`, 54 `lessons`, 24 `lesson_resources`, 33 `reviews` khớp `avg_rating`/`review_count` |
| `learning_db` | ≥15 bản ghi ở toàn bộ 41 bảng nghiệp vụ (20 `enrollments`, 16 `payment_enrollment_receipts`, 26 `lesson_progress`, 16 `quizzes`, 32 `quiz_questions`, 128 `quiz_options`, 18 `quiz_attempts`, 34 `quiz_answers`, 20 `notifications`, 18 `learner_profiles`, 26 `learning_xp_events`, 25 `learning_activity_days`, 20 `learner_rewards`, 15 `community_topics`, 18 `community_posts`, 24 `community_comments`, 15 `shop_items`, 28 `shop_inventory`, 18 `shop_purchases`, 16 `learning_frozen_days`, 15 `pro_memberships`, 18 `pro_grants`, 16 `pro_activation_codes`, 15 `pro_activation_attempts`, 15 `engagement_reward_rules`, 15 `learner_admin_adjustments`, 16 `learning_admin_audit`, 15 `gem_topup_receipts`, 15 `toeic_exams`, 16 `toeic_attempts`, 16 `toeic_lesson_progress`, 18 `toeic_notes`, 15 `toeic_media`, 15 `dictation_audio`/`exercises`/`revisions`/`imports`/`sync`/`sources`, 16 `dictation_attempts`, 24 `dictation_responses`) |
| `payment_db` | 15 `pro_plans` (3 gói gốc đang mở bán + 12 gói chiến dịch), 36 `orders` (17 `COURSE`, 4 `PRO`, 15 `GEM_TOPUP`), 36 `order_items`, 36 `payments` (`MOCK`), 36 `payment_transactions`, 15 `payment_admin_audit` |
| `ai_db` | 16 `ai_conversations`, 32 `ai_messages` (16 `USER` + 16 `AI`), 16 `ai_usage_logs`, 16 `ai_daily_usage` |

## Kiểm chứng độc lập

```powershell
mvn -f backend/pom.xml verify -B -ntp
docker compose --profile backend build auth-service course-service learning-service payment-service ai-service
python infra/mysql/verify-seed.py
```
