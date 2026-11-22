# Kế hoạch nâng line coverage frontend lên 95%

Agent bổ sung test cho `frontend/web` đến khi `npm run test:coverage` đạt **ít nhất 95% line coverage toàn bộ `src/**/*.js` và `src/**/*.jsx`**. Ngưỡng 95% đã có trong runner hiện tại. Giữ phạm vi đo, ngưỡng và cơ chế tính cả các file chưa được test import.

## Kết quả xác nhận

Sau các ca regression về review, mốc đầu ở lượt này là **84,78% (6.991/8.246 dòng)**. Sau khi bổ sung test theo từng module, lượt chạy đầy đủ ngày 22/11/2026 đạt **95,39% (7.866/8.246 dòng)**. Có 435 ca đạt và một ca kiểm tra media TOEIC được bỏ qua vì thiếu tệp phát hành.

Lượt xác nhận chạy 78 suite với bốn tiến trình song song và dùng cùng phép đo Istanbul của runner. Mỗi tiến trình ghi báo cáo với tên duy nhất để giữ đủ dữ liệu khi hệ điều hành cấp lại PID. Báo cáo được ghi vào `frontend/web/coverage/coverage-summary.json`.

## Cách tổ chức các file test

**Mỗi đợt phải tạo nhiều file `*.test.js` riêng theo tính năng. Mỗi file phụ trách một page, component, mô-đun API hoặc một luồng người dùng liền mạch.** Các đường dẫn trong bảng là các file cần tạo riêng. Khi mở rộng một suite tổng hợp như `coverage-courses.test.js`, `coverage-app-shared.test.js` hoặc `coverage-api-contracts.test.js`, chuyển các case liên quan sang file chuyên trách trước khi thêm case mới. Giữ `tests/integration/integration-pages.test.js` cho các luồng đi qua nhiều mô-đun và các kiểm tra routing xuyên tính năng.

- `tests/features/<tính-năng>/` chứa test page, component, logic và API theo domain. TOEIC nằm trong `tests/features/learning/toeic/`.
- `tests/app/` chứa test bootstrap, router và provider của ứng dụng. `tests/shared/` chứa test component, tiện ích và API dùng chung.
- `tests/integration/` chứa các luồng cần phối hợp nhiều tính năng. `tests/helpers/` chứa helper dùng lại như `load-source.js`.

## Đo và lập danh sách dòng thiếu

Lượt đo sau khi chuyển thư mục đạt **84,23% (6.941/8.241 dòng)**, với 356 ca đạt, 2 ca lỗi và 1 ca media TOEIC được bỏ qua vì thiếu tệp phát hành. Với cùng phạm vi đo, ngưỡng 95% cần 7.829 dòng đã phủ. Chênh lệch ở lượt này là **888 dòng**, cần tính lại sau khi xử lý hai ca lỗi.

### Đợt 0 ổn định bộ test

Hai ca lỗi của lượt đo này ban đầu nằm trong `tests/features/courses/coverage-courses.test.js`. Các ca regression tương ứng đã được tách sang `course-detail.test.js` và `admin-review.test.js` trong cùng thư mục.

- Khi người học chưa có review, API trả `data: null`. Kiểm tra cách `CourseDetailPage` đọc phản hồi và bảo đảm trang mở `ReviewForm` để người học tạo review đầu tiên. Đưa ca này vào `features/courses/course-detail.test.js`.
- `AdminReviewPage` gọi `reviewApi.adminList`, còn fixture hiện mock `adminListAll`. Sửa mock theo phương thức thực tế và xác nhận review đã hiện lại sau thao tác bỏ ẩn. Đưa ca này vào `features/courses/admin-review.test.js`.

### Đo lại sau mỗi đợt

1. Dùng Node.js 22 và chạy `npm ci` nếu cần cài dependency. Từ `frontend/web`, chạy `npm test` và `npm run test:coverage` để lấy mốc sau đợt 0.
2. Đọc `coverage/coverage-summary.json` để lấy tổng số dòng và xếp hạng theo **số dòng chưa phủ**. Tính số dòng cần phủ thêm bằng `Math.max(0, Math.ceil(lines.total * 0.95) - lines.covered)`. Dùng `coverage/coverage-final.json` để dò vị trí cụ thể qua `statementMap` và counter `s`. Nếu runner báo lỗi test, xử lý lỗi đó trước khi dùng kết quả làm mốc.
3. Sau mỗi đợt, chạy từng file mới và đo lại coverage toàn bộ. Ưu tiên các file còn nhiều dòng thiếu và các luồng liên quan đến phân quyền, thanh toán, tiến độ học hoặc thay đổi phiên. Cập nhật danh sách theo report mới vì các luồng có thể phủ trùng nhau.

