# Cửa hàng, kho đồ và header

Truy cập `/shop` sau khi đăng nhập, hoặc nhấn biểu tượng kim cương trên header. Giao diện Việt–Anh và bố cục responsive dùng cùng dữ liệu thật từ Learning Service.

## Chức năng

- **Cửa hàng / Kho đồ:** lọc tất cả, khung avatar, ảnh nền; xem độ hiếm, giá, vật phẩm miễn phí và trạng thái đang dùng.
- **Mua:** xác nhận trước khi trừ kim cương. Không đủ số dư thì nút bị vô hiệu hóa và server cũng từ chối giao dịch.
- **Trang bị / Tháo:** mỗi tài khoản dùng một khung và một ảnh nền. Khung hiển thị trên header, hồ sơ, thành tích và bảng xếp hạng; ảnh nền hiển thị trong kho đồ và hồ sơ tài khoản.
- **Header:** số dư kim cương dẫn đến cửa hàng; biểu tượng lửa và số ngày dẫn đến thành tích; chuông thông báo có số chưa đọc; avatar có khung đã chọn và nhãn `Lv.`; bộ chọn Việt–Anh có cờ, viền và đổ bóng.
- Số dư, cấp độ, chuỗi và khung trên header được làm mới sau hoàn thành bài, nộp quiz, nhận thưởng, mua hoặc trang bị; đồng thời cập nhật khi quay lại tab và định kỳ khi tab hiển thị.

## Kinh tế trong ứng dụng

Ngày có hoạt động học hợp lệ đầu tiên nhận **25 kim cương**, tối đa một lần/ngày theo `Asia/Ho_Chi_Minh`. Quy tắc XP và năm phần thưởng thành tích vẫn áp dụng. Làm lại quiz có trả lời ở ngày khác có thể nhận thưởng ngày; hoàn thành lại lesson đã hoàn thành không tạo hoạt động mới.

| Vật phẩm | Loại | Giá kim cương |
| --- | --- | ---: |
| Streak freeze | Tiêu hao | 25 |
| Bầu trời khởi đầu | Ảnh nền | 0 |
| Hẹn gặp ở giảng đường | Ảnh nền | 100 |
| Thư viện ánh trăng | Ảnh nền | 120 |
| Vòng sáng khởi đầu | Khung avatar | 0 |
| Mèo nhỏ chăm học | Khung avatar | 150 |
| Koala vườn xanh | Khung avatar | 180 |
| Cú mèo phù thủy | Khung avatar | 250 |
| Thỏ hoa anh đào | Khung avatar | 180 |

Giá lưu trong `shop_items`; client không quyết định giá hoặc số dư. Đây là kim cương học tập trong ứng dụng, không phải thanh toán tiền thật.

## Streak freeze

- Giữ tối đa **7 lượt**. Mỗi lượt bảo vệ một ngày đã kết thúc mà người học không có hoạt động hợp lệ.
- Đối soát tự động khi đọc hồ sơ/cửa hàng hoặc ghi nhận hoạt động tiếp theo. Ngày hiện tại vẫn còn thời gian học nên chưa dùng freeze.
- Freeze giữ nguyên số ngày streak, không tăng streak, XP, thưởng ngày hay hoạt động trong lịch. Ngày được bảo vệ hiển thị màu xanh dương trong lịch thành tích.
- Nếu thiếu lượt để bảo vệ toàn bộ các ngày bỏ lỡ, dùng các lượt hiện có cho các ngày đầu tiên rồi đặt streak hiện tại về 0. Chuỗi dài nhất giữ nguyên.
- Đối soát trước khi mua lượt mới: mua freeze không sửa lại chuỗi đã đứt.

## API và lưu trữ

Tất cả API yêu cầu JWT, user ID lấy từ principal. Prefix `/api/v1/learning/shop`:

| Method | Path | Nội dung |
| --- | --- | --- |
| GET | Gốc prefix (không thêm `/`) | Số dư, stock freeze, giới hạn, danh mục, sở hữu và trạng thái trang bị |
| POST | `/purchases` | `{ "itemCode": "FRAME_KITTY", "requestId": "UUID-cua-lan-mua" }` |
| POST | `/equip` | `{ "itemType": "FRAME", "itemCode": "FRAME_KITTY" }`; `BACKGROUND` cho ảnh nền, `null` để tháo |

Mua sử dụng transaction và khóa hồ sơ người học. Trừ kim cương, thêm kho/stock và ghi biên nhận cùng thành công hoặc cùng rollback. `requestId` duy nhất theo người dùng; thử lại cùng mã trả biên nhận và trạng thái hiện tại, không trừ lại. Dùng cùng request ID cho vật phẩm khác trả `409 / CONFLICT`. Vật phẩm vĩnh viễn đã sở hữu không bị thu tiền lần nữa, kể cả khi request đồng thời. UI giữ nguyên request ID khi thử lại trong hộp xác nhận sau lỗi mạng.

`409 / INSUFFICIENT_GEMS`: thiếu kim cương; `409 / INVENTORY_FULL`: đủ 7 freeze; `403 / FORBIDDEN`: trang bị vật phẩm chưa sở hữu/sai loại; `404 / NOT_FOUND`: mã không tồn tại/không bán. Các mã đầu vào được validation.

Migration **V7** thêm catalog, inventory, biên nhận và ngày được freeze; bổ sung background/stock/mốc đối soát vào hồ sơ, chuyển mốc ngày học hiện có sang mốc đối soát. Flyway tự áp dụng khi Learning Service khởi động. Không cần reset database.

```powershell
docker compose --profile backend up --build -d learning-service
cd frontend/web
npm run dev
```

## Hình ảnh

Sáu asset nguyên bản được tạo bằng ImageGen, lưu tại [public/images/shop](../../frontend/web/public/images/shop). Khung PNG giữ nền và lỗ avatar trong suốt, ảnh đại diện thật nằm phía dưới; không dùng ảnh phản chiếu mẫu trong screenshot. Brief tạo ảnh được ghi ở [PROMPTS.md](../../frontend/web/public/images/shop/PROMPTS.md).

## Kiểm tra

Backend kiểm tra số dư/giá từ server, quyền trang bị, validation, request lặp, mua đồng thời, giới hạn freeze, ngày Việt Nam, chống nhận thưởng ngày trùng, freeze không cộng XP và không sửa chuỗi đã đứt. Frontend kiểm tra thử lại cùng request ID, chống bấm trùng, kho đồ/trang bị và header dữ liệu thật, chuyển ngôn ngữ. Có kiểm tra tích hợp Gateway/MySQL và xem giao diện bằng Chrome desktop/mobile.

Kết quả backend: 61 kiểm thử Learning đạt (verify toàn service, sau đó chạy lại nhóm 10 kiểm thử engagement/community/shop sau chỉnh sửa cuối). Migration V7 áp dụng thành công trên MySQL; các luồng mua, request lặp, trang bị và tiêu hao freeze đã kiểm tra qua Gateway. Chrome kiểm tra bố cục 360, 390, 768, 1024, 1440, 1600 và 1920px; hai ngôn ngữ, chuông thông báo và ảnh nền hồ sơ hoạt động. Dữ liệu cửa hàng/học tập của hai tài khoản QA đã được dọn và các tài khoản này được vô hiệu hóa.

Frontend: **177/177** kiểm thử đạt; lint và production build đạt. Build còn cảnh báo kích thước một số bundle trên 500 kB.
