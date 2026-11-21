# Luyện nghe chép chính tả

## Phạm vi

- Khách có thể xem các chủ đề và bài đã xuất bản tại `/dictation`. Bắt đầu luyện, tiếp tục bài và xem tiến độ yêu cầu đăng nhập. Luyện nghe hoạt động độc lập với khóa học, đăng ký học và gói PRO.
- Hỗ trợ thanh thời gian cho toàn bộ audio, nghe và phát lại từng câu, gợi ý từng từ, phản hồi chấm từ trực tiếp từ backend, lưu để luyện tiếp và xem tiến độ mới nhất của mỗi bài.
- Trang quản lý `/admin/dictation` chỉ dành cho vai trò `ADMIN`, được kiểm tra ở cả frontend và backend.
- Bài mới dùng video YouTube có thể nhúng. Các bài MP3 và MP4 đã có vẫn dùng trình phát tương ứng.

## Dữ liệu và tệp

Learning Service lưu dữ liệu bài nghe trong các bảng `dictation_*` của `learning_db`.

- Flyway V14 tạo các bảng và bài audio mẫu **The company picnic**.
- Flyway V15 bổ sung chỉ số các từ đã dùng gợi ý, không thay đổi điểm hiện có hoặc checksum của V14.
- Flyway V16 bổ sung chấm điểm trực tiếp và lưu riêng các từ người học tự nhập đúng. Các lượt luyện cũ đã hoàn thành vẫn giữ nguyên điểm đã lưu.
- Flyway V21 tạo sẵn bài YouTube **What day is it today?**.
- Flyway V23 ghi nhận các workbook đã nhập để dùng lại bài tương ứng khi nhận cùng nội dung.
- Flyway V24 xóa hai bài mẫu **The company picnic** và **What day is it today?** cùng điểm và tiến độ của riêng hai bài mẫu.

V10-V13 thuộc các migration thương mại, danh mục và TOEIC hiện có trên `main`, không được sửa. Database local từng chạy migration luyện nghe dưới tên V10-V12 cần được sao lưu rồi đối chiếu, điều chỉnh lịch sử migration. Chỉ đổi tên tệp nguồn không tự cập nhật lịch sử trong database đã chạy.

Thư viện trên database mới sẽ trống cho đến khi một bài được xuất bản. Để đưa **What day is it today?** lên thư viện, dùng workbook của bài trong thư mục tự nhập như các bài khác.

Lệnh khởi động backend vẫn là:

```sh
docker compose --profile backend up --build -d
```

Compose lưu các audio admin đã tải lên trong volume riêng `dictation_uploads`. Flyway tự tạo bảng khi khởi động backend trên database mới.

Khi chạy Maven từ `backend/learning-service`, thư mục lưu audio mặc định là `./uploads/dictation`. Có thể cấu hình đường dẫn này bằng `DICTATION_STORAGE_DIR`.

## Biên tập transcript

### Tạo bài từ YouTube và Excel

1. Mở video gốc trên YouTube và sao chép liên kết chia sẻ. Lưu file Excel vào thư mục của nhóm trên VPS hoặc Drive chung. Lưu link YouTube cạnh Excel, chẳng hạn trong file `youtube-links.csv` có tên file, link và chủ đề.
2. Vào **Quản lý bài nghe → Thêm bài nghe**, nhập tên và chủ đề, rồi dán link vào **Liên kết YouTube**. Bấm phát trong khung xem trước nếu thời lượng chưa hiện.
3. Chọn **Nhập từ Excel** và chọn tệp `.xlsx`. Nếu mở trình duyệt trong Remote Desktop, có thể chọn trực tiếp file trên VPS. Nếu mở ở máy cá nhân, chép hoặc tải Excel về máy trước khi chọn.
4. Kiểm tra mốc thời gian theo video YouTube gốc rồi **Xuất bản**. Database lưu link YouTube, chủ đề, các câu và mốc thời gian. Khi luyện, ChitChatGo phát video từ YouTube theo mốc của câu được chọn.

Các bài seed có thể dùng cùng cấu trúc dữ liệu với `video.url` là link YouTube gốc, `video.duration` là thời lượng tính bằng giây và `sentences` chứa các câu có mốc bắt đầu/kết thúc.

### Tự nhập bài từ một file Excel trên VPS

