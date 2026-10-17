SET NAMES utf8mb4;
-- ============================================================
-- V7__seed_data.sql — Seed data khóa học Tiếng Anh LearnSphere
-- ============================================================
DELETE FROM reviews;
DELETE FROM lesson_resources;
DELETE FROM lessons;
DELETE FROM sections;
DELETE FROM courses;
DELETE FROM categories;

ALTER TABLE categories AUTO_INCREMENT = 1;
ALTER TABLE courses AUTO_INCREMENT = 1;
ALTER TABLE sections AUTO_INCREMENT = 1;
ALTER TABLE lessons AUTO_INCREMENT = 1;
ALTER TABLE reviews AUTO_INCREMENT = 1;

-- ============================================================
-- 1. DANH MỤC (Categories)
-- ============================================================
INSERT INTO categories (id, name, slug, description, created_at, updated_at) VALUES
(1, 'Luyện thi IELTS',          'luyen-thi-ielts',          'Academic & General, lộ trình bứt phá 4 kỹ năng Listening, Speaking, Reading, Writing đạt band 6.5 - 7.5+', NOW(), NOW()),
(2, 'Luyện thi TOEIC',          'luyen-thi-toeic',          'Phương pháp giải đề Listening & Reading, bẫy ETS và từ vựng mục tiêu 650+ đến 850+', NOW(), NOW()),
(3, 'Tiếng Anh Giao tiếp',      'tieng-anh-giao-tiep',      'Phản xạ tự nhiên công sở, du lịch và giao tiếp tự tin với người bản xứ trong đời sống hằng ngày', NOW(), NOW()),
(4, 'Tiếng Anh CNTT & Tech',    'tieng-anh-it',             'Thuật ngữ chuyên ngành IT, đọc tài liệu kỹ thuật, Scrum standup meeting và phỏng vấn công ty quốc tế', NOW(), NOW()),
(5, 'Phát âm & Ngữ điệu',      'phat-am-ngu-dieu',         'Bảng ký hiệu ngữ âm quốc tế IPA chuẩn Mỹ, nhấn trọng âm, nối âm, nuốt âm và ngữ điệu tự nhiên', NOW(), NOW()),
(6, 'Tiếng Anh Thương mại',     'tieng-anh-thuong-mai',     'Business English thực chiến: viết email thương mại, thuyết trình kinh doanh, đàm phán hợp đồng', NOW(), NOW()),
(7, 'Ngữ pháp & Từ vựng căn bản', 'ngu-phap-tu-vung',       'Nền tảng 12 thì tiếng Anh, cấu trúc câu và từ vựng cốt lõi xóa mất gốc cấp tốc cho người mới bắt đầu', NOW(), NOW());

-- ============================================================
-- 2. KHÓA HỌC (Courses)
-- ============================================================

-- [1] Khóa học trả phí — IELTS Intensive 7.5+
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  1,
  'IELTS Intensive 7.5+: Bứt phá 4 kỹ năng cùng chuyên gia',
  'ielts-intensive-75',
  'Chiến thuật xử lý Writing Task 2 & Speaking chuyên sâu. Khóa học được thiết kế bởi giảng viên 8.5 IELTS giúp bạn nắm vững tư duy phát triển ý tưởng, tối ưu điểm Lexical Resource và Grammatical Range để đạt band mục tiêu 7.5+ trong thời gian ngắn nhất.',
  1, 1690000.00, 2400000.00, 'ADVANCED', 'PUBLISHED',
  '/images/english-ielts.jpg', 4.8, 3,
  NOW(), NOW()
);

