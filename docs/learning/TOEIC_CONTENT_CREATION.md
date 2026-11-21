# Cách tạo bài học và bài tập từ tài liệu TOEIC

Tài liệu là **nguồn để biên soạn nội dung**, không phải file được đưa vào trình đọc trên website.
Đã tạo 10 bộ Reading ETS 2024, mỗi bộ có 100 câu và 4 bài học. Người học học bài,
chọn đáp án A–D, nộp bài, xem lời giải và tiếp tục bài đang làm ngay trong web.
Reading được triển khai trước; không sử dụng thư mục `AUDIO` hoặc nhập đề Listening.

## 1. Nguồn dùng cho từng loại nội dung

| Nguồn trong `docs/resources` | Dữ liệu tạo ra |
| --- | --- |
| `ĐỀ RC/TEST ... RC...pdf` | Câu hỏi, lựa chọn A–D, đoạn đọc và hình/bảng cần giữ bố cục |
| `ĐÁP ÁN ETS 2024/ĐÁP ÁN ETS 2024 RC.pdf` | Đáp án chính thức cho câu 101–200 của từng test |
| `EBOOK GIẢI CHI TIẾT 10 TEST/...pdf` | Giải thích tiếng Việt, ví dụ cho bài học và tham chiếu trang |

Không đoán đáp án từ OCR. Đáp án được đối chiếu giữa bảng đáp án và bảng lời giải
theo **số Test và số câu**. Tất cả 1.000 đáp án của bộ dữ liệu hiện tại đã khớp khi đối chiếu.

## 2. Bốn bài học đã được tạo

Trong mỗi bộ đề, nội dung được biên soạn thành bốn bài có mục tiêu, cách làm,
ví dụ từ chính bộ đề và câu hỏi tự kiểm tra:

| Bài học | Nội dung và cách lấy ví dụ |
| --- | --- |
| Bài 1 — Cách đọc và học TOEIC Reading | Hệ thống hóa hướng dẫn Part 5–7: đọc yêu cầu, phân bổ thời gian, ghi lại lỗi và tìm bằng chứng |
| Bài 2 — Part 5: Ngữ pháp và từ vựng trong câu | Giải thích từ loại/cấu trúc câu; lấy câu 101 và lời giải tương ứng làm ví dụ |
| Bài 3 — Part 6: Liên kết và ngữ cảnh đoạn văn | Phân tích ngữ cảnh, từ nối và liên kết câu; dùng câu 131 và lời giải tương ứng |
| Bài 4 — Part 7: Đọc hiểu và tìm bằng chứng | Cách đọc email/thông báo/bảng, tìm thông tin và suy luận; dùng câu 147 cùng lời giải |

Ví dụ ở Test 1: câu 101 có cụm `------- career experiences` và các lựa chọn
`he / his / him / himself`. Bài học Part 5 giải thích vì sao **his** đứng trước
cụm danh từ. Nguồn là đề Reading Test 1, trang PDF 2 và lời giải câu 101 trong ebook.
Đây là bài học có nội dung trực tiếp, không phải nút mở tài liệu.

Luồng học lưu trạng thái hoàn thành từng bài. Luồng làm bài riêng sử dụng câu hỏi,
đoạn đọc và đáp án đã số hóa; API bài đang làm không trả đáp án đúng hay lời giải.

## 3. Quy trình đã dùng để chuyển đổi từ file gốc

Nội dung hiện tại đã được chuyển đổi và lưu sẵn trong JSON cùng các gói ảnh.
Các script Python chuyển đổi và công cụ OCR đã được gỡ theo lựa chọn của người dùng.
Chạy website và nạp dữ liệu ban đầu dùng JSON cùng các gói ảnh có sẵn; nội dung mới
được thêm qua Admin hoặc import Excel/CSV, không cần công cụ Python/OCR.
Phần dưới ghi lại cách dữ liệu đã được tạo, không phải hướng dẫn chạy lại công cụ.

Các bước thực hiện:

1. Đọc bảng đáp án và lời giải. Khôi phục chữ tiếng Việt bị thiếu ánh xạ font trong ebook.
2. Kết xuất các trang đề Reading thành ảnh tạm, rồi OCR tiếng Anh ngay trên máy.
3. Dùng vị trí chữ để tách số câu, thân câu, lựa chọn và nhóm đoạn đọc.
4. Ghép đáp án/lời giải theo số câu; biên soạn bốn bài học từ các kiến thức và ví dụ đã chọn.
5. Đối chiếu với đề gốc. Áp dụng các hiệu chỉnh đã kiểm chứng, được lưu lại trong `source-overrides`.
6. Sinh JSON cho backend và các hình nội dung cần dùng cho frontend.

