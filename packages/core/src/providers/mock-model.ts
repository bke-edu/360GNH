import { compactExcerpt } from '../citations.js';
import type {
  AnswerDraft,
  DebateTurnInput,
  KnowledgeModel,
  MindmapDraft,
  ModelResult,
  QuizDraft,
  StudyGuideDraft,
} from '../model.js';
import { tokenize } from '../tokenize.js';
import type { Citation, ModelContext, RetrievedChunk } from '../types.js';
import type { AgoraMessage, DebateSummary } from '../agora/types.js';

export class MockKnowledgeModel implements KnowledgeModel {
  readonly provider = 'local';
  readonly model = 'deterministic-demo-v1';

  answer(context: ModelContext): Promise<ModelResult<AnswerDraft>> {
    const evidence = bestSentences(context.query, context.chunks, 3);
    const answer =
      evidence.length > 0
        ? `Từ nguồn đã nạp, có thể kết luận: ${evidence.join(' ')}`
        : 'Chưa có đủ đoạn nguồn liên quan để trả lời chắc chắn.';
    return Promise.resolve(this.result({ answer }));
  }

  generateMindmap(context: ModelContext): Promise<ModelResult<MindmapDraft>> {
    const labels = topTerms(context.chunks, 6);
    const fallbackLabels = ['Khái niệm chính', 'Cơ chế', 'Ứng dụng'];
    const rootLabel = context.query || context.chunks[0]?.sourceTitle || 'Bản đồ tri thức';
    return Promise.resolve(
      this.result({
        root: {
          label: compactExcerpt(rootLabel, 60),
          children: (labels.length > 0 ? labels : fallbackLabels).map((label, index) => ({
            label: titleCase(label),
            sourceExcerpt: compactExcerpt(
              context.chunks[index % Math.max(context.chunks.length, 1)]?.text ?? '',
              180,
            ),
          })),
        },
      }),
    );
  }

  generateQuiz(context: ModelContext, count: number): Promise<ModelResult<QuizDraft>> {
    const sentences = bestSentences(context.query, context.chunks, Math.max(3, count));
    const safeSentences =
      sentences.length > 0 ? sentences : context.chunks.map((chunk) => chunk.text);
    const questions = Array.from({ length: count }, (_, index) => {
      const sentence = compactExcerpt(
        safeSentences[index % safeSentences.length] ?? 'Không có dữ liệu.',
        220,
      );
      const subject =
        topTerms(
          [context.chunks[index % Math.max(context.chunks.length, 1)]].filter(
            Boolean,
          ) as RetrievedChunk[],
          1,
        )[0] ?? 'ý chính';
      return {
        format: 'mcq' as const,
        difficulty:
          index % 3 === 0
            ? ('easy' as const)
            : index % 3 === 1
              ? ('medium' as const)
              : ('hard' as const),
        question: `Phát biểu nào khớp nhất với nguồn về “${subject}”?`,
        options: [
          sentence,
          `Nguồn phủ nhận hoàn toàn vai trò của ${subject}.`,
          `${titleCase(subject)} chỉ là chi tiết trang trí, không có cơ chế.`,
          `Nguồn không hề đề cập đến ${subject}.`,
        ],
        correctAnswer: sentence,
        explanation: `Đáp án đầu tiên bám trực tiếp vào đoạn nguồn được trích dẫn.`,
        sourceExcerpt: sentence,
      };
    });

    return Promise.resolve(
      this.result({
        title: `Bài kiểm tra: ${context.query || context.chunks[0]?.sourceTitle || 'Nguồn đã chọn'}`,
        questions,
      }),
    );
  }

