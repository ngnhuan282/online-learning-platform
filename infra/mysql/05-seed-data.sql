-- ==============================================================================
-- SGSphere Online Learning Platform - Seed Data Script
-- Initializes all tables across microservice databases with sample data (~5 rows/table)
-- Admin account: admin@elearning.com / Admin123
-- User accounts: User123!
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- 1. AUTH_DB (Roles, Users, User_Roles, Refresh_Tokens)
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_db;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(20) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed Roles (USER, ADMIN)
INSERT INTO roles (id, name, created_at) VALUES
(1, 'USER', NOW(6)),
(2, 'ADMIN', NOW(6))
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Users (1 Admin: admin@elearning.com / Admin123 + 5 Regular Users / User123!)
INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at) VALUES
(1, 'admin@elearning.com', '$2a$10$DOkjV8JxtHVcVMzBZc95i.HetnzKfnNxts83m6Her4H7YsxYri4AO', 'System Administrator', 'ACTIVE', NOW(6), NOW(6)),
(2, 'nguyen.van.a@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Nguyễn Văn A', 'ACTIVE', NOW(6), NOW(6)),
(3, 'tran.thi.b@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Trần Thị B', 'ACTIVE', NOW(6), NOW(6)),
(4, 'le.van.c@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Lê Văn C', 'ACTIVE', NOW(6), NOW(6)),
(5, 'pham.thi.d@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Phạm Thị D', 'LOCKED', NOW(6), NOW(6)),
(6, 'hoang.van.e@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Hoàng Văn E', 'ACTIVE', NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), status = VALUES(status), password_hash = VALUES(password_hash);

-- Seed User Roles (User 1 has USER + ADMIN; Users 2..6 have USER)
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1),
(1, 2),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1)
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- Seed Refresh Tokens (5 rows)
INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES
(1, 1, '4a5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e', DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6)),
(2, 2, '5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c', DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6)),
(3, 3, '6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d', DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6)),
(4, 4, '7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e', DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6)),
(5, 6, '8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f', DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6))
ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash);


