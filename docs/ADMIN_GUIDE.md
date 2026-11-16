# Hướng dẫn khu vực quản trị

## Chạy ứng dụng

Tại thư mục gốc `D:\GitHub\online-learning-platform`:

```powershell
docker compose --profile backend up --build -d
docker compose --profile backend ps
```

Auth tự chạy migration `V4__admin_roles_permissions.sql` khi khởi động. Migration giữ dữ liệu tài khoản hiện tại, bổ sung quyền, vai trò tùy chỉnh, thời điểm đăng nhập gần nhất và nhật ký quản trị. Không cần xóa volume hay chạy lại seed nếu đã có dữ liệu mẫu.

Mở terminal thứ hai:

```powershell
cd frontend/web
npm install
npm run dev
```

Truy cập `http://localhost:5173/login`. Nếu đã chạy seed của dự án, đăng nhập bằng:

- Email: `admin@gmail.com`
- Mật khẩu mẫu: `Admin123`

Admin được chuyển đến `http://localhost:5173/admin`. Tài khoản thường tiếp tục đến `/account`. Tài khoản có vai trò tùy chỉnh chứa `ADMIN_ACCESS` cũng được chuyển đến khu vực admin; menu chỉ hiện các chức năng được cấp quyền.

## Các trang đã nối backend

| Đường dẫn | Chức năng |
| --- | --- |
| `/admin` | Tổng quan tài khoản, khóa học, tỷ lệ hoàn thành, doanh thu, biểu đồ 6 tháng và đơn hàng gần nhất |
| `/admin/profile` | Hồ sơ cá nhân và đổi mật khẩu trong giao diện quản trị |
| `/admin/users` | Tìm theo tên/email; lọc vai trò/trạng thái; phân trang; tạo tài khoản; sửa họ tên; khóa/mở khóa; gán nhiều vai trò; xuất CSV trang hiện tại |
| `/admin/roles` | Tạo vai trò tùy chỉnh; tìm kiếm vai trò/quyền; ma trận quyền; lưu/hoàn tác; xóa vai trò chưa gán; tải JSON |
| `/admin/audit` | Tổng hợp nhật ký Auth, Learning và Payment; cảnh báo khi một nguồn chưa tải được |
| `/admin/shop` | Thêm/sửa/ẩn vật phẩm; giá gem, độ hiếm, hình minh họa, thứ tự; tra cứu giao dịch gem |
| `/admin/engagement` | Tra cứu gem, XP/cấp độ, streak/freeze; điều chỉnh và xem lịch sử có lý do |
| `/admin/engagement-rules` | Cấu hình XP bài học/quiz, XP mỗi cấp, gem mỗi ngày và các mốc thưởng |
| `/admin/pro-plans` | Sửa tên/giá, mở hoặc ngừng bán ba gói Pro |
| `/admin/pro-members` | Tra cứu thành viên, lịch sử cấp Pro; cấp thêm, tạm khóa/mở lại, thu hồi khoản Pro quản trị |
| `/admin/pro-codes` | Xem mã đã che; phát hành và thu hồi mã chưa dùng theo quyền riêng |
| `/admin/community` | Kiểm duyệt bài viết/bình luận; khóa, ẩn và khôi phục nội dung |
| `/admin/quizzes` | Xem quiz; soạn/xuất bản/xóa nháp khi có quyền quản lý |
| `/admin/notifications` | Xem lịch sử thông báo; gửi thông báo khi có quyền quản lý |
| `/admin/courses` | Trang quản lý khóa học hiện có, dùng API admin để lấy cả khóa nháp; nút tạo/xóa hiện theo quyền |

Admin có sidebar, topbar và footer riêng, không sử dụng header của giao diện học viên. `/admin/analytics` chuyển về tổng quan mới.

Nhấn avatar ở góc phải để mở menu **Hồ sơ cá nhân** và **Đăng xuất**. Trong admin, Hồ sơ mở `/admin/profile`; ở giao diện người dùng, Hồ sơ mở `/account`. Menu thay các nút Dashboard/Tài khoản/Đăng xuất trước đây trên header người dùng. Nhấn Escape hoặc bên ngoài để đóng menu; đăng xuất thu hồi phiên qua AuthContext hiện có rồi đưa về trang đăng nhập.