-- [2] Khóa học trả phí — Tiếng Anh CNTT & Tech
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  2,
  'Tiếng Anh chuyên ngành IT & Phỏng vấn công ty quốc tế',
  'tieng-anh-chuyen-nganh-it',
  'Khóa học dành riêng cho lập trình viên, kỹ sư phần mềm và sinh viên CNTT. Luyện kỹ năng đọc tài liệu API/Architecture, viết CV chuẩn ATS, trao đổi trong Daily Scrum standup meeting và tự tin phỏng vấn System Design bằng tiếng Anh.',
  4, 1290000.00, 1950000.00, 'INTERMEDIATE', 'PUBLISHED',
  '/images/english-workplace.jpg', 5.0, 2,
  NOW(), NOW()
);

-- [3] Khóa học trả phí — TOEIC 850+
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  3,
  'TOEIC 850+ Cấp tốc: Chiến thuật giải đề & tăng điểm',
  'toeic-850-cap-toc',
  'Giải mã các bẫy đề thi ETS mới nhất. Kỹ thuật bắt keyword trong Part 3, Part 4 và phương pháp đọc quét Scanning/Skimming cho Part 7. Giúp bạn tăng 150-200 điểm sau lộ trình ôn luyện cô đọng.',
  2, 1090000.00, 1700000.00, 'INTERMEDIATE', 'PUBLISHED',
  '/images/english-toeic.jpg', 5.0, 1,
  NOW(), NOW()
);

-- [4] Khóa học MIỄN PHÍ — Phát âm chuẩn IPA (0đ)
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  4,
  'Nhập môn Phát âm tiếng Anh chuẩn IPA & Phản xạ giao tiếp',
  'phat-am-chuan-ipa-mien-phi',
  'Khóa học miễn phí giúp bạn xóa mất gốc phát âm với trọn bộ 44 âm trong bảng IPA tiếng Anh chuẩn Mỹ. Hướng dẫn chi tiết khẩu hình miệng, cách phân biệt các cặp âm dễ nhầm và quy tắc nối âm, trọng âm cơ bản.',
  5, 0.00, 490000.00, 'BEGINNER', 'PUBLISHED',
  '/images/english-speaking.jpg', 5.0, 2,
  NOW(), NOW()
);

-- [5] Khóa học trả phí — Tiếng Anh Giao tiếp Đi làm
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  5,
  'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm & Công Sở',
  'tieng-anh-giao-tiep-di-lam',
  'Tự tin giao tiếp với đồng nghiệp và đối tác nước ngoài. Khóa học tập trung vào các tình huống thực tế: giới thiệu bản thân, điều hành cuộc họp, xử lý khiếu nại qua điện thoại và giao tiếp xã giao networking sau giờ làm việc.',
  3, 790000.00, 1290000.00, 'BEGINNER', 'PUBLISHED',
  '/images/english-communication.jpg', 5.0, 1,
  NOW(), NOW()
);

-- [6] Khóa học MIỄN PHÍ — Ngữ pháp tiếng Anh nền tảng (0đ)
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  6,
  'Ngữ Pháp Tiếng Anh Nền Tảng & Ứng Dụng Thực Tế',
  'ngu-phap-tieng-anh-nen-tang',
  'Hệ thống hóa toàn bộ 12 thì cơ bản, câu bị động, câu điều kiện, mệnh đề quan hệ và các cấu trúc câu phổ biến. Giải thích dễ hiểu, trực quan kèm bài tập ứng dụng giúp bạn xóa bỏ nỗi sợ ngữ pháp tiếng Anh.',
  7, 0.00, 390000.00, 'BEGINNER', 'PUBLISHED',
  '/images/english-grammar.jpg', 5.0, 1,
  NOW(), NOW()
);

-- [7] Khóa học trả phí — Tiếng Anh Thương mại & Đàm phán
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  7,
  'Tiếng Anh Thương Mại: Viết Email & Đàm Phán Quốc Tế',
  'tieng-anh-thuong-mai-dam-phan',
  'Chuẩn hóa kỹ năng viết Business Email trang trọng, xúc tích và thuyết phục. Học cách thương lượng giá cả, giải quyết bất đồng và chốt hợp đồng thương mại với khách hàng quốc tế.',
  6, 890000.00, 1490000.00, 'INTERMEDIATE', 'PUBLISHED',
  '/images/english-workplace.jpg', 4.9, 0,
  NOW(), NOW()
);