1. Trên VPS, tạo thư mục dành riêng cho file muốn xuất bản, chẳng hạn `/home/ubuntu/dictation-sources/inbox/`. Đặt `DICTATION_IMPORT_HOST_DIR=/home/ubuntu/dictation-sources/inbox` trong `.env.production` rồi deploy phiên bản có V23 theo luồng deploy của nhóm. Khi để trống biến này, Compose dùng `dictation-inbox.local/` trong thư mục dự án. Learning Service đọc thư mục qua bind mount chỉ đọc, nên tài khoản chạy trong container cần có quyền đọc thư mục và file.
2. Trên web, vào **Quản lý bài nghe → Thêm bài nghe → Tải Excel mẫu** để tải `transcript-template.xlsx`. Mẫu có một sheet **Transcript**. Thay dữ liệu minh họa trong phần **Nội dung** bằng tên bài, chủ đề, trình độ, link YouTube HTTPS và thời lượng của bài. Dùng dạng `mm:ss` cho thời lượng, ví dụ `01:32`. Các file cũ ghi thời lượng bằng số giây vẫn nhập được. Bảng transcript bắt đầu ở dòng 8. Thay hai câu ví dụ và điền mốc theo dạng `mm:ss`. Mỗi file `.xlsx` chứa một bài và có dung lượng tối đa 5 MB.
3. Nếu nhận một file ZIP, giải nén rồi chép từng file `.xlsx` trực tiếp vào thư mục ở bước 1. Dịch vụ quét cấp thư mục đó và lấy chủ đề từ ô **Chủ đề** trong Excel. Có thể dùng đuôi `.xlsx.part` trong lúc tải lên rồi đổi thành `.xlsx` khi xong. Dịch vụ đợi 15 giây giữa các lượt quét, kiểm tra và xuất bản bài hợp lệ. Tải lại thư viện để thấy bài. Nếu file lỗi, tìm tên file và lý do trong log `learning-service`, sửa nội dung rồi thay file.

Thư mục này dành cho quản trị viên VPS vì workbook hợp lệ được xuất bản tự động. Mỗi nội dung workbook được nhập một lần, kể cả khi chép lại dưới tên khác hoặc khởi động lại dịch vụ. Workbook có nội dung khác được tạo thành bài riêng. Web đọc các bài đã nhập từ database, nên bạn có thể dời file nguồn ra khỏi thư mục nhận bài sau khi xác nhận đã xuất bản. Để chỉnh bài hoặc gỡ bài khỏi thư viện, dùng trang quản lý bài nghe.

### Nhập và kiểm tra mốc

Admin có thể nhập từng câu trực tiếp, lấy mốc bắt đầu/kết thúc từ vị trí đang phát hoặc nhập tệp `.xlsx` theo mẫu tải từ trang quản lý. Khi nhập qua admin, hệ thống đọc bảng transcript và dùng tên bài, chủ đề, trình độ cùng video từ form. Bạn có thể để trống phần thông tin trên. Các mẫu cũ có tiêu đề bảng ở dòng đầu vẫn dùng được.

Nhập Excel cần xem trước, xác nhận và lưu hoặc xuất bản thì nội dung bài mới được cập nhật. Phát hoặc tua đến vị trí mong muốn rồi bấm nút lấy mốc để điền thời gian hiện tại vào câu.

Các cột gồm `Thứ tự`, `Transcript`, `Bắt đầu`, `Kết thúc`. Mốc thời gian trong Excel phải là văn bản theo định dạng `mm:ss`. Mốc lấy trực tiếp từ trình phát vẫn giữ phần giây lẻ trong dữ liệu nội bộ. Bản nháp cho phép để trống mốc thời gian.

Khi lưu hoặc xuất bản, mốc kết thúc vượt thời lượng audio sẽ được giới hạn đúng đến cuối tệp. Ví dụ, nhập `00:36` cho audio dài 35,8 giây sẽ lấy đến 35,8 giây. Mốc bắt đầu phải nằm trong thời lượng audio; khi xuất bản, các đoạn vẫn phải hợp lệ, đúng thứ tự và không chồng lấn. Màn hình xem trước hiển thị lỗi theo dòng. Mặc định, các câu nhập vào được thêm tiếp; admin có thể chủ động chọn thay thế toàn bộ. Nhập Excel không tự lưu hoặc xuất bản.

Admin có thể lưu bản nháp hoặc xuất bản trực tiếp trong hộp biên tập. Xuất bản trực tiếp sẽ kiểm tra, lưu phần chưa lưu và xuất bản trong cùng một giao dịch; nếu thất bại, bản nháp hiện có và phiên bản đang xuất bản được giữ nguyên. Lần xuất bản đầu không hỏi xác nhận về lịch sử học viên. Cập nhật bài đã xuất bản cần xác nhận và không làm mất các lượt luyện trước đó. Khi xuất bản thành công, hộp biên tập đóng lại, danh sách được tải lại và hiển thị thông báo thành công phía trên.

