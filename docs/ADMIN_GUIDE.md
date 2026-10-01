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

- Email: `demo.admin@example.com`
- Mật khẩu mẫu: `Admin123`

Admin được chuyển đến `http://localhost:5173/admin`. Tài khoản thường tiếp tục đến `/account`. Tài khoản có vai trò tùy chỉnh chứa `ADMIN_ACCESS` cũng được chuyển đến khu vực admin; menu chỉ hiện các chức năng được cấp quyền.

## Các trang đã nối backend

| Đường dẫn | Chức năng |
| --- | --- |
| `/admin` | Tổng quan tài khoản, khóa học, tỷ lệ hoàn thành, doanh thu, biểu đồ 6 tháng và đơn hàng gần nhất |
| `/admin/profile` | Hồ sơ cá nhân và đổi mật khẩu trong giao diện quản trị |
| `/admin/users` | Tìm theo tên/email; lọc vai trò/trạng thái; phân trang; tạo tài khoản; sửa họ tên; khóa/mở khóa; gán nhiều vai trò; xuất CSV trang hiện tại |
| `/admin/roles` | Tạo vai trò tùy chỉnh; tìm kiếm vai trò/quyền; ma trận quyền; lưu/hoàn tác; xóa vai trò chưa gán; tải JSON |
| `/admin/audit` | 50 thao tác quản trị gần nhất, người thực hiện, đối tượng và thời gian |
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

ADMIN có toàn bộ quyền. API tạo/sửa/xóa khóa học và danh mục cũng chấp nhận quyền `COURSE_*`/`CATEGORY_*` tương ứng. Catalog có 20 quyền cho các chức năng đã có API, thay vì tạo các ô quyền chưa có chức năng như trong ảnh minh họa. Nhập Excel, đặt lại mật khẩu quản trị, dashboard AI và những chức năng chưa có backend không được tạo thành nút giả.

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
