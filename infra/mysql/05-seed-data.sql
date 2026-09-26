-- SGSphere demo data for MySQL 8.4. Run AFTER service Flyway migrations.
-- 5 rows per business table, except roles: only USER and ADMIN are supported.
-- ai_db has no business tables yet. Never seed flyway_schema_history.
-- Sample IDs: 900001..900005. Existing rows are NEVER updated or deleted.
-- Re-running adds missing samples only; conflicting IDs/unique keys abort and roll back.
-- Demo admin: demo.admin@example.com / Admin123
-- Demo learners: demo.an@example.com, demo.binh@example.com,
--                demo.chi@example.com, demo.dung@example.com / User123!
-- Refresh-token samples are expired AND revoked; they cannot authenticate.
-- All payments are MOCK. Lesson IDs are placeholders until Course implements lessons.
-- Use mysql in batch mode (without --force); see infra/mysql/README.md.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;
USE auth_db;

-- This temporary routine is the only DDL here. Schema ownership stays with Flyway.
DROP PROCEDURE IF EXISTS seed_demo_data_v1;
DELIMITER $$
CREATE PROCEDURE seed_demo_data_v1()
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
            OR (table_schema = 'course_db' AND table_name IN ('categories', 'courses'))
            OR (table_schema = 'learning_db' AND table_name IN (
                'enrollments', 'lesson_progress', 'quizzes', 'quiz_questions',
                'quiz_options', 'quiz_attempts', 'quiz_answers', 'notifications'))
            OR (table_schema = 'payment_db' AND table_name IN (
                'orders', 'order_items', 'payments', 'payment_transactions'))
        )) <> 18 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Run all service migrations first; 18 InnoDB business tables are required';
    END IF;

    IF (SELECT COUNT(*) FROM auth_db.roles WHERE name IN ('USER', 'ADMIN')) <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Run Auth Flyway migrations first: USER/ADMIN roles are required';
    END IF;

    -- auth_db.users: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM auth_db.users
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND email <=> 'demo.admin@example.com')
                OR (id <=> 900002 AND email <=> 'demo.an@example.com')
                OR (id <=> 900003 AND email <=> 'demo.binh@example.com')
                OR (id <=> 900004 AND email <=> 'demo.chi@example.com')
                OR (id <=> 900005 AND email <=> 'demo.dung@example.com'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in auth_db.users; no data was changed';
    END IF;

    INSERT INTO auth_db.users (id, email, password_hash, full_name, status, created_at, updated_at)
        SELECT 900001, 'demo.admin@example.com', '$2a$10$DOkjV8JxtHVcVMzBZc95i.HetnzKfnNxts83m6Her4H7YsxYri4AO', 'Quản trị Demo', 'ACTIVE', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.users WHERE id = 900001);

    INSERT INTO auth_db.users (id, email, password_hash, full_name, status, created_at, updated_at)
        SELECT 900002, 'demo.an@example.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Nguyễn An', 'ACTIVE', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.users WHERE id = 900002);

    INSERT INTO auth_db.users (id, email, password_hash, full_name, status, created_at, updated_at)
        SELECT 900003, 'demo.binh@example.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Trần Bình', 'ACTIVE', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.users WHERE id = 900003);

    INSERT INTO auth_db.users (id, email, password_hash, full_name, status, created_at, updated_at)
        SELECT 900004, 'demo.chi@example.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Lê Chi', 'ACTIVE', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.users WHERE id = 900004);

    INSERT INTO auth_db.users (id, email, password_hash, full_name, status, created_at, updated_at)
        SELECT 900005, 'demo.dung@example.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Phạm Dũng', 'ACTIVE', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.users WHERE id = 900005);

    -- One valid role assignment per sample user: 1 ADMIN and 4 USERs.
    -- Look up role IDs by name; do not assume migrations assigned specific IDs.
    IF EXISTS (
        SELECT 1 FROM auth_db.user_roles ur JOIN auth_db.roles r ON r.id = ur.role_id
        WHERE ur.user_id BETWEEN 900001 AND 900005
          AND r.name <> CASE WHEN ur.user_id = 900001 THEN 'ADMIN' ELSE 'USER' END
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed user role collision; no permissions were changed';
    END IF;
    INSERT INTO auth_db.user_roles (user_id, role_id)
        SELECT u.id, r.id FROM auth_db.users u
        JOIN auth_db.roles r ON r.name = CASE WHEN u.id = 900001 THEN 'ADMIN' ELSE 'USER' END
        WHERE u.id BETWEEN 900001 AND 900005
          AND NOT EXISTS (
              SELECT 1 FROM auth_db.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
          );

    -- auth_db.refresh_tokens: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM auth_db.refresh_tokens
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND user_id <=> 900001 AND token_hash <=> '330bf07f015858b7d0f042152b8153849d219a84dd3e0c2b8366d74ab0103557')
                OR (id <=> 900002 AND user_id <=> 900002 AND token_hash <=> '1060e3648d56c06a5949628aeb3dbf0e06c5f5364b5dffe4a47f7f539f8fa355')
                OR (id <=> 900003 AND user_id <=> 900003 AND token_hash <=> 'aa139086369993536037a46aa9a1a9b2fa5e602c575cdbb76f2a8f6791386c58')
                OR (id <=> 900004 AND user_id <=> 900004 AND token_hash <=> 'a49589beef3d3b6ca7c285fc7ccd6091f292896ebdfc48b3511dc4e0e377ef1f')
                OR (id <=> 900005 AND user_id <=> 900005 AND token_hash <=> 'cfd1454057267360f5877412630bf743af7a3912321343059b74c615e1d59a6d'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in auth_db.refresh_tokens; no data was changed';
    END IF;

    INSERT INTO auth_db.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
        SELECT 900001, 900001, '330bf07f015858b7d0f042152b8153849d219a84dd3e0c2b8366d74ab0103557', '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE id = 900001);

    INSERT INTO auth_db.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
        SELECT 900002, 900002, '1060e3648d56c06a5949628aeb3dbf0e06c5f5364b5dffe4a47f7f539f8fa355', '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE id = 900002);

    INSERT INTO auth_db.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
        SELECT 900003, 900003, 'aa139086369993536037a46aa9a1a9b2fa5e602c575cdbb76f2a8f6791386c58', '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE id = 900003);

    INSERT INTO auth_db.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
        SELECT 900004, 900004, 'a49589beef3d3b6ca7c285fc7ccd6091f292896ebdfc48b3511dc4e0e377ef1f', '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE id = 900004);

    INSERT INTO auth_db.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
        SELECT 900005, 900005, 'cfd1454057267360f5877412630bf743af7a3912321343059b74c615e1d59a6d', '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE id = 900005);

    -- course_db.categories: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM course_db.categories
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND slug <=> 'demo-category-1')
                OR (id <=> 900002 AND slug <=> 'demo-category-2')
                OR (id <=> 900003 AND slug <=> 'demo-category-3')
                OR (id <=> 900004 AND slug <=> 'demo-category-4')
                OR (id <=> 900005 AND slug <=> 'demo-category-5'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.categories; no data was changed';
    END IF;

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at)
        SELECT 900001, 'Demo IELTS', 'demo-category-1', 'Danh mục dùng cho dữ liệu mẫu.', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.categories WHERE id = 900001);

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at)
        SELECT 900002, 'Demo TOEIC', 'demo-category-2', 'Danh mục dùng cho dữ liệu mẫu.', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.categories WHERE id = 900002);

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at)
        SELECT 900003, 'Demo Giao tiếp', 'demo-category-3', 'Danh mục dùng cho dữ liệu mẫu.', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.categories WHERE id = 900003);

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at)
        SELECT 900004, 'Demo IT English', 'demo-category-4', 'Danh mục dùng cho dữ liệu mẫu.', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.categories WHERE id = 900004);

    INSERT INTO course_db.categories (id, name, slug, description, created_at, updated_at)
        SELECT 900005, 'Demo Ngữ pháp', 'demo-category-5', 'Danh mục dùng cho dữ liệu mẫu.', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.categories WHERE id = 900005);

    -- course_db.courses: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM course_db.courses
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND slug <=> 'demo-course-1' AND category_id <=> 900001)
                OR (id <=> 900002 AND slug <=> 'demo-course-2' AND category_id <=> 900002)
                OR (id <=> 900003 AND slug <=> 'demo-course-3' AND category_id <=> 900003)
                OR (id <=> 900004 AND slug <=> 'demo-course-4' AND category_id <=> 900004)
                OR (id <=> 900005 AND slug <=> 'demo-course-5' AND category_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.courses; no data was changed';
    END IF;

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at)
        SELECT 900001, 'IELTS nền tảng', 'demo-course-1', 'Khóa học mẫu để kiểm tra danh sách, thanh toán và tiến độ học.', 900001, 1490000, 1690000, 'BEGINNER', 'PUBLISHED', '/images/english-ielts.jpg', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.courses WHERE id = 900001);

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at)
        SELECT 900002, 'TOEIC luyện tập', 'demo-course-2', 'Khóa học mẫu để kiểm tra danh sách, thanh toán và tiến độ học.', 900002, 990000, 1190000, 'BEGINNER', 'PUBLISHED', '/images/english-toeic.jpg', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.courses WHERE id = 900002);

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at)
        SELECT 900003, 'Giao tiếp công sở', 'demo-course-3', 'Khóa học mẫu để kiểm tra danh sách, thanh toán và tiến độ học.', 900003, 790000, 990000, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.courses WHERE id = 900003);

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at)
        SELECT 900004, 'English for Developers', 'demo-course-4', 'Khóa học mẫu để kiểm tra danh sách, thanh toán và tiến độ học.', 900004, 890000, 1090000, 'BEGINNER', 'PUBLISHED', '/images/english-workplace.jpg', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.courses WHERE id = 900004);

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at)
        SELECT 900005, 'Ngữ pháp cơ bản', 'demo-course-5', 'Khóa học mẫu để kiểm tra danh sách, thanh toán và tiến độ học.', 900005, 490000, 690000, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM course_db.courses WHERE id = 900005);

    -- learning_db.enrollments: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.enrollments
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND user_id <=> 900001 AND course_id <=> 900001)
                OR (id <=> 900002 AND user_id <=> 900002 AND course_id <=> 900002)
                OR (id <=> 900003 AND user_id <=> 900003 AND course_id <=> 900003)
                OR (id <=> 900004 AND user_id <=> 900004 AND course_id <=> 900004)
                OR (id <=> 900005 AND user_id <=> 900005 AND course_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.enrollments; no data was changed';
    END IF;

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at)
        SELECT 900001, 900001, 900001, 'COMPLETED', '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.enrollments WHERE id = 900001);

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at)
        SELECT 900002, 900002, 900002, 'COMPLETED', '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.enrollments WHERE id = 900002);

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at)
        SELECT 900003, 900003, 900003, 'COMPLETED', '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.enrollments WHERE id = 900003);

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at)
        SELECT 900004, 900004, 900004, 'COMPLETED', '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.enrollments WHERE id = 900004);

    INSERT INTO learning_db.enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at)
        SELECT 900005, 900005, 900005, 'COMPLETED', '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.enrollments WHERE id = 900005);

    -- learning_db.lesson_progress: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.lesson_progress
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND user_id <=> 900001 AND course_id <=> 900001 AND lesson_id <=> 900001)
                OR (id <=> 900002 AND user_id <=> 900002 AND course_id <=> 900002 AND lesson_id <=> 900002)
                OR (id <=> 900003 AND user_id <=> 900003 AND course_id <=> 900003 AND lesson_id <=> 900003)
                OR (id <=> 900004 AND user_id <=> 900004 AND course_id <=> 900004 AND lesson_id <=> 900004)
                OR (id <=> 900005 AND user_id <=> 900005 AND course_id <=> 900005 AND lesson_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.lesson_progress; no data was changed';
    END IF;

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at, updated_at)
        SELECT 900001, 900001, 900001, 900001, 'COMPLETED', 100, 1800, '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE id = 900001);

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at, updated_at)
        SELECT 900002, 900002, 900002, 900002, 'COMPLETED', 100, 1800, '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE id = 900002);

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at, updated_at)
        SELECT 900003, 900003, 900003, 900003, 'COMPLETED', 100, 1800, '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE id = 900003);

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at, updated_at)
        SELECT 900004, 900004, 900004, 900004, 'COMPLETED', 100, 1800, '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE id = 900004);

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at, updated_at)
        SELECT 900005, 900005, 900005, 900005, 'COMPLETED', 100, 1800, '2025-01-01 08:00:00', '2025-01-02 09:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE id = 900005);

    -- learning_db.quizzes: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.quizzes
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND course_id <=> 900001 AND title <=> 'Demo Quiz 1: IELTS nền tảng')
                OR (id <=> 900002 AND course_id <=> 900002 AND title <=> 'Demo Quiz 2: TOEIC luyện tập')
                OR (id <=> 900003 AND course_id <=> 900003 AND title <=> 'Demo Quiz 3: Giao tiếp công sở')
                OR (id <=> 900004 AND course_id <=> 900004 AND title <=> 'Demo Quiz 4: English for Developers')
                OR (id <=> 900005 AND course_id <=> 900005 AND title <=> 'Demo Quiz 5: Ngữ pháp cơ bản'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quizzes; no data was changed';
    END IF;

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at)
        SELECT 900001, 900001, 900001, 'Demo Quiz 1: IELTS nền tảng', 'Bộ câu hỏi tối giản phục vụ kiểm tra dữ liệu mẫu.', 70, 15, TRUE, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quizzes WHERE id = 900001);

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at)
        SELECT 900002, 900002, 900002, 'Demo Quiz 2: TOEIC luyện tập', 'Bộ câu hỏi tối giản phục vụ kiểm tra dữ liệu mẫu.', 70, 15, TRUE, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quizzes WHERE id = 900002);

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at)
        SELECT 900003, 900003, 900003, 'Demo Quiz 3: Giao tiếp công sở', 'Bộ câu hỏi tối giản phục vụ kiểm tra dữ liệu mẫu.', 70, 15, TRUE, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quizzes WHERE id = 900003);

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at)
        SELECT 900004, 900004, 900004, 'Demo Quiz 4: English for Developers', 'Bộ câu hỏi tối giản phục vụ kiểm tra dữ liệu mẫu.', 70, 15, TRUE, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quizzes WHERE id = 900004);

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at)
        SELECT 900005, 900005, 900005, 'Demo Quiz 5: Ngữ pháp cơ bản', 'Bộ câu hỏi tối giản phục vụ kiểm tra dữ liệu mẫu.', 70, 15, TRUE, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quizzes WHERE id = 900005);

    -- learning_db.quiz_questions: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.quiz_questions
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND quiz_id <=> 900001 AND question_text <=> 'What is a synonym of important?')
                OR (id <=> 900002 AND quiz_id <=> 900002 AND question_text <=> 'Choose the base form: She can ___ English.')
                OR (id <=> 900003 AND quiz_id <=> 900003 AND question_text <=> 'How do you greet a colleague in the morning?')
                OR (id <=> 900004 AND quiz_id <=> 900004 AND question_text <=> 'What does API stand for?')
                OR (id <=> 900005 AND quiz_id <=> 900005 AND question_text <=> 'Complete: I ___ a student.'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_questions; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position)
        SELECT 900001, 900001, 'What is a synonym of important?', 'SINGLE_CHOICE', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_questions WHERE id = 900001);

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position)
        SELECT 900002, 900002, 'Choose the base form: She can ___ English.', 'SINGLE_CHOICE', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_questions WHERE id = 900002);

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position)
        SELECT 900003, 900003, 'How do you greet a colleague in the morning?', 'SINGLE_CHOICE', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_questions WHERE id = 900003);

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position)
        SELECT 900004, 900004, 'What does API stand for?', 'SINGLE_CHOICE', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_questions WHERE id = 900004);

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position)
        SELECT 900005, 900005, 'Complete: I ___ a student.', 'SINGLE_CHOICE', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_questions WHERE id = 900005);

    -- learning_db.quiz_options: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.quiz_options
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND question_id <=> 900001 AND option_text <=> 'Essential')
                OR (id <=> 900002 AND question_id <=> 900002 AND option_text <=> 'speak')
                OR (id <=> 900003 AND question_id <=> 900003 AND option_text <=> 'Good morning!')
                OR (id <=> 900004 AND question_id <=> 900004 AND option_text <=> 'Application Programming Interface')
                OR (id <=> 900005 AND question_id <=> 900005 AND option_text <=> 'am'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_options; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position)
        SELECT 900001, 900001, 'Essential', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_options WHERE id = 900001);

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position)
        SELECT 900002, 900002, 'speak', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_options WHERE id = 900002);

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position)
        SELECT 900003, 900003, 'Good morning!', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_options WHERE id = 900003);

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position)
        SELECT 900004, 900004, 'Application Programming Interface', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_options WHERE id = 900004);

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position)
        SELECT 900005, 900005, 'am', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_options WHERE id = 900005);

    -- learning_db.quiz_attempts: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.quiz_attempts
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND quiz_id <=> 900001 AND user_id <=> 900001 AND course_id <=> 900001)
                OR (id <=> 900002 AND quiz_id <=> 900002 AND user_id <=> 900002 AND course_id <=> 900002)
                OR (id <=> 900003 AND quiz_id <=> 900003 AND user_id <=> 900003 AND course_id <=> 900003)
                OR (id <=> 900004 AND quiz_id <=> 900004 AND user_id <=> 900004 AND course_id <=> 900004)
                OR (id <=> 900005 AND quiz_id <=> 900005 AND user_id <=> 900005 AND course_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_attempts; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at)
        SELECT 900001, 900001, 900001, 900001, 'GRADED', 100, TRUE, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_attempts WHERE id = 900001);

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at)
        SELECT 900002, 900002, 900002, 900002, 'GRADED', 100, TRUE, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_attempts WHERE id = 900002);

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at)
        SELECT 900003, 900003, 900003, 900003, 'GRADED', 100, TRUE, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_attempts WHERE id = 900003);

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at)
        SELECT 900004, 900004, 900004, 900004, 'GRADED', 100, TRUE, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_attempts WHERE id = 900004);

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at)
        SELECT 900005, 900005, 900005, 900005, 'GRADED', 100, TRUE, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_attempts WHERE id = 900005);

    -- learning_db.quiz_answers: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.quiz_answers
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND attempt_id <=> 900001 AND question_id <=> 900001 AND selected_option_id <=> 900001)
                OR (id <=> 900002 AND attempt_id <=> 900002 AND question_id <=> 900002 AND selected_option_id <=> 900002)
                OR (id <=> 900003 AND attempt_id <=> 900003 AND question_id <=> 900003 AND selected_option_id <=> 900003)
                OR (id <=> 900004 AND attempt_id <=> 900004 AND question_id <=> 900004 AND selected_option_id <=> 900004)
                OR (id <=> 900005 AND attempt_id <=> 900005 AND question_id <=> 900005 AND selected_option_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_answers; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded)
        SELECT 900001, 900001, 900001, 900001, 'Essential', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_answers WHERE id = 900001);

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded)
        SELECT 900002, 900002, 900002, 900002, 'speak', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_answers WHERE id = 900002);

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded)
        SELECT 900003, 900003, 900003, 900003, 'Good morning!', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_answers WHERE id = 900003);

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded)
        SELECT 900004, 900004, 900004, 900004, 'Application Programming Interface', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_answers WHERE id = 900004);

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded)
        SELECT 900005, 900005, 900005, 900005, 'am', TRUE, 1
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.quiz_answers WHERE id = 900005);

    -- learning_db.notifications: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM learning_db.notifications
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND user_id <=> 900001 AND title <=> 'Demo: hoàn thành bài kiểm tra 1')
                OR (id <=> 900002 AND user_id <=> 900002 AND title <=> 'Demo: hoàn thành bài kiểm tra 2')
                OR (id <=> 900003 AND user_id <=> 900003 AND title <=> 'Demo: hoàn thành bài kiểm tra 3')
                OR (id <=> 900004 AND user_id <=> 900004 AND title <=> 'Demo: hoàn thành bài kiểm tra 4')
                OR (id <=> 900005 AND user_id <=> 900005 AND title <=> 'Demo: hoàn thành bài kiểm tra 5'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.notifications; no data was changed';
    END IF;

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at)
        SELECT 900001, 900001, 'QUIZ', 'Demo: hoàn thành bài kiểm tra 1', 'Bạn đạt 100/100 điểm trong bài kiểm tra mẫu.', '/quizzes/900001/result', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.notifications WHERE id = 900001);

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at)
        SELECT 900002, 900002, 'QUIZ', 'Demo: hoàn thành bài kiểm tra 2', 'Bạn đạt 100/100 điểm trong bài kiểm tra mẫu.', '/quizzes/900002/result', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.notifications WHERE id = 900002);

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at)
        SELECT 900003, 900003, 'QUIZ', 'Demo: hoàn thành bài kiểm tra 3', 'Bạn đạt 100/100 điểm trong bài kiểm tra mẫu.', '/quizzes/900003/result', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.notifications WHERE id = 900003);

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at)
        SELECT 900004, 900004, 'QUIZ', 'Demo: hoàn thành bài kiểm tra 4', 'Bạn đạt 100/100 điểm trong bài kiểm tra mẫu.', '/quizzes/900004/result', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.notifications WHERE id = 900004);

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, read_at, created_at)
        SELECT 900005, 900005, 'QUIZ', 'Demo: hoàn thành bài kiểm tra 5', 'Bạn đạt 100/100 điểm trong bài kiểm tra mẫu.', '/quizzes/900005/result', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM learning_db.notifications WHERE id = 900005);

    -- payment_db.orders: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM payment_db.orders
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND order_code <=> 'DEMO-ORDER-001' AND user_id <=> 900001)
                OR (id <=> 900002 AND order_code <=> 'DEMO-ORDER-002' AND user_id <=> 900002)
                OR (id <=> 900003 AND order_code <=> 'DEMO-ORDER-003' AND user_id <=> 900003)
                OR (id <=> 900004 AND order_code <=> 'DEMO-ORDER-004' AND user_id <=> 900004)
                OR (id <=> 900005 AND order_code <=> 'DEMO-ORDER-005' AND user_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.orders; no data was changed';
    END IF;

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at)
        SELECT 900001, 'DEMO-ORDER-001', 900001, 'PAID', 1490000, 'VND', NULL, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.orders WHERE id = 900001);

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at)
        SELECT 900002, 'DEMO-ORDER-002', 900002, 'PAID', 990000, 'VND', NULL, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.orders WHERE id = 900002);

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at)
        SELECT 900003, 'DEMO-ORDER-003', 900003, 'PAID', 790000, 'VND', NULL, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.orders WHERE id = 900003);

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at)
        SELECT 900004, 'DEMO-ORDER-004', 900004, 'PAID', 890000, 'VND', NULL, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.orders WHERE id = 900004);

    INSERT INTO payment_db.orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at)
        SELECT 900005, 'DEMO-ORDER-005', 900005, 'PAID', 490000, 'VND', NULL, '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.orders WHERE id = 900005);

    -- payment_db.order_items: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM payment_db.order_items
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND order_id <=> 900001 AND course_id <=> 900001)
                OR (id <=> 900002 AND order_id <=> 900002 AND course_id <=> 900002)
                OR (id <=> 900003 AND order_id <=> 900003 AND course_id <=> 900003)
                OR (id <=> 900004 AND order_id <=> 900004 AND course_id <=> 900004)
                OR (id <=> 900005 AND order_id <=> 900005 AND course_id <=> 900005))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.order_items; no data was changed';
    END IF;

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at)
        SELECT 900001, 900001, 900001, 'IELTS nền tảng', 1690000, 200000, 1490000, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.order_items WHERE id = 900001);

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at)
        SELECT 900002, 900002, 900002, 'TOEIC luyện tập', 1190000, 200000, 990000, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.order_items WHERE id = 900002);

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at)
        SELECT 900003, 900003, 900003, 'Giao tiếp công sở', 990000, 200000, 790000, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.order_items WHERE id = 900003);

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at)
        SELECT 900004, 900004, 900004, 'English for Developers', 1090000, 200000, 890000, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.order_items WHERE id = 900004);

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at)
        SELECT 900005, 900005, 900005, 'Ngữ pháp cơ bản', 690000, 200000, 490000, '2025-01-01 08:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.order_items WHERE id = 900005);

    -- payment_db.payments: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM payment_db.payments
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND order_id <=> 900001 AND provider_transaction_code <=> 'DEMO-TXN-001')
                OR (id <=> 900002 AND order_id <=> 900002 AND provider_transaction_code <=> 'DEMO-TXN-002')
                OR (id <=> 900003 AND order_id <=> 900003 AND provider_transaction_code <=> 'DEMO-TXN-003')
                OR (id <=> 900004 AND order_id <=> 900004 AND provider_transaction_code <=> 'DEMO-TXN-004')
                OR (id <=> 900005 AND order_id <=> 900005 AND provider_transaction_code <=> 'DEMO-TXN-005'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payments; no data was changed';
    END IF;

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at)
        SELECT 900001, 900001, 'MOCK', 'SUCCESS', 1490000, 'VND', NULL, 'DEMO-TXN-001', NULL, NULL, '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payments WHERE id = 900001);

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at)
        SELECT 900002, 900002, 'MOCK', 'SUCCESS', 990000, 'VND', NULL, 'DEMO-TXN-002', NULL, NULL, '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payments WHERE id = 900002);

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at)
        SELECT 900003, 900003, 'MOCK', 'SUCCESS', 790000, 'VND', NULL, 'DEMO-TXN-003', NULL, NULL, '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payments WHERE id = 900003);

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at)
        SELECT 900004, 900004, 'MOCK', 'SUCCESS', 890000, 'VND', NULL, 'DEMO-TXN-004', NULL, NULL, '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payments WHERE id = 900004);

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at)
        SELECT 900005, 900005, 'MOCK', 'SUCCESS', 490000, 'VND', NULL, 'DEMO-TXN-005', NULL, NULL, '2025-01-02 09:00:00', '2025-01-01 08:00:00', '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payments WHERE id = 900005);

    -- payment_db.payment_transactions: 5 samples. Preserve any existing sample edits.

    IF EXISTS (
        SELECT 1 FROM payment_db.payment_transactions
        WHERE id BETWEEN 900001 AND 900005
            AND NOT ((id <=> 900001 AND payment_id <=> 900001 AND provider_transaction_code <=> 'DEMO-TXN-001')
                OR (id <=> 900002 AND payment_id <=> 900002 AND provider_transaction_code <=> 'DEMO-TXN-002')
                OR (id <=> 900003 AND payment_id <=> 900003 AND provider_transaction_code <=> 'DEMO-TXN-003')
                OR (id <=> 900004 AND payment_id <=> 900004 AND provider_transaction_code <=> 'DEMO-TXN-004')
                OR (id <=> 900005 AND payment_id <=> 900005 AND provider_transaction_code <=> 'DEMO-TXN-005'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payment_transactions; no data was changed';
    END IF;

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at)
        SELECT 900001, 900001, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1490000, 'VND', 'DEMO-TXN-001', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payment_transactions WHERE id = 900001);

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at)
        SELECT 900002, 900002, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 990000, 'VND', 'DEMO-TXN-002', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payment_transactions WHERE id = 900002);

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at)
        SELECT 900003, 900003, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 790000, 'VND', 'DEMO-TXN-003', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payment_transactions WHERE id = 900003);

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at)
        SELECT 900004, 900004, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 890000, 'VND', 'DEMO-TXN-004', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payment_transactions WHERE id = 900004);

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at)
        SELECT 900005, 900005, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 490000, 'VND', 'DEMO-TXN-005', NULL, '2025-01-02 09:00:00'
        WHERE NOT EXISTS (SELECT 1 FROM payment_db.payment_transactions WHERE id = 900005);

    COMMIT;
