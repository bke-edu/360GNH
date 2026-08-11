import type { IngestSourceInput } from './studio.js';

export const DEMO_SOURCE: IngestSourceInput = {
  title: 'Học bền / Durable learning: active recall and spaced practice',
  kind: 'transcript',
  text: `Đọc lại nhiều lần tạo cảm giác quen mắt, nhưng quen mắt không đồng nghĩa với nhớ được. Muốn biết kiến thức đã nằm trong đầu hay chưa, người học phải đóng tài liệu và tự gọi nó ra. Hành động đó gọi là nhớ chủ động.

Mỗi lần cố nhớ, đường truy cập tới kiến thức được luyện lại. Một câu trả lời sai vẫn có ích nếu người học nhận phản hồi ngay, vì sai lầm chỉ ra chính xác chỗ ký ức còn yếu. Ngược lại, nhìn đáp án quá sớm khiến bài học có vẻ dễ nhưng không tạo được lần truy xuất thật.

Ôn cách quãng giải quyết một vấn đề khác: ký ức phai theo thời gian. Thay vì dồn năm lượt ôn vào một buổi, người học giãn chúng ra qua nhiều ngày. Khi việc nhớ bắt đầu hơi khó, lần truy xuất tiếp theo đòi hỏi nhiều nỗ lực hơn và thường làm ký ức bền hơn.

Hai cơ chế bổ sung cho nhau. Nhớ chủ động quyết định người học làm gì trong một lượt ôn; ôn cách quãng quyết định khi nào lượt ôn đó diễn ra. Một lịch học tốt tăng khoảng cách sau câu trả lời đúng và rút ngắn khoảng cách sau câu trả lời sai.

Ứng dụng đơn giản nhất không cần phần mềm cầu kỳ. Cuối mỗi buổi, người học viết ba câu hỏi, che ghi chép, tự trả lời rồi đánh dấu mức chắc chắn. Ngày hôm sau chỉ ôn lại câu sai hoặc câu trả lời còn mơ hồ. Sau một tuần, người học kiểm tra lại toàn bộ để phát hiện phần tưởng nhớ mà thực ra đã quên.

Reading the same material repeatedly creates familiarity, but familiarity is not proof of recall. To check whether knowledge is actually available, close the material and retrieve it from memory. This act is called active recall.

Every retrieval attempt practices the path back to the knowledge. A wrong answer still helps when immediate feedback follows, because the error identifies the weak part of memory. Looking at the answer too early feels easier but removes the retrieval attempt.

Spaced practice solves a different problem: memory fades over time. Instead of cramming five reviews into one session, spread them across several days. When recall becomes slightly difficult, the next retrieval requires more effort and often produces stronger retention.

The two mechanisms complement each other. Active recall determines what the learner does during a review; spaced practice determines when that review happens. A useful schedule increases the interval after a correct answer and shortens it after an incorrect one.

The simplest application needs no elaborate software. At the end of a study session, write three questions, hide the notes, answer from memory, and mark confidence. Review incorrect or uncertain answers the next day. After one week, test everything again to uncover material that felt familiar but was forgotten.`,
  segments: [
    {
      startMs: 0,
      endMs: 18_000,
      text: 'Đọc lại nhiều lần tạo cảm giác quen mắt nhưng không chứng minh rằng ta nhớ được. Đóng tài liệu và tự gọi kiến thức ra là nhớ chủ động. Repeated reading creates familiarity but does not prove recall. Closing the material and retrieving knowledge is active recall.',
    },
    {
      startMs: 18_000,
      endMs: 42_000,
      text: 'Mỗi lần cố nhớ luyện lại đường truy cập tới kiến thức. Trả lời sai có ích khi nhận phản hồi ngay. Each retrieval attempt practices access to knowledge. A wrong answer helps when immediate feedback follows.',
    },
    {
      startMs: 42_000,
      endMs: 67_000,
      text: 'Ôn cách quãng giãn các lượt ôn qua nhiều ngày thay vì dồn vào một buổi. Spaced practice spreads reviews across several days instead of cramming them into one session.',
    },
    {
      startMs: 67_000,
      endMs: 92_000,
      text: 'Nhớ chủ động quyết định làm gì trong lượt ôn, còn ôn cách quãng quyết định khi nào ôn. Active recall determines what happens during a review; spaced practice determines when the review happens.',
    },
    {
      startMs: 92_000,
      endMs: 125_000,
      text: 'Người học có thể viết câu hỏi, che ghi chép, tự trả lời và ôn lại câu sai vào ngày hôm sau. Learners can write questions, hide their notes, answer from memory, and review incorrect answers the next day.',
    },
  ],
};
