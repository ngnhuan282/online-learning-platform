-- SGSphere development seed for MySQL 8.4. Run after all service Flyway migrations.
-- Admin: admin@gmail.com / Admin123; learner: user@gmail.com / User123.
-- Other sample learners use User123!; pham.thi.d@elearning.com is intentionally LOCKED.
-- Users are resolved by email, roles by name. Existing user IDs and profile names are preserved.
-- Business fixture IDs 1..5 and curriculum IDs 910001..910501 are checked before use.
-- Unrelated ID/natural-key collisions abort and roll back the whole import.
-- All payment fixtures use MOCK; refresh-token fixtures are expired and revoked.
-- This file creates no business tables and never changes Flyway metadata.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;
USE auth_db;

DROP PROCEDURE IF EXISTS seed_sgsphere_data;
DELIMITER $$
CREATE PROCEDURE seed_sgsphere_data()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    IF (SELECT COUNT(*) FROM information_schema.tables
        WHERE engine = 'InnoDB' AND (
            (table_schema = 'auth_db' AND table_name IN ('roles', 'users', 'user_roles', 'refresh_tokens'))
            OR (table_schema = 'course_db' AND table_name IN ('categories', 'courses', 'sections', 'lessons'))
            OR (table_schema = 'learning_db' AND table_name IN (
                'enrollments', 'lesson_progress', 'quizzes', 'quiz_questions',
                'quiz_options', 'quiz_attempts', 'quiz_answers', 'notifications'))
            OR (table_schema = 'payment_db' AND table_name IN (
                'orders', 'order_items', 'payments', 'payment_transactions'))
        )) <> 20 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Run all service migrations first; 20 InnoDB business tables are required';
    END IF;
    IF (SELECT COUNT(*) FROM auth_db.roles WHERE name IN ('USER', 'ADMIN')) <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Auth migrations must provide USER and ADMIN roles';
    END IF;
    IF EXISTS (SELECT 1 FROM auth_db.users WHERE email IN ('admin@gmail.com', 'user@gmail.com') AND deleted_at IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A requested seed account was deleted; restore it explicitly before seeding';
    END IF;

    SET @seed_admin_changed = EXISTS (SELECT 1 FROM auth_db.users WHERE email = 'admin@gmail.com' AND NOT (password_hash <=> '$2a$10$DNTIsYdZXkpNP96Im8d.CuGqysyIBjQ6Hyo1tkZIJEDuRZ/ApCDdS'));
    SET @seed_user_changed = EXISTS (SELECT 1 FROM auth_db.users WHERE email = 'user@gmail.com' AND NOT (password_hash <=> '$2a$10$cJZdoW.57vF4D7FmcHfat.e5fDZQ5FjIUFz0MjnR1RKtpwRHEiaM2'));

    INSERT INTO auth_db.users (email, password_hash, full_name, status, created_at, updated_at) VALUES
    ('admin@gmail.com', '$2a$10$DNTIsYdZXkpNP96Im8d.CuGqysyIBjQ6Hyo1tkZIJEDuRZ/ApCDdS', 'System Administrator', 'ACTIVE', NOW(6), NOW(6)),
    ('user@gmail.com', '$2a$10$cJZdoW.57vF4D7FmcHfat.e5fDZQ5FjIUFz0MjnR1RKtpwRHEiaM2', 'Nguyễn Văn A', 'ACTIVE', NOW(6), NOW(6)),
    ('tran.thi.b@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Trần Thị B', 'ACTIVE', NOW(6), NOW(6)),
    ('le.van.c@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Lê Văn C', 'ACTIVE', NOW(6), NOW(6)),
    ('pham.thi.d@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Phạm Thị D', 'LOCKED', NOW(6), NOW(6)),
    ('hoang.van.e@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Hoàng Văn E', 'ACTIVE', NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE
        credential_version = credential_version + IF(email IN ('admin@gmail.com', 'user@gmail.com') AND NOT (password_hash <=> VALUES(password_hash)), 1, 0),
        password_hash = IF(email IN ('admin@gmail.com', 'user@gmail.com'), VALUES(password_hash), password_hash),
        status = IF(email IN ('admin@gmail.com', 'user@gmail.com'), 'ACTIVE', status);

    SET @seed_admin_id = (SELECT id FROM auth_db.users WHERE email = 'admin@gmail.com');

    SET @seed_user_id = (SELECT id FROM auth_db.users WHERE email = 'user@gmail.com');

    SET @seed_b_id = (SELECT id FROM auth_db.users WHERE email = 'tran.thi.b@elearning.com');

    SET @seed_c_id = (SELECT id FROM auth_db.users WHERE email = 'le.van.c@elearning.com');

    SET @seed_d_id = (SELECT id FROM auth_db.users WHERE email = 'pham.thi.d@elearning.com');

    SET @seed_e_id = (SELECT id FROM auth_db.users WHERE email = 'hoang.van.e@elearning.com');

    INSERT INTO auth_db.user_roles (user_id, role_id)
    SELECT u.id, r.id FROM auth_db.users u JOIN auth_db.roles r
        ON r.name = 'USER' OR (u.email = 'admin@gmail.com' AND r.name = 'ADMIN')
    WHERE u.id IN (@seed_admin_id, @seed_user_id, @seed_b_id, @seed_c_id, @seed_d_id, @seed_e_id)
        AND NOT EXISTS (SELECT 1 FROM auth_db.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

    UPDATE auth_db.refresh_tokens SET revoked_at = NOW(6)
    WHERE revoked_at IS NULL AND ((user_id = @seed_admin_id AND @seed_admin_changed)
        OR (user_id = @seed_user_id AND @seed_user_changed));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, expires_at, revoked_at, created_at)
    SELECT @seed_admin_id, SHA2('sgsphere-seed-refresh-1', 256), SHA2('sgsphere-seed-refresh-1', 256), '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('sgsphere-seed-refresh-1', 256));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, expires_at, revoked_at, created_at)
    SELECT @seed_user_id, SHA2('sgsphere-seed-refresh-2', 256), SHA2('sgsphere-seed-refresh-2', 256), '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('sgsphere-seed-refresh-2', 256));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, expires_at, revoked_at, created_at)
    SELECT @seed_b_id, SHA2('sgsphere-seed-refresh-3', 256), SHA2('sgsphere-seed-refresh-3', 256), '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('sgsphere-seed-refresh-3', 256));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, expires_at, revoked_at, created_at)
    SELECT @seed_c_id, SHA2('sgsphere-seed-refresh-4', 256), SHA2('sgsphere-seed-refresh-4', 256), '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('sgsphere-seed-refresh-4', 256));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, expires_at, revoked_at, created_at)
    SELECT @seed_e_id, SHA2('sgsphere-seed-refresh-6', 256), SHA2('sgsphere-seed-refresh-6', 256), '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('sgsphere-seed-refresh-6', 256));

    -- course_db.categories: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM course_db.categories
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND slug <=> 'luyen-thi-ielts')
                OR (id <=> 2 AND slug <=> 'luyen-thi-toeic')
                OR (id <=> 3 AND slug <=> 'tieng-anh-giao-tiep')
                OR (id <=> 4 AND slug <=> 'tieng-anh-it')
                OR (id <=> 5 AND slug <=> 'ngu-phap-tu-vung'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.categories; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.categories WHERE (name <=> 'Luyện thi IELTS' AND id <> 1)
        OR (name <=> 'Luyện thi TOEIC' AND id <> 2)
        OR (name <=> 'Tiếng Anh Giao tiếp' AND id <> 3)
        OR (name <=> 'Tiếng Anh Công nghệ (IT)' AND id <> 4)
        OR (name <=> 'Ngữ pháp & Từ vựng căn bản' AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.categories; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.categories WHERE (slug <=> 'luyen-thi-ielts' AND id <> 1)
        OR (slug <=> 'luyen-thi-toeic' AND id <> 2)
        OR (slug <=> 'tieng-anh-giao-tiep' AND id <> 3)
        OR (slug <=> 'tieng-anh-it' AND id <> 4)
        OR (slug <=> 'ngu-phap-tu-vung' AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.categories; no data was changed';
    END IF;

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at) VALUES
    (1, 'Luyện thi IELTS', 'luyen-thi-ielts', 'Các khóa học luyện thi IELTS toàn diện 4 kỹ năng từ cơ bản đến nâng cao.', NOW(), NOW()),
    (2, 'Luyện thi TOEIC', 'luyen-thi-toeic', 'Lộ trình bứt phá mục tiêu TOEIC 650+ đến 850+ cho sinh viên và người đi làm.', NOW(), NOW()),
    (3, 'Tiếng Anh Giao tiếp', 'tieng-anh-giao-tiep', 'Phát âm chuẩn IPA, phản xạ tiếng Anh tự nhiên trong đời sống và công việc.', NOW(), NOW()),
    (4, 'Tiếng Anh Công nghệ (IT)', 'tieng-anh-it', 'Thuật ngữ, tài liệu kỹ thuật, phỏng vấn và làm việc trong môi trường công nghệ.', NOW(), NOW()),
    (5, 'Ngữ pháp & Từ vựng căn bản', 'ngu-phap-tu-vung', 'Hệ thống hóa ngữ pháp cốt lõi và từ vựng thông dụng xây gốc tiếng Anh vững chắc.', NOW(), NOW())
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

    -- course_db.courses: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM course_db.courses
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND slug <=> 'ielts-masterclass-75')
                OR (id <=> 2 AND slug <=> 'toeic-dot-pha-850')
                OR (id <=> 3 AND slug <=> 'tieng-anh-giao-tiep-di-lam')
                OR (id <=> 4 AND slug <=> 'english-for-software-engineers')
                OR (id <=> 5 AND slug <=> 'ngu-phap-tieng-anh-nen-tang'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.courses; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.courses WHERE (slug <=> 'ielts-masterclass-75' AND id <> 1)
        OR (slug <=> 'toeic-dot-pha-850' AND id <> 2)
        OR (slug <=> 'tieng-anh-giao-tiep-di-lam' AND id <> 3)
        OR (slug <=> 'english-for-software-engineers' AND id <> 4)
        OR (slug <=> 'ngu-phap-tieng-anh-nen-tang' AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.courses; no data was changed';
    END IF;

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at) VALUES
    (1, 'IELTS Masterclass 7.5+ Toàn Diện', 'ielts-masterclass-75', 'Khóa học chiến thuật chuyên sâu giúp đạt mục tiêu IELTS 7.5+ trong 3 tháng.', 1, 1490000.00, 2490000.00, 'ADVANCED', 'PUBLISHED', '/images/english-ielts.jpg', NOW(), NOW()),
    (2, 'TOEIC Đột Phá 850+ Cấp Tốc', 'toeic-dot-pha-850', 'Phương pháp luyện nghe hiểu và làm bài đọc nhanh, cam kết chuẩn đầu ra 850+.', 2, 990000.00, 1690000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-toeic.jpg', NOW(), NOW()),
    (3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 'tieng-anh-giao-tiep-di-lam', 'Tự tin giao tiếp với sếp và đồng nghiệp nước ngoài, thuyết trình dự án mượt mà.', 3, 790000.00, 1290000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', NOW(), NOW()),
    (4, 'English for Software Engineers & IT', 'english-for-software-engineers', 'Luyện kỹ năng đọc tài liệu API, viết email, stand-up meeting và phỏng vấn quốc tế.', 4, 890000.00, 1490000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-workplace.jpg', NOW(), NOW()),
    (5, 'Ngữ Pháp Tiếng Anh Nền Tảng & Ứng Dụng', 'ngu-phap-tieng-anh-nen-tang', 'Nắm trọn 12 thì tiếng Anh, cấu trúc câu phức và mẹo ghi nhớ từ vựng dễ hiểu.', 5, 0.00, 490000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', NOW(), NOW())
    ON DUPLICATE KEY UPDATE title = VALUES(title), price = VALUES(price), status = VALUES(status);

    -- course_db.sections: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM course_db.sections
        WHERE id IN (910001, 910002, 910003, 910004, 910005)
            AND NOT ((id <=> 910001 AND course_id <=> 1 AND order_index <=> 0)
                OR (id <=> 910002 AND course_id <=> 2 AND order_index <=> 0)
                OR (id <=> 910003 AND course_id <=> 3 AND order_index <=> 0)
                OR (id <=> 910004 AND course_id <=> 4 AND order_index <=> 0)
                OR (id <=> 910005 AND course_id <=> 5 AND order_index <=> 0))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.sections; no data was changed';
    END IF;

    INSERT INTO course_db.sections (id, course_id, title, order_index, created_at, updated_at) VALUES
    (910001, 1, 'Giáo trình cơ bản', 0, NOW(6), NOW(6)),
    (910002, 2, 'Giáo trình cơ bản', 0, NOW(6), NOW(6)),
    (910003, 3, 'Giáo trình cơ bản', 0, NOW(6), NOW(6)),
    (910004, 4, 'Giáo trình cơ bản', 0, NOW(6), NOW(6)),
    (910005, 5, 'Giáo trình cơ bản', 0, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title);

    -- course_db.lessons: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM course_db.lessons
        WHERE id IN (910101, 910102, 910201, 910301, 910401, 910501)
            AND NOT ((id <=> 910101 AND section_id <=> 910001 AND order_index <=> 0)
                OR (id <=> 910102 AND section_id <=> 910001 AND order_index <=> 1)
                OR (id <=> 910201 AND section_id <=> 910002 AND order_index <=> 0)
                OR (id <=> 910301 AND section_id <=> 910003 AND order_index <=> 0)
                OR (id <=> 910401 AND section_id <=> 910004 AND order_index <=> 0)
                OR (id <=> 910501 AND section_id <=> 910005 AND order_index <=> 0))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.lessons; no data was changed';
    END IF;

    INSERT INTO course_db.lessons (id, section_id, title, lesson_type, content, duration, order_index, is_preview, created_at, updated_at) VALUES
    (910101, 910001, 'IELTS Listening cơ bản', 'TEXT', 'Ghi chú từ khóa và xác định thông tin cần nghe trước khi bắt đầu bài nghe.', 600, 0, TRUE, NOW(6), NOW(6)),
    (910102, 910001, 'IELTS Reading cơ bản', 'TEXT', 'Đọc câu hỏi trước, tìm từ khóa và đối chiếu thông tin trong đoạn văn.', 600, 1, FALSE, NOW(6), NOW(6)),
    (910201, 910002, 'TOEIC Grammar & Vocabulary', 'TEXT', 'Ôn tập từ loại, cấu trúc câu và từ vựng thường gặp trong TOEIC Part 5.', 600, 0, TRUE, NOW(6), NOW(6)),
    (910301, 910003, 'Giao tiếp trong công việc', 'TEXT', 'Sử dụng lời chào, đề nghị và cách từ chối lịch hẹn phù hợp trong công việc.', 600, 0, TRUE, NOW(6), NOW(6)),
    (910401, 910004, 'English for Developers', 'TEXT', 'Luyện cách mô tả công việc, báo cáo tiến độ và đọc tài liệu kỹ thuật bằng tiếng Anh.', 600, 0, TRUE, NOW(6), NOW(6)),
    (910501, 910005, 'Ngữ pháp tiếng Anh nền tảng', 'TEXT', 'Ôn tập thì hiện tại đơn, quá khứ đơn và cấu trúc câu bị động.', 600, 0, TRUE, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content);

    -- learning_db.enrollments: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.enrollments
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND user_id <=> @seed_user_id AND course_id <=> 1)
                OR (id <=> 2 AND user_id <=> @seed_user_id AND course_id <=> 5)
                OR (id <=> 3 AND user_id <=> @seed_b_id AND course_id <=> 2)
                OR (id <=> 4 AND user_id <=> @seed_c_id AND course_id <=> 3)
                OR (id <=> 5 AND user_id <=> @seed_e_id AND course_id <=> 4))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.enrollments; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM learning_db.enrollments WHERE (user_id <=> @seed_user_id AND course_id <=> 1 AND id <> 1)
        OR (user_id <=> @seed_user_id AND course_id <=> 5 AND id <> 2)
        OR (user_id <=> @seed_b_id AND course_id <=> 2 AND id <> 3)
        OR (user_id <=> @seed_c_id AND course_id <=> 3 AND id <> 4)
        OR (user_id <=> @seed_e_id AND course_id <=> 4 AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in learning_db.enrollments; no data was changed';
    END IF;

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at) VALUES
    (1, @seed_user_id, 1, 'ACTIVE', DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY), NULL, '2026-10-01 08:00:00'),
    (2, @seed_user_id, 5, 'COMPLETED', DATE_SUB('2026-10-01 08:00:00', INTERVAL 30 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 5 DAY), '2026-10-01 08:00:00'),
    (3, @seed_b_id, 2, 'ACTIVE', DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY), NULL, '2026-10-01 08:00:00'),
    (4, @seed_c_id, 3, 'ACTIVE', DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY), NULL, '2026-10-01 08:00:00'),
    (5, @seed_e_id, 4, 'ACTIVE', DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY), NULL, '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE status = VALUES(status);

    -- learning_db.lesson_progress: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.lesson_progress
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND user_id <=> @seed_user_id AND course_id <=> 1 AND lesson_id <=> 910101)
                OR (id <=> 2 AND user_id <=> @seed_user_id AND course_id <=> 1 AND lesson_id <=> 910102)
                OR (id <=> 3 AND user_id <=> @seed_b_id AND course_id <=> 2 AND lesson_id <=> 910201)
                OR (id <=> 4 AND user_id <=> @seed_c_id AND course_id <=> 3 AND lesson_id <=> 910301)
                OR (id <=> 5 AND user_id <=> @seed_e_id AND course_id <=> 4 AND lesson_id <=> 910401))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.lesson_progress; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE (user_id <=> @seed_user_id AND lesson_id <=> 910101 AND id <> 1)
        OR (user_id <=> @seed_user_id AND lesson_id <=> 910102 AND id <> 2)
        OR (user_id <=> @seed_b_id AND lesson_id <=> 910201 AND id <> 3)
        OR (user_id <=> @seed_c_id AND lesson_id <=> 910301 AND id <> 4)
        OR (user_id <=> @seed_e_id AND lesson_id <=> 910401 AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in learning_db.lesson_progress; no data was changed';
    END IF;

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at) VALUES
    (1, @seed_user_id, 1, 910101, 'COMPLETED', 100, 1800, DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 9 DAY)),
    (2, @seed_user_id, 1, 910102, 'IN_PROGRESS', 65, 1200, DATE_SUB('2026-10-01 08:00:00', INTERVAL 8 DAY), NULL),
    (3, @seed_b_id, 2, 910201, 'COMPLETED', 100, 2400, DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 6 DAY)),
    (4, @seed_c_id, 3, 910301, 'IN_PROGRESS', 40, 800, DATE_SUB('2026-10-01 08:00:00', INTERVAL 3 DAY), NULL),
    (5, @seed_e_id, 4, 910401, 'COMPLETED', 100, 2100, DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE status = VALUES(status), progress_percent = VALUES(progress_percent);

    -- learning_db.quizzes: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.quizzes
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND course_id <=> 1 AND title <=> 'IELTS Listening & Reading Mini-Test 1')
                OR (id <=> 2 AND course_id <=> 2 AND title <=> 'TOEIC Part 5 Grammar & Vocab Check')
                OR (id <=> 3 AND course_id <=> 3 AND title <=> 'Business Communication Fluency Quiz')
                OR (id <=> 4 AND course_id <=> 4 AND title <=> 'Technical Terms for Software Engineering')
                OR (id <=> 5 AND course_id <=> 5 AND title <=> 'Tenses & Basic Sentence Structure Review'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quizzes; no data was changed';
    END IF;

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at) VALUES
    (1, 1, 910102, 'IELTS Listening & Reading Mini-Test 1', 'Kiểm tra kỹ năng nghe nhận diện bẫy từ vựng và đọc lướt tìm ý chính.', 70, 30, TRUE, '2026-10-01 08:00:00'),
    (2, 2, 910201, 'TOEIC Part 5 Grammar & Vocab Check', 'Đánh giá khả năng chọn dạng từ, liên từ và cấu trúc mệnh đề.', 75, 20, TRUE, '2026-10-01 08:00:00'),
    (3, 3, 910301, 'Business Communication Fluency Quiz', 'Thực hành các tình huống hội thoại thường gặp nơi công sở.', 80, 15, TRUE, '2026-10-01 08:00:00'),
    (4, 4, 910401, 'Technical Terms for Software Engineering', 'Kiểm tra nghĩa và cách dùng thuật ngữ Agile, DevOps, Microservices.', 70, 25, TRUE, '2026-10-01 08:00:00'),
    (5, 5, 910501, 'Tenses & Basic Sentence Structure Review', 'Ôn tập 12 thì tiếng Anh và cấu trúc câu chủ động / bị động.', 70, 20, TRUE, '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE title = VALUES(title), passing_score = VALUES(passing_score);

    -- learning_db.quiz_questions: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.quiz_questions
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND quiz_id <=> 1 AND position <=> 1)
                OR (id <=> 2 AND quiz_id <=> 2 AND position <=> 1)
                OR (id <=> 3 AND quiz_id <=> 3 AND position <=> 1)
                OR (id <=> 4 AND quiz_id <=> 4 AND position <=> 1)
                OR (id <=> 5 AND quiz_id <=> 5 AND position <=> 1))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_questions; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position) VALUES
    (1, 1, 'Which word is the synonym of "crucial" in IELTS Academic reading?', 'SINGLE_CHOICE', 1, 1),
    (2, 2, 'The manager requested that all employees _____ the training session.', 'SINGLE_CHOICE', 1, 1),
    (3, 3, 'How should you professionally decline a meeting due to a schedule conflict?', 'SINGLE_CHOICE', 1, 1),
    (4, 4, 'What does "CI/CD" stand for in software engineering?', 'SINGLE_CHOICE', 1, 1),
    (5, 5, 'Identify the correct passive sentence: "They built this bridge in 2020."', 'SINGLE_CHOICE', 1, 1)
    ON DUPLICATE KEY UPDATE question_text = VALUES(question_text);

    -- learning_db.quiz_options: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.quiz_options
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND question_id <=> 1 AND position <=> 1)
                OR (id <=> 2 AND question_id <=> 2 AND position <=> 1)
                OR (id <=> 3 AND question_id <=> 3 AND position <=> 1)
                OR (id <=> 4 AND question_id <=> 4 AND position <=> 1)
                OR (id <=> 5 AND question_id <=> 5 AND position <=> 1))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_options; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position) VALUES
    (1, 1, 'Vital / Essential', TRUE, 1),
    (2, 2, 'attend', TRUE, 1),
    (3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
    (4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
    (5, 5, 'This bridge was built in 2020.', TRUE, 1)
    ON DUPLICATE KEY UPDATE option_text = VALUES(option_text);

    -- learning_db.quiz_attempts: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.quiz_attempts
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND quiz_id <=> 1 AND user_id <=> @seed_user_id)
                OR (id <=> 2 AND quiz_id <=> 2 AND user_id <=> @seed_b_id)
                OR (id <=> 3 AND quiz_id <=> 3 AND user_id <=> @seed_c_id)
                OR (id <=> 4 AND quiz_id <=> 4 AND user_id <=> @seed_e_id)
                OR (id <=> 5 AND quiz_id <=> 5 AND user_id <=> @seed_user_id))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_attempts; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at) VALUES
    (1, 1, @seed_user_id, 1, 'GRADED', 85, TRUE, DATE_SUB('2026-10-01 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 5 DAY)),
    (2, 2, @seed_b_id, 2, 'GRADED', 90, TRUE, DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY)),
    (3, 3, @seed_c_id, 3, 'GRADED', 60, FALSE, DATE_SUB('2026-10-01 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 3 DAY)),
    (4, 4, @seed_e_id, 4, 'GRADED', 100, TRUE, DATE_SUB('2026-10-01 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 1 DAY)),
    (5, 5, @seed_user_id, 5, 'GRADED', 95, TRUE, DATE_SUB('2026-10-01 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 12 DAY))
    ON DUPLICATE KEY UPDATE score = VALUES(score), passed = VALUES(passed);

    -- learning_db.quiz_answers: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.quiz_answers
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND attempt_id <=> 1 AND question_id <=> 1)
                OR (id <=> 2 AND attempt_id <=> 2 AND question_id <=> 2)
                OR (id <=> 3 AND attempt_id <=> 3 AND question_id <=> 3)
                OR (id <=> 4 AND attempt_id <=> 4 AND question_id <=> 4)
                OR (id <=> 5 AND attempt_id <=> 5 AND question_id <=> 5))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_answers; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded) VALUES
    (1, 1, 1, 1, 'Vital / Essential', TRUE, 1),
    (2, 2, 2, 2, 'attend', TRUE, 1),
    (3, 3, 3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
    (4, 4, 4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
    (5, 5, 5, 5, 'This bridge was built in 2020.', TRUE, 1)
    ON DUPLICATE KEY UPDATE points_awarded = VALUES(points_awarded);

    -- learning_db.notifications: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM learning_db.notifications
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND user_id <=> @seed_admin_id AND type <=> 'SYSTEM')
                OR (id <=> 2 AND user_id <=> @seed_user_id AND type <=> 'ENROLLMENT')
                OR (id <=> 3 AND user_id <=> @seed_b_id AND type <=> 'PROGRESS')
                OR (id <=> 4 AND user_id <=> @seed_c_id AND type <=> 'QUIZ')
                OR (id <=> 5 AND user_id <=> @seed_e_id AND type <=> 'SYSTEM'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.notifications; no data was changed';
    END IF;

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at) VALUES
    (1, @seed_admin_id, 'SYSTEM', 'Hệ thống SGSphere hoạt động ổn định', 'Tất cả 6 microservices và cổng API Gateway đã sẵn sàng phục vụ.', '/admin', '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (2, @seed_user_id, 'ENROLLMENT', 'Chào mừng bạn đến với IELTS Masterclass', 'Bạn đã đăng ký thành công khóa học. Hãy bắt đầu bài học đầu tiên!', '/learning/1', '2026-10-01 08:00:00', DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY)),
    (3, @seed_b_id, 'PROGRESS', 'Bạn đã hoàn thành 50% khóa TOEIC 850+', 'Tuyệt vời! Tiếp tục duy trì phong độ học tập hàng ngày nhé.', '/learning/2', NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY)),
    (4, @seed_c_id, 'QUIZ', 'Kết quả bài kiểm tra Business Communication', 'Bạn đã hoàn thành bài kiểm tra với điểm số 60/100.', '/quizzes/3/result', NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 3 DAY)),
    (5, @seed_e_id, 'SYSTEM', 'Khóa học IT English có bài tập mới', 'Giảng viên đã cập nhật bài học và quiz mới cho tuần này.', '/learning/4', NULL, '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE title = VALUES(title);

    -- payment_db.orders: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM payment_db.orders
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND order_code <=> 'ORD-2026-0001' AND user_id <=> @seed_user_id)
                OR (id <=> 2 AND order_code <=> 'ORD-2026-0002' AND user_id <=> @seed_b_id)
                OR (id <=> 3 AND order_code <=> 'ORD-2026-0003' AND user_id <=> @seed_c_id)
                OR (id <=> 4 AND order_code <=> 'ORD-2026-0004' AND user_id <=> @seed_e_id)
                OR (id <=> 5 AND order_code <=> 'ORD-2026-0005' AND user_id <=> @seed_user_id))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.orders; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM payment_db.orders WHERE (order_code <=> 'ORD-2026-0001' AND id <> 1)
        OR (order_code <=> 'ORD-2026-0002' AND id <> 2)
        OR (order_code <=> 'ORD-2026-0003' AND id <> 3)
        OR (order_code <=> 'ORD-2026-0004' AND id <> 4)
        OR (order_code <=> 'ORD-2026-0005' AND id <> 5)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in payment_db.orders; no data was changed';
    END IF;

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at) VALUES
    (1, 'ORD-2026-0001', @seed_user_id, 'PAID', 1490000.00, 'VND', DATE_ADD('2026-10-01 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY)),
    (2, 'ORD-2026-0002', @seed_b_id, 'PAID', 990000.00, 'VND', DATE_ADD('2026-10-01 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY)),
    (3, 'ORD-2026-0003', @seed_c_id, 'PAID', 790000.00, 'VND', DATE_ADD('2026-10-01 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY)),
    (4, 'ORD-2026-0004', @seed_e_id, 'PAID', 890000.00, 'VND', DATE_ADD('2026-10-01 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY)),
    (5, 'ORD-2026-0005', @seed_user_id, 'PENDING_PAYMENT', 790000.00, 'VND', DATE_ADD('2026-10-01 08:00:00', INTERVAL 1 DAY), '2026-10-01 08:00:00', '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE status = VALUES(status), total_amount = VALUES(total_amount);

    -- payment_db.order_items: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM payment_db.order_items
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND order_id <=> 1 AND course_id <=> 1)
                OR (id <=> 2 AND order_id <=> 2 AND course_id <=> 2)
                OR (id <=> 3 AND order_id <=> 3 AND course_id <=> 3)
                OR (id <=> 4 AND order_id <=> 4 AND course_id <=> 4)
                OR (id <=> 5 AND order_id <=> 5 AND course_id <=> 3))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.order_items; no data was changed';
    END IF;

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at) VALUES
    (1, 1, 1, 'IELTS Masterclass 7.5+ Toàn Diện', 2490000.00, 1000000.00, 1490000.00, DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY)),
    (2, 2, 2, 'TOEIC Đột Phá 850+ Cấp Tốc', 1690000.00, 700000.00, 990000.00, DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY)),
    (3, 3, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY)),
    (4, 4, 4, 'English for Software Engineers & IT', 1490000.00, 600000.00, 890000.00, DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY)),
    (5, 5, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE final_price = VALUES(final_price);

    -- payment_db.payments: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM payment_db.payments
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND order_id <=> 1 AND provider_transaction_code <=> 'SEED_MOCK_TXN_1')
                OR (id <=> 2 AND order_id <=> 2 AND provider_transaction_code <=> 'SEED_MOCK_TXN_2')
                OR (id <=> 3 AND order_id <=> 3 AND provider_transaction_code <=> 'SEED_MOCK_TXN_3')
                OR (id <=> 4 AND order_id <=> 4 AND provider_transaction_code <=> 'SEED_MOCK_TXN_4')
                OR (id <=> 5 AND order_id <=> 5 AND provider_transaction_code <=> 'SEED_MOCK_TXN_5'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payments; no data was changed';
    END IF;

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at) VALUES
    (1, 1, 'MOCK', 'SUCCESS', 1490000.00, 'VND', NULL, 'SEED_MOCK_TXN_1', NULL, NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY)),
    (2, 2, 'MOCK', 'SUCCESS', 990000.00, 'VND', NULL, 'SEED_MOCK_TXN_2', NULL, NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY)),
    (3, 3, 'MOCK', 'SUCCESS', 790000.00, 'VND', NULL, 'SEED_MOCK_TXN_3', NULL, NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY)),
    (4, 4, 'MOCK', 'SUCCESS', 890000.00, 'VND', NULL, 'SEED_MOCK_TXN_4', NULL, NULL, DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY)),
    (5, 5, 'MOCK', 'PENDING', 790000.00, 'VND', NULL, 'SEED_MOCK_TXN_5', NULL, NULL, NULL, '2026-10-01 08:00:00', '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE status = VALUES(status), amount = VALUES(amount);

    -- payment_db.payment_transactions: preserve unrelated rows and detect occupied fixture IDs.

    IF EXISTS (SELECT 1 FROM payment_db.payment_transactions
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND payment_id <=> 1 AND provider_transaction_code <=> 'SEED_MOCK_TXN_1')
                OR (id <=> 2 AND payment_id <=> 2 AND provider_transaction_code <=> 'SEED_MOCK_TXN_2')
                OR (id <=> 3 AND payment_id <=> 3 AND provider_transaction_code <=> 'SEED_MOCK_TXN_3')
                OR (id <=> 4 AND payment_id <=> 4 AND provider_transaction_code <=> 'SEED_MOCK_TXN_4')
                OR (id <=> 5 AND payment_id <=> 5 AND provider_transaction_code <=> 'SEED_MOCK_TXN_5'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payment_transactions; no data was changed';
    END IF;

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at) VALUES
    (1, 1, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1490000.00, 'VND', 'SEED_MOCK_TXN_1', 'chk_vnpay_001_success', DATE_SUB('2026-10-01 08:00:00', INTERVAL 10 DAY)),
    (2, 2, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 990000.00, 'VND', 'SEED_MOCK_TXN_2', 'chk_vnpay_002_success', DATE_SUB('2026-10-01 08:00:00', INTERVAL 7 DAY)),
    (3, 3, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 790000.00, 'VND', 'SEED_MOCK_TXN_3', 'chk_mock_003_success', DATE_SUB('2026-10-01 08:00:00', INTERVAL 4 DAY)),
    (4, 4, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 890000.00, 'VND', 'SEED_MOCK_TXN_4', 'chk_mock_004_success', DATE_SUB('2026-10-01 08:00:00', INTERVAL 2 DAY)),
    (5, 5, 'CREATED', 'MOCK', 'PENDING', 790000.00, 'VND', 'SEED_MOCK_TXN_5', 'chk_vnpay_005_initiated', '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE status = VALUES(status);

    COMMIT;
END$$
DELIMITER ;
CALL seed_sgsphere_data();
DROP PROCEDURE seed_sgsphere_data;

SELECT id, email, status FROM auth_db.users
WHERE email IN ('admin@gmail.com', 'user@gmail.com') ORDER BY email;
SELECT id, title, status FROM course_db.courses WHERE id BETWEEN 1 AND 5 ORDER BY id;