Số liệu được lấy trực tiếp từ service sở hữu database tương ứng. Nếu một service không khả dụng, trang tổng quan báo phần chưa tải được và cho phép làm mới. Giá trị chưa tải được hiển thị `—`.

Doanh thu tính tổng các đơn `PAID` có tiền tệ `VND`, không cộng lặp từng lần thử thanh toán. Biểu đồ nhóm doanh thu theo tháng tạo đơn đã thanh toán, tài khoản theo tháng đăng ký, trong 6 tháng gần nhất (UTC). Seed cũ có đơn năm 2025 nên biểu đồ các tháng hiện tại có thể bằng 0 dù tổng doanh thu khác 0. Phân bố danh mục là **số khóa học**, không phải tỷ trọng doanh thu. Học viên trong đơn hàng được hiển thị bằng ID vì các service không đọc chéo database.

`lastLoginAt` bắt đầu được ghi từ migration này; tài khoản chưa đăng nhập lại sẽ hiển thị “Chưa đăng nhập”. Trạng thái “Hoạt động” nghĩa là được phép đăng nhập, không khẳng định người dùng đang online.

## Tự test tài khoản và phân quyền

1. Vào **Quản lý tài khoản → Thêm người dùng mới**. Nhập họ tên, email chưa dùng và mật khẩu có ít nhất 8 ký tự, chữ hoa, chữ thường, số. Tài khoản mới có vai trò `USER`; mật khẩu lưu bằng BCrypt.
2. Tìm tài khoản vừa tạo bằng email. Thử sửa họ tên, khóa tài khoản rồi đăng nhập tài khoản đó ở cửa sổ riêng: backend từ chối. Mở lại để đăng nhập bình thường.
3. Vào **Vai trò & Phân quyền → Tạo vai trò**. Ví dụ mã `SUPPORT`, tên “Hỗ trợ học viên”. Mã dùng chữ in hoa, số, dấu gạch dưới, bắt đầu bằng chữ.
4. Chọn quyền **Xem tài khoản**, **Tạo tài khoản**, **Khóa / mở khóa** rồi bấm **Lưu thay đổi**. Quyền thao tác tự thêm quyền xem và truy cập admin cần thiết. Bỏ quyền xem sẽ bỏ các quyền phụ thuộc.
5. Trong bảng tài khoản, chọn biểu tượng chìa khóa để gán thêm `SUPPORT` cho tài khoản thử nghiệm. Đăng nhập lại tài khoản đó ở cửa sổ riêng: có thể vào admin và quản lý tài khoản theo quyền vừa cấp; không thể quản lý vai trò hay gán ADMIN.
6. Mở **Nhật ký quản trị** bằng tài khoản ADMIN để kiểm tra các thao tác vừa thực hiện.
7. Thử lưu thay đổi cùng một vai trò ở hai cửa sổ: bản lưu sử dụng phiên bản cũ bị từ chối với HTTP 409; tải lại trang để lấy cấu hình mới.

`ADMIN` luôn có toàn quyền và không được sửa/xóa. `USER` là vai trò học viên mặc định, không cấp quyền quản trị và không thể chỉnh sửa/xóa. Migration V6 xóa các quyền quản trị từng gán cho USER; backend cũng bỏ qua quyền cũ từ vai trò này. Để cấp quyền quản trị có giới hạn, tạo và gán thêm vai trò tùy chỉnh có `ADMIN_ACCESS` và các quyền chức năng cần thiết.

Chỉ ADMIN được quản lý vai trò và gán vai trò cho tài khoản; hai quyền này không thể cấp cho USER hay vai trò tùy chỉnh. Để đặt quyền khác nhau cho một nhóm tài khoản, tạo và gán vai trò tùy chỉnh. Quyền hiệu lực là tổng quyền từ các vai trò tùy chỉnh và ADMIN, không tính quyền quản trị từng gán cho USER. Vai trò tùy chỉnh có người dùng đang gán không thể bị xóa.

Không thể tự khóa tài khoản, tự bỏ ADMIN hoặc loại bỏ quản trị viên hoạt động cuối cùng. Vai trò hỗ trợ không thể sửa/khóa tài khoản ADMIN. Mọi API quản trị đều kiểm tra quyền ở backend; ẩn menu chỉ phục vụ giao diện.

