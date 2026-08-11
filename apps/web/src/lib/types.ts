import type {
  AgoraAgent,
  AnswerResult,
  Citation,
  DebateResult,
  KnowledgeSource,
  LearnerQuiz,
  Mindmap,
  QuizGrade,
  SmartClip,
  StudyGuide,
} from '@360gnh/core';

export type StudioMode = 'chat' | 'mindmap' | 'quiz' | 'guide' | 'clips' | 'agora';

export interface StudioMeta {
  provider: string;
  model: string;
  debateAgents: AgoraAgent[];
}

export interface StudioSnapshot {
  meta: StudioMeta | null;
  sources: KnowledgeSource[];
  activeSourceId: string | null;
  mode: StudioMode;
  query: string;
  busy: boolean;
  error: string | null;
  citations: Citation[];
  answer: AnswerResult | null;
  mindmap: Mindmap | null;
  quiz: LearnerQuiz | null;
  quizGrade: QuizGrade | null;
  guide: StudyGuide | null;
  clips: SmartClip[];
  debate: DebateResult | null;
}

export type {
  AgoraAgent,
  AnswerResult,
  Citation,
  DebateResult,
  KnowledgeSource,
  Mindmap,
  LearnerQuiz,
  QuizGrade,
  SmartClip,
  StudyGuide,
};

export type Quiz = LearnerQuiz;