-- ==============================================================================
-- 2. COURSE_DB (Categories, Courses)
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS course_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE course_db;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_categories_name UNIQUE (name),
    CONSTRAINT uk_categories_slug UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description VARCHAR(2000) NULL,
    category_id BIGINT NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    original_price DECIMAL(12, 2) NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    thumbnail_url VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_courses_slug UNIQUE (slug),
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Seed Categories (5 rows)
INSERT INTO categories (id, name, slug, description, created_at, updated_at) VALUES
(1, 'Luyện thi IELTS', 'luyen-thi-ielts', 'Các khóa học luyện thi IELTS toàn diện 4 kỹ năng từ cơ bản đến nâng cao.', NOW(), NOW()),
(2, 'Luyện thi TOEIC', 'luyen-thi-toeic', 'Lộ trình bứt phá mục tiêu TOEIC 650+ đến 850+ cho sinh viên và người đi làm.', NOW(), NOW()),
(3, 'Tiếng Anh Giao tiếp', 'tieng-anh-giao-tiep', 'Phát âm chuẩn IPA, phản xạ tiếng Anh tự nhiên trong đời sống và công việc.', NOW(), NOW()),
(4, 'Tiếng Anh Công nghệ (IT)', 'tieng-anh-it', 'Thuật ngữ, tài liệu kỹ thuật, phỏng vấn và làm việc trong môi trường công nghệ.', NOW(), NOW()),
(5, 'Ngữ pháp & Từ vựng căn bản', 'ngu-phap-tu-vung', 'Hệ thống hóa ngữ pháp cốt lõi và từ vựng thông dụng xây gốc tiếng Anh vững chắc.', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- Seed Courses (5 rows)
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, created_at, updated_at) VALUES
(1, 'IELTS Masterclass 7.5+ Toàn Diện', 'ielts-masterclass-75', 'Khóa học chiến thuật chuyên sâu giúp đạt mục tiêu IELTS 7.5+ trong 3 tháng.', 1, 1490000.00, 2490000.00, 'ADVANCED', 'PUBLISHED', '/images/english-ielts.jpg', NOW(), NOW()),
(2, 'TOEIC Đột Phá 850+ Cấp Tốc', 'toeic-dot-pha-850', 'Phương pháp luyện nghe hiểu và làm bài đọc nhanh, cam kết chuẩn đầu ra 850+.', 2, 990000.00, 1690000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-toeic.jpg', NOW(), NOW()),
(3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 'tieng-anh-giao-tiep-di-lam', 'Tự tin giao tiếp với sếp và đồng nghiệp nước ngoài, thuyết trình dự án mượt mà.', 3, 790000.00, 1290000.00, 'BEGINNER', 'PUBLISHED', '/images/english-communication.jpg', NOW(), NOW()),
(4, 'English for Software Engineers & IT', 'english-for-software-engineers', 'Luyện kỹ năng đọc tài liệu API, viết email, stand-up meeting và phỏng vấn quốc tế.', 4, 890000.00, 1490000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-it.jpg', NOW(), NOW()),
(5, 'Ngữ Pháp Tiếng Anh Nền Tảng & Ứng Dụng', 'ngu-phap-tieng-anh-nen-tang', 'Nắm trọn 12 thì tiếng Anh, cấu trúc câu phức và mẹo ghi nhớ từ vựng dễ hiểu.', 5, 0.00, 490000.00, 'BEGINNER', 'PUBLISHED', '/images/english-grammar.jpg', NOW(), NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title), price = VALUES(price), status = VALUES(status);


-- ==============================================================================
-- 3. LEARNING_DB (Enrollments, Progress, Quizzes, Questions, Options, Attempts, Answers, Notifications)
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS learning_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE learning_db;

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    last_accessed_at TIMESTAMP NULL,
    CONSTRAINT uk_enrollments_user_course UNIQUE (user_id, course_id),
    CONSTRAINT chk_enrollments_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    progress_percent INT NOT NULL DEFAULT 0,
    time_spent_seconds BIGINT NOT NULL DEFAULT 0,
    first_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_lesson_progress_user_lesson UNIQUE (user_id, lesson_id),
    CONSTRAINT chk_lesson_progress_status CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'))
);

CREATE TABLE IF NOT EXISTS quizzes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    passing_score INT NOT NULL DEFAULT 70,
    time_limit_minutes INT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    points INT NOT NULL DEFAULT 1,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
);