## Các đợt triển khai

Đường dẫn trong bảng tính từ `frontend/web/tests/`. Dùng report mới nhất để chọn case cụ thể trong từng file.

| Đợt | File test cần tạo riêng | Kịch bản cần đối chiếu với report |
| --- | --- | --- |
| 1. Courses | `features/courses/course-list.test.js`, `features/courses/course-detail.test.js`, `features/courses/review-form.test.js` | Bộ lọc kết hợp và URL, lỗi tải và retry, quyền truy cập bài học, lỗi gửi hoặc xóa review và dữ liệu sau retry |
| 1. Curriculum | `features/courses/curriculum-builder.test.js`, `features/courses/add-lesson-dialog.test.js`, `features/courses/lesson-resources-modal.test.js`, `features/courses/media-uploader.test.js` | Thứ tự và lưu chương trình, validation theo loại bài học, tải/xóa tài liệu, xử lý upload lỗi và hủy |
| 1. Dictation | `features/dictation/admin-dictation.test.js`, `features/dictation/dictation-practice.test.js`, `features/dictation/youtube-embed.test.js` | Danh sách và trình sửa, lỗi lưu/import, chấm và khôi phục bản nháp, lỗi player và dọn listener khi unmount |
| 1. Quản trị | `features/admin/admin-accounts.test.js`, `features/admin/revenue-analytics.test.js`, `features/admin/admin-pro-members.test.js`, `features/admin/admin-shop-page.test.js` | Quyền và thao tác trạng thái tài khoản, lỗi tải báo cáo theo kỳ, suspend thành viên Pro, quản lý cửa hàng và xác nhận thao tác |
| 2. TOEIC | `features/learning/toeic/toeic-reader.test.js`, `features/learning/toeic/toeic-attempt.test.js`, `features/learning/toeic/toeic-result.test.js`, `features/learning/toeic/admin-toeic.test.js`, `features/learning/toeic/toeic-question-import-dialog.test.js`, `features/learning/toeic/toeic-api.test.js` | Reader và kết quả thiếu dữ liệu, lưu/nộp bài và chuyển phiên, CRUD đề thi, lỗi xem trước import, HTTP method, URL, payload, query và tùy chọn Axios |
| 2. Learning | `features/learning/admin-quiz.test.js`, `features/learning/study-text-assistant.test.js`, `features/learning/admin-notifications.test.js`, `features/learning/notifications-provider.test.js` | Validation quiz và publish, phản hồi tra từ đến muộn, lỗi gửi thông báo, lỗi kết nối và đổi tài khoản trong provider |
| 2. Auth và thanh toán | `features/auth/auth-form.test.js`, `features/auth/sign-in-methods.test.js`, `features/payment/payment-checkout.test.js`, `features/payment/payment-history.test.js`, `features/payment/pro-checkout.test.js` | Gửi form bất đồng bộ, lỗi Google sign-in, retry hoặc hủy checkout, lịch sử trống/lỗi, kế hoạch Pro không hợp lệ |
| 3. Provider và phần còn thiếu | `features/pro/pro-provider.test.js`, `features/pro/admin-pro-codes.test.js`, `features/engagement/engagement-provider.test.js` và các file có tên theo mô-đun còn thiếu dưới `app/`, `shared/` hoặc `features/` | Tải dữ liệu theo phiên, refresh và cleanup, lỗi thao tác mã Pro, case còn thiếu trong các mô-đun có báo cáo coverage thấp |

## Cách viết và nghiệm thu

- Dùng `node:test` và `node:assert/strict`. Với JSX, dùng Vite SSR, JSDOM và React `act` theo các suite hiện có. Với mô-đun JS nạp trực tiếp, dùng `loadSource` để test được tính coverage. Với test hợp đồng API, gọi mô-đun API thật và mock ở Axios adapter hoặc transport.
- Assert kết quả nhìn thấy được như nội dung UI, redirect, state được lưu, hoặc request thực tế. Bao gồm happy path và nhánh lỗi, retry, dữ liệu rỗng hoặc phản hồi đến muộn khi report chỉ ra các nhánh đó. Dọn mocks, timers, storage, DOM và Vite server sau test. Giữ test độc lập với thứ tự chạy và dịch vụ bên ngoài.
- Trước khi bàn giao, chạy `npm run lint -- --max-warnings=0`, `npm test` và `npm run test:coverage` từ `frontend/web`. Cả ba lệnh phải trả mã `0`. Coverage report phải đạt từ 95% line coverage với số liệu thực tế trước khi làm tròn. Dùng branch và function coverage để tìm case thiếu.
- Bàn giao danh sách các file mới theo tính năng, các case chính và số dòng đã phủ trên tổng số dòng ở mốc đầu và mốc cuối.
