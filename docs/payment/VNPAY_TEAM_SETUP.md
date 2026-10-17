# Hướng dẫn nhóm chạy VNPay Sandbox sau khi pull code

Tài liệu dành cho Windows/PowerShell, chạy frontend tại `http://localhost:5173` và Gateway tại
`http://localhost:8080`, theo cấu hình hiện tại của nhóm. Chỉ dùng cho đồ án/môi trường thử nghiệm.
Không đổi port, tắt kiểm tra đăng nhập hoặc xóa database để làm theo hướng dẫn này.

Các khối lệnh dùng PowerShell (prompt thường có tiền tố `PS`). Lệnh chạy relay bằng `node.exe`
ở mục 3 và các lệnh portable ở mục 4 dùng được trong cả PowerShell và CMD.
Không thêm dấu `&` trước lệnh trong CMD; dấu đó là cú pháp gọi executable của PowerShell.

## 1. Những gì cần và không cần chia sẻ

| Thông tin | Cách sử dụng |
| --- | --- |
| Code, `.env.example`, tài liệu này | Push/pull qua Git |
| `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` | Nhận riêng từ người quản lý merchant Sandbox, điền vào `.env` ở root |
| Mật khẩu đăng nhập VNPay SIT | Người quản lý có thể tự cập nhật IPN giúp; không cần đưa mật khẩu cho mọi người |
| Mật khẩu DB, JWT, `INTERNAL_SERVICE_TOKEN` | Giữ cấu hình của môi trường trên máy mình; không chép toàn bộ `.env` của người khác |
| URL tunnel | Tạo trên máy đang test, không dùng lại URL tunnel của người khác |

**Không cần đăng ký merchant mới nếu dùng chung merchant Sandbox của nhóm.** Không commit khóa thật,
file `.env`, token, ảnh chứa bí mật, binary `cloudflared` hoặc log vào Git. Không đưa khóa VNPay vào
`frontend/web/.env` hay biến `VITE_*`.

Nếu mỗi người chạy backend/DB riêng, chỉ một người test tại một thời điểm với merchant dùng chung.
Thống nhất với người quản lý trước khi đổi IPN: callback sẽ được gửi đến URL đang cấu hình, không tự
chọn máy theo người bấm thanh toán. Muốn test độc lập song song thì dùng merchant riêng hoặc một môi
trường backend/DB demo chung đã được nhóm cấu hình; tài liệu này hướng dẫn cách chạy riêng trên local.

## 2. Chuẩn bị dự án trên máy mình

Cần Git, Docker Desktop đang chạy, Node.js đáp ứng phiên bản Vite của dự án và PowerShell.
Với backend chạy bằng Docker, không cần cài Java/Maven trên máy để khởi động các service.

Sau khi pull đúng nhánh/commit, mở terminal tại **root dự án**, nơi có `compose.yaml` và `.env.example`.
Không chạy các lệnh Docker dưới đây từ thư mục `backend`.

Chỉ tạo `.env` nếu chưa có:

```powershell
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

Nếu đã có `.env`, giữ nguyên và chỉ bổ sung các biến còn thiếu. Với máy mới, điền các mật khẩu DB,
`JWT_SECRET` và `INTERNAL_SERVICE_TOKEN` theo [README của dự án](../../README.md).
Hai token cần ít nhất 32 byte UTF-8; JWT phải thống nhất giữa các service, token nội bộ phải thống
nhất giữa Payment và Learning. Compose truyền các giá trị từ root `.env` cho các service tương ứng.
Nếu DB đã tồn tại, không tùy ý đổi mật khẩu DB trong `.env`: đổi file không đổi mật khẩu trong MySQL.

Nhận hai giá trị VNPay qua kênh riêng và điền vào root `.env`. Giữ endpoint thanh toán ở Sandbox:

```dotenv
VNPAY_TMN_CODE=<ma-merchant-Sandbox-cua-nhom>
VNPAY_HASH_SECRET=<khoa-Sandbox-nhan-rieng>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_EXPIRE_MINUTES=15
```

Thay các giá trị trong dấu `<...>` bằng cấu hình thật, không giữ nguyên dấu ngoặc.
Chưa có IPN HTTPS thì VNPay có thể chưa chọn được, nhưng Mock vẫn dùng được khi các service đã sẵn sàng.

Khởi động backend và chờ khỏe mạnh:

```powershell
docker compose --profile backend config -q
docker compose --profile backend up --build -d --wait --wait-timeout 180
docker compose --profile backend ps
```

Auth, Course, Learning, Payment, AI, Gateway và MySQL phải chạy bình thường. Flyway tự áp dụng
migration của phiên bản code; không sửa migration đã áp dụng hoặc chạy SQL tạo bảng thủ công.
Nếu thiếu account/khóa học, xem [hướng dẫn seed](../../infra/mysql/README.md). Không bắt buộc chạy
seed lại nếu đã có dữ liệu để test. Nếu seed báo collision, dừng và báo lead; không xóa volume.

## 3. Mở relay chỉ nhận callback trên máy mình

IPN là lời gọi từ máy chủ VNPay, nên không thể dùng `localhost` làm IPN URL. Cần một URL HTTPS
công khai dẫn về callback của backend trên máy đang tạo đơn.

Không mở tunnel trực tiếp đến Gateway `8080`, frontend `5173` hoặc MySQL `3306`. Đoạn lệnh dưới đây
chỉ nhận hai đường GET callback và chuyển tiếp đến Gateway local, không chuyển cookie/JWT/identity
header từ người gọi. Nó không thay đổi file ứng dụng hay port của nhóm, không đọc `.env` và không
ghi tham số callback vào log.

Mã relay dùng chung nằm trong repo tại
[`infra/scripts/vnpay-callback-relay.mjs`](../../infra/scripts/vnpay-callback-relay.mjs).
Sau khi pull code, mở **terminal A tại root dự án** và chạy một lệnh sau (PowerShell hoặc CMD):

```powershell
node.exe .\infra\scripts\vnpay-callback-relay.mjs
```

Script dùng thư viện có sẵn của Node.js, không cần `npm install` ở root và không đọc khóa VNPay.
Không cần file relay trong `.tmp/vnpay` của người khác. Các binary tunnel, log và file trạng thái
phiên vẫn giữ ngoài Git; chỉ mã relay và test được chia sẻ.

Terminal in ra dạng `{"host":"127.0.0.1","port":1800}` rồi tiếp tục chạy. `1800` chỉ là ví dụ;
dùng **port thực tế vừa in trên máy mình**. Giữ terminal A mở đến khi test xong.

## 4. Lấy URL HTTPS bằng Cloudflare Quick Tunnel

### Chuẩn bị portable một lần trên mỗi máy

Nhóm dùng **bản portable**, không cần cài đặt, quyền admin hay thêm `cloudflared.exe` vào PATH.
Sau khi pull code, chạy tại **root dự án** (lệnh dùng được trong cả CMD và PowerShell):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\setup-vnpay-cloudflared.ps1
```

Script tải bản Windows x64/x86 `2026.10.0` từ
[bản phát hành chính thức của Cloudflare](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0),
kiểm tra SHA-256 rồi lưu vào **`.tmp/vnpay/cloudflared.exe`**. Cần internet khi tải lần đầu.
Nếu file đúng phiên bản đã có, script chỉ kiểm tra và dùng lại, không tải lại.
Nếu file hiện có không khớp, script dừng và giữ nguyên file; không tự thay executable đang sử dụng.
Máy dùng kiến trúc khác xem [trang tải chính thức](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).

Chỉ push **script tải, test và tài liệu**, không push executable. `.tmp/` đã được Git bỏ qua.
Script không đọc/sửa `.env`, đổi port, cài Windows service hoặc tự mở relay/tunnel.
Không cần chạy lại bước tải sau mỗi lần tắt máy; chỉ chạy lại nếu file portable bị mất hoặc khi nhóm cập nhật bản ghim.

