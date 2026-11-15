# Streak, thành tích, xếp hạng, đa ngôn ngữ và diễn đàn

Triển khai ngày 15/11/2026 trong React/Vite và `learning-service` hiện có. Frontend tiếp tục gọi API qua Gateway; không thêm service hoặc cơ sở dữ liệu riêng.

## Sử dụng trên website

- Đăng nhập rồi mở **Thành tích học tập** trong menu tài khoản: `/achievements`.
- Mở **Bảng xếp hạng** trên thanh điều hướng: `/leaderboard`.
- Mở **Diễn đàn**: `/community`; nhấn **Viết bài mới**, chọn chủ đề và loại Thảo luận/Hỏi đáp.
- Chủ bài hỏi đáp có thể chọn/bỏ chọn lời giải. Chủ bài và chủ bình luận được sửa/xóa nội dung của mình. ADMIN có thể quản lý nội dung và khóa/mở lại thảo luận ngay trên trang bài viết.
- Chọn **Tiếng Việt / English** trên thanh đầu trang; trang quản trị cũng có bộ chọn. Ngôn ngữ được lưu trong `localStorage` bằng khóa `sgedu.locale`, đồng bộ giữa các tab. Chuyển ngôn ngữ không tải lại trang và giữ nội dung form đang nhập.

Giao diện và định dạng ngày/số/tiền tệ sử dụng ngôn ngữ đã chọn. Nội dung khóa học, bài đăng, bình luận và câu trả lời AI là nội dung học tập/người dùng, không tự động dịch. Múi giờ tính ngày học và kỳ xếp hạng vẫn là `Asia/Ho_Chi_Minh` ở cả hai ngôn ngữ.

## Quy tắc ghi nhận học tập

| Hoạt động | XP | Ghi nhận ngày học |
| --- | --- | --- |
| Hoàn thành một lesson lần đầu | 20 XP cho mỗi lesson | Có |
| Nộp một quiz có ít nhất một lựa chọn trả lời | 10 XP ở lần nộp đầu tiên của quiz đó | Có; các lần làm lại hợp lệ ở ngày khác vẫn duy trì streak |
| Gọi lại hoàn thành lesson đã hoàn thành | Không cộng lại | Không tạo thêm hoạt động |
| Nộp quiz không trả lời câu nào | Không cộng | Không ghi nhận |
| Đăng nhập, mở trang, đăng bài/bình luận | Không cộng | Không ghi nhận |

- Mỗi 100 XP tăng một cấp, bắt đầu từ cấp 1. Đây là cấp độ hoạt động, không phải chứng nhận CEFR.
- Ngày học đầu tiên có streak 1; học ở ngày liền sau tăng streak. Ngày bỏ lỡ có thể được streak freeze bảo vệ; thiếu freeze thì chuỗi đứt và hoạt động tiếp theo bắt đầu lại từ 1. Xem [SHOP.md](SHOP.md).
- Trong ngày chưa học, chuỗi hôm qua vẫn còn khả năng duy trì. Khi đã gián đoạn, API trả current streak 0; longest streak được giữ lại.
- Trang thành tích hiển thị lịch hoạt động 90 ngày gần nhất, tổng XP, cấp độ, streak hiện tại và dài nhất.
- Không tính ngược XP cho lesson/quiz hoàn thành trước đợt triển khai. Lịch sử và tiến độ học cũ vẫn dùng như trước.

Ghi nhận XP/ngày học tham gia cùng transaction hoàn thành bài hoặc nộp quiz. Khóa theo người học và ràng buộc duy nhất `(user_id, source_type, source_id)` ngăn cộng XP trùng khi có request đồng thời.

## Phần thưởng và khung avatar

| Mã | Điều kiện mở khóa | Kim cương |
| --- | --- | --- |
| `FIRST_LESSON` | Hoàn thành lesson đầu tiên có ghi nhận XP | 20 |
| `STREAK_3` | Đạt chuỗi dài nhất ít nhất 3 ngày | 30 |
| `STREAK_7` | Đạt chuỗi dài nhất ít nhất 7 ngày | 70 |
| `STREAK_30` | Đạt chuỗi dài nhất ít nhất 30 ngày | 300 |
| `LEVEL_5` | Đạt cấp độ 5, tương đương 400 XP | 100 |