Auth kiểm tra quyền và trạng thái hiện tại trong database ở mỗi API admin, vì vậy thu hồi quyền có hiệu lực ngay tại Auth. Course/Learning/Payment kiểm tra quyền trong JWT đã ký: token đã cấp còn hiệu lực đến khi hết hạn (mặc định 15 phút). Đăng xuất/đăng nhập lại hoặc refresh sẽ nhận quyền mới. Không tuyên bố thu hồi tức thời token đang tồn tại ở các service này.

## API và dữ liệu

Tất cả request từ frontend đi qua Gateway `/api/v1` và dùng Axios/AuthContext hiện có.

| API | Quyền cần thiết |
| --- | --- |
| `GET /admin/users`, `GET /admin/users/{id}` | `USER_VIEW` |
| `POST /admin/users` | `USER_CREATE` |
| `PUT /admin/users/{id}` | `USER_UPDATE` |
| `PATCH /admin/users/{id}/status` | `USER_STATUS_UPDATE` |
| `PUT /admin/users/{id}/roles` | `USER_ROLES_ASSIGN` — chỉ ADMIN |
| `GET /admin/roles` | `ROLE_VIEW` hoặc `USER_VIEW` để hiển thị bộ lọc vai trò |
| `GET /admin/permissions` | `ROLE_VIEW` |
| `POST /admin/roles`, `PUT /admin/roles/{id}`, `DELETE /admin/roles/{id}` | `ROLE_MANAGE` — chỉ ADMIN |
| `GET /admin/overview` | `DASHBOARD_VIEW` hoặc `USER_VIEW` |
| `GET /admin/audit` | `AUDIT_VIEW` |
| `GET /admin/courses`, `GET /admin/courses/overview` | `COURSE_VIEW` |
| `GET /learning/admin/overview` | `LEARNING_REPORT_VIEW` |
| `GET /payments/admin/analytics` | `PAYMENT_REPORT_VIEW` |

ADMIN có toàn bộ quyền. API tạo/sửa/xóa khóa học và danh mục cũng chấp nhận quyền `COURSE_*`/`CATEGORY_*` tương ứng. Catalog chỉ chứa quyền có API thực tế. Nhập Excel, đặt lại mật khẩu quản trị, dashboard AI và những chức năng chưa có backend không được tạo thành nút giả.

## Quản trị cửa hàng, học tập và Pro

Auth **V12**, Learning **V10**, Payment **V5** bổ sung quản trị các chức năng mới. Không sửa migration cũ, xóa volume hay chạy lại seed. Khi nâng cấp, chạy lại ba service Auth/Learning/Payment bằng mã nguồn mới. ADMIN tự nhận các quyền mới; vai trò tùy chỉnh hiện tại không tự được thêm quyền.

| Nhóm | Quyền xem | Quyền thao tác (tự bổ sung quyền xem và `ADMIN_ACCESS`) |
| --- | --- | --- |
| Cửa hàng và giao dịch gem | `SHOP_VIEW` | `SHOP_CREATE`, `SHOP_UPDATE` |
| Tài khoản học tập | `ENGAGEMENT_VIEW` | `GEM_ADJUST`, `XP_ADJUST`, `STREAK_ADJUST` |
| Kho đồ học viên | `INVENTORY_VIEW` (kèm `ENGAGEMENT_VIEW`) | `INVENTORY_MANAGE` (kèm quyền xem kho và `SHOP_VIEW`) |
| Cấu hình học tập và phần thưởng | `ENGAGEMENT_CONFIG_VIEW` | `ENGAGEMENT_CONFIG_UPDATE` |
| Danh mục gói Pro | `PRO_PLAN_VIEW` | `PRO_PLAN_UPDATE` |
| Thành viên Pro | `PRO_MEMBER_VIEW` | `PRO_MEMBER_MANAGE` |
| Mã kích hoạt Pro | `PRO_CODE_VIEW` | `PRO_CODE_CREATE`, `PRO_CODE_REVOKE` |
| Diễn đàn | `COMMUNITY_VIEW` | `COMMUNITY_MODERATE` |
| Quiz | `QUIZ_VIEW` | `QUIZ_MANAGE` |
| Thông báo | `NOTIFICATION_VIEW` | `NOTIFICATION_MANAGE` |

