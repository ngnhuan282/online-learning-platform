# TOEIC Reading: học và làm bài trực tiếp

Trang học viên: `/exams/toeic`. Trang quản trị: `/admin/toeic` (vai trò ADMIN).
Website giữ header chung, nút xanh và phân trang 6 bộ đề mỗi trang.

## Luồng học viên

1. Chọn bộ đề để đọc bài học trực tiếp trên web.
2. Hoàn thành bốn bài học: phương pháp làm Reading, Part 5, Part 6, Part 7. Tiến độ được lưu theo tài khoản.
3. Chọn luyện một Part không giới hạn thời gian hoặc thi thử toàn bộ Reading trong 75 phút.
4. Chọn đáp án A–D, chuyển câu, xem câu bỏ trống. Đáp án được tự lưu; có thể rời trang và tiếp tục bài đang làm.
5. Nộp bài để nhận số câu đúng, tỷ lệ phần trăm và lời giải từng câu. Có lịch sử và chức năng làm lại.

Điểm hiển thị là phần trăm và số câu đúng, không phải điểm quy đổi TOEIC chính thức.
Hết thời gian, server chấm những lựa chọn đã được lưu trước hạn. Đáp án đúng và lời giải chỉ được trả qua API kết quả sau khi chấm.
Các hình trích từ đề là nội dung câu hỏi/đoạn đọc; không có trình mở PDF hay liên kết tải tài liệu trong luồng học.
Theo lựa chọn hiện tại, chỉ có Reading; thư mục AUDIO và phần Listening không được nhập.

## Bốn bài học

Mỗi bộ đề có bốn bài học nội dung trực tiếp, có ví dụ theo nguồn của chính bộ đề:

1. Phương pháp Reading: xác định yêu cầu, phân bổ thời gian, tìm bằng chứng trong đoạn đọc.
2. Part 5: từ loại, đại từ/tính từ sở hữu, cấu trúc câu và ví dụ được giải thích.
3. Part 6: dùng ngữ cảnh, liên kết câu và điền đoạn văn.
4. Part 7: tìm thông tin, suy luận và đối chiếu các đoạn/bảng/thông báo.

## Quản trị nội dung

Admin có thể tạo nháp, sửa tên/mô tả/thời gian, thêm/sửa/xóa bài học và câu hỏi, nhập đoạn đọc, bốn lựa chọn, đáp án và lời giải.
Giao diện chọn từng câu để chỉnh nên không cần sửa một biểu mẫu gồm toàn bộ câu hỏi cùng lúc.
Lưu bộ đề trước khi xuất bản hoặc ẩn. Chỉ bộ đề đã xuất bản xuất hiện trong thư viện công khai.
Xóa bộ đề sẽ gỡ khỏi thư viện; snapshot của bài làm cũ vẫn giữ câu hỏi, đáp án và kết quả tại thời điểm bắt đầu.
Nếu hai Admin cùng sửa một bản, server từ chối bản đã lỗi thời bằng `409`; tải lại nội dung trước khi sửa tiếp.
Khi phiên bản nội dung thay đổi, tiến độ bài học hiển thị theo phiên bản mới, không thay đổi điểm của bài đã nộp.

### Nhập hàng loạt câu hỏi

Trong **Ngân hàng câu hỏi**, chọn **Import Excel/CSV** → tải mẫu `.xlsx` hoặc CSV
UTF-8 → điền câu hỏi → chọn file → xem trước và sửa hết lỗi → xác nhận nhập →
**Lưu bộ đề**. File tối đa 5 MB; tổng số câu sau khi nhập tối đa 1.000 câu/bộ đề.
Excel được đọc từ trang tính đang hiển thị đầu tiên.

Mẫu gồm 11 cột: `Số câu`, `Part`, `Đoạn đọc`, `Câu hỏi`, `A`, `B`, `C`, `D`,
`Đáp án`, `Giải thích`, `Nguồn`. Đoạn đọc và nguồn có thể bỏ trống; các cột còn lại
cần có nội dung. Part chỉ nhận 5/6/7; đáp án là A/B/C/D. Số câu phải khác các câu
đang có. Import chỉ thêm câu, không ghi đè hoặc tự đánh lại số; một dòng lỗi sẽ chặn
cả lượt nhập. Có thể hủy trước khi xác nhận mà không thay đổi nội dung.