-- [8] Khóa học trả phí — IELTS Writing Chuyên sâu
INSERT INTO courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
(
  8,
  'IELTS Writing Task 1 & 2 Chuyên Sâu: Chiến lược Band 7.0+',
  'ielts-writing-chuyen-sau',
  'Phân tích chi tiết tất cả các dạng biểu đồ trong Task 1 và các chủ đề nóng trong Task 2. Hướng dẫn lập dàn ý nhanh trong 5 phút, cấu trúc đoạn văn Coherence & Cohesion và bộ từ vựng Academic ăn điểm.',
  1, 990000.00, 1590000.00, 'ADVANCED', 'PUBLISHED',
  '/images/english-ielts.jpg', 4.9, 0,
  NOW(), NOW()
);

-- ============================================================
-- 3. CHƯƠNG BÀI HỌC (Sections)
-- ============================================================

-- Khóa 1: IELTS Intensive 7.5+
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(1, 1, 'Chương 1: Tổng quan & Chiến thuật làm bài IELTS 7.5+', 1, NOW(), NOW()),
(2, 1, 'Chương 2: Bứt phá Writing Task 2 — Luận điểm & Từ vựng', 2, NOW(), NOW()),
(3, 1, 'Chương 3: Phản xạ Speaking Part 2 & Part 3 tự nhiên', 3, NOW(), NOW());

-- Khóa 2: Tiếng Anh CNTT & Tech
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(4, 2, 'Chương 1: Từ vựng & Thuật ngữ kiến trúc phần mềm', 1, NOW(), NOW()),
(5, 2, 'Chương 2: Giao tiếp trong quy trình Agile & Standup', 2, NOW(), NOW()),
(6, 2, 'Chương 3: Chiến thuật phỏng vấn kỹ thuật quốc tế', 3, NOW(), NOW());

-- Khóa 3: TOEIC 850+ Cấp tốc
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(7, 3, 'Chương 1: Chiến thuật xử lý Part 3 & 4 Listening', 1, NOW(), NOW()),
(8, 3, 'Chương 2: Kỹ năng đọc nhanh Part 7 Reading', 2, NOW(), NOW());

-- Khóa 4: Nhập môn Phát âm chuẩn IPA
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(9, 4, 'Chương 1: Bảng nguyên âm đơn & nguyên âm đôi IPA', 1, NOW(), NOW()),
(10, 4, 'Chương 2: Phụ âm hữu thanh, vô thanh & Quy tắc nối âm', 2, NOW(), NOW());

-- Khóa 5: Tiếng Anh Giao tiếp Đi làm
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(11, 5, 'Chương 1: Small talk & Giới thiệu bản thân ấn tượng', 1, NOW(), NOW()),
(12, 5, 'Chương 2: Thuyết trình ý tưởng & Điều hành cuộc họp', 2, NOW(), NOW());

-- Khóa 6: Ngữ pháp tiếng Anh nền tảng
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(13, 6, 'Chương 1: Nắm trọn 12 thì trong tiếng Anh', 1, NOW(), NOW()),
(14, 6, 'Chương 2: Câu bị động & Mệnh đề quan hệ', 2, NOW(), NOW());

-- Khóa 7: Tiếng Anh Thương Mại
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(15, 7, 'Chương 1: Viết Email thương mại chuẩn quốc tế', 1, NOW(), NOW()),
(16, 7, 'Chương 2: Nghệ thuật đàm phán hợp đồng', 2, NOW(), NOW());

-- Khóa 8: IELTS Writing
INSERT INTO sections (id, course_id, title, order_index, created_at, updated_at) VALUES
(17, 8, 'Chương 1: Xử lý nhanh biểu đồ Task 1', 1, NOW(), NOW()),
(18, 8, 'Chương 2: Phát triển luận điểm Task 2', 2, NOW(), NOW());

