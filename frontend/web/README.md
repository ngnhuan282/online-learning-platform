# SGEdu Frontend

Giao diện React + Vite triển khai theo ảnh tham chiếu và `../../docs/DESIGN.md`.

## Chạy dự án

```sh
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal. Kiểm tra trước khi bàn giao:

```sh
npm run lint
npm run build
```

## Trang chủ

- Trang chủ tiếng Anh gồm hero luyện phát âm, tìm kiếm, 8 danh mục (IELTS, TOEIC, giao tiếp, CNTT, phát âm, thương mại, ngữ pháp và mentor), 4 khóa học nổi bật, lợi ích, AI Speaking Coach và footer.
- Responsive cho desktop, tablet và mobile; có menu mobile, focus bàn phím và hỗ trợ giảm chuyển động.
- Tìm kiếm và lọc bằng dữ liệu mẫu trong `src/features/courses/data/demoCourses.js`; trạng thái lọc được lưu trong URL.
- Các tab hỗ trợ tất cả, IELTS & Chứng chỉ, Giao tiếp & IT và miễn phí. Khóa học có thể thuộc nhiều danh mục; thẻ mở thông tin và nội dung học tương ứng. Tìm kiếm hỗ trợ tiếng Việt không dấu.
- AI Speaking Coach trả lời theo kịch bản tiếng Anh (IELTS, TOEIC, IPA, email, phỏng vấn và ngữ pháp). Phần xem thử là bài luyện hội thoại công sở. Chưa kết nối video, ghi âm hoặc dịch vụ AI chấm phát âm.
- Số học viên, điểm IELTS, tỷ lệ tự tin, điểm phát âm và tiến độ là dữ liệu minh họa theo ảnh tham chiếu.
- Xác thực, đăng ký khóa học và thanh toán chưa được kết nối backend.

## Đăng nhập và đăng ký

- `/login`: email, mật khẩu, ẩn/hiện mật khẩu, ghi nhớ đăng nhập và hộp thoại quên mật khẩu.
- `/register`: họ tên, email, mật khẩu, xác nhận mật khẩu, thanh độ mạnh và đồng ý điều khoản.
- Kiểm tra dữ liệu trên frontend; mật khẩu đăng ký tối thiểu 8 ký tự gồm chữ hoa, chữ thường và số. Mức mạnh yêu cầu ít nhất 12 ký tự và ký tự đặc biệt.
- Form hiển thị lỗi tại từng trường, chuyển focus đến trường sai đầu tiên và hỗ trợ thao tác bằng bàn phím.
- Google/GitHub, gửi form và khôi phục mật khẩu hiện chỉ hiển thị thông báo chưa khả dụng. Không tạo tài khoản, gửi email, lưu mật khẩu hay tạo phiên đăng nhập giả. Tùy chọn ghi nhớ đăng nhập chỉ thay đổi trạng thái checkbox, chưa lưu phiên.
- Trang chủ, đăng nhập và đăng ký dùng chung `SiteHeader` và `SiteFooter`, đồng nhất nội dung, kích thước và responsive.

## Tổ chức mã nguồn

- `src/pages/HomePage.jsx`: ghép các khối trang chủ.
- `src/features/home/components`: hero, danh mục và lợi ích.
- `src/features/courses/components`: danh sách và thẻ khóa học.
- `src/features/ai-assistant/components`: giao diện trải nghiệm trợ lý AI.
- `src/features/auth`: các trang, component form dùng chung, quy tắc validation trong `schemas` và stylesheet riêng trong `styles`.
- `src/shared/components`: header, footer, logo, icon và cuộn đến mục.
- `src/index.css`: design tokens, layout, component styles và breakpoints.
- `public/images/english-*.jpg`: ảnh minh họa lưu cục bộ từ Unsplash (`photo-1434030216411-0b793f4b4173`, `photo-1522071820081-009f0129c71c`, `photo-1516321318423-f06f85e504b3`, `photo-1521737711867-e3b97375f902`). Font Inter và Plus Jakarta Sans tải từ Google Fonts, có font hệ thống dự phòng.
