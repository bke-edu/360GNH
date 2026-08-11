# 360GNH Knowledge Studio

**Ngôn ngữ:** [English](README.md) · Tiếng Việt

360GNH lấy nội dung từ một video YouTube, giữ nguyên bản phụ đề thô, biên tập thành tài liệu sạch rồi biến cùng nguồn đó thành câu trả lời có trích dẫn, công cụ học hoặc một tệp sách nói.

Đây là bản tách độc lập từ các ý tưởng dùng lại được của một nền tảng tri thức do Nguyễn Duy Hưng duy trì. Toàn bộ giao diện có cả tiếng Việt lẫn tiếng Anh, tự nhận ngôn ngữ trình duyệt ở lần đầu và nhớ lựa chọn của người dùng. Mặc định dự án chạy hoàn toàn cục bộ bằng mô hình giả lập có kết quả ổn định, không cần khóa API và không gửi dữ liệu ra ngoài.

![Giao diện Knowledge Studio trên máy tính](docs/assets/knowledge-studio-desktop.png)

## Chạy thử

Cần Node.js 20 trở lên và npm.

```bash
npm ci
npm run dev
```

Mở <http://127.0.0.1:4311>. Máy chủ API chạy tại <http://127.0.0.1:4310>. Dùng nút **VI / EN** trên đầu trang để đổi toàn bộ giao diện; đầu ra của mô hình cục bộ đi theo ngôn ngữ câu hỏi.

```bash
npm test
npm run eval
npm run check
```

### Tự chạy cùng Docker

Docker Compose dựng riêng container API không chạy bằng quyền quản trị và container giao diện tĩnh. Cả hai chỉ mở trên máy cục bộ và dùng `restart: unless-stopped`, nên tự sống lại mỗi khi Docker khởi động. Trình duyệt gọi API đã bảo vệ qua máy chuyển tiếp của giao diện; khóa nhà cung cấp không đi vào gói giao diện hay lớp image.

Muốn chạy mô hình cục bộ không cần khóa:

```bash
cp .env.example .env
./scripts/docker-up.sh
```

Nếu chưa có `API_TOKEN`, trình hỗ trợ sẽ tự sinh một mã nội bộ mới. Nếu gọi Compose trực tiếp thì người vận hành phải tự đặt giá trị này.

Muốn dùng lại một tệp môi trường riêng mà không chép khóa vào repository:

```bash
AI_PROVIDER=openai ./scripts/docker-up.sh /đường/dẫn/tuyệt/đối/tới/private.env
```

Mở <http://127.0.0.1:4311>. Xem trạng thái bằng `docker compose ps`; xem tối đa 100 dòng nhật ký gần nhất bằng `docker compose logs --tail 100`. Chỉ cần dựng lại sau khi mã hoặc phụ thuộc đổi. Bộ nhớ hiện tại vẫn mất các nguồn đã nhập khi container API khởi động lại.

## Có gì bên trong

- hỏi đáp bám nguồn bằng bộ tìm kiếm BM25 cục bộ;
- lấy phụ đề gốc có mốc thời gian từ từng video YouTube qua Supadata;
- chỉ biên tập khi người dùng bấm nút, luôn giữ bản thô và cảnh báo khi bản sạch bị co hoặc phình đáng ngờ;
- giữ mốc thời gian của bản ghi lời nói và tạo đoạn thông minh;
- bản đồ ý nhiều tầng có đoạn nguồn đi kèm;
- bài kiểm tra giữ đáp án ở máy chủ cho tới lúc chấm;
- hướng dẫn học tập trung vào cơ chế, không chỉ tóm tắt;
- dựng một tệp sách nói WAV qua OpenAI, tự chia ở ranh giới câu và chặn cứng số ký tự;
- Quảng trường tranh luận với 2–4 góc nhìn bắt buộc dựa vào bằng chứng.

Muốn dùng OpenAI cho biên tập và các công cụ tri thức thì chép `.env.example` thành `.env`, đặt `AI_PROVIDER=openai`, thêm `OPENAI_API_KEY` và chọn giới hạn `AI_BUDGET_USD`. Văn bản chỉ được gửi cho mô hình tri thức khi người vận hành bật lựa chọn này; sách nói chỉ gửi nguồn đã chọn sau khi người dùng tự bấm dựng.

Để bật trọn luồng video và sách nói, thêm các giá trị chỉ nằm ở máy chủ:

```dotenv
SUPADATA_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENAI_TTS_MODEL=gpt-4o-mini-tts
AUDIOBOOK_MAX_CHARS=20000
AUDIOBOOK_SESSION_CHAR_BUDGET=100000
```

Luồng được cố ý giữ rõ ràng: nhập một video → xem bản thô → tự bấm biên tập → tái dùng bản sạch → dựng một tệp WAV. Không có tải danh sách phát, tải hàng loạt hay sản xuất sách nói hàng loạt. Giọng đọc do AI tạo phải được thông báo cho người nghe.

## Phạm vi cố ý chưa làm

Study Groups chưa được đưa vào 360GNH cho tới khi mô-đun đó ổn định và được rà soát riêng. Dự án cũng không chứa xác thực theo khách hàng, dữ liệu sản xuất, trình tải danh sách phát, xử lý âm thanh hàng loạt, cấu hình triển khai riêng hay bí mật của sản phẩm gốc.

Bản `0.1.0` chỉ dùng bộ nhớ trong tiến trình, chưa có lưu trữ bền vững và chưa phù hợp để mở thành dịch vụ nhiều người dùng trên Internet.

## Ranh giới pháp lý

Giấy phép MIT chỉ áp dụng cho mã và tài liệu gốc của 360GNH, không tự cấp quyền đối với video, phụ đề, bài viết hay giọng nói mà người dùng đưa vào. Nội dung xem công khai không đồng nghĩa với quyền tái bản. Người vận hành phải có quyền, giấy phép hoặc căn cứ hợp pháp để xử lý nội dung, đồng thời tuân thủ điều khoản hiện hành của dịch vụ họ tự bật.

Giọng đọc do AI tạo phải được thông báo cho người nghe. Không giả giọng người thật khi chưa có quyền và sự đồng ý cần thiết.

Đọc thêm: [lưu ý pháp lý và sử dụng có trách nhiệm](docs/LEGAL.md), [nguồn gốc mã](docs/PROVENANCE.md), [thông báo giấy phép bên thứ ba](THIRD_PARTY_NOTICES.md), [kiến trúc](docs/ARCHITECTURE.md), [mô hình đe dọa](docs/THREAT_MODEL.md), [lộ trình](docs/ROADMAP.md).

## Bảo mật và đóng góp

Máy chủ mặc định chỉ nghe trên máy cục bộ. Khóa OpenAI và Supadata chỉ nằm ở máy chủ; không nhúng chúng vào gói giao diện hay commit tệp `.env`. Hãy báo lỗ hổng qua [kênh báo cáo riêng](SECURITY.md), đừng đăng bí mật hoặc dữ liệu riêng tư vào issue công khai.

Muốn đóng góp thì đọc [CONTRIBUTING.md](CONTRIBUTING.md). Study Groups, dữ liệu khách hàng và mã riêng theo từng tổ chức vẫn cố ý nằm ngoài phạm vi.

Giấy phép dự án: [MIT](LICENSE). Phụ thuộc, phông chữ và biểu tượng giữ giấy phép riêng trong [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