END$$
DELIMITER ;

CALL seed_demo_data_v1();
DROP PROCEDURE seed_demo_data_v1;

-- Count only this fixture set; existing application data is deliberately preserved.
SELECT 'auth_db.roles (supported roles)' AS table_name, COUNT(*) AS sample_rows
FROM auth_db.roles WHERE name IN ('USER', 'ADMIN')
UNION ALL
SELECT 'auth_db.user_roles', COUNT(*) FROM auth_db.user_roles WHERE user_id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'auth_db.users', COUNT(*) FROM auth_db.users WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'auth_db.refresh_tokens', COUNT(*) FROM auth_db.refresh_tokens WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'course_db.categories', COUNT(*) FROM course_db.categories WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'course_db.courses', COUNT(*) FROM course_db.courses WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.enrollments', COUNT(*) FROM learning_db.enrollments WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.lesson_progress', COUNT(*) FROM learning_db.lesson_progress WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.quizzes', COUNT(*) FROM learning_db.quizzes WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.quiz_questions', COUNT(*) FROM learning_db.quiz_questions WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.quiz_options', COUNT(*) FROM learning_db.quiz_options WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.quiz_attempts', COUNT(*) FROM learning_db.quiz_attempts WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.quiz_answers', COUNT(*) FROM learning_db.quiz_answers WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'learning_db.notifications', COUNT(*) FROM learning_db.notifications WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'payment_db.orders', COUNT(*) FROM payment_db.orders WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'payment_db.order_items', COUNT(*) FROM payment_db.order_items WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'payment_db.payments', COUNT(*) FROM payment_db.payments WHERE id BETWEEN 900001 AND 900005

UNION ALL
SELECT 'payment_db.payment_transactions', COUNT(*) FROM payment_db.payment_transactions WHERE id BETWEEN 900001 AND 900005

ORDER BY table_name;
