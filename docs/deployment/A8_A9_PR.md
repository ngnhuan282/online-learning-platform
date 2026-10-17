# Nội dung PR A8 và A9

Title: `fix(integration): enforce Course access and verify core staging readiness`

Guest trước đây có thể đọc bài private/resource và khóa Draft; VNPAY checkout chỉ trả một URL return
không được ký. Thay đổi này kiểm tra quyền Course qua JWT + enrollment của Learning, giới hạn Published/preview,
cấp media local URL có hạn và hiển thị dữ liệu Learning thật. Trang Payment Result chờ Backend order và
enrollment cùng xác nhận; MOCK phải bật tường minh, VNPay chưa triển khai báo lỗi rõ ràng.

Gateway readiness phản ánh bốn service cốt lõi với timeout hữu hạn. AI chuyển sang profile riêng;
request log truyền correlation ID, thêm route an toàn và tránh exception messages chứa URL/secret.
Không nâng stack, đổi API owner, sửa migration hoặc chia sẻ DB/JPA giữa services.

Validation: xem [checklist có bằng chứng](../testing/A8_A9_ACCEPTANCE.md).
Scope owner: Course access adapter, Learning curriculum/error state, Payment provider gate/result enrollment;
S3 nghiệp vụ và D9 VNPay signed checkout/callback vẫn cần owner bàn giao.

## Checklist review và merge

- [ ] Tối thiểu một thành viên review; Tùng kiểm tra access/media, Hoàng kiểm tra curriculum/enrollment,
      Nguyên kiểm tra provider gating và D9 handoff.
- [ ] Xác nhận nhánh đích develop với đội; repo hiện chỉ có main và remote-tracking nhánh thành viên.
- [ ] Review router, shared client/guards, JWT claim validation, CORS và headers nội bộ.
- [ ] Xác nhận PAYMENT_MOCK_ENABLED chỉ bật trên môi trường demo/test; secret chỉ ở Backend/env.
- [ ] Kiểm tra Flyway history khi ghép các DB đã dùng; không sửa migration cũ hoặc tự repair.
- [ ] Chạy backend verify, FE test/build/lint và Docker integration/staging smoke trên commit cuối sau merge.
- [ ] Chỉ đánh dấu paid Sandbox pass sau signed callback E2E thật; không dùng MOCK thay minh chứng VNPay.
- [ ] Kiểm tra health/fault/restart và HTTPS secure cookie trên domain staging thật trước release.

Các nhóm review: Auth/Gateway và Course authorization; staging/observability/provider config;
test/smoke/tài liệu. Working tree được để lại trên feature branch, chưa tự commit/push/merge.
