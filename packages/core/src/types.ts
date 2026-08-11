export type SourceKind = 'transcript' | 'article' | 'note';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  kind: SourceKind;
  sourceUrl?: string;
  text: string;
  /** Immutable imported/original transcript when an editorial workflow was used. */
  rawText?: string;
  /** Clean copy currently indexed by the Studio after explicit editing. */
  editedText?: string;
  transcriptLanguage?: string;
  availableTranscriptLanguages?: string[];
  editStats?: SourceEditStats;
  segments?: TranscriptSegment[];
  createdAt: string;
}

export interface SourceEditStats {
  parts: number;
  wordRatio: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  provider: string;
  model: string;
  warnings: Array<'possible-compression' | 'possible-expansion'>;
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  ordinal: number;
  text: string;
  startMs?: number;
  endMs?: number;
  terms: ReadonlyMap<string, number>;
}

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
}

export interface Citation {
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  excerpt: string;
  startSeconds?: number;
  endSeconds?: number;
  score: number;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
  usage: ModelUsage;
}

export interface MindmapNode {
  id: string;
  label: string;
  sourceExcerpt?: string;
  children?: MindmapNode[];
}

export interface Mindmap {
  root: MindmapNode;
  markdown: string;
  citations: Citation[];
}

export type QuestionFormat = 'mcq' | 'true_false' | 'fill_blank' | 'open_ended';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  format: QuestionFormat;
  difficulty: Difficulty;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  sourceExcerpt: string;
}

export interface Quiz {
  id: string;
  title: string;
  sourceIds: string[];
  questions: QuizQuestion[];
  createdAt: string;
}

export type LearnerQuizQuestion = Omit<QuizQuestion, 'correctAnswer' | 'explanation'>;

/** Quiz shape safe to send before grading. Answers stay in the trusted process. */
export interface LearnerQuiz extends Omit<Quiz, 'questions'> {
  questions: LearnerQuizQuestion[];
}

export interface QuizGradeDetail {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  explanation: string;
}

export interface QuizGrade {
  score: number;
  autoGradable: number;
  total: number;
  details: QuizGradeDetail[];
}

export interface StudyGuideSection {
  heading: string;
  explanation: string;
  sourceExcerpt: string;
}

export interface StudyGuide {
  title: string;
  overview: string;
  learningObjectives: string[];
  sections: StudyGuideSection[];
  reviewQuestions: string[];
  citations: Citation[];
}

export interface SmartClip {
  id: string;
  topic: string;
  sourceId: string;
  sourceTitle: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  deepLink?: string;
}

export interface ModelUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}

export interface BudgetSnapshot {
  limitUsd: number;
  spentUsd: number;
  reservedUsd: number;
  remainingUsd: number;
  calls: number;
}

export interface ModelContext {
  query: string;
  chunks: RetrievedChunk[];
  untrustedContext: string;
}