Import và xem trước chạy trong trình duyệt. Chỉ khi bấm **Lưu bộ đề**, frontend mới
gửi nội dung qua API quản trị hiện có. Bài học không bị thay đổi. Với bộ đề đã xuất
bản, lưu sẽ cập nhật nội dung đang hiển thị cho học viên; có thể **Ẩn bộ đề** trước
khi chỉnh rồi xuất bản lại sau khi kiểm tra. PDF/Word cần trích xuất và kiểm tra trước;
không upload trực tiếp vào importer này.

Hướng dẫn chi tiết về mẫu và chuyển đổi tài liệu: [Cách tạo nội dung TOEIC](TOEIC_CONTENT_CREATION.md#import-câu-hỏi-từ-excel-hoặc-csv).

## Dữ liệu và khởi động

Flyway `V12__create_toeic_learning.sql` tạo ba bảng trong **learning_db**:
`toeic_exams`, `toeic_attempts`, `toeic_lesson_progress`.
Không sửa bảng Quiz, Enrollment hoặc dữ liệu Course/Payment cho chức năng này.

Learning Service nhập bộ dữ liệu đã số hóa từ classpath `toeic/ets2024-reading.json` khi khởi động.
Seed chỉ thêm các `seedKey` chưa tồn tại; không ghi đè nội dung Admin đã sửa và không phục hồi bộ đề Admin đã xóa.
Có thể tắt nhập bằng cấu hình Spring `toeic.seed.enabled=false`.
Seeder bỏ qua profile `test`; các kiểm thử tự chuẩn bị dữ liệu riêng.

```powershell
docker compose --profile backend up --build -d --no-deps learning-service
```

Nếu Gateway chưa có thay đổi cho thư viện TOEIC công khai, build lại riêng `api-gateway`.
Với frontend dev, chạy `npm run dev` trong `frontend/web`. Nếu dùng image web thì build lại image web sau thay đổi giao diện.
Các PDF/Word gốc không còn được đóng gói trong image web hoặc được Vite phục vụ cho học viên.
Ảnh nội dung Reading nằm trong 10 gói ở thư mục con `toeic-reading` của `TOEIC_ARCHIVES_DIR`.
Frontend giải nén chúng vào `public` khi có bộ gói. Xem
[cách cung cấp dữ liệu TOEIC](TOEIC_CONTENT_CREATION.md#4-các-file-đầu-ra).

### Máy đã chạy migration TOEIC V10 trước khi gộp main

TOEIC dùng V12 vì main đã có V9, V10 và V11 cho các chức năng khác. Database mới
và CI chạy migration bình thường. Chỉ làm các bước sau trên database phát triển
đã chạy `V10__create_toeic_learning.sql` cũ; không xóa volume hoặc bảng TOEIC.

1. Dừng Learning Service và sao lưu `learning_db` trước khi chỉnh lịch sử migration:

   ```powershell
   docker compose --profile backend stop learning-service
   New-Item -ItemType Directory -Force backups | Out-Null
   docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases learning_db > /tmp/learning-before-toeic-v12.sql'
   if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop here.' }
   docker compose cp mysql:/tmp/learning-before-toeic-v12.sql backups/learning-before-toeic-v12.sql
   if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed; stop here.' }
   ```

2. Đổi **đúng bản ghi TOEIC cũ** từ V10 sang V12. SQL chỉ khớp khi tên file,
   mô tả, checksum và trạng thái thành công đúng với bản đã phát hành; không sửa
   checksum hay bản ghi V10 của Commerce. Kết quả `moved` phải bằng `1` ở lần đầu.
   Nếu bằng `0`, dừng và kiểm tra lịch sử, không chạy Flyway repair để bỏ qua lỗi.

   ```powershell
   @'
   UPDATE flyway_schema_history old_entry
   LEFT JOIN flyway_schema_history new_entry ON new_entry.version = '12'
   SET old_entry.version = '12', old_entry.script = 'V12__create_toeic_learning.sql'
   WHERE old_entry.version = '10' AND old_entry.type = 'SQL'
     AND old_entry.description = 'create toeic learning'
     AND old_entry.script = 'V10__create_toeic_learning.sql'
     AND old_entry.checksum = 525189811 AND old_entry.success = 1
     AND new_entry.installed_rank IS NULL;
   SELECT ROW_COUNT() AS moved;
   SELECT version, description, script, checksum, success
   FROM flyway_schema_history ORDER BY installed_rank;
   '@ | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot learning_db'
   ```

3. Cho phép áp dụng các migration V9–V11 còn thiếu **một lần**, rồi chạy lại bằng
   cấu hình bình thường. Tệp override dưới đây chỉ nằm trong `.tmp`, không commit:

   ```powershell
   New-Item -ItemType Directory -Force .tmp | Out-Null
   @'
   services:
     learning-service:
       command: ["--spring.flyway.out-of-order=true"]
   '@ | Set-Content -Encoding UTF8 .tmp/toeic-v12-once.yaml
   docker compose -f compose.yaml -f .tmp/toeic-v12-once.yaml --profile backend up --build -d --no-deps --wait --wait-timeout 180 learning-service
   if ($LASTEXITCODE -ne 0) { throw 'Migration failed; inspect Learning Service logs before continuing.' }
   docker compose --profile backend up -d --no-deps --force-recreate --wait --wait-timeout 120 learning-service
   ```

Quy trình đã được kiểm chứng trên MySQL 8.4 tạm: đủ 12 migration, giữ nguyên nội dung,
bài làm đã chấm và tiến độ bài học; Flyway validate thành công khi tắt `out-of-order`.

## API

Các đường dẫn dưới `/api/v1/learning/toeic`:

| API | Mục đích |
| --- | --- |
| `GET /exams` | Danh sách bộ đề đã xuất bản; công khai |
| `GET /exams/{id}` | Nội dung học và câu hỏi, cần đăng nhập |
| `GET /exams/{id}/progress` | Bài đã học và lịch sử làm bài của người hiện tại |
| `PUT /exams/{id}/lessons/{lessonId}/complete` | Hoàn thành bài học, lặp lại không tạo trùng |
| `POST /exams/{id}/attempts` | Bắt đầu/tiếp tục PRACTICE hoặc EXAM |
| `GET /attempts/{id}` | Khôi phục bài đang làm hoặc xem kết quả |
| `PUT /attempts/{id}/answers` | Lưu bản đồ lựa chọn của bài làm |
| `POST /attempts/{id}/submit` | Nộp/chấm bài; retry trả lại kết quả đã chấm |

Admin dùng `/api/v1/learning/admin/toeic/exams`: GET danh sách, POST tạo, GET/PUT/DELETE theo id và PATCH `/{id}/publish` với `{ "published": true/false }`.
Danh tính người học lấy từ JWT; không gửi `userId` từ frontend. Mọi thao tác bài làm đều kiểm tra người sở hữu.

Hướng dẫn số hóa tài liệu và bổ sung dữ liệu nằm trong `TOEIC_CONTENT_CREATION.md` cùng thư mục.

## Kiểm chứng thay đổi này

- 15 kiểm thử frontend riêng cho nội dung và luồng TOEIC: đạt.
- 3 kiểm thử đóng gói ảnh, giải nén từ đầu, phục hồi ảnh thiếu và kiểm tra đường dẫn: đạt.
- 7 kiểm thử HTTP Learning Service trên MySQL 8.4: đạt, bao gồm migration TOEIC.
- 2 kiểm thử Gateway cho catalog công khai và các đường dẫn phải đăng nhập: đạt.
- Build frontend và lint các file liên quan: đạt. Bản build không chứa PDF, Word hoặc audio.
- Kiểm thử trình duyệt qua Gateway → Learning Service → MySQL tạm: học/hoàn thành bài,
  chọn đáp án, tải lại để tiếp tục, nộp bài, xem lời giải, phóng to đoạn đọc trên mobile,
  Admin tạo bốn bài học/câu hỏi rồi xuất bản, sửa và xóa: đạt.

Trong kiểm thử trình duyệt, Auth/profile dùng fixture; các API TOEIC và dữ liệu MySQL là thật.
Không chạy lại bộ test toàn hệ thống trong thay đổi này.
