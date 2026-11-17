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

Flyway `V10__create_toeic_learning.sql` tạo ba bảng trong **learning_db**:
`toeic_exams`, `toeic_attempts`, `toeic_lesson_progress`.
Không sửa bảng Quiz, Enrollment hoặc dữ liệu Course/Payment cho chức năng này.

Learning Service nhập bộ dữ liệu đã số hóa từ classpath `toeic/ets2024-reading.json` khi khởi động.
Seed chỉ thêm các `seedKey` chưa tồn tại; không ghi đè nội dung Admin đã sửa và không phục hồi bộ đề Admin đã xóa.
Có thể tắt nhập bằng cấu hình Spring `toeic.seed.enabled=false`.

```powershell
docker compose --profile backend up --build -d --no-deps learning-service
```

Nếu Gateway chưa có thay đổi cho thư viện TOEIC công khai, build lại riêng `api-gateway`.
Với frontend dev, chạy `npm run dev` trong `frontend/web`. Nếu dùng image web thì build lại image web sau thay đổi giao diện.
Các PDF/Word gốc không còn được đóng gói trong image web hoặc được Vite phục vụ cho học viên.
Ảnh nội dung được commit thành 10 gói trong `frontend/web/resources/toeic`. Frontend
tự giải nén trước khi chạy dev/build/test; không cần commit các ảnh sinh trong `public`.

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
- 7 kiểm thử HTTP Learning Service trên MySQL 8.4: đạt, bao gồm migration V10.
- 2 kiểm thử Gateway cho catalog công khai và các đường dẫn phải đăng nhập: đạt.
- Build frontend và lint các file liên quan: đạt. Bản build không chứa PDF, Word hoặc audio.
- Kiểm thử trình duyệt qua Gateway → Learning Service → MySQL tạm: học/hoàn thành bài,
  chọn đáp án, tải lại để tiếp tục, nộp bài, xem lời giải, phóng to đoạn đọc trên mobile,
  Admin tạo bốn bài học/câu hỏi rồi xuất bản, sửa và xóa: đạt.

Trong kiểm thử trình duyệt, Auth/profile dùng fixture; các API TOEIC và dữ liệu MySQL là thật.
Không chạy lại bộ test toàn hệ thống trong thay đổi này.