OCR có thể làm mất dấu trống hoặc sai nhãn lựa chọn. Công cụ không tự đoán vị trí
chỗ trống. Câu chưa đủ tin cậy dùng hình trích đúng câu gốc; đoạn đọc/bảng được
giữ hình khi cần bảo toàn bố cục. Người học vẫn trả lời bằng điều khiển A–D của web.
Hình có thể phóng to để đọc trên điện thoại. Các lựa chọn đã được chép lại từ nguồn,
không dùng nội dung mẫu thay cho câu thiếu.

Một số lỗi đánh số trong tài liệu gốc, đặc biệt câu 194–195 Test 8, đã được sửa
theo nội dung thực tế. Các hiệu chỉnh và mã SHA-256 của nguồn được ghi lại để kiểm tra lại được.
File PDF gốc được giữ nguyên. Khi biên soạn từ tài liệu mới, cần đối chiếu lại nội dung
và đáp án với đúng nguồn, không tái sử dụng kết quả OCR của tài liệu khác.

Chi tiết nguồn và các hiệu chỉnh đã ghi nhận: [Ghi chú dữ liệu TOEIC](../../infra/scripts/toeic/README.md).
Để thêm nội dung tiếp theo, dùng Admin hoặc mẫu Excel/CSV ở mục 5.

## 4. Các file đầu ra

| File/thư mục | Vai trò |
| --- | --- |
| `backend/learning-service/src/main/resources/toeic/ets2024-reading.json` | 10 bộ đề, 40 bản ghi bài học, 1.000 câu, đáp án và lời giải; chỉ đóng gói ở backend |
| `frontend/web/public/toeic-assets/ets2024-reading/` | Hình câu hỏi và đoạn đọc từ đề không có đáp án |
| `$TOEIC_ARCHIVES_DIR/toeic/test01.tar.gz` … `test10.tar.gz` | Mười gói ảnh Reading lưu ngoài Git. Frontend giải nén chúng vào `public` |
| `docs/learning/TOEIC_SOURCE_AUDIT.json` | Tham chiếu nguồn, SHA-256, kết quả đối chiếu và hiệu chỉnh |
| `infra/scripts/toeic/source-overrides/` | Bằng chứng đối chiếu và hiệu chỉnh nguồn; không dùng khi ứng dụng chạy |

Không chép JSON chứa đáp án vào `public` hoặc import nó từ frontend. Learning Service
nạp seed khi khởi động; Admin có thể chỉnh nội dung đã nạp trong database.

Lấy 19 gói từ thư mục dữ liệu trên VPS và đặt `TOEIC_ARCHIVES_DIR` trỏ tới thư mục
chứa `toeic` và `toeic-listening`. Ví dụ khi chạy local trên PowerShell trong `frontend/web`:

```powershell
$env:TOEIC_ARCHIVES_DIR = 'D:\toeic-data'
npm run dev
```

