import type {
  Citation,
  ModelContext,
  ModelUsage,
  QuizQuestion,
  StudyGuideSection,
} from './types.js';
import type { AgoraAgent, AgoraMessage, DebatePhase, DebateSummary } from './agora/types.js';

export interface ModelResult<T> {
  value: T;
  usage: ModelUsage;
}

export interface AnswerDraft {
  answer: string;
}

export interface QuizDraft {
  title: string;
  questions: Omit<QuizQuestion, 'id'>[];
}

export interface MindmapNodeDraft {
  label: string;
  sourceExcerpt?: string;
  children?: MindmapNodeDraft[];
}

export interface MindmapDraft {
  root: MindmapNodeDraft;
}

export interface StudyGuideDraft {
  title: string;
  overview: string;
  learningObjectives: string[];
  sections: StudyGuideSection[];
  reviewQuestions: string[];
}

export interface DebateTurnInput {
  topic: string;
  phase: DebatePhase;
  round: number;
  agent: AgoraAgent;
  transcript: AgoraMessage[];
  context: ModelContext;
}

export interface KnowledgeModel {
  readonly provider: string;
  readonly model: string;
  answer(context: ModelContext): Promise<ModelResult<AnswerDraft>>;
  generateMindmap(context: ModelContext): Promise<ModelResult<MindmapDraft>>;
  generateQuiz(context: ModelContext, count: number): Promise<ModelResult<QuizDraft>>;
  generateStudyGuide(context: ModelContext): Promise<ModelResult<StudyGuideDraft>>;
  debateTurn(
    input: DebateTurnInput,
  ): Promise<ModelResult<{ content: string; citationIndexes: number[] }>>;
  synthesizeDebate(
    topic: string,
    transcript: AgoraMessage[],
    citations: Citation[],
  ): Promise<ModelResult<DebateSummary>>;
}