Nhấn **Nhận thưởng** để nhận huy hiệu và kim cương; mỗi mã chỉ nhận một lần. Sau khi nhận, có thể **Dùng khung đại diện** hoặc bỏ khung. Khung được lưu trên server và hiển thị ở header, hồ sơ, thành tích/bảng xếp hạng. Không thể dùng khung của phần thưởng chưa nhận. Mỗi ngày có hoạt động học hợp lệ nhận thêm 25 kim cương một lần. Kim cương dùng trong [cửa hàng](SHOP.md) để mua khung, ảnh nền và streak freeze.

## Bảng xếp hạng

- Chọn tháng để xem XP được ghi nhận trong tháng đó theo giờ Việt Nam, hoặc chọn toàn thời gian.
- Xếp thứ tự theo XP giảm dần; bằng XP thì người đạt số điểm đó sớm hơn đứng trước, cuối cùng dùng user ID để ổn định thứ tự.
- API phân trang và trả riêng thứ hạng của người gọi, kể cả khi người đó không nằm trong trang hiện tại.
- Cấp độ hiển thị là cấp độ tích lũy toàn thời gian; điểm trên bảng tháng chỉ là XP của tháng được chọn.
- Chưa có hoạt động hợp lệ thì chưa có vị trí trong bảng. Không tạo thứ hạng hoặc số liệu mẫu.

## Diễn đàn

Bốn chủ đề ban đầu: Học tiếng Anh, IELTS & TOEIC, Câu hỏi & giải đáp, Góc chia sẻ. Có tìm kiếm tiêu đề/nội dung, lọc chủ đề, lọc Thảo luận/Hỏi đáp/chưa giải đáp, phân trang bài và bình luận.

Tiêu đề tối đa 160 ký tự, bài viết tối đa 12.000, bình luận tối đa 4.000. Nội dung trắng bị từ chối. Nội dung được hiển thị như văn bản, không chèn HTML từ người dùng.

- Tất cả API mới yêu cầu JWT; danh tính lấy từ principal, bỏ qua user ID tự khai trong JSON.
- Tên công khai lấy từ Auth qua `/api/v1/users/me` với JWT của chính người gọi rồi lưu bản sao vào Learning. Không truy cập chéo database. Khi Auth tạm thời không trả dữ liệu, dùng tên đã lưu hoặc `Learner #ID`.
- Giới hạn tạo bài: một bài mỗi 30 giây/người; bình luận: một bình luận mỗi 5 giây/người. Request vượt giới hạn nhận `429 / RATE_LIMITED`.
- Chỉ chọn bình luận còn hiển thị, thuộc đúng bài hỏi đáp làm lời giải. Xóa bình luận đang được chọn sẽ bỏ trạng thái lời giải tương ứng.
- Sửa/xóa bình luận luôn kiểm tra cả post ID và comment ID. Người khác không được sửa/xóa nội dung của chủ bài hoặc chủ bình luận.
- Bài đã khóa không nhận thay đổi từ học viên; ADMIN vẫn có quyền quản lý. Xóa là xóa mềm; nội dung đã xóa không còn xuất hiện trong API đọc thông thường.

## API mới

Prefix chung: `/api/v1/learning`. Response dùng envelope hiện có. Các danh sách diễn đàn dùng `PageResponse.content`, page bắt đầu từ 0; size mặc định 20, tối đa 50.