`npm run dev`, `npm run build` và `npm test` đối chiếu checksum và giải nén media khi
có bộ gói. Dùng `npm run prepare:toeic` để chạy riêng bước chuẩn bị và yêu cầu có đầy
đủ các gói. CI có thể chạy build và kiểm thử cấu trúc đề bằng dữ liệu thử nhỏ. Khi cung
cấp bộ gói thật, kiểm thử cũng đối chiếu ảnh/audio mà câu hỏi tham chiếu.
Xem [cách cấu hình production](../deployment/PRODUCTION.md#2-kiểm-tra-cấu-hình-tạo-admin-và-khởi-động).
Ảnh tùy chỉnh mới nên đặt ngoài thư mục sinh tự động `ets2024-reading` để được Git theo dõi.

## 5. Tạo và sửa nội dung tiếp theo bằng Admin

1. Đăng nhập tài khoản ADMIN, mở **Quản lý TOEIC** → **Thêm bộ đề**.
2. Nhập tên, mã bộ đề và thời gian thi.
3. Trong **Bài học**, nhập bốn bài theo cấu trúc ở trên; dùng ví dụ từ nguồn mới.
4. Trong **Ngân hàng câu hỏi**, thêm số câu, Part, đoạn đọc, nội dung câu hỏi,
   bốn lựa chọn, đáp án đúng và lời giải. Có thể nhập từng câu hoặc chọn
   **Import Excel/CSV** theo hướng dẫn dưới đây. Ghi lại tham chiếu nguồn.
5. Xem trước, lưu bản nháp, kiểm tra nội dung rồi xuất bản.

### Import câu hỏi từ Excel hoặc CSV

1. Mở bộ đề cần chỉnh sửa → **Ngân hàng câu hỏi** → **Import Excel/CSV**.
2. Chọn **Tải mẫu Excel** (`.xlsx`) hoặc **Tải mẫu CSV**. Điền câu hỏi theo các cột
   của mẫu, sửa hoặc bỏ câu ví dụ trước khi nhập dữ liệu của mình.
3. Chọn file để xem trước câu hỏi, bốn lựa chọn, đáp án, lời giải và các lỗi theo
   dòng. Mỗi trang xem trước hiển thị tối đa 10 câu.
4. Sửa hết lỗi trong file rồi chọn lại. Chỉ khi tất cả các dòng hợp lệ mới bấm được
   **Nhập … câu hỏi**. Đóng bằng **Hủy** không thay đổi ngân hàng câu hỏi.
5. Kiểm tra các câu vừa thêm trong biểu mẫu, rồi bấm **Lưu bộ đề** để ghi vào database.
   Thao tác chọn file, xem trước và xác nhận import chưa tự gọi API lưu bộ đề.

File tối đa **5 MB**. Bộ đề sau khi thêm không được vượt quá **1.000 câu**, tính cả
câu đang có. Với Excel, importer đọc **trang tính đang hiển thị đầu tiên**; đặt bảng
câu hỏi ở trang này. Với CSV, lưu bằng **CSV UTF-8** để giữ tiếng Việt; mẫu tải xuống
có dấu BOM UTF-8 để mở bằng Excel.

Mẫu có **11 cột**:

| Cột | Bắt buộc | Nội dung |
| --- | --- | --- |
| `Số câu` | Có | Số nguyên từ 1 đến 10.000, không trùng trong file hoặc với câu đang có |
| `Part` | Có | `5`, `6` hoặc `7` |
| `Đoạn đọc` | Không | Đoạn văn dùng cho câu hỏi; có thể giữ các dòng xuống hàng |
| `Câu hỏi` | Có | Nội dung câu hỏi hiển thị trực tiếp cho học viên |
| `A`, `B`, `C`, `D` | Có, cả bốn cột | Nội dung từng phương án |
| `Đáp án` | Có | Một chữ cái `A`, `B`, `C` hoặc `D` |
| `Giải thích` | Có | Giải thích vì sao đáp án đúng để hiển thị sau khi chấm bài |
| `Nguồn` | Không | Tên tài liệu, Test, trang hoặc tham chiếu giúp đối chiếu nội dung |

Import **chỉ thêm câu hỏi**, không ghi đè, không tự đổi số câu, không thay đổi các
bài học đang có. Nếu có bất kỳ lỗi nào, toàn bộ lượt import bị chặn; không tự bỏ qua
dòng lỗi để nhập phần còn lại. Khi thêm câu cho bộ đề đã có dữ liệu, chọn các số câu
chưa dùng hoặc sửa/xóa câu cũ bằng giao diện trước.

Bộ đề mới được lưu nháp trước khi xuất bản. Với bộ đề **đang xuất bản**, bấm
**Lưu bộ đề** sẽ cập nhật nội dung cho học viên; import không tự chuyển bộ đề về nháp.
Nếu muốn kiểm tra riêng trước, lưu các thay đổi đang có rồi bấm **Ẩn bộ đề**, thực hiện
import, lưu và xuất bản lại khi sẵn sàng.

Importer này nhận `.xlsx` và `.csv`, không nhận `.xls`, PDF hay Word trực tiếp.
Với PDF/Word trong `docs/resources`, trích xuất và đối chiếu theo mục 3, sau đó đưa
câu hỏi vào mẫu nếu muốn nhập qua Admin. Import không tự tạo bài học; nội dung bài
học vẫn được biên soạn trong tab **Bài học**.

Cập nhật bộ đề đã tồn tại bằng Admin/API. Sửa JSON seed rồi khởi động lại **không**
ghi đè dữ liệu Admin đã sửa; seed cũng không phục hồi bộ đề Admin đã xóa.
Bài làm cũ dùng snapshot nên việc sửa/xóa nội dung không làm đổi kết quả đã chấm.

## 6. Kiểm tra các luồng liên quan

```powershell
cd frontend/web
node --test --test-concurrency=1 tests/toeic-assets.test.js tests/toeic-content.test.js tests/toeic-import.test.js tests/toeic-native.test.js
```

Test nội dung kiểm tra đủ bốn bài học, cấu trúc 100 câu/test, bốn lựa chọn,
đáp án, đoạn đọc, nguồn và hình tồn tại. Test giao diện kiểm tra học bài, phân trang,
lưu/khôi phục đáp án, nộp bài, hết giờ, xem lại và Admin thêm/sửa/xóa.
Test import dùng file CSV/XLSX để kiểm tra mẫu, nội dung nhiều dòng, dữ liệu thiếu/sai,
câu trùng, giới hạn số câu và việc chỉ thêm câu sau khi xác nhận.

Backend có `ToeicLearningIntegrationTests`; Gateway có `ToeicGatewayAccessTests`.
Chỉ chạy các kiểm thử liên quan này cho thay đổi TOEIC.

## 7. Soạn bộ đề Listening

Trong **Luyện thi TOEIC → Listening**, học viên chọn luyện từng Part hoặc thi thử
45 phút. Một bộ đầy đủ có 6 câu Part 1, 25 câu Part 2, 39 câu Part 3 và 30 câu Part 4.
Bộ đề ETS 2024 hiện có audio cho Test 01–03 và 05–10.

1. Đối chiếu số Test trong `docs/resources/AUDIO` với đề Listening trong
   `docs/resources/ĐỀ LC` và bảng đáp án Listening trong `docs/resources/ĐÁP ÁN ETS 2024`.
2. Cắt theo lời đọc số câu và khoảng nghỉ ở hai đầu. Cắt từng câu cho Part 1–2.
   Với Part 3–4, một đoạn gồm hội thoại hoặc bài nói và ba câu hỏi đi kèm. Nghe lại
   câu đầu và câu cuối sau khi cắt để xác nhận đúng nhóm.
3. Trích ảnh Part 1 và biểu đồ Part 3–4. Từ scan có ghi chú tay, nhập lại câu hỏi và
   lựa chọn từ chữ in. Dùng đáp án trong bảng đáp án gốc.
4. Chép transcript từ audio đã cắt. Với Part 1–2, ghi các phương án đã nghe theo
   thứ tự A–D hoặc A–C. Với Part 3–4, dùng một transcript cho cả nhóm ba câu.

Ví dụ xuất đoạn từ giây 2276.0812 đến giây 2344.1359 của Test 01.

```powershell
ffmpeg -ss 2276.0812 -i "docs/resources/AUDIO/Test_01.mp3" -t 68.0547 -map 0:a:0 -map_metadata -1 -ac 1 -ar 24000 -c:a libmp3lame -b:a 40k "audio-083-085.mp3"
```

Trong **Admin → Quản lý TOEIC**, chọn **Thêm câu Listening** khi tạo đề, chọn
Part, rồi nhập đường dẫn MP3 đã được frontend phục vụ dưới `/toeic-assets/`. Nhập
transcript, đáp án đúng và ảnh Part 1 hoặc hình nhóm câu nếu có. Part 3–4 có trường
câu hỏi và bốn lựa chọn. Dùng cùng đường dẫn MP3 cho ba câu liên tiếp trong một
nhóm. **Xem trước câu hỏi** để kiểm tra bản cắt trước khi lưu và xuất bản.

Dữ liệu phát hành nằm trong `ets2024-listening.json` của Learning Service và chín
gói media trong `$TOEIC_ARCHIVES_DIR/toeic-listening`. Lệnh `npm run prepare:toeic`
giải nén ảnh và audio khi chạy frontend. Learning Service tự chạy migration V22 và
thêm các đề Listening khi khởi động với chức năng seed bật.

Ảnh và câu hỏi Test 01 dùng file `docs/resources/ĐỀ LC/TEST 1 LC.pdf` được khôi
phục từ commit `c3a9b37`. File PDF đọc được đủ 13 trang.