Danh sách quản lý hỗ trợ 10, 20 hoặc 50 dòng mỗi trang, hiển thị khoảng bản ghi hiện tại và tổng số. Trang hiện tại và bộ lọc được giữ trong URL. Đổi bộ lọc hoặc số dòng mỗi trang sẽ quay về trang đầu.

Giới hạn: MP3 tối đa 25 MB và 60 phút; Excel tối đa 5 MB; mỗi bài tối đa 200 câu; mỗi câu transcript tối đa 1.500 ký tự; câu trả lời tối đa 2.000 ký tự.

## Chấm điểm và lịch sử

Backend chuẩn hóa chữ hoa/thường, khoảng trắng, dấu nháy Unicode và dấu câu, sau đó căn chỉnh các từ bằng khoảng cách chỉnh sửa. Dạng viết tắt và cách viết số vẫn được phân biệt; ví dụ, `I'll` không tự được coi là tương đương với `I will`. Hệ thống không suy đoán ngữ nghĩa.

Nếu có nhiều cách căn chỉnh tối ưu ngang nhau, hệ thống ưu tiên từ trái sang phải để câu trả lời ngắn nhập sai không bị đặt vào từ cuối. Frontend gộp thao tác nhập thành các yêu cầu lưu tiến độ tuần tự khoảng mỗi 200 ms, kể cả khi người học gõ liên tục; trước khi dùng gợi ý hoặc chuyển câu, phần đang chờ được gửi ngay. Kết nối chậm không làm hàng đợi tăng vô hạn. Phản hồi từ server chỉ tiết lộ những từ khớp đúng; đáp án của từ sai hoặc chưa nhập vẫn được ẩn. Phần đầu của từ cuối đang gõ có thể tạm giữ trạng thái trung tính.

Không có nút kiểm tra riêng. Câu trả lời đầy đủ và đúng sẽ tự hoàn thành, khóa câu đó. Câu sai hoặc chưa đủ vẫn được sửa và chưa tính là hoàn thành. Nhập thừa từ sẽ không tự hoàn thành. Xem đáp án hoặc mở hết gợi ý từ cũng hoàn thành câu, nhưng không tự chuyển sang câu khác hay kết thúc bài.

Điểm trực tiếp được tính từ những từ trong đáp án mà người học tự nhập đúng trước khi dùng gợi ý hoặc xem đáp án. Tự sửa lỗi vẫn được ghi nhận điểm. Lần gửi có từ thừa không tích lũy thêm từ đúng. Từ đã dùng gợi ý không được tính điểm, trừ khi từ đó đã được tự nhập đúng trước đó. Xem đáp án cả câu giữ lại điểm của những từ đã tự làm được, không cộng điểm cho các từ còn lại. Backend quản lý danh sách từ được tính điểm.

Điểm bài nghe bằng số từ được tính điểm chia cho tổng số từ trong đáp án, quy về thang 100 và chỉ hiển thị khi hoàn thành bài. Đây là mức hoàn thành không nhờ trợ giúp, không phải độ chính xác ngay lần nghe đầu. Các lượt luyện cũ đã hoàn thành giữ nguyên kết quả theo lần kiểm tra đầu tiên; chú thích ở phần kết quả cho biết cơ chế chấm điểm cũ.

Mỗi câu hoàn thành đều có viền xanh lá và dấu tích, dù có dùng gợi ý hay không. Đây là dấu hiệu hoàn thành, không khẳng định người học tự làm đúng toàn bộ.

Nhấp một dòng transcript sẽ phát câu đó từ đầu và dừng ở mốc kết thúc. Nút `Bắt đầu` tiếp tục phát trong câu đang chọn; nếu đã đến cuối câu thì chuyển sang phát câu tiếp theo. Nút `Phát lại` luôn phát lại câu hiện tại từ đầu. Khi đến cuối câu cuối cùng, nút `Bắt đầu` bị khóa nhưng vẫn có thể phát lại. Nghe audio không tự chấm câu trả lời hoặc kết thúc bài.

Thanh thời gian và thời lượng luôn áp dụng cho toàn bộ tệp audio. Tua thủ công trên thanh thời gian cho phép nghe toàn bài; chọn một câu hoặc bấm `Phát lại` sẽ khôi phục giới hạn dừng ở cuối câu. Xem đáp án, kết thúc bài và luyện lại vẫn cần xác nhận. Kết quả hoàn thành hiển thị phần tổng kết điểm phía trên khu vực luyện tập chỉ đọc, khu vực này luôn được giữ lại. Nhận xét điểm dùng màu đỏ khi dưới 50, màu cam từ 50 đến dưới 80 và màu xanh lá từ 80 trở lên; không thay đổi điểm đã lưu hoặc màu đánh dấu câu hoàn thành.