| Method | Path sau prefix | Mục đích |
| --- | --- | --- |
| GET | `/engagement/me` | Hồ sơ XP, streak, lịch hoạt động, thưởng và khung đang dùng |
| POST | `/engagement/rewards/{code}/claim` | Nhận phần thưởng đủ điều kiện; gọi lại không cộng thưởng lần nữa |
| POST | `/engagement/frame` | `{ "code": "FIRST_LESSON" }`; `null` để bỏ khung |
| GET | `/engagement/leaderboard?period=month&month=2026-11&page=0&size=20` | Bảng tháng; `period=all` để xem toàn thời gian |
| GET | `/community/topics` | Danh sách chủ đề |
| GET | `/community/posts` | Lọc bằng `topicId`, `keyword`, `kind`, `unanswered`, `page`, `size` |
| POST | `/community/posts` | Tạo bài với `topicId`, `kind`, `title`, `body` |
| GET / PUT / DELETE | `/community/posts/{id}` | Đọc, sửa hoặc xóa bài |
| PATCH | `/community/posts/{id}/lock` | ADMIN gửi `{ "locked": true/false }` |
| GET / POST | `/community/posts/{id}/comments` | Phân trang hoặc thêm bình luận `{ "body": "..." }` |
| PUT / DELETE | `/community/posts/{id}/comments/{commentId}` | Sửa/xóa bình luận |
| PATCH | `/community/posts/{id}/answer` | Chủ bài/ADMIN gửi `{ "commentId": 123 }`; `null` để bỏ chọn |

## Migration và chạy local

- `V5__engagement_and_community.sql`: hồ sơ hoạt động, lịch sử XP, ngày học, thưởng, chủ đề, bài viết và bình luận.
- `V6__learner_reward_frames.sql`: khung avatar đang dùng. Không sửa migration cũ đã áp dụng.
- `V7__shop_inventory_and_streak_freezes.sql`: cửa hàng, kho đồ, lịch sử mua, ảnh nền và bảo vệ chuỗi. Xem [SHOP.md](SHOP.md).
- `AUTH_SERVICE_URL` được bổ sung vào cấu hình Learning và Compose; khi chạy local không qua Docker mặc định là `http://localhost:8081`.
- Không cần API key hoặc dịch vụ bên ngoài mới cho năm chức năng này.

```powershell
docker compose --profile backend up --build -d
cd frontend/web
npm run dev
```

Flyway áp dụng các migration mới khi Learning khởi động. Không cần reset database hoặc chạy lại seed.

## Kiểm chứng

Các kiểm tra đã thực hiện bao gồm Maven verify toàn backend, kiểm tra riêng Learning sau bổ sung khung avatar, frontend build/lint/test, HTTP thực qua Gateway + MySQL, và Chrome headless desktop/mobile.

| Kiểm tra đợt XP/diễn đàn, trước bổ sung cửa hàng | Kết quả |
| --- | --- |
| Backend: `mvn -f backend/pom.xml verify`; sau đó verify lại Learning có khung avatar | 322 test, 0 lỗi/thất bại trong các báo cáo cuối |
| Frontend: `npm test` | 174/174 test đạt |
| Frontend: `npm run lint`, `npm run build` | Đạt; build có cảnh báo kích thước một số bundle trên 500 kB |
| MySQL local | V5 và V6 áp dụng thành công |
| Gateway + MySQL | Hoàn thành lesson, XP/streak, nhận thưởng lặp, bảng xếp hạng, đăng bài/bình luận, lời giải, quyền sở hữu và xóa nội dung đạt |
| Chrome desktop/mobile | Việt–Anh, dùng/bỏ khung avatar, bài hỏi đáp và xếp hạng đạt; không tràn ngang tại kích thước đã kiểm tra |

Dữ liệu học tập/diễn đàn do các tài khoản QA của đợt kiểm tra tạo đã được dọn; các tài khoản QA được vô hiệu hóa. Không dùng số liệu QA làm dữ liệu mẫu trong sản phẩm.

Test mới kiểm tra mốc đổi ngày Việt Nam, chuỗi bị gián đoạn, chống cộng XP/nhận thưởng đồng thời, điều kiện dùng khung, kỳ xếp hạng, quyền diễn đàn, chọn lời giải đúng bài, xóa mềm, nội dung trắng, rate limit, chuyển ngôn ngữ giữ bản nháp, chống gửi thưởng lặp và render nội dung dưới dạng text. Xem `EngagementCommunityIntegrationTests.java` và `community-engagement.test.js`.