  generateStudyGuide(context: ModelContext): Promise<ModelResult<StudyGuideDraft>> {
    const evidence = bestSentences(context.query, context.chunks, 5);
    const labels = topTerms(context.chunks, 4);
    return Promise.resolve(
      this.result({
        title: `Hướng dẫn học: ${context.query || context.chunks[0]?.sourceTitle || 'Chủ đề'}`,
        overview:
          evidence.slice(0, 2).join(' ') || 'Tài liệu này gom các ý chính từ nguồn đã chọn.',
        learningObjectives: labels
          .slice(0, 3)
          .map((label) => `Giải thích được vai trò của ${label}`),
        sections: evidence.slice(0, 4).map((sentence, index) => ({
          heading: titleCase(labels[index] ?? `Ý chính ${index + 1}`),
          explanation: sentence,
          sourceExcerpt: sentence,
        })),
        reviewQuestions: labels.slice(0, 3).map((label) => `Cơ chế nào khiến ${label} quan trọng?`),
      }),
    );
  }

  debateTurn(
    input: DebateTurnInput,
  ): Promise<ModelResult<{ content: string; citationIndexes: number[] }>> {
    const evidence =
      bestSentences(input.topic, input.context.chunks, 1)[0] ?? 'Nguồn chưa đủ mạnh để kết luận.';
    const leadByRole: Record<string, string> = {
      advocate: 'Tao sẽ dựng phiên bản mạnh nhất của luận điểm',
      critic: 'Lỗ hổng cần soi là giả định ẩn phía sau kết luận',
      scientist: 'Điều nguồn thực sự chứng minh mới quan trọng',
      practitioner: 'Đem xuống đời thật thì câu hỏi là nó có làm được không',
      curious: 'Nếu bỏ hết chữ lớn, cơ chế đơn giản ở đây là gì',
      synthesizer: 'Điểm nối được các phía là',
    };
    const prior = input.transcript.at(-1);
    const response = `${leadByRole[input.agent.role] ?? 'Góc nhìn của tao'}: ${evidence}${
      prior
        ? ` Phản hồi ý của ${prior.agentName}: cần phân biệt ví dụ với bằng chứng tổng quát.`
        : ''
    }`;
    return Promise.resolve(
      this.result({
        content: response,
        citationIndexes: input.context.chunks.length > 0 ? [1] : [],
      }),
    );
  }

  synthesizeDebate(
    _topic: string,
    transcript: AgoraMessage[],
    _citations: Citation[],
  ): Promise<ModelResult<DebateSummary>> {
    return Promise.resolve(
      this.result({
        strongestArguments: transcript.slice(-4).map((message) => ({
          agentName: message.agentName,
          argument: compactExcerpt(message.content, 180),
        })),
        commonGround: ['Kết luận phải bám vào nguồn và nói rõ phần còn bất định.'],
        openQuestions: ['Bằng chứng hiện có đại diện đến đâu cho các bối cảnh khác?'],
        decisionFramework:
          'Tách dữ kiện, cơ chế, điều kiện áp dụng và chi phí kiểm chứng trước khi quyết định.',
      }),
    );
  }

  private result<T>(value: T): ModelResult<T> {
    return {
      value,
      usage: {
        provider: this.provider,
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: 0,
      },
    };
  }
}

function bestSentences(query: string, chunks: RetrievedChunk[], limit: number): string[] {
  const queryTerms = new Set(tokenize(query));
  return chunks
    .flatMap((chunk) =>
      chunk.text.split(/(?<=[.!?。！？])\s+/u).map((sentence) => ({
        sentence: sentence.trim(),
        score: tokenize(sentence).filter((term) => queryTerms.has(term)).length + chunk.score,
      })),
    )
    .filter((candidate) => candidate.sentence.length >= 24)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((candidate) => compactExcerpt(candidate.sentence, 260));
}

function topTerms(chunks: RetrievedChunk[], limit: number): string[] {
  const totals = new Map<string, number>();
  for (const chunk of chunks) {
    for (const [term, count] of chunk.terms)
      totals.set(term, (totals.get(term) ?? 0) + count * Math.max(chunk.score, 0.1));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function titleCase(value: string): string {
  return value ? `${value[0]?.toLocaleUpperCase('vi') ?? ''}${value.slice(1)}` : value;
}