`Tiến độ bài học` chỉ hiển thị lượt luyện mới nhất của mỗi bài. Khung bộ lọc gồm `Tất cả` (mặc định), `Đang luyện`, `Đã hoàn thành`, tìm kiếm, trình độ và chủ đề. Luyện lại đưa bài về trạng thái đang luyện, không xóa lịch sử trước đó. Việc chọn lượt mới nhất được thực hiện trước khi lọc và phân trang, nên lượt cũ đã hoàn thành không xuất hiện trở lại sau khi luyện lại. Thư viện và tiến độ đều dùng tổng số chính xác để phân trang theo số: thư viện 12 bài/trang, tiến độ 20 bài/trang.

Các phiên bản nội dung không bị sửa đè. Lưu bài đã xuất bản sẽ tạo phiên bản nháp; xuất bản chỉ áp dụng cho lượt luyện mới. Lượt luyện hiện có giữ nguyên nội dung, mốc thời gian và điểm của phiên bản ban đầu.

Ẩn bài sẽ chặn bắt đầu lượt mới, truy cập lượt chưa hoàn thành, tải audio của lượt đó và mọi thao tác cập nhật của người học ở API. Lịch sử vẫn giữ các lượt này với cờ `archived` và khóa nút tiếp tục. Chủ sở hữu vẫn được xem kết quả và nghe audio của lượt đã hoàn thành, nhưng không thể luyện lại bài đang bị ẩn. Cập nhật bài và thay đổi trạng thái ẩn dùng chung khóa bài nghe, nên yêu cầu ghi không thể vượt qua thao tác ẩn đã hoàn tất. Hiện lại bài cho phép tiếp tục lượt luyện cũ. Lượt đã hoàn thành chỉ đọc; luyện lại sẽ tạo lượt mới.

## API

Mọi yêu cầu frontend đều đi qua client Gateway dùng chung. Không nới lỏng bảo mật để phát audio: frontend tải audio có xác thực dưới dạng Blob và thu hồi object URL khi dọn dẹp.

Tiền tố API người học: `/api/v1/learning/dictation`

- `GET /`: thư viện có phân trang và bộ lọc từ khóa, trình độ, chủ đề.
- `POST /exercises/{id}/attempts`: bắt đầu hoặc tiếp tục; gửi lại cùng yêu cầu không tạo lượt trùng.
- `GET /attempts`: tiến độ mới nhất của người dùng, nhận `keyword`, `level`, `topic`, `status` (`IN_PROGRESS`, `COMPLETED` hoặc để trống), `page`, `size`. Trả về `{items,total,page,size,topics}`. Danh sách chủ đề lấy từ các lượt mới nhất của chính người dùng, bao gồm bài đã ẩn và phiên bản gốc.
- `GET /attempts/{id}` và `/attempts/{id}/audio`: chỉ chủ sở hữu được đọc trạng thái và audio của lượt luyện.
- `PUT /attempts/{id}/progress`: lưu và chấm nội dung đang nhập; trả về phản hồi từng từ đã được che đáp án và trạng thái hoàn thành câu. Không trả phần đáp án còn lại của câu chưa hoàn thành.
- `POST /attempts/{id}/check`, `/hint` (nhận `index`, `wordIndex`), `/reveal`, `/skip`, `/finish`.

`/check` được giữ để tương thích và xử lý như lưu tiến độ trực tiếp; giao diện người học không gọi endpoint này. `/skip` được giữ cho client cũ, không có trong giao diện hiện tại.

Tiền tố API quản trị: `/api/v1/learning/admin/dictation`

- `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`: danh sách, chi tiết, tạo và cập nhật bản nháp.
- `POST /publish`: tạo và xuất bản bài mới trong một giao dịch.
- `POST /{id}/publish`: yêu cầu phiên bản hiện tại trong trình biên tập. Có thể gửi thêm nội dung để lưu và xuất bản trong một giao dịch; nếu chỉ gửi phiên bản thì xuất bản bản nháp đã lưu.
- `PUT /{id}/visibility`: ẩn/hiện bài, không xóa lịch sử.
- `POST /audio`, `GET /audio/{key}`: tải lên và đọc audio.
- `GET /template`, `POST /import`: tải Excel mẫu và đọc nội dung tệp nhập.

## Kiểm thử

- Learning Service: `DictationIntegrationTests`, `DictationGraderTests`, `DictationMigrationTests`.
- Frontend: `frontend/web/tests/dictation.test.js` và `dictation-ui.test.js` kiểm tra logic và các thao tác React.

Các bộ kiểm thử này bổ sung, không thay thế các bộ kiểm thử service và frontend hiện có.
