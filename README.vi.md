# 360GNH Knowledge Studio

360GNH biến nguồn dài thành câu trả lời có trích dẫn, đoạn thông minh có mốc thời gian, bản đồ ý, bài kiểm tra, hướng dẫn học và phiên tranh luận nhiều góc nhìn.

Đây là bản tách độc lập từ các ý tưởng dùng lại được của một nền tảng tri thức do Nguyễn Duy Hưng duy trì. Mặc định dự án chạy hoàn toàn cục bộ bằng mô hình giả lập có kết quả ổn định, không cần khóa API và không gửi dữ liệu ra ngoài.

![Giao diện Knowledge Studio trên máy tính](docs/assets/knowledge-studio-desktop.png)

## Chạy thử

Cần Node.js 20 trở lên và npm.

```bash
npm ci
npm run dev
```

Mở <http://127.0.0.1:4311>. Máy chủ API chạy tại <http://127.0.0.1:4310>.

```bash
npm test
npm run eval
npm run check
```

## Có gì bên trong

- hỏi đáp bám nguồn bằng bộ tìm kiếm BM25 cục bộ;
- giữ mốc thời gian của bản ghi lời nói và tạo đoạn thông minh;
- bản đồ ý nhiều tầng có đoạn nguồn đi kèm;
- bài kiểm tra giữ đáp án ở máy chủ cho tới lúc chấm;
- hướng dẫn học tập trung vào cơ chế, không chỉ tóm tắt;
- Quảng trường tranh luận với 2–4 góc nhìn bắt buộc dựa vào bằng chứng.

Muốn dùng OpenAI thì chép `.env.example` thành `.env`, đặt `AI_PROVIDER=openai`, thêm `OPENAI_API_KEY` và chọn giới hạn `AI_BUDGET_USD`. Dữ liệu chỉ được gửi đi khi người vận hành chủ động bật nhà cung cấp này.

## Phạm vi cố ý chưa làm

Study Groups chưa được đưa vào 360GNH cho tới khi mô-đun đó ổn định và được rà soát riêng. Dự án cũng không chứa xác thực theo khách hàng, dữ liệu sản xuất, trình tải danh sách phát, dây chuyền sách nói, cấu hình triển khai riêng hay bí mật của sản phẩm gốc.

Bản `0.1.0` chỉ dùng bộ nhớ trong tiến trình, chưa có lưu trữ bền vững và chưa phù hợp để mở thành dịch vụ nhiều người dùng trên Internet.

Đọc thêm: [kiến trúc](docs/ARCHITECTURE.md), [mô hình đe dọa](docs/THREAT_MODEL.md), [nguồn gốc mã](docs/PROVENANCE.md), [lộ trình](docs/ROADMAP.md).

Giấy phép: [MIT](LICENSE).
