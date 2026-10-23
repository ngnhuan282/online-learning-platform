# AI Assistant (D10)

## Phạm vi

Tích hợp Gemini qua backend `ai-service`, lưu hội thoại/tin nhắn và nhật ký sử dụng
trong `ai_db`, xem lại lịch sử riêng của từng user, chat theo ngữ cảnh khóa học/bài học.
Không thêm streaming, voice, upload, vector database hoặc tự động đăng ký dịch vụ trả phí.

D10 chỉ được nghiệm thu sau khi lead xác nhận Must Have và hồ sơ bắt buộc đã đạt.
AI vẫn là profile riêng, không làm core phụ thuộc vào API key hoặc Gemini.

## Cấu hình và chạy

Tạo key tại Google AI Studio theo [hướng dẫn chính thức](https://ai.google.dev/gemini-api/docs/api-key).
Điền trực tiếp vào `.env` ở root, không gửi key vào chat/Git hoặc đặt trong `VITE_*`:

```dotenv
AI_API_KEY=<key cua nhom>
AI_MODEL=<model ID duoc cap quyen trong Google AI Studio>
AI_REQUEST_TIMEOUT_MS=15000
```

Model được cấu hình, không hard-code vì danh sách model/quota có thể thay đổi.
Không bật billing nếu nhóm chưa thống nhất chi phí. Free tier có giới hạn và có thể
dùng nội dung để cải thiện sản phẩm; chỉ dùng dữ liệu học tập không nhạy cảm khi demo.
Xem [giá và chính sách dữ liệu](https://ai.google.dev/gemini-api/docs/pricing).

Chạy ở root sau khi Docker Desktop sẵn sàng:

```powershell
docker compose --profile backend --profile ai up --build -d
docker compose --profile backend --profile ai ps
```

Lần đầu Flyway tự tạo `ai_conversations`, `ai_messages`, `ai_usage_logs` trong `ai_db`
bằng `V1__create_ai_conversations.sql`. Không cần seed AI, không xóa volume hoặc sửa
migration cũ của service khác. Không đổi port; trình duyệt vẫn chỉ gọi Gateway `8080`.
Compose chỉ bổ sung URL nội bộ Course/Learning cho AI.

Frontend chạy như hiện tại:

```powershell
cd frontend/web
npm run dev
```

Mở `/ai-assistant`, hoặc nút **Trợ lý AI** trên trang học để lấy ngữ cảnh bài đang xem.
Sau khi sửa key/model/timeout trong `.env`, nạp lại container AI:

```powershell
docker compose --profile ai up -d --no-deps --force-recreate ai-service
```

Không cần tunnel hoặc IPN cho Gemini. Key trống/model trống: generation bị khóa,
nhưng lịch sử đã lưu vẫn đọc được. Capabilities chỉ xác nhận cấu hình đã có, không
gọi thử provider; chỉ câu trả lời thật mới xác nhận key/model/quota hoạt động.

## API và dữ liệu

Mọi API sau cần Bearer JWT qua Gateway, dùng envelope hiện có:

| Method | `/api/v1/ai` | Kết quả |
| --- | --- | --- |
| GET | `/capabilities` | `available`, `historyAvailable`, `maxMessageLength` |
| GET | `/conversations?page=0&size=20` | PageResponse, chỉ hội thoại của người gọi |
| POST | `/conversations` | `{title?, courseId?, lessonId?}` → metadata |
| GET | `/conversations/{id}` | Metadata của hội thoại sở hữu |
| GET | `/conversations/{id}/messages?page=0&size=50` | PageResponse, mới nhất trước |
| POST | `/conversations/{id}/messages` | `{content, requestId?}` → cặp USER/AI đã lưu |

`content` bắt buộc, không trắng, tối đa 4000 ký tự. `lessonId` cần `courseId` và phải
thuộc đúng khóa học. `requestId` là ID do frontend tạo, 8–64 ký tự chữ/số/`_`/`-`.
Client cũ không gửi ID vẫn hoạt động nhưng không có bảo đảm chống lặp giữa hai POST.
Frontend hiện tại luôn gửi ID và dùng lại khi retry cùng câu hỏi.

UserId luôn lấy từ JWT, bỏ qua identity/provider key do FE tự khai. Admin không có
quyền đọc hội thoại của user khác qua API cá nhân; trả 404 để không lộ tài nguyên.
Nội dung AI được render thành text, không chèn HTML từ provider.

## Context và retry

- Chat thông thường không cần Course/Learning. Chat theo bài học yêu cầu quyền học;
  AI gọi Learning bằng JWT người gọi và kiểm tra lại mỗi lần gửi, sau đó lấy text từ Course.
- Chỉ gửi mô tả khóa học, tiêu đề và text của bài đã chọn; không gửi email, JWT,
  signed media URL hoặc API key như nội dung prompt. Video không được tự suy diễn thành transcript.
- Provider nhận tối đa 20 tin nhắn gần nhất, giới hạn 24.000 ký tự lịch sử,
  cùng ngữ cảnh có giới hạn. Toàn bộ lịch sử vẫn đọc được qua phân trang.
- Lưu cặp USER/AI và usage trong một transaction sau khi provider trả lời thành công.
  Lỗi provider không tạo câu trả lời giả hay cặp tin nhắn dở dang. FE giữ câu hỏi để retry.
- Cùng `requestId` + cùng content trả lại cặp đã lưu, không gọi Gemini lần nữa.
  Dùng lại ID với content khác trả 409.
- Mỗi hội thoại xử lý một câu hỏi tại một thời điểm bằng lease ngắn trong DB;
  không giữ transaction/row lock trong lúc chờ HTTP. Sau lỗi lease được giải phóng;
  sau crash lease hết hạn sau 120 giây để không khóa hội thoại vĩnh viễn.
- Timeout provider được cấu hình 1–60 giây; frontend cho phép tối đa 90 giây để
  backend có thời gian kiểm tra context và trả mã lỗi chuẩn. Không sửa timeout toàn app.
- Không tự retry provider vì request timeout vẫn có thể đã tiêu quota/chi phí.
  Người dùng quyết định thử lại; API request ID chống trùng dữ liệu đã ghi nhận,
  không bảo đảm provider không tính phí một request bị timeout.
- `AI_TIMEOUT` (504), `AI_QUOTA_EXCEEDED` (429), `AI_CONFIGURATION_ERROR` (503),
  `AI_PROVIDER_ERROR` (503), `AI_CONTEXT_UNAVAILABLE` (503), `AI_CONTENT_BLOCKED` (422)
  có thông báo riêng. Không trả raw lỗi hoặc credentials từ upstream.
- Usage chỉ lưu model, kết quả, token counts và thời điểm; không ghi prompt vào log.

REST contract theo [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Checklist trên web

1. Đăng nhập user A, hỏi một câu ngữ pháp ở `/ai-assistant`; chờ câu trả lời Gemini thật.
2. Hỏi tiếp câu dựa vào nội dung trước. Reload hoặc chọn lại lịch sử: hai lượt vẫn còn.
3. Mở khóa học đã ghi danh → chọn bài → **Trợ lý AI** → hỏi về bài. Tiêu đề ngữ cảnh phải đúng.
4. Sao chép URL hội thoại sang user B: không xem/gửi được vào hội thoại A.
5. Sửa courseId/lessonId sang bài không có quyền: không được gọi provider hoặc lộ nội dung.
6. Gửi nhiều lần khi đang chờ: chỉ một yêu cầu được gửi; không đổi hội thoại khi đang xử lý.
7. Để trống key/model rồi recreate riêng AI: chat bị khóa nhưng lịch sử vẫn mở được.
8. Sai key/model: lỗi cấu hình, không lộ key, câu hỏi còn để sửa hoặc thử lại.
9. Timeout/quota kiểm tra bằng test tự động, không cố tiêu quota hoặc bật billing để gây lỗi.

## Kiểm thử tự động

```powershell
mvn -f backend/ai-service/pom.xml verify
cd frontend/web
npm run lint
npm test
npm run build
```

`AiChatIntegrationTests` dùng HTTP server cục bộ làm Gemini/Course/Learning và
Flyway + H2 để kiểm tra persistence, lịch sử nhiều lượt, ownership, JWT forwarding,
context, duplicate/concurrent requests, lỗi cấu hình, HTTP 429 và timeout mạng thật.
Không cần key thật và không gọi provider trả phí trong test.

Có thể chạy chính bộ test này trên một database MySQL **riêng, có thể bỏ đi**:
đặt `AI_TEST_DB_URL`, `AI_TEST_DB_USERNAME`, `AI_TEST_DB_PASSWORD`,
`AI_TEST_DB_DRIVER=com.mysql.cj.jdbc.Driver`, rồi chạy `-Dtest=AiChatIntegrationTests`.
Test xóa dữ liệu AI để cô lập các ca; tuyệt đối không trỏ các biến test vào `ai_db`
hoặc database đang dùng của nhóm.

Test tự động/HTTP giả lập không thay thế nghiệm thu Gemini thật bằng key của nhóm.
Chỉ đánh dấu D10 hoàn thành sau checklist provider thật và điều kiện Must Have đã đạt.

## Kết quả xác minh 19/10/2026

| Kiểm tra | Kết quả |
| --- | --- |
| AI `verify`, Flyway + H2 | 24/24 đạt |
| `AiChatIntegrationTests` trên MySQL 8.4 riêng | 10/10 đạt, gồm timeout HTTP, quota, ownership, context, duplicate và lease hết hạn |
| Backend các module | 277 test, 276 đạt, 1 Google tùy chọn bỏ qua |
| Frontend | Lint/build đạt; lần chạy toàn bộ 118/118 đạt; bộ AI sau bổ sung phân trang đạt 7/7 |
| Playwright, API giả lập | Desktop 1440px và mobile 390px/320px đạt; retry/lịch sử/thiếu key/404; không lỗi JavaScript hoặc tràn ngang |
| Image/runtime AI riêng | Build đạt; health UP; tạo/đọc hội thoại 200, thiếu key 503, thiếu JWT 401 |
| Gemini thật | Chưa chạy, chờ key/model của nhóm |

Lần verify backend đầu vướng migration Learning cũ còn trong `target`, không còn
trong source. Sau `clean verify` từ Learning trở đi, các module còn lại đạt;
không sửa source/migration Learning để xử lý lỗi build này.

Runtime core của máy hiện chưa được xác minh: container MySQL cũ còn mount đường
dẫn `infra/mysql/05-seed-data.sql` từ cấu hình trước. Đề nghị recreate theo Compose
hiện tại đã bị chặn vì tác động DB dùng chung, đang chờ chủ workspace cho phép.
Chưa recreate MySQL core, không chạy seed, không sửa `.env`, không xóa volume.
Container/database/ảnh kiểm thử riêng không phải thành phần cần push.