Trong **Vai trò & Phân quyền**, tạo vai trò tùy chỉnh rồi chọn các quyền cần thiết. Ví dụ, nhân viên cửa hàng chỉ cần `SHOP_VIEW`/`SHOP_UPDATE`; hỗ trợ cấp gem cần `ENGAGEMENT_VIEW`/`GEM_ADJUST`; người kiểm duyệt cần `COMMUNITY_VIEW`/`COMMUNITY_MODERATE`. Không cấp `ROLE_MANAGE` hoặc `USER_ROLES_ASSIGN` cho nhân viên: hai quyền đó vẫn chỉ dành cho ADMIN. USER đơn lẻ bị từ chối ngay cả khi token mang thêm chuỗi quyền quản trị. Sau khi gán quyền, đăng nhập lại hoặc refresh để token Learning/Payment nhận quyền mới.

### Vật phẩm và gem/XP

- Vật phẩm có mã/loại cố định sau khi tạo; được đổi tên, giá, độ hiếm, thứ tự, hình minh họa có sẵn và trạng thái hiển thị. Hình minh họa giới hạn trong bộ asset hiện có, không nhận URL/script tùy ý. Không hỗ trợ tạo thêm loại streak freeze; chỉnh sản phẩm `STREAK_FREEZE` hiện có.
- Ẩn sản phẩm ngăn lượt mua mới, giữ kho đồ và quyền trang bị của người đã mua. Lịch sử mua lưu số gem thực chi, không tính lại theo giá mới. Các vật phẩm mới dùng chung bộ asset hiển thị đúng khi trang bị, trên avatar và bảng xếp hạng.
- Trong chi tiết tài khoản học tập, nhân viên có `INVENTORY_VIEW` xem kho; `INVENTORY_MANAGE` được cấp tặng/thu hồi vật phẩm có lý do. Cấp tặng không trừ gem; thu hồi không hoàn gem, giữ lịch sử mua và tự tháo vật phẩm đang dùng. Lượt PUT lặp cùng trạng thái không cấp trùng. Freeze được điều chỉnh bằng quyền `STREAK_ADJUST`, không phải vật phẩm kho.
- Điều chỉnh gem/XP/freeze/chuỗi bắt buộc có lý do. Server lấy người thực hiện từ JWT, khóa hồ sơ và ghi số dư trước/sau trong cùng transaction. Số dư/XP không âm; freeze giới hạn 0–7. UUID của yêu cầu ngăn gửi lặp cộng/trừ hai lần; dùng lại UUID với nội dung khác bị từ chối.
- **Đặt cấp độ** đặt XP về mốc bắt đầu của cấp đó. XP chỉnh thủ công không tạo sự kiện học tập hay điểm thi đua. **Khôi phục chuỗi** đặt chuỗi đã hoàn thành đến hôm qua (hoặc giữ đến hôm nay nếu thực sự đã có hoạt động); không tạo ngày học/XP/gem thưởng giả, không giảm kỷ lục streak cũ.
- Quy tắc XP/gem mới áp dụng cho hoạt động tương lai. Đổi XP mỗi cấp tính lại cấp độ từ tổng XP hiện có; không sửa XP đã kiếm trong lịch sử. Mốc thưởng giữ điều kiện nghiệp vụ hiện có; được đổi gem/tắt mở, không cấp lại thưởng đã nhận.

### Pro và kiểm duyệt

- Ba mã gói và thời hạn 1/3/12 tháng được giữ cố định. Admin đổi giá/mở bán; đơn đã tạo và quyền đã cấp giữ snapshot cũ. Chỉnh sửa catalog/quy tắc dùng `version` để từ chối cập nhật đè dữ liệu mới.
- Cấp Pro quản trị tạo một grant riêng, có người cấp, lý do và UUID chống lặp. Cộng dồn vào hạn hiện tại như gia hạn thông thường. Chỉ thu hồi trực tiếp grant nguồn `ADMIN`; grant thanh toán phải theo quy trình hoàn tiền, không bị xóa bằng chức năng cấp tặng.
- Tạm khóa chặn quyền truy cập Pro, không hoàn tiền, không xóa grant, không ảnh hưởng khóa học mua riêng. Mở lại giữ hạn theo lịch cũ, không bù thời gian bị khóa. Người học được thông báo trạng thái, không thể mua/nhập mã trên giao diện khi bị khóa; backend cũng từ chối đổi mã khi khóa. Callback thanh toán hợp lệ vẫn được ghi nhận theo đơn nhưng không tự gỡ khóa.
- Mã Pro chỉ trả đầy đủ một lần khi phát hành; quyền chỉ xem chỉ thấy bản che. Quyền tạo/thu hồi tách biệt.
- Kiểm duyệt không sửa nội dung người học: khóa/mở thảo luận, ẩn/khôi phục bài và bình luận. Ẩn bình luận đã được chọn làm đáp án xóa liên kết đáp án; khôi phục không tự chọn lại. Nội dung render bằng văn bản, không thực thi HTML từ bài/bình luận.

