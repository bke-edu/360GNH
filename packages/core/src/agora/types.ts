import type { Citation, ModelUsage } from '../types.js';

export type AgentRole =
  'advocate' | 'critic' | 'scientist' | 'practitioner' | 'curious' | 'synthesizer';

export type EpistemicLens =
  'evidence' | 'systems' | 'human_factors' | 'ethics' | 'practice' | 'first_principles';

export type DebatePhase = 'exploration' | 'collision' | 'synthesis';

export interface AgoraAgent {
  id: string;
  name: string;
  role: AgentRole;
  lens: EpistemicLens;
  tone: 'calm' | 'direct' | 'skeptical' | 'curious';
  description: string;
}

export interface AgoraMessage {
  id: string;
  agentId: string;
  agentName: string;
  phase: DebatePhase;
  round: number;
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface DebateSummary {
  strongestArguments: Array<{ agentName: string; argument: string }>;
  commonGround: string[];
  openQuestions: string[];
  decisionFramework: string;
}

export interface DebateResult {
  topic: string;
  messages: AgoraMessage[];
  summary: DebateSummary;
  usage: ModelUsage[];
}
