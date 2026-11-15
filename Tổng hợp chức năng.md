# Tổng hợp chức năng còn thiếu so với Parroto

- **Project:** ChitChatGo — `online-learning-platform`.
- **Website đối chiếu:** [Parroto](https://parroto.app/), ưu tiên nội dung tiếng Việt.
- **Ngày rà soát:** 15/11/2026, múi giờ Việt Nam.
- **Mốc mã nguồn:** commit `1af677f`, cùng các file trong workspace tại thời điểm rà soát.
- **Cập nhật triển khai:** F16, F20, F21, F22 và F26 đã được bổ sung ngày 15/11/2026. Xem [hướng dẫn chức năng mới](docs/learning/ENGAGEMENT_COMMUNITY.md).
- **Bổ sung cửa hàng:** `/shop` có mua bằng kim cương, kho đồ, trang bị khung/ảnh nền và streak freeze; header có thông báo, streak, kim cương, avatar kèm level và bộ chọn ngôn ngữ có cờ. Xem [SHOP.md](docs/learning/SHOP.md).
- **Phương pháp:** kiểm tra route và giao diện React, API/controller/service Spring Boot, DTO/entity và migration; đối chiếu với các trang sản phẩm, hướng dẫn và thông báo chính thức của Parroto.

> **Giới hạn kiểm chứng:** công cụ đọc trực tiếp `parroto.app` nhận HTTP 403. Thông tin phía Parroto được kiểm tra qua nội dung các trang chính thức do công cụ tìm kiếm lập chỉ mục; liên kết được đặt ngay tại từng mục. Chưa đăng nhập hoặc thực hiện luồng học, gọi thoại hay mua gói trên Parroto. Project ban đầu được đánh giá bằng mã nguồn. Đợt bổ sung năm chức năng đã được kiểm tra qua Gateway/MySQL và Chrome desktop/mobile; phạm vi và kết quả được ghi trong hướng dẫn triển khai. Các phần khác của bản đối chiếu không phải xác nhận runtime toàn bộ chức năng cũ.

## 1. Kết quả chính

Project đã có nền tảng quản lý khóa học, học theo bài, quiz, thanh toán, trợ lý AI bằng văn bản, cùng năm nhóm chức năng vừa bổ sung: streak, cấp độ/phần thưởng, xếp hạng, Việt–Anh và diễn đàn. Các khoảng cách chính còn lại là nghe chép chính tả, thu âm/chấm phát âm, SRS và luyện nói với người khác.

Danh sách gồm **26 hạng mục: 5 đã triển khai trong đợt này, 10 chưa thấy triển khai và 11 có một phần**. Đây là cách chia hạng mục để lập kế hoạch, không phải tỷ lệ hoàn thiện của hai sản phẩm. Ứng dụng di động và blog được ghi riêng vì nằm ngoài phạm vi web chính.

Quy ước:

| Ký hiệu | Ý nghĩa |
| --- | --- |
| **Chưa có** | Chưa tìm thấy luồng sử dụng, API và dữ liệu nghiệp vụ tương ứng trong phạm vi mã nguồn đã rà soát. Chỉ có lời giới thiệu hoặc nút minh họa vẫn được xếp vào nhóm này. |
| **Có một phần** | Có chức năng nền tảng liên quan, nhưng thiếu các thành phần tạo nên trải nghiệm tương đương Parroto. |
| **Đã triển khai** | Có luồng sử dụng và lưu dữ liệu tương ứng trong đợt bổ sung này; xem hướng dẫn và kiểm chứng liên kết phía trên. |
| **P1** | Nên ưu tiên nếu muốn phát triển project thành nền tảng luyện tiếng Anh tương tự Parroto. |
| **P2** | Bổ sung sau khi luồng luyện tập cốt lõi đã hoạt động. |
| **P3** | Mở rộng theo định hướng cộng đồng, thương mại hoặc thị trường. |

Các mức ưu tiên là đề xuất cho project, không phải thông tin do Parroto công bố. Mã **M01–M14** dẫn tới bảng bằng chứng mã nguồn ở mục 6.

## 2. Những chức năng project đã có

Các chức năng sau cần được tận dụng khi bổ sung phần còn thiếu:

| Nhóm | Phần triển khai đã tìm thấy | Bằng chứng |
| --- | --- | --- |
| Tài khoản và phiên đăng nhập | Đăng ký, đăng nhập email/mật khẩu, ghi nhớ đăng nhập, JWT, refresh token rotation, đăng xuất. | M02 |
| Google và khôi phục mật khẩu | Đăng nhập Google, liên kết tài khoản Google, quên mật khẩu và đặt lại mật khẩu. | M02 |
| Hồ sơ cá nhân | Cập nhật họ tên, avatar URL, số điện thoại, ngày sinh, giới thiệu và đổi mật khẩu. | M02 |
| Danh mục khóa học | Tìm kiếm, lọc danh mục/trình độ/giá/đánh giá, sắp xếp, trang chi tiết và học thử. | M03 |
| Quản trị nội dung | Quản lý danh mục, khóa học, chương, bài học; xuất bản; upload media và tài liệu, sử dụng lưu trữ local/S3. | M03, M04 |
| Học và tiến độ | Ghi danh, khóa học của tôi, phát video hoặc nhúng YouTube, bài văn bản/tài liệu/quiz, tài liệu đính kèm, đánh dấu hoàn thành và dashboard. | M04, M05 |
| Quiz | Quản trị quiz, câu hỏi một/nhiều lựa chọn, giới hạn thời gian, chấm điểm theo phần trăm, lưu lượt làm và xem lại đáp án. | M06 |
| Thông báo | Danh sách, số chưa đọc, đánh dấu đã đọc, cập nhật qua SSE và gửi thông báo từ admin. | M07 |
| Thanh toán | Checkout theo khóa học, VNPay, callback/IPN, kích hoạt quyền học, lịch sử đơn hàng và báo cáo quản trị; có MOCK cho demo/test. | M08 |
| Trợ lý AI | Chat văn bản qua Gemini, ngữ cảnh khóa học/bài học, lưu và đọc lịch sử hội thoại; cần cấu hình provider để sinh câu trả lời. | M09 |
| Đánh giá và quản trị | Review khóa học, ẩn/hiện review; quản lý tài khoản, vai trò, quyền và nhật ký quản trị. | M10, M11 |

**Điểm cần phân biệt khi đánh giá:** `BenefitsSection.jsx` có nội dung quảng bá lộ trình CEFR và chấm phát âm; `AiTutorSection.jsx` có nhãn Voice AI và câu trả lời minh họa. Phần minh họa dùng câu trả lời định sẵn, còn API AI thật nhận `content` dạng văn bản. Những nội dung này chưa đủ để xác nhận có chấm giọng nói hoặc đánh giá CEFR. Diễn đàn hiện đã có màn hình và API riêng. Xem M09, M12 và hướng dẫn chức năng mới.

## 3. Danh sách chức năng còn thiếu hoặc chưa tương đương

### A. Luyện nghe, luyện nói và từ vựng

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F01 | **Nghe chép chính tả — Dictation:** nghe nội dung rồi nhập lại, kiểm tra độ chính xác và nhận phản hồi. [Dictation](https://parroto.app/dictation). | Có trình phát và quiz lựa chọn; chưa có bài nghe chia đoạn/câu, ô nhập bản chép, đối chiếu transcript và kết quả riêng cho hoạt động nghe chép. M04, M06. | **Chưa có** | P1 |
| F02 | **Shadowing và phản hồi phát âm:** nghe mẫu, nói theo, nhận phản hồi về phát âm, ngữ điệu và nhịp điệu. Đây là chức năng Parroto mô tả công khai, chưa được thử độ chính xác thực tế trong lần rà soát này. [Shadowing](https://parroto.app/shadowing). | Chưa tìm thấy thu âm microphone, gửi audio để phân tích, chấm phát âm hoặc lưu lượt luyện nói. Chat Gemini hiện nhận văn bản; giao diện Voice AI ở trang chủ là minh họa. M09, M12. | **Chưa có** | P1 |
| F03 | **Nghe/đọc theo câu, theo từ:** phát lại câu, điều chỉnh tốc độ và highlight đồng bộ với lời đọc trong nội dung học. [Trải nghiệm đọc và nghe](https://parroto.app/stories). | Có video HTML và iframe YouTube, có thể tận dụng điều khiển phát sẵn có. Chưa có transcript được căn thời gian và giao diện chọn/phát lại từng câu; nhúng video chưa tạo thành bài luyện tương tác. M04. | **Có một phần** | P1 |
| F04 | **Tra từ trong ngữ cảnh và sổ từ cá nhân:** chạm từ trong video để lưu từ vào bộ thẻ; thẻ có nghĩa, phiên âm, ví dụ và audio. [Từ vựng](https://parroto.app/vi/vocabulary). | Chưa có từ điển tích hợp, lưu từ/cụm từ từ bài học hoặc sổ từ riêng của từng người. “Ghi chú bài giảng” hiện hiển thị `currentLesson.content`, chưa phải ghi chú do học viên tạo. M04, M14. | **Chưa có** | P1 |
| F05 | **Flashcard và ôn tập ngắt quãng — SRS:** học theo bộ từ, ôn lại thẻ đến hạn để duy trì trí nhớ. [Flashcard SRS](https://parroto.app/vi/vocabulary). | Nút luyện từ vựng trong trang AI chỉ tạo câu hỏi cho chatbot. Chưa có deck/card, trạng thái ghi nhớ, lịch ôn hoặc phiên ôn tập. M09, M14. | **Chưa có** | P1 |
| F06 | **Tự tạo bộ từ vựng:** tìm và thêm từ có sẵn trong hệ thống/từ điển vào bộ từ riêng. [Thông báo của Admin Parroto](https://parroto.app/vi/community/6930180ac30a19e37d944199). | Chưa có quản lý bộ từ cá nhân, thêm/sửa/xóa thẻ hoặc chọn từ từ một kho từ điển. M01, M14. | **Chưa có** | P2 |

### B. Thư viện và tạo nội dung học

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F07 | **Nội dung theo CEFR A1–C2 và chủ đề:** bài học có mức độ riêng để người học chọn nội dung phù hợp. [Kho bài học](https://parroto.app/vi/topics). | Đã có danh mục, tìm kiếm và lọc trình độ, nhưng `CourseLevel` chỉ gồm `BEGINNER`, `INTERMEDIATE`, `ADVANCED`. Chưa có nhãn/lọc CEFR A1–C2 cho từng bài và dữ liệu kỹ năng tương ứng. M03, M04. | **Có một phần** | P1 |
| F08 | **Tạo bài luyện từ YouTube:** dán URL để tạo bài Shadowing/Dictation; giao diện công khai giới thiệu AI tạo transcript và phân loại cấp độ, có nhãn Pro. [Tạo bài từ YouTube](https://parroto.app/vi/topics), [hướng dẫn chính thức](https://parroto.app/blog/vi/bien-video-youtube-thanh-bai-hoc-tieng-anh-voi-shadowing-va-dictation-tren-parroto). | Đã nhận diện URL YouTube để nhúng vào bài do người có quyền quản trị nội dung tạo. Chưa có luồng học viên nhập URL, tạo transcript, chia câu hoặc sinh bài luyện. M03, M04, M09. | **Có một phần** | P2 |
| F09 | **Thư viện bài học do cộng đồng tạo:** khám phá bài luyện gắn người tạo, chủ đề, trình độ và số câu. [Bài học cộng đồng](https://parroto.app/community-lessons/tags/work). | API tạo/sửa nội dung hiện yêu cầu ADMIN hoặc quyền quản trị khóa học. Chưa có luồng học viên tự tạo/chia sẻ bài và danh sách bài học cộng đồng. M03, M01. | **Chưa có** | P2 |
| F10 | **Đọc truyện theo trình độ:** truyện có audio, highlight từng từ, tra/lưu từ, ghi chú ngữ pháp và danh sách truyện đã lưu. [Stories](https://parroto.app/stories). | Bài TEXT/DOCUMENT có thể chứa truyện, nhưng chưa có bộ đọc truyện tích hợp audio và tương tác từ vựng/ngữ pháp hoặc lưu truyện cá nhân. M04. | **Có một phần** | P2 |

### C. Luyện thi, phân tích kết quả và cá nhân hóa

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F11 | **Thi thử IELTS Listening/Reading:** đề theo cấu trúc thi, chấm band và giải thích đáp án. Trang chuyên biệt nói rõ phạm vi hiện tại là Listening và Reading, chưa chấm Writing/Speaking. [IELTS](https://parroto.app/exams/ielts). | Có quiz và đồng hồ, nhưng thiếu mô hình bộ đề/section/passage/audio và dạng trả lời đặc thù, quy đổi band, giải thích đáp án. Có nhãn khóa IELTS chưa đồng nghĩa có hệ thống thi thử IELTS. M03, M06. | **Có một phần** | P1 |
| F12 | **Thi thử TOEIC Listening/Reading:** đủ 7 Part, làm full test hoặc từng Part, chấm theo thang TOEIC và xem giải thích. [TOEIC](https://parroto.app/vi/exams/toeic). | Quiz chấm 0–100%, có ngưỡng đạt và xem đáp án. Chưa có cấu trúc 7 Part, câu hỏi dùng chung audio/đoạn đọc, kết quả tách Listening/Reading và quy đổi thang 10–990. M06. | **Có một phần** | P1 |
| F13 | **Ôn lại điểm yếu từ bài luyện:** hệ thống ôn tập tập trung vào từ/cụm từ khó và lỗi trong quá trình nghe, nói. [Mô tả hệ thống ôn tập](https://parroto.app/shadowing). | Đã xem lại đúng/sai của từng lượt quiz. Chưa có kho lỗi xuyên suốt các lần học, nhóm lỗi nghe/phát âm/từ vựng và phiên luyện lại theo điểm yếu. M06, M14. | **Có một phần** | P2 |
| F14 | **Biểu đồ tiến bộ kỹ năng và hồ sơ trình độ:** theo dõi khả năng nghe/nói theo thời gian, không chỉ số bài hoàn thành. [Theo dõi luyện nghe](https://parroto.app/dictation), [theo dõi luyện nói](https://parroto.app/shadowing). | Dashboard đang thống kê ghi danh, bài hoàn thành và quiz gần đây. Chưa có chuỗi kết quả theo kỹ năng, biểu đồ nghe/nói và hồ sơ mức năng lực cá nhân. M05. | **Có một phần** | P1 |
| F15 | **Đề xuất học theo mục tiêu và tiến bộ:** Parroto giới thiệu báo cáo và gợi ý học cá nhân hóa; chưa kiểm chứng cơ chế đề xuất sau đăng nhập. [Mô tả trên trang chủ](https://parroto.app/vi). | Trang chủ có quảng bá lộ trình cá nhân hóa, nhưng chưa tìm thấy mục tiêu học, hồ sơ năng lực và API đề xuất dựa trên lịch sử thực hành. Gợi ý câu hỏi chatbot chưa thay thế luồng này. M05, M09, M12. | **Chưa có** | P2 |

### D. Cộng đồng và giao tiếp giữa học viên

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F16 | **Diễn đàn học tập:** đăng bài theo chủ đề, hỏi đáp và bình luận. [Bài hỏi đáp trong cộng đồng](https://parroto.app/vi/community/691dcdaea8fc736d762ffcd2). | Đã có `/community`: đăng/sửa/xóa bài theo 4 chủ đề, tìm kiếm/lọc/phân trang, bình luận, chọn lời giải và ADMIN khóa/mở bài. Dữ liệu lưu MySQL; kiểm tra quyền ở backend. [Hướng dẫn](docs/learning/ENGAGEMENT_COMMUNITY.md). | **Đã triển khai** | Hoàn tất |
| F17 | **Ghép cặp luyện nói bằng giọng nói:** tìm người học cùng trình độ và chủ đề để hội thoại trực tiếp. [Trang giới thiệu luyện nói](https://parroto.app/ms/practice-english-speaking). | Chưa có phòng luyện nói, hàng chờ/ghép cặp, trạng thái người tham gia và kết nối thoại giữa học viên. SSE thông báo hiện có chưa cung cấp các luồng này. M01, M07, M12, M14. | **Chưa có** | P2 |
| F18 | **Kết bạn và nhắn tin:** Admin Parroto đã công bố hoàn thành hai chức năng này. [Thông báo chính thức](https://parroto.app/vi/community/69824d0f6c6ff5e40338895b). | Chưa có lời mời kết bạn, danh sách bạn và hội thoại giữa người dùng. Lịch sử chat AI hiện có là hội thoại với trợ lý, chưa phải nhắn tin giữa học viên. M09, M14. | **Chưa có** | P2 |
| F19 | **Báo cáo và chặn người dùng:** người học có thể report/block; quản trị xử lý vi phạm. [Hướng dẫn của Admin Parroto](https://parroto.app/vi/community/69824d0f6c6ff5e40338895b). | Đã có khóa tài khoản, phân quyền và ẩn review từ admin. Chưa có thao tác học viên chặn người khác, gửi báo cáo kèm nội dung vi phạm và hàng chờ xử lý báo cáo. M10, M11, M14. | **Có một phần** | P2 |

### E. Duy trì thói quen và trò chơi học tập

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F20 | **Chuỗi ngày học — streak:** hồ sơ hiển thị số ngày học liên tiếp. [FAQ theo dõi tiến bộ](https://parroto.app/vi). | Đã ghi nhận ngày học từ hoàn thành bài/nộp quiz, tính streak theo giờ Việt Nam, giữ chuỗi dài nhất và hiển thị lịch 90 ngày tại `/achievements`. Có streak freeze mua ở cửa hàng để bảo vệ ngày bỏ lỡ, tối đa 7 lượt. [Hướng dẫn](docs/learning/SHOP.md). | **Đã triển khai** | Hoàn tất |
| F21 | **Cấp độ hoạt động và phần thưởng:** hiển thị level người dùng, huy hiệu, khung avatar và phần thưởng kim cương. [Bảng xếp hạng và thưởng tháng](https://parroto.app/leaderboard). | Đã có XP, cấp độ hoạt động, 5 huy hiệu, thưởng ngày và kim cương; nhận thưởng một lần. Cửa hàng/kho đồ có mua và trang bị khung avatar, ảnh nền, lưu lựa chọn trên server. Header hiển thị level và khung đã chọn. [Hướng dẫn](docs/learning/SHOP.md). | **Đã triển khai** | Hoàn tất |
| F22 | **Bảng xếp hạng học tập:** xếp hạng người học theo tháng và hiển thị hoạt động học. [Leaderboard](https://parroto.app/leaderboard). | Đã có `/leaderboard`: bảng theo tháng/toàn thời gian, phân trang, vị trí cá nhân, cấp độ và khung avatar; điểm lấy từ lịch sử XP thật. [Hướng dẫn](docs/learning/ENGAGEMENT_COMMUNITY.md). | **Đã triển khai** | Hoàn tất |
| F23 | **Games & Vocab Battle:** trò chơi và thi đấu từ vựng được giới thiệu như một nhóm tính năng của nền tảng. [Trang chủ Parroto](https://parroto.app/vi). | Chưa có chế độ game, trận đấu từ vựng hoặc điểm/kết quả trận. Quiz hiện tại là bài kiểm tra cá nhân. Chưa xác minh từng chế độ chơi trên website trong lần rà soát này. M01, M06, M14. | **Chưa có** | P3 |

### F. Gói thành viên, phản hồi và ngôn ngữ giao diện

| Mã | Chức năng phía Parroto và nguồn | Hiện trạng project / phần cần bổ sung | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- |
| F24 | **Quyền lợi thành viên Pro:** một số bộ từ/nội dung dành cho Pro; có quyền lợi như lưu từ không giới hạn. [Quyền truy cập bộ từ](https://parroto.app/vi/vocabulary/ets-toeic), [quyền lợi ở Stories](https://parroto.app/stories). | Đã có thanh toán và cấp quyền theo khóa học; `CheckoutRequest` nhận `courseId`. Chưa có gói thành viên cấp quyền trên nhiều loại nội dung, thời hạn gói và hạn mức theo gói. Chưa xác minh cơ chế tự động gia hạn của Parroto nên không coi đó là chức năng bắt buộc phải đối chiếu. M08, M14. | **Có một phần** | P3 |
| F25 | **Phản hồi sản phẩm và báo lỗi bài học:** có trang đánh giá nền tảng, trả lời của Parroto; Admin hướng dẫn báo lỗi ở cuối bài. [Feedback](https://parroto.app/feedbacks), [hướng dẫn báo lỗi](https://parroto.app/vi/feedbacks). | Đã có đánh giá khóa học và admin ẩn/hiện review. Chưa có feedback toàn nền tảng, phản hồi từ đội ngũ hoặc báo lỗi gắn câu/bài và trạng thái xử lý. M10, M12, M14. | **Có một phần** | P2 |
| F26 | **Giao diện đa ngôn ngữ:** có các phiên bản trang tiếng Việt, Indonesia và các ngôn ngữ khác. [Tiếng Việt](https://parroto.app/vi), [Indonesia](https://parroto.app/id). | Đã có bộ chọn Việt–Anh trên web và trang quản trị, hơn 1.400 chuỗi dịch giao diện, định dạng ngày/số/tiền tệ theo locale và lưu lựa chọn giữa các lần truy cập. Chuyển ngôn ngữ giữ bản nháp form. [Hướng dẫn](docs/learning/ENGAGEMENT_COMMUNITY.md). | **Đã triển khai** | Hoàn tất |

## 4. Các khác biệt ngoài phạm vi web chính

| Hạng mục | Bằng chứng phía Parroto | Hiện trạng project | Định hướng |
| --- | --- | --- | --- |
| Ứng dụng di động riêng | Có ứng dụng do Parroto phát hành trên [App Store](https://apps.apple.com/us/app/parroto-shadowing-dictation/id6752111996). | Workspace hiện có frontend React/Vite; chưa thấy mã ứng dụng native/mobile riêng. Giao diện responsive hiện có vẫn phục vụ truy cập từ điện thoại. | Tùy chọn sau khi chức năng web ổn định; không tính là phần thiếu bắt buộc để so sánh hai website. |
| Blog và hướng dẫn học | Có bài viết hướng dẫn, ví dụ [học từ video YouTube](https://parroto.app/blog/vi/bien-video-youtube-thanh-bai-hoc-tieng-anh-voi-shadowing-va-dictation-tren-parroto). | Chưa có route và module bài viết công khai/CMS trong frontend đang rà soát. | Tùy chọn nếu cần kênh hướng dẫn và thu hút người học. |

## 5. Thứ tự bổ sung đề xuất

Nếu mục tiêu là đưa project gần trải nghiệm học của Parroto, có thể chia thành các đợt sau. Đây là đề xuất triển khai từ kết quả đối chiếu, không phải mô tả kiến trúc nội bộ của Parroto.

| Đợt | Hạng mục | Kết quả cần có để đánh giá hoàn thành |
| --- | --- | --- |
| 1. Bài luyện nghe tương tác | F01, F03, F07 | Bài có transcript chia câu và thời gian bắt đầu/kết thúc; học viên nghe lại câu, nhập bản chép, xem lỗi, lưu kết quả; nội dung có nhãn CEFR. |
| 2. Từ vựng theo ngữ cảnh | F04, F05, sau đó F06 | Lưu từ từ bài học vào sổ cá nhân, xem nghĩa/ví dụ và học flashcard; hệ thống xác định thẻ đến hạn, lưu kết quả ôn và cập nhật lịch ôn. |
| 3. Luyện nói và đo tiến bộ | F02, F14, sau đó F13/F15 | Thu âm, gửi audio để đánh giá, hiển thị phản hồi và lưu lượt luyện; dashboard thể hiện kết quả nghe/nói theo thời gian. Phải có luồng audio thật và dữ liệu đánh giá. |
| 4. Luyện thi chuyên biệt | F11, F12 | Tận dụng quiz nhưng mở rộng cấu trúc đề, loại câu hỏi, media, thời gian và cách quy đổi điểm; hiển thị giải thích đáp án và kết quả từng phần. Có thể hoàn thiện một loại kỳ thi trước. |
| 5. Phản hồi và nội dung mở rộng | F25, rồi F08–F10 | Ghi nhận hoạt động học theo ngày, tiếp nhận báo lỗi; tiếp đó mở tạo bài từ YouTube, thư viện cộng đồng hoặc truyện tùy nhu cầu thực tế. |
| 6. Giao tiếp và thương mại | F17–F19, F23–F24 | Diễn đàn/nhắn tin/luyện nói cần đi cùng report và block; điểm thưởng cần quy tắc tính rõ ràng; gói Pro cần mô hình quyền truy cập và thời hạn riêng. |

Các lưu ý khi chuyển danh sách thành công việc:

- **Tái sử dụng nền tảng hiện có:** Auth, Gateway, Course, Learning, Payment, AI và hệ thống thông báo. Không cần xây lại các chức năng tài khoản, thanh toán hoặc quiz đã có.
- **Tách dữ liệu học thực tế khỏi nội dung quảng bá:** nút “Luyện từ vựng”, tên khóa IELTS hoặc nhãn “Voice AI” chưa chứng minh có SRS, thi thử hoặc chấm audio. Nếu chưa triển khai, nên diễn đạt rõ đây là bản minh họa/tính năng dự kiến.
- **Kiểm tra chức năng theo luồng hoàn chỉnh:** giao diện → Gateway → service → lưu dữ liệu → đọc lại kết quả của đúng người học. Với audio hoặc AI, cần kiểm tra bằng đầu vào thật và xử lý lỗi dịch vụ.
- **Giữ phân biệt CEFR và điểm hoạt động:** số bài làm, số ngày học và level tích lũy có thể dùng để khuyến khích học, nhưng không tự động chứng minh năng lực ngôn ngữ.

## 6. Bằng chứng mã nguồn trong project

Các đường dẫn tương đối bên dưới trỏ tới phần triển khai đã đọc. Với nhận định “chưa có”, kết luận dựa trên việc đối chiếu toàn bộ route, API công khai, service, entity và migration liên quan, kết hợp tìm kiếm dấu hiệu triển khai; không chỉ dựa vào tên file hoặc README.

| Mã | File/thư mục tiêu biểu | Điều được dùng để đối chiếu |
| --- | --- | --- |
| M01 | [router.jsx](frontend/web/src/app/router.jsx), [endpoints.js](frontend/web/src/shared/apis/endpoints.js) | Phạm vi màn hình và API frontend đang sử dụng: Auth, Course, Learning, Quiz, Notifications, Payment, AI, Admin. |
| M02 | [AuthController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/AuthController.java), [GoogleLoginController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/GoogleLoginController.java), [GoogleLinkController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/GoogleLinkController.java), [PasswordResetController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/PasswordResetController.java), [UserController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/UserController.java), [AccountPage.jsx](frontend/web/src/features/auth/pages/AccountPage.jsx) | Tài khoản, Google, khôi phục mật khẩu, hồ sơ và avatar đã có phần triển khai. |
| M03 | [CourseController.java](backend/course-service/src/main/java/com/elearning/course/controller/CourseController.java), [CourseService.java](backend/course-service/src/main/java/com/elearning/course/service/CourseService.java), [CourseLevel.java](backend/course-service/src/main/java/com/elearning/course/entity/CourseLevel.java), [CourseListPage.jsx](frontend/web/src/features/courses/pages/CourseListPage.jsx), [LessonController.java](backend/course-service/src/main/java/com/elearning/course/controller/LessonController.java) | Tìm/lọc khóa học, ba mức trình độ hiện tại; quyền quản trị cần có để tạo/sửa nội dung. |
| M04 | [LearningPage.jsx](frontend/web/src/features/learning/pages/LearningPage.jsx), [lessonMedia.js](frontend/web/src/features/learning/utils/lessonMedia.js), [Lesson.java](backend/course-service/src/main/java/com/elearning/course/entity/Lesson.java), [MediaController.java](backend/course-service/src/main/java/com/elearning/course/controller/MediaController.java) | Video, YouTube, TEXT/DOCUMENT/QUIZ và tài liệu; chưa có transcript căn thời gian, trình đọc tương tác hoặc ghi chú cá nhân trong luồng học. |
| M05 | [LearningService.java](backend/learning-service/src/main/java/com/elearning/learning/service/LearningService.java), [LearningDashboardResponse.java](backend/learning-service/src/main/java/com/elearning/learning/dto/LearningDashboardResponse.java), [UserDashboardPage.jsx](frontend/web/src/features/learning/pages/UserDashboardPage.jsx), [LessonProgress.java](backend/learning-service/src/main/java/com/elearning/learning/entity/LessonProgress.java) | Ghi danh, tiến độ hoàn thành và dashboard; chưa có mô hình kết quả kỹ năng nghe/nói theo thời gian. |
| M06 | [QuizService.java](backend/learning-service/src/main/java/com/elearning/learning/service/QuizService.java), [QuizSubmissionRequest.java](backend/learning-service/src/main/java/com/elearning/learning/dto/QuizSubmissionRequest.java), [QuizReviewResponse.java](backend/learning-service/src/main/java/com/elearning/learning/dto/QuizReviewResponse.java), [QuizPage.jsx](frontend/web/src/features/learning/pages/QuizPage.jsx) | Quiz có thời gian, chọn đáp án, chấm phần trăm và review. Enum/schema có `TEXT`, nhưng service hiện từ chối loại này khi kiểm tra quiz có thể chấm và khi định nghĩa quiz; chưa thể coi là đã có chấm câu trả lời tự nhập. |
| M07 | [NotificationController.java](backend/learning-service/src/main/java/com/elearning/learning/controller/NotificationController.java), [NotificationService.java](backend/learning-service/src/main/java/com/elearning/learning/service/NotificationService.java), [NotificationsContext.jsx](frontend/web/src/features/learning/context/NotificationsContext.jsx) | Thông báo cá nhân, trạng thái đọc và SSE; chưa phải giao tiếp thoại hoặc nhắn tin giữa học viên. |
| M08 | [CheckoutRequest.java](backend/payment-service/src/main/java/com/elearning/payment/dto/CheckoutRequest.java), [PaymentController.java](backend/payment-service/src/main/java/com/elearning/payment/controller/PaymentController.java), [VnpayController.java](backend/payment-service/src/main/java/com/elearning/payment/controller/VnpayController.java), [PaymentCheckoutService.java](backend/payment-service/src/main/java/com/elearning/payment/service/PaymentCheckoutService.java) | Mua quyền học theo `courseId`, VNPay và quản lý thanh toán; chưa có mô hình gói thành viên Pro. |
| M09 | [AiController.java](backend/ai-service/src/main/java/com/elearning/ai/controller/AiController.java), [SendMessageRequest.java](backend/ai-service/src/main/java/com/elearning/ai/dto/SendMessageRequest.java), [aiApi.js](frontend/web/src/features/ai-assistant/api/aiApi.js), [AiAssistantPage.jsx](frontend/web/src/features/ai-assistant/pages/AiAssistantPage.jsx), [AI_ASSISTANT.md](docs/ai/AI_ASSISTANT.md) | Hội thoại AI bằng văn bản và lịch sử theo user; tài liệu phạm vi AI cũng ghi chưa thêm voice. |
| M10 | [ReviewController.java](backend/course-service/src/main/java/com/elearning/course/controller/ReviewController.java), [reviewApi.js](frontend/web/src/features/courses/api/reviewApi.js) | Review theo khóa học và ẩn/hiện review; chưa có diễn đàn hoặc hệ thống báo lỗi/feedback sản phẩm riêng. |
| M11 | [AdminManagementController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/AdminManagementController.java), [AdminUserController.java](backend/auth-service/src/main/java/com/elearning/auth/controller/AdminUserController.java), [AdminRolesPage.jsx](frontend/web/src/features/admin/pages/AdminRolesPage.jsx), [AdminAuditPage.jsx](frontend/web/src/features/admin/pages/AdminAuditPage.jsx) | Vai trò, quyền, quản lý tài khoản và nhật ký quản trị đã có. |
| M12 | [BenefitsSection.jsx](frontend/web/src/features/home/components/BenefitsSection.jsx), [AiTutorSection.jsx](frontend/web/src/features/ai-assistant/components/AiTutorSection.jsx), [PolicyDialog.jsx](frontend/web/src/shared/components/PolicyDialog.jsx) | Nội dung giới thiệu CEFR/phát âm và câu trả lời AI minh họa; bài kiểm tra trình độ vẫn đang chuẩn bị. Diễn đàn đã có module riêng. |
| M13 | [index.html](frontend/web/index.html), [package.json](frontend/web/package.json), [src](frontend/web/src) | Web React/Vite; đã bổ sung LanguageSwitcher và shared/i18n với kho bản dịch Việt–Anh. |
| M14 | [Migration Auth](backend/auth-service/src/main/resources/db/migration), [Migration Course](backend/course-service/src/main/resources/db/migration), [Migration Learning](backend/learning-service/src/main/resources/db/migration), [Migration Payment](backend/payment-service/src/main/resources/db/migration), [Migration AI](backend/ai-service/src/main/resources/db/migration) | Có dữ liệu nghiệp vụ nền tảng; V5/V6 đã bổ sung hồ sơ hoạt động, XP, ngày học, thưởng, khung avatar, chủ đề, bài đăng và bình luận. Chưa có SRS, bạn bè, trận đấu hoặc membership. |

## 7. Những điểm chưa đủ căn cứ để coi là khoảng cách chức năng

- Không đưa video call, học offline, livestream, chứng chỉ hoàn thành hoặc chấm IELTS Writing/Speaking vào danh sách “Parroto có mà project chưa có” khi chưa có nguồn phù hợp. [Trang IELTS chuyên biệt](https://parroto.app/exams/ielts) hiện nêu rõ chỉ luyện/chấm Listening và Reading.
- Không suy luận Parroto có hệ thống quản trị nội bộ, cách phân quyền hoặc kiến trúc backend cụ thể từ giao diện công khai.
- Không khẳng định mọi tính năng được mô tả là miễn phí, có trên mọi thiết bị hoặc mở cho mọi tài khoản. Một số nội dung/tạo bài có nhãn Pro; điều kiện truy cập từng luồng cần kiểm tra thêm trong tài khoản thực tế.
- Chưa kiểm chứng giá, quota, tự động gia hạn, hiệu quả học tập hoặc độ chính xác của AI trên Parroto. Tài liệu này đối chiếu phạm vi chức năng được công bố với phần triển khai hiện có của project.