Kiểm tra script dành cho người phát triển, không cần chạy mỗi lần test thanh toán:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\setup-vnpay-cloudflared.test.ps1
```

Các test này dùng mock tải/checksum trong thư mục tạm riêng, không kết nối mạng hay thay file portable đang dùng.

### Chạy tunnel khi test VNPay

Mở **terminal B tại root dự án** và kiểm tra (CMD hoặc PowerShell):

```powershell
.\.tmp\vnpay\cloudflared.exe --version
```

Ví dụ terminal A in port `1800`, chạy:

```powershell
.\.tmp\vnpay\cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:1800
```

Thay `1800` bằng port của relay trên máy mình, **không thay bằng `8080`**.
Terminal B sẽ in URL dạng `https://ten-ngau-nhien.trycloudflare.com`. Đó là URL dùng ở bước tiếp theo,
không phải URL từ máy của người chia sẻ khóa VNPay.

[Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) không cần tài khoản/domain
Cloudflare, chỉ dành cho phát triển và không có cam kết uptime. URL đổi khi tạo phiên tunnel mới và
ngừng hoạt động khi dừng tiến trình. Giữ terminal B mở. Không bật đăng nhập bằng email/Cloudflare Access
trước callback vì máy chủ VNPay không thể đăng nhập tương tác để gửi IPN.

## 5. Điền callback và cập nhật IPN trên VNPay SIT

URL HTTPS ở terminal B chỉ là **địa chỉ gốc của tunnel**, chưa có đường dẫn callback. Lấy nguyên
URL đó (không có dấu `/` ở cuối) rồi ghép thêm đúng phần tương ứng:

| URL cần tạo | Phần nối sau URL tunnel | Điền vào đâu |
| --- | --- | --- |
| Return | `/api/v1/payments/vnpay/return` | Biến `VNPAY_RETURN_URL` trong root `.env` |
| IPN | `/api/v1/payments/vnpay/ipn` | Biến `VNPAY_IPN_URL` trong root `.env` và ô **IPN URL** trên SIT |

Ví dụ terminal B cấp `https://ten-ngau-nhien.trycloudflare.com`, hai URL sau khi ghép sẽ như bên dưới.
Bổ sung/sửa các biến trong **root `.env`**, không tạo hai dòng trùng tên biến:

```dotenv
VNPAY_RETURN_URL=https://ten-ngau-nhien.trycloudflare.com/api/v1/payments/vnpay/return
VNPAY_IPN_URL=https://ten-ngau-nhien.trycloudflare.com/api/v1/payments/vnpay/ipn
VNPAY_RESULT_URL=http://localhost:5173/payment/result
```

Thay domain ví dụ bằng domain vừa được cấp. `VNPAY_RESULT_URL` là frontend trên máy đang test,
không phải địa chỉ tunnel. Dùng `localhost:5173` nhất quán lúc đăng nhập và thanh toán để tránh
chuyển sang origin khác làm mất phiên đăng nhập.