API mới nằm dưới `/api/v1/learning/admin/{shop,engagement,pro,community}` và `/api/v1/payments/admin/pro/plans`. Các mutation quản trị mới ghi nhật ký ở database của service sở hữu; `/admin/audit` tổng hợp qua API, không đọc chéo database. Nhật ký không chứa mật khẩu, mã Pro đầy đủ hay thông tin merchant.

`POST /admin/roles` nhận `{name, label, description, permissions, version: 0}`. `PUT` giữ nguyên mã vai trò và yêu cầu `version` lấy từ API danh sách; backend kiểm tra xung đột cập nhật. Quyền lạ bị từ chối, quyền phụ thuộc được bổ sung phía server. JWT giữ claim `role` tương thích và bổ sung `roles`, `permissions`; API user trả thêm `permissions`.

Migration mới thêm `permissions`, `role_permissions`, `admin_audit_logs`; mở rộng `roles` và `users`. ADMIN được cấp toàn bộ catalog khi migration chạy. Nhật ký không chứa mật khẩu/token.

## Kiểm thử tự động

```powershell
# Từ thư mục gốc
mvn -f backend/pom.xml verify -B -ntp

cd frontend/web
npm run build
npm run lint
npm test
node scripts/admin-e2e.mjs
```

E2E cần Chrome và các service đang chạy với seed admin. Có thể thay tài khoản bằng biến môi trường `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. Script dùng Chrome headless, tạo một tài khoản có email bắt đầu `admin-e2e-`, kiểm tra khóa/mở khóa và phân quyền, rồi trả tài khoản về USER và vô hiệu hóa. Vai trò test được xóa; tài khoản và nhật ký kiểm thử được giữ để đối chiếu. Script không sửa tài khoản demo có sẵn.

Kết quả và ảnh chụp nằm trong `.tmp/admin-e2e/` (không đưa vào Git). Đã kiểm tra thực tế desktop 1440px và mobile 390px, qua Gateway và MySQL thật, gồm tạo tài khoản, khóa/mở khóa, tạo/lưu vai trò, gán quyền và nhật ký.

### Xác nhận cho quản trị cửa hàng, học tập và Pro (16/11/2026)

- `mvn -f backend/pom.xml -pl auth-service,learning-service,payment-service -am verify`: Auth 92 test (1 bỏ qua), Learning 78, Payment 58; không có test lỗi. Các integration test mới kiểm tra quyền xem/ghi, USER không được nâng quyền, gửi lặp/đồng thời, giới hạn số dư, xung đột phiên bản, kho đồ, cấu hình thưởng, Pro và kiểm duyệt.
- Frontend lint và production build đạt; 39 test liên quan admin, quiz, thông báo, Pro và engagement/community đạt.
- Auth V12, Learning V10 và Payment V5 đã chạy thành công trên MySQL local bằng JAR đã kiểm thử. Không thay `.env` hoặc bật thanh toán giả lập.
- Chrome qua Gateway/MySQL thật: sửa vật phẩm riêng đã ẩn, điều chỉnh gem, lưu quyền phụ thuộc; kiểm tra sáu trang mới, giao diện chỉ xem, tiếng Anh và chiều rộng 390/1440px. Không có lỗi JavaScript. Pro cấp quản trị/khóa/mở lại/đổi mã/thu hồi đúng nguồn và yêu cầu đồng thời đã được kiểm tra bằng API thật.
- Chỉ dùng tài khoản/vai trò/vật phẩm QA riêng; bài diễn đàn QA luôn nằm trong hàng đợi ẩn. Dữ liệu nghiệp vụ QA đã dọn, tài khoản QA đã vô hiệu hóa. Giá Pro, cấu hình thưởng và dữ liệu học viên hiện hữu được giữ nguyên trong đợt QA.