-- ============================================================
-- 4. BÀI HỌC (Lessons) — Có cả Preview (Học thử) và Private (Khóa)
-- ============================================================

-- Khóa 1 (IELTS Intensive)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(1, 1, 'Bài 1.1: Định hướng lộ trình từ 6.0 lên 7.5+ IELTS', 1, 720, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(2, 1, 'Bài 1.2: Tiêu chí chấm điểm và các sai lầm cần tránh', 2, 850, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW()),
(3, 2, 'Bài 2.1: Công thức viết Introduction & Thesis Statement', 1, 960, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 0, NOW(), NOW()),
(4, 2, 'Bài 2.2: Kỹ thuật PEEL phát triển đoạn thân bài chặt chẽ', 2, 1140, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 0, NOW(), NOW()),
(5, 3, 'Bài 3.1: Chiến thuật mở rộng câu trả lời Speaking Part 2', 1, 900, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 1, NOW(), NOW()),
(6, 3, 'Bài 3.2: Xử lý các câu hỏi hóc búa trong Part 3', 2, 1020, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4', 0, NOW(), NOW());

-- Khóa 2 (Tiếng Anh IT)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(7, 4, 'Bài 1.1: Từ vựng cốt lõi về Microservices & Database', 1, 800, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(8, 4, 'Bài 1.2: Cách đọc hiểu tài liệu API & RFC kỹ thuật', 2, 950, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW()),
(9, 5, 'Bài 2.1: Mẫu câu báo cáo tiến độ trong Daily Standup', 1, 650, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 1, NOW(), NOW()),
(10, 5, 'Bài 2.2: Thảo luận kỹ thuật và xử lý mâu thuẫn trong Sprint', 2, 880, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 0, NOW(), NOW()),
(11, 6, 'Bài 3.1: Giới thiệu bản thân và trả lời Behavioral Questions', 1, 1050, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 0, NOW(), NOW()),
(12, 6, 'Bài 3.2: Mock Interview: Trình bày giải pháp System Design', 2, 1200, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4', 0, NOW(), NOW());

-- Khóa 3 (TOEIC 850+)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(13, 7, 'Bài 1.1: Kỹ thuật bắt âm và suy luận ngữ cảnh Part 3', 1, 750, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(14, 7, 'Bài 1.2: Bẫy thời gian và câu hỏi hình ảnh trong Part 4', 2, 820, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW()),
(15, 8, 'Bài 2.1: Phương pháp đọc đoạn kép và đoạn ba Part 7', 1, 980, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 0, NOW(), NOW());

-- Khóa 4 (Phát âm IPA — Miễn phí)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(16, 9, 'Bài 1.1: Giới thiệu 44 âm trong bảng IPA quốc tế', 1, 600, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(17, 9, 'Bài 1.2: Luyện phát âm các nguyên âm dài và ngắn: /i:/ vs /ɪ/', 2, 700, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 1, NOW(), NOW()),
(18, 10, 'Bài 2.1: Phụ âm khó: /θ/ và /ð/ chuẩn Tây', 1, 650, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 1, NOW(), NOW()),
(19, 10, 'Bài 2.2: Quy tắc nối âm (Linking Sounds) và nuốt âm', 2, 780, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 1, NOW(), NOW());

-- Khóa 5 (Giao tiếp đi làm)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(20, 11, 'Bài 1.1: Kỹ năng bắt chuyện xã giao (Small Talk)', 1, 600, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(21, 11, 'Bài 1.2: Giới thiệu về vị trí công việc và trách nhiệm', 2, 720, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW()),
(22, 12, 'Bài 2.1: Mở đầu bài thuyết trình và thu hút người nghe', 1, 850, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 0, NOW(), NOW());

-- Khóa 6 (Ngữ pháp nền tảng — Miễn phí)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(23, 13, 'Bài 1.1: Nhóm thì Hiện tại: Đơn, Tiếp diễn, Hoàn thành', 1, 900, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(24, 13, 'Bài 1.2: Nhóm thì Quá khứ & Tương lai trong thực tế', 2, 850, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 1, NOW(), NOW()),
(25, 14, 'Bài 2.1: Câu bị động (Passive Voice) ứng dụng', 1, 780, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 1, NOW(), NOW());

-- Khóa 7 (Thương mại)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(26, 15, 'Bài 1.1: Cấu trúc một Business Email chuyên nghiệp', 1, 750, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(27, 16, 'Bài 2.1: Kỹ thuật đàm phán giá cả và điều khoản thanh toán', 1, 920, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW());

-- Khóa 8 (IELTS Writing)
INSERT INTO lessons (id, section_id, title, order_index, duration, lesson_type, video_url, is_preview, created_at, updated_at) VALUES
(28, 17, 'Bài 1.1: Mô tả xu hướng tăng giảm trong Line Graph', 1, 800, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 1, NOW(), NOW()),
(29, 18, 'Bài 2.1: Viết bài dạng Opinion Essay chuẩn band 7.0', 1, 950, 'VIDEO', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0, NOW(), NOW());

-- ============================================================
-- 5. ĐÁNH GIÁ (Reviews)
-- ============================================================
INSERT INTO reviews (course_id, user_id, rating, comment, is_hidden, user_full_name, created_at, updated_at) VALUES
(1, 2, 5, 'Khóa học IELTS tuyệt vời! Thầy cô hướng dẫn tư duy viết luận cực kỳ sắc sảo, mình đã tăng từ 6.0 lên 7.5 Writing sau 2 tháng.', 0, 'Nguyễn Văn A', NOW(), NOW()),
(1, 3, 5, 'Rất thích phần luyện phản xạ Speaking. Tài liệu chuẩn bị kỹ lưỡng, video bài giảng nét và âm thanh rõ.', 0, 'Trần Thị B', NOW(), NOW()),
(1, 4, 4, 'Nội dung rất chi tiết, phù hợp cho bạn nào đang kẹt ở band 6.0 - 6.5 muốn bứt phá lên 7.5.', 0, 'Lê Văn C', NOW(), NOW()),
(2, 2, 5, 'Là lập trình viên nên khóa học này cực kỳ hữu ích cho mình khi làm việc với sếp nước ngoài. Các mẫu câu standup rất tự nhiên.', 0, 'Nguyễn Văn A', NOW(), NOW()),
(2, 3, 5, 'Phần chuẩn bị phỏng vấn System Design bằng tiếng Anh rất hay, mình đã apply đậu vào công ty outsourcing quốc tế.', 0, 'Trần Thị B', NOW(), NOW()),
(3, 4, 5, 'Mẹo giải đề Part 3 và Part 4 rất hiệu quả. Mình vừa thi đạt 865 điểm TOEIC tuần trước!', 0, 'Lê Văn C', NOW(), NOW()),
(4, 2, 5, 'Khóa phát âm miễn phí mà chất lượng không khác gì khóa có phí. Thầy giảng khẩu hình miệng rất dễ hiểu.', 0, 'Nguyễn Văn A', NOW(), NOW()),
(4, 3, 5, 'Nhờ khóa học mà mình sửa được tật nuốt âm cuối và biết cách nhấn trọng âm câu chuẩn hơn.', 0, 'Trần Thị B', NOW(), NOW()),
(5, 4, 5, 'Học xong tự tin hơn hẳn khi họp online với team bên Singapore.', 0, 'Lê Văn C', NOW(), NOW()),
(6, 2, 5, 'Bài giảng ngữ pháp ngắn gọn, đi thẳng vào trọng tâm, không bị lan man lý thuyết.', 0, 'Nguyễn Văn A', NOW(), NOW());
