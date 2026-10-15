# Dữ liệu mẫu SGSphere

File seed chính là [`seed-data.sql`](seed-data.sql), thay cho file ở thư mục gốc,
`05-seed-data.sql` và script `seed.ps1` trước đây. Chạy sau khi Auth, Course, Learning,
Payment đã hoàn tất Flyway. Seed dùng các bảng hiện có; schema vẫn do migration quản lý.

## Chạy seed bằng PowerShell

Tại thư mục gốc dự án, khởi động backend nếu chưa chạy:

```powershell
docker compose --profile backend up --build -d --wait
```

Copy bản SQL mới nhất vào container rồi import bằng MySQL ở chế độ batch:

```powershell
docker compose cp infra/mysql/seed-data.sql mysql:/tmp/sgsphere-seed.sql

docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 --batch -uroot < /tmp/sgsphere-seed.sql'
```

Lệnh sử dụng mật khẩu root đã cấu hình trong container. Cách copy này cũng áp dụng
cho container đang tồn tại từ trước khi đổi đường dẫn seed. Container mới mount
SQL tại `/seed/seed-data.sql`; seed vẫn là thao tác chủ động sau migration.

Không thêm `--force`: lỗi SQL cần dừng import. Procedure bao toàn bộ dữ liệu bằng
transaction; nếu gặp lỗi, các thay đổi dữ liệu của lần import được rollback.

## Tài khoản

| Email | Mật khẩu | Quyền / trạng thái |
| --- | --- | --- |
| `admin@gmail.com` | `Admin123` | `ADMIN` + `USER`, `ACTIVE` |
| `user@gmail.com` | `User123` | `USER`, `ACTIVE` |
| `tran.thi.b@elearning.com` | `User123!` | `USER`, `ACTIVE` |
| `le.van.c@elearning.com` | `User123!` | `USER`, `ACTIVE` |
| `pham.thi.d@elearning.com` | `User123!` | `USER`, `LOCKED` |
| `hoang.van.e@elearning.com` | `User123!` | `USER`, `ACTIVE` |

Đây là thông tin đăng nhập công khai dành cho phát triển. Database lưu BCrypt hash.
Seed tìm user theo email và role theo tên, giữ nguyên ID và tên hồ sơ đã tồn tại.
Hai tài khoản Gmail được đặt lại đúng mật khẩu/trạng thái trong bảng trên. Khi hash
mật khẩu thay đổi, credential version được tăng và refresh token cũ được thu hồi.
Quyền `ADMIN` được thêm cho tài khoản admin; các quyền đang có được giữ lại.
Các tài khoản ngoài danh sách seed được giữ nguyên. Nếu tài khoản Gmail đã bị xóa
mềm, seed dừng để người quản trị xử lý thay vì tự khôi phục tài khoản.

## Dữ liệu và chạy lại

Trên database đã migrate nhưng chưa có dữ liệu, seed tạo 101 bản ghi, tính cả hai
role do Flyway tạo sẵn:

| Database | Dữ liệu |
| --- | --- |
| Auth | 6 user, 7 liên kết role, 5 refresh token mẫu đã hết hạn và thu hồi |
| Course | 5 danh mục, 5 khóa học, 5 chương, 6 bài học dạng văn bản |
| Learning | 5 bản ghi mỗi bảng enrollment, progress, quiz, question, option, attempt, answer, notification |
| Payment | 5 bản ghi mỗi bảng order, order item, payment, payment transaction |

Khóa học mẫu dùng ID `1..5`; chương/bài học dùng các ID `910001..910501`.
Progress và quiz tham chiếu bài học thật trong curriculum. Thanh toán mẫu dùng
`MOCK`; dữ liệu không gọi VNPay hoặc tạo giao dịch bên ngoài.

Chạy lại cập nhật các fixture đã nhận diện, không tạo thêm user/bản ghi mẫu trùng.
Nếu ID dành cho fixture hoặc một khóa duy nhất đã thuộc đối tượng khác, seed dừng
và rollback. Dữ liệu demo cũ ở dải ID `900001..900005` được giữ nguyên; tổng số dòng
trên database đang dùng vì vậy có thể lớn hơn số lượng trong bảng trên.

## Kiểm chứng độc lập

```powershell
mvn -f backend/pom.xml verify -B -ntp
docker compose --profile backend build auth-service course-service learning-service payment-service
python infra/mysql/verify-seed.py
```

Script tạo MySQL tạm và các service trên network riêng, dùng mật khẩu ngẫu nhiên.
Kiểm tra migration thật, tài khoản đã tồn tại ở ID khác, chạy lặp lại, xung đột
ID/khóa duy nhất và rollback xuyên database. Sau đó kiểm tra đăng nhập, quyền
admin, curriculum, tiến độ, quiz và lịch sử thanh toán qua API. Tài nguyên kiểm
thử được dọn khi kết thúc; database đang dùng của dự án được giữ nguyên.