CREATE TABLE IF NOT EXISTS quiz_options (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    question_id BIGINT NOT NULL,
    option_text VARCHAR(1000) NOT NULL,
    correct BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_options_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    score INT NULL,
    passed BOOLEAN NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_option_id BIGINT NULL,
    answer_text VARCHAR(2000) NULL,
    correct BOOLEAN NULL,
    points_awarded INT NULL,
    CONSTRAINT fk_quiz_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id),
    CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id),
    CONSTRAINT fk_quiz_answers_selected_option FOREIGN KEY (selected_option_id) REFERENCES quiz_options (id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    action_url VARCHAR(500) NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Enrollments (5 rows)
INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, completed_at, last_accessed_at) VALUES
(1, 2, 1, 'ACTIVE', DATE_SUB(NOW(), INTERVAL 10 DAY), NULL, NOW()),
(2, 2, 5, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
(3, 3, 2, 'ACTIVE', DATE_SUB(NOW(), INTERVAL 7 DAY), NULL, NOW()),
(4, 4, 3, 'ACTIVE', DATE_SUB(NOW(), INTERVAL 4 DAY), NULL, NOW()),
(5, 6, 4, 'ACTIVE', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Seed Lesson Progress (5 rows)
INSERT INTO lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at) VALUES
(1, 2, 1, 101, 'COMPLETED', 100, 1800, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY)),
(2, 2, 1, 102, 'IN_PROGRESS', 65, 1200, DATE_SUB(NOW(), INTERVAL 8 DAY), NULL),
(3, 3, 2, 201, 'COMPLETED', 100, 2400, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(4, 4, 3, 301, 'IN_PROGRESS', 40, 800, DATE_SUB(NOW(), INTERVAL 3 DAY), NULL),
(5, 6, 4, 401, 'COMPLETED', 100, 2100, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE status = VALUES(status), progress_percent = VALUES(progress_percent);

-- Seed Quizzes (5 rows)
INSERT INTO quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at) VALUES
(1, 1, 102, 'IELTS Listening & Reading Mini-Test 1', 'Kiểm tra kỹ năng nghe nhận diện bẫy từ vựng và đọc lướt tìm ý chính.', 70, 30, TRUE, NOW()),
(2, 2, 201, 'TOEIC Part 5 Grammar & Vocab Check', 'Đánh giá khả năng chọn dạng từ, liên từ và cấu trúc mệnh đề.', 75, 20, TRUE, NOW()),
(3, 3, 301, 'Business Communication Fluency Quiz', 'Thực hành các tình huống hội thoại thường gặp nơi công sở.', 80, 15, TRUE, NOW()),
(4, 4, 401, 'Technical Terms for Software Engineering', 'Kiểm tra nghĩa và cách dùng thuật ngữ Agile, DevOps, Microservices.', 70, 25, TRUE, NOW()),
(5, 5, 501, 'Tenses & Basic Sentence Structure Review', 'Ôn tập 12 thì tiếng Anh và cấu trúc câu chủ động / bị động.', 70, 20, TRUE, NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title), passing_score = VALUES(passing_score);

-- Seed Quiz Questions (5 rows)
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, points, position) VALUES
(1, 1, 'Which word is the synonym of "crucial" in IELTS Academic reading?', 'SINGLE_CHOICE', 1, 1),
(2, 2, 'The manager requested that all employees _____ the training session.', 'SINGLE_CHOICE', 1, 1),
(3, 3, 'How should you professionally decline a meeting due to a schedule conflict?', 'SINGLE_CHOICE', 1, 1),
(4, 4, 'What does "CI/CD" stand for in software engineering?', 'SINGLE_CHOICE', 1, 1),
(5, 5, 'Identify the correct passive sentence: "They built this bridge in 2020."', 'SINGLE_CHOICE', 1, 1)
ON DUPLICATE KEY UPDATE question_text = VALUES(question_text);

-- Seed Quiz Options (5 rows)
INSERT INTO quiz_options (id, question_id, option_text, correct, position) VALUES
(1, 1, 'Vital / Essential', TRUE, 1),
(2, 2, 'attend', TRUE, 1),
(3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
(4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
(5, 5, 'This bridge was built in 2020.', TRUE, 1)
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text);

-- Seed Quiz Attempts (5 rows)
INSERT INTO quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at) VALUES
(1, 1, 2, 1, 'GRADED', 85, TRUE, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 2, 3, 2, 'GRADED', 90, TRUE, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, 3, 4, 3, 'GRADED', 60, FALSE, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4, 4, 6, 4, 'GRADED', 100, TRUE, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(5, 5, 2, 5, 'GRADED', 95, TRUE, DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY))
ON DUPLICATE KEY UPDATE score = VALUES(score), passed = VALUES(passed);

