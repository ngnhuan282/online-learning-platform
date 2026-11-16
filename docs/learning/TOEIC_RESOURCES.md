# Thư viện TOEIC ETS 2024

Mở `/exams/toeic` trên frontend hoặc chọn **Luyện thi TOEIC** trong menu chính.
Trang dùng header/footer chung của website; ở màn hình có nút ba gạch, mở nút đó để vào menu.
Trang có danh sách bộ đề, tìm kiếm, lọc, lưu đề trên trình duyệt và trình đọc PDF theo từng test.
Thư viện hiển thị tối đa 6 mục mỗi trang; tìm kiếm, đổi bộ lọc hoặc cách sắp xếp sẽ về trang đầu.
Đồng hồ tự luyện chạy tại trang đọc; không tạo Quiz Attempt hoặc tự chấm điểm.

## Tài liệu nguồn

Frontend dùng trực tiếp PDF/Word trong `docs/resources`. Không di chuyển hoặc sửa tài liệu gốc.
Thư mục `AUDIO` bị loại khỏi danh mục, quyền đọc file của Vite dev server và bản build.

| Thư mục | Vai trò |
| --- | --- |
| `ĐỀ RC` | Đề Reading PDF theo số test |
| `ĐỀ LC` | Đề Listening PDF theo số test; không có trình phát audio |
| `EBOOK GIẢI CHI TIẾT 10 TEST` | Ebook lời giải; giữ cả PDF và Word nếu có |
| `ĐÁP ÁN ETS 2024` | Hai bảng đáp án chung cho các test |

Tên có `TEST 1`, `TEST 2`, ... được gom vào bộ đề tương ứng, sắp xếp theo số.
File PDF và Word của cùng một test là hai tài liệu riêng; Word được tải xuống để mở bằng ứng dụng phù hợp.
Bảng đáp án chung được truy cập từ danh sách tài liệu và thanh tài liệu của mỗi test.

## Thêm tài liệu

1. Thêm PDF hoặc Word vào thư mục phù hợp; dùng `TEST <số>` trong tên nếu tài liệu thuộc một bộ đề.
2. Khởi động lại `npm run dev`, hoặc chạy lại `npm run build` cho bản production.
3. Kiểm tra tài liệu tại tab **Tất cả tài liệu**. File không thuộc nhóm quen thuộc hiển thị ở **Tài liệu khác**.

Vite tạo URL asset cho từng tài liệu, do đó bản build có thể dùng độc lập với đường dẫn `docs` trên máy phát triển.
PDF chỉ được trình duyệt tải khi mở trang đọc hoặc nhấn mở/tải file; trang danh sách không tải nội dung tất cả PDF.
Tài liệu nguồn phải có trên máy chạy build. Trang sẽ hiển thị trạng thái rỗng nếu không có file phù hợp.

Image web Docker cũng đóng gói tài liệu vào bản build. `.dockerignore` chỉ cho phép
`docs/resources` trong nhóm tài liệu và tiếp tục loại thư mục `AUDIO`.
Sau khi thêm tài liệu, build lại image web để cập nhật thư viện.

Không có migration, API upload hoặc thay đổi nghiệp vụ Course/Payment trong phần giao diện này.