Người quản lý merchant thực hiện trên [VNPay SIT Testing](https://sandbox.vnpayment.vn/vnpaygw-sit-testing/user/login):

1. Đăng nhập bằng tên đăng nhập trong email kết nối và mật khẩu lúc đăng ký Sandbox.
2. Chọn **Cấu hình IPN URL** ở menu trái và kiểm tra đúng merchant đang test.
3. Chọn **Sửa** nếu ô đang khóa, điền đúng `VNPAY_IPN_URL` ở trên, bấm **Cập nhật**.
4. Xác nhận thông báo **Cập nhật thành công!** và URL hiển thị khớp với máy đang test.

Nếu không được cấp quyền đăng nhập SIT, gửi riêng URL IPN mới cho người quản lý để họ cập nhật giúp.
**Điền IPN trong `.env` không tự cập nhật IPN trên VNPay.** Không điền URL `/return` vào ô IPN.
Trên SIT, dán **toàn bộ URL HTTPS có đuôi `/api/v1/payments/vnpay/ipn`**, không chỉ dán domain
và không dán cả phần `VNPAY_IPN_URL=`.
Cập nhật ở SIT chưa chứng minh IPN đã được gửi; phải kiểm tra bằng một giao dịch thật trên Sandbox.

Sau khi sửa root `.env`, tại root chạy:

```powershell
docker compose --profile backend config -q
docker compose --profile backend up --build -d --no-deps --wait --wait-timeout 180 payment-service api-gateway
```

Lệnh trên dùng khi các service phụ thuộc đã chạy khỏe mạnh ở bước 2. `docker compose restart` đơn
thuần không nạp lại environment mới; cần `up` để Compose tạo lại container khi cấu hình thay đổi.

## 6. Kiểm tra callback trước khi thanh toán

Trong terminal khác, dùng domain của chính mình:

```powershell
$publicBase = 'https://ten-ngau-nhien.trycloudflare.com'
Invoke-RestMethod -Uri "$publicBase/api/v1/payments/vnpay/ipn?vnp_SecureHash=invalid" -Method Get
```

Mong đợi `RspCode` là `97` và thông báo chữ ký không hợp lệ. Đây là kết quả **đúng** với yêu cầu thử
có chữ ký sai: đường HTTPS đã đến được Payment, nhưng không có thanh toán nào được cập nhật.
Không gửi khóa thật hay tự tạo callback SUCCESS để thay thế việc test VNPay.

Mở `$publicBase/api/v1/payments/history` trong trình duyệt phải nhận `404`, vì relay không cho phép
đường đó. Đường public chỉ dành cho callback, không phải base URL API của frontend.
Frontend vẫn gọi Gateway local tại `http://localhost:8080`.

## 7. Chạy frontend và thử thanh toán

Mở **terminal C** tại root, chuyển vào frontend:

```powershell
Set-Location .\frontend\web
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
npm.cmd ci
npm.cmd run dev -- --port 5173 --strictPort
```

Trong `frontend/web/.env`, giữ `VITE_API_URL=http://localhost:8080`, không thêm `/api/v1` vào giá trị.
Nếu `5173` đã có frontend của dự án đang chạy, dùng phiên đó; không tự đổi port hoặc đóng tiến trình
không rõ nguồn gốc. Cấu hình callback/result trong hướng dẫn này dùng `5173`.

Mở `http://localhost:5173`, đăng nhập tài khoản học viên và chọn một khóa học đã mở bán, có phí và
chưa đăng ký. Nếu dùng seed chính thức trên DB mới, xem tài khoản mẫu trong hướng dẫn seed; không
dùng mật khẩu của merchant VNPay để đăng nhập ứng dụng.

1. Vào checkout, chọn **VNPay**, bấm tiếp tục thanh toán.
2. Kiểm tra trang nhận thanh toán thuộc `sandbox.vnpayment.vn` và số tiền đúng với khóa học.
3. Chọn **Thẻ ATM/tài khoản ngân hàng**, ngân hàng **NCB** và dùng thông tin test bên dưới.
4. Hoàn tất OTP, để trình duyệt quay về ứng dụng.
5. Kiểm tra trang kết quả thành công, lịch sử thanh toán và khóa học trong **Khóa của tôi**.

Thông tin [thẻ test chính thức của VNPay](https://sandbox.vnpayment.vn/apis/vnpay-demo/):

| Trường | Giá trị test |
| --- | --- |
| Ngân hàng | `NCB` |
| Số thẻ thành công | `9704198526191432198` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| OTP | `123456` |
| Số thẻ không đủ số dư | `9704195798459170488` |

Chỉ dùng dữ liệu test được VNPay công bố, không nhập thẻ thật hoặc xác nhận chuyển tiền bằng app
ngân hàng/ví thật để thử đồ án. Nếu VNPay cập nhật dữ liệu thử, ưu tiên thông tin trên trang chính thức.

Thử hủy bằng nút hủy của VNPay và thử thẻ không đủ số dư trên **giao dịch mới**. Kiểm tra kết quả/DB
của từng giao dịch; không mặc định mọi lỗi nhập thẻ đều là một giao dịch thất bại cuối cùng, vì cổng
có thể cho nhập lại thông tin. Nếu kết quả vẫn đang chờ, kiểm tra IPN trước khi kết luận test đã pass.
Khóa học không được kích hoạt do giao dịch hủy/thất bại; nếu tài khoản đã có khóa đó từ trước thì
không dùng việc khóa vẫn xuất hiện làm bằng chứng kích hoạt mới.

Để kiểm tra đơn bị bỏ dở, tạo một giao dịch VNPay mới rồi không thanh toán. Sau thời hạn cấu hình
(`VNPAY_EXPIRE_MINUTES`, mặc định 15 phút), tải lại lịch sử hoặc trang kết quả: đơn hiển thị
**Hết hạn thanh toán**, không còn nút tiếp tục dùng link cũ. Có thể lọc các đơn này trên lịch sử và
trang quản lý thanh toán; chúng không tính vào số tiền/số giao dịch đang chờ thanh toán.
Backend kiểm tra đơn quá hạn mỗi 30 giây, giữ nguyên lịch sử và không tự kết luận thanh toán thất bại.
Nếu đã thanh toán đúng hạn nhưng chưa có xác nhận, dùng **Kiểm tra kết quả** trước khi tạo đơn mới.

Theo [protocol VNPay PAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), Return dùng
để kiểm tra/hiển thị kết quả, IPN dùng để cập nhật thanh toán. Ứng dụng chỉ báo thành công từ trạng
thái đã xác nhận ở backend; không sửa query `status=success` hoặc trạng thái bằng admin để test VNPay.

## 8. Dừng test, tắt máy và chạy lại lần sau

### Khi test xong

Chờ giao dịch đã cập nhật kết quả trên ứng dụng, không chỉ trên trang VNPay. Sau đó bấm `Ctrl+C`
ở terminal B để dừng tunnel, rồi ở terminal A để dừng relay. Không cần xóa container/database.
Frontend ở terminal C có thể tiếp tục chạy để dùng web hoặc Mock. Không chuyển IPN sang người
khác khi các giao dịch của phiên hiện tại còn đang xử lý.

### Khi mở máy lại để test VNPay

Hai khóa `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` vẫn giữ nguyên trong `.env`, không cần đăng ký
merchant mới. Tuy nhiên relay/tunnel chạy theo phiên terminal, không tự khởi động lại theo Docker.
Làm theo thứ tự sau:

1. Mở Docker Desktop. Tại root chạy lệnh bên dưới để khởi động backend; không cần build lại nếu code không đổi.

```powershell
docker compose --profile backend up -d --wait --wait-timeout 180
```

2. Mở **terminal A tại root**, chạy `node.exe .\infra\scripts\vnpay-callback-relay.mjs` như mục 3
   và ghi nhận port vừa in ra. Không mặc định port cũ vẫn đúng.
3. Mở **terminal B tại root**, gọi `.\.tmp\vnpay\cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:1800`
   như mục 4; thay `1800` bằng port mới của terminal A. File portable vẫn còn sau khi tắt máy, không cần tải lại.
   URL HTTPS nằm trong khung ngay dưới dòng `Your quick Tunnel has been created!`.
4. Lấy URL tunnel mới, bỏ dấu `/` ở cuối nếu có, rồi nối `/api/v1/payments/vnpay/return`
   để điền `VNPAY_RETURN_URL` và nối `/api/v1/payments/vnpay/ipn` để điền `VNPAY_IPN_URL` trong root `.env`.
   Dán toàn bộ URL IPN vừa ghép vào SIT như mục 5; người quản lý merchant có thể cập nhật giúp.
   `VNPAY_RESULT_URL` vẫn là `http://localhost:5173/payment/result`.
5. Tại root nạp cấu hình Payment mới, rồi kiểm tra callback chữ ký sai như mục 6:

```powershell
docker compose --profile backend up -d --no-deps --wait --wait-timeout 180 payment-service
```

6. Mở **terminal C** tại root để chạy frontend. Nếu frontend đã chạy thì dùng phiên hiện có, không mở thêm server:

```powershell
Set-Location .\frontend\web
npm.cmd run dev -- --port 5173 --strictPort
```

Giữ **cả ba terminal A/B/C** chạy trong lúc test VNPay, đồng thời Docker phải đang chạy. Nếu code
hoặc dependency vừa thay đổi sau khi pull, build backend/cài dependency lại theo mục 2 và 7 trước
khi test. Không cần chạy seed lại hoặc đăng ký VNPay lại chỉ vì đã tắt máy.

Tạo giao dịch mới sau khi đổi domain; URL thanh toán của đơn cũ chứa Return URL của phiên tunnel
cũ và không tự đổi khi sửa `.env`.

**Chỉ mở được trang VNPay chưa chứng minh callback đang hoạt động.** Backend vẫn có thể tạo link
thanh toán khi URL tunnel cũ không còn truy cập được. Để chốt test, phải kiểm tra kết quả được ghi
nhận trong lịch sử thanh toán và khóa học được kích hoạt khi giao dịch thành công. Nếu chỉ dùng
web/thanh toán Mock thì không cần terminal A/B. Nếu chỉ đóng frontend nhưng relay/tunnel vẫn đang
chạy với URL còn hoạt động, không cần tạo lại tunnel hay cập nhật URL.

## 9. Lỗi thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| VNPay chưa chọn được ở checkout | Hai khóa đã điền; merchant code 8 ký tự; đúng endpoint Sandbox; IPN HTTPS; Return/Result đúng đường; container đã nạp `.env` mới |
| `cloudflared.exe` không được nhận diện | Không gọi tên trần; ở root dùng `.\.tmp\vnpay\cloudflared.exe`. Nếu chưa có file, chạy script tải ở mục 4; không cần thêm PATH |
| Script tải portable báo checksum sai | Không chạy file chưa được xác minh. Nếu báo file hiện có không khớp, giữ nguyên và kiểm tra với người quản lý trước khi chuyển file cũ sang chỗ khác rồi tải lại |
| Tunnel báo không kết nối được / callback trả `502` | Terminal A/B còn chạy; port của relay đúng; Gateway/Payment khỏe mạnh |
| IPN thử trả `97` | Đúng khi cố ý dùng chữ ký sai; không phải bằng chứng giao dịch đã thành công |
| VNPay báo xong nhưng web đang chờ | IPN trên SIT trỏ đúng máy; tunnel không bị đóng/đổi; kiểm tra sự kiện IPN trong chi tiết giao dịch và thử gửi lại từ SIT nếu có thao tác tương ứng |
| IPN trả `01` cho giao dịch thật | Kiểm tra đúng merchant/backend/DB; không dùng URL tunnel của người khác |
| Thành công nhưng khóa học chưa sẵn sàng | Kiểm tra Learning và `INTERNAL_SERVICE_TOKEN`; dùng retry kích hoạt ở trang kết quả hoặc chờ worker, không thanh toán lần nữa |
| Quay về web lại yêu cầu đăng nhập | Dùng nhất quán `localhost:5173`, kiểm tra frontend đang chạy và Result URL; không trộn với `127.0.0.1` |
| Chữ ký không hợp lệ ở giao dịch thật | Kiểm tra TmnCode/HashSecret cùng merchant, giá trị đúng không có khoảng trắng thừa; không gửi secret hoặc toàn bộ signed URL vào log/chat |
| Seed/migration lỗi | Đọc log của service và báo lead; không `down -v`, sửa Flyway history hoặc reset DB để né lỗi |

Chỉ chia sẻ thông báo lỗi, mã đơn cần tra cứu và ảnh đã che bí mật. Không gửi output
`docker compose config` đầy đủ hoặc `docker inspect` environment vì có thể chứa khóa/mật khẩu.

## 10. Kiểm tra trước khi merge

Tại `frontend/web`, chạy `npm.cmd test`, `npm.cmd run lint` và `npm.cmd run build`.
Tại `backend/payment-service`, chạy `.\mvnw.cmd verify`; test mặc định dùng H2, không ghi vào DB của nhóm.
Tại root, kiểm tra các script hỗ trợ:

```powershell
node.exe --test .\infra\scripts\vnpay-callback-relay.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\setup-vnpay-cloudflared.test.ps1
```