-- Seed Quiz Answers (5 rows)
INSERT INTO quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded) VALUES
(1, 1, 1, 1, 'Vital / Essential', TRUE, 1),
(2, 2, 2, 2, 'attend', TRUE, 1),
(3, 3, 3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
(4, 4, 4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
(5, 5, 5, 5, 'This bridge was built in 2020.', TRUE, 1)
ON DUPLICATE KEY UPDATE points_awarded = VALUES(points_awarded);

-- Seed Notifications (5 rows)
INSERT INTO notifications (id, user_id, type, title, body, action_url, read_at, created_at) VALUES
(1, 1, 'SYSTEM', 'Hệ thống SGSphere hoạt động ổn định', 'Tất cả 6 microservices và cổng API Gateway đã sẵn sàng phục vụ.', '/admin', NOW(), NOW()),
(2, 2, 'ENROLLMENT', 'Chào mừng bạn đến với IELTS Masterclass', 'Bạn đã đăng ký thành công khóa học. Hãy bắt đầu bài học đầu tiên!', '/learning/1', NOW(), DATE_SUB(NOW(), INTERVAL 10 DAY)),
(3, 3, 'PROGRESS', 'Bạn đã hoàn thành 50% khóa TOEIC 850+', 'Tuyệt vời! Tiếp tục duy trì phong độ học tập hàng ngày nhé.', '/learning/2', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 4, 'QUIZ', 'Kết quả bài kiểm tra Business Communication', 'Bạn đã hoàn thành bài kiểm tra với điểm số 60/100.', '/quizzes/3/result', NULL, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(5, 6, 'SYSTEM', 'Khóa học IT English có bài tập mới', 'Giảng viên đã cập nhật bài học và quiz mới cho tuần này.', '/learning/4', NULL, NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title);


-- ==============================================================================
-- 4. PAYMENT_DB (Orders, Order_Items, Payments, Payment_Transactions)
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE payment_db;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_code VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_orders_order_code UNIQUE (order_code)
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    final_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    checkout_url VARCHAR(1024) NULL,
    provider_transaction_code VARCHAR(100) NULL,
    failure_code VARCHAR(100) NULL,
    failure_message VARCHAR(500) NULL,
    paid_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    payment_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    provider_transaction_code VARCHAR(100) NULL,
    payload_checksum VARCHAR(128) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- Seed Orders (5 rows)
INSERT INTO orders (id, order_code, user_id, status, total_amount, currency, expires_at, created_at, updated_at) VALUES
(1, 'ORD-2026-0001', 2, 'PAID', 1490000.00, 'VND', DATE_ADD(NOW(6), INTERVAL 1 DAY), DATE_SUB(NOW(6), INTERVAL 10 DAY), DATE_SUB(NOW(6), INTERVAL 10 DAY)),
(2, 'ORD-2026-0002', 3, 'PAID', 990000.00, 'VND', DATE_ADD(NOW(6), INTERVAL 1 DAY), DATE_SUB(NOW(6), INTERVAL 7 DAY), DATE_SUB(NOW(6), INTERVAL 7 DAY)),
(3, 'ORD-2026-0003', 4, 'PAID', 790000.00, 'VND', DATE_ADD(NOW(6), INTERVAL 1 DAY), DATE_SUB(NOW(6), INTERVAL 4 DAY), DATE_SUB(NOW(6), INTERVAL 4 DAY)),
(4, 'ORD-2026-0004', 6, 'PAID', 890000.00, 'VND', DATE_ADD(NOW(6), INTERVAL 1 DAY), DATE_SUB(NOW(6), INTERVAL 2 DAY), DATE_SUB(NOW(6), INTERVAL 2 DAY)),
(5, 'ORD-2026-0005', 2, 'PENDING_PAYMENT', 790000.00, 'VND', DATE_ADD(NOW(6), INTERVAL 1 DAY), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE status = VALUES(status), total_amount = VALUES(total_amount);

-- Seed Order Items (5 rows)
INSERT INTO order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at) VALUES
(1, 1, 1, 'IELTS Masterclass 7.5+ Toàn Diện', 2490000.00, 1000000.00, 1490000.00, DATE_SUB(NOW(6), INTERVAL 10 DAY)),
(2, 2, 2, 'TOEIC Đột Phá 850+ Cấp Tốc', 1690000.00, 700000.00, 990000.00, DATE_SUB(NOW(6), INTERVAL 7 DAY)),
(3, 3, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, DATE_SUB(NOW(6), INTERVAL 4 DAY)),
(4, 4, 4, 'English for Software Engineers & IT', 1490000.00, 600000.00, 890000.00, DATE_SUB(NOW(6), INTERVAL 2 DAY)),
(5, 5, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, NOW(6))
ON DUPLICATE KEY UPDATE final_price = VALUES(final_price);

-- Seed Payments (5 rows)
INSERT INTO payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, created_at, updated_at) VALUES
(1, 1, 'VNPAY', 'SUCCESS', 1490000.00, 'VND', 'http://localhost:8080/api/v1/payments/mock-gateway/1', 'VNPAY_TXN_0001', NULL, NULL, DATE_SUB(NOW(6), INTERVAL 10 DAY), DATE_SUB(NOW(6), INTERVAL 10 DAY), DATE_SUB(NOW(6), INTERVAL 10 DAY)),
(2, 2, 'VNPAY', 'SUCCESS', 990000.00, 'VND', 'http://localhost:8080/api/v1/payments/mock-gateway/2', 'VNPAY_TXN_0002', NULL, NULL, DATE_SUB(NOW(6), INTERVAL 7 DAY), DATE_SUB(NOW(6), INTERVAL 7 DAY), DATE_SUB(NOW(6), INTERVAL 7 DAY)),
(3, 3, 'MOCK', 'SUCCESS', 790000.00, 'VND', 'http://localhost:8080/api/v1/payments/mock-gateway/3', 'MOCK_TXN_0003', NULL, NULL, DATE_SUB(NOW(6), INTERVAL 4 DAY), DATE_SUB(NOW(6), INTERVAL 4 DAY), DATE_SUB(NOW(6), INTERVAL 4 DAY)),
(4, 4, 'MOCK', 'SUCCESS', 890000.00, 'VND', 'http://localhost:8080/api/v1/payments/mock-gateway/4', 'MOCK_TXN_0004', NULL, NULL, DATE_SUB(NOW(6), INTERVAL 2 DAY), DATE_SUB(NOW(6), INTERVAL 2 DAY), DATE_SUB(NOW(6), INTERVAL 2 DAY)),
(5, 5, 'VNPAY', 'PENDING', 790000.00, 'VND', 'http://localhost:8080/api/v1/payments/mock-gateway/5', 'VNPAY_TXN_0005', NULL, NULL, NULL, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE status = VALUES(status), amount = VALUES(amount);

-- Seed Payment Transactions (5 rows)
INSERT INTO payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at) VALUES
(1, 1, 'PAYMENT_SUCCESS', 'VNPAY', 'SUCCESS', 1490000.00, 'VND', 'VNPAY_TXN_0001', 'chk_vnpay_001_success', DATE_SUB(NOW(6), INTERVAL 10 DAY)),
(2, 2, 'PAYMENT_SUCCESS', 'VNPAY', 'SUCCESS', 990000.00, 'VND', 'VNPAY_TXN_0002', 'chk_vnpay_002_success', DATE_SUB(NOW(6), INTERVAL 7 DAY)),
(3, 3, 'PAYMENT_SUCCESS', 'MOCK', 'SUCCESS', 790000.00, 'VND', 'MOCK_TXN_0003', 'chk_mock_003_success', DATE_SUB(NOW(6), INTERVAL 4 DAY)),
(4, 4, 'PAYMENT_SUCCESS', 'MOCK', 'SUCCESS', 890000.00, 'VND', 'MOCK_TXN_0004', 'chk_mock_004_success', DATE_SUB(NOW(6), INTERVAL 2 DAY)),
(5, 5, 'PAYMENT_INITIATED', 'VNPAY', 'PENDING', 790000.00, 'VND', 'VNPAY_TXN_0005', 'chk_vnpay_005_initiated', NOW(6))
ON DUPLICATE KEY UPDATE status = VALUES(status);

SET FOREIGN_KEY_CHECKS = 1;
-- ==============================================================================
-- End of Seed Data Script
-- ==============================================================================
