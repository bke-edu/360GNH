import { AsyncLocalStorage } from 'node:async_hooks';
import { AudiobookRenderer, AudiobookUsageBudget, UsageBudget } from '@360gnh/core';
import type {
  AnswerDraft,
  Citation,
  DebateTurnInput,
  KnowledgeModel,
  MindmapDraft,
  ModelContext,
  ModelResult,
  QuizDraft,
  StudyGuideDraft,
  TranscriptEditDraft,
  TranscriptEditInput,
  YouTubeTranscriptProvider,
} from '@360gnh/core';
import type { AgoraMessage, DebateSummary } from '@360gnh/core';
import type { RuntimeConfig } from './config.js';
import { createModel } from './model-factory.js';
import { OpenAISpeechProvider } from './openai-speech.js';
import { SupadataTranscriptProvider } from './supadata-transcript.js';

export interface RuntimeProviders {
  model: KnowledgeModel;
  youtubeTranscriptProvider?: YouTubeTranscriptProvider;
  audiobookRenderer?: AudiobookRenderer;
}

export interface RuntimeProviderUsage {
  knowledge: UsageBudget;
  audiobook: AudiobookUsageBudget;
}

export type KnowledgeAndSpeechProviders = Pick<RuntimeProviders, 'model' | 'audiobookRenderer'>;

export function createRuntimeProviderUsage(config: RuntimeConfig): RuntimeProviderUsage {
  return {
    knowledge: new UsageBudget(config.aiBudgetUsd),
    audiobook: new AudiobookUsageBudget(config.audiobookSessionCharacterBudget),
  };
}

export function createKnowledgeAndSpeechProviders(
  config: RuntimeConfig,
  usage: RuntimeProviderUsage = createRuntimeProviderUsage(config),
): KnowledgeAndSpeechProviders {
  const model = createModel(config, usage.knowledge);
  const audiobookRenderer = config.openaiApiKey
    ? new AudiobookRenderer(
        new OpenAISpeechProvider({
          apiKey: config.openaiApiKey,
          model: config.openaiTtsModel,
        }),
        {
          maxBookCharacters: config.audiobookMaxCharacters,
          maxSessionCharacters: config.audiobookSessionCharacterBudget,
          usageBudget: usage.audiobook,
        },
      )
    : undefined;

  return {
    model,
    ...(audiobookRenderer ? { audiobookRenderer } : {}),
  };
}

export function createYouTubeTranscriptProvider(
  config: RuntimeConfig,
): YouTubeTranscriptProvider | undefined {
  return config.supadataApiKey
    ? new SupadataTranscriptProvider({ apiKey: config.supadataApiKey })
    : undefined;
}

export function createRuntimeProviders(
  config: RuntimeConfig,
  usage: RuntimeProviderUsage = createRuntimeProviderUsage(config),
): RuntimeProviders {
  const knowledgeAndSpeech = createKnowledgeAndSpeechProviders(config, usage);
  const youtubeTranscriptProvider = createYouTubeTranscriptProvider(config);
  return {
    ...knowledgeAndSpeech,
    ...(youtubeTranscriptProvider ? { youtubeTranscriptProvider } : {}),
  };
}

/**
 * Keeps the domain's model port stable while provider clients are replaced atomically.
 * A request already in flight finishes on the provider instance it started with.
 */
export class ProviderRegistry implements KnowledgeModel {
  #runtime: RuntimeProviders;
  readonly #requestRuntime = new AsyncLocalStorage<RuntimeProviders>();

  constructor(runtime: RuntimeProviders) {
    this.#runtime = runtime;
  }

  get provider(): string {
    return this.#activeRuntime().model.provider;
  }

  get model(): string {
    return this.#activeRuntime().model.model;
  }

  get youtubeTranscriptProvider(): YouTubeTranscriptProvider | undefined {
    return this.#activeRuntime().youtubeTranscriptProvider;
  }

  get audiobookRenderer(): AudiobookRenderer | undefined {
    return this.#activeRuntime().audiobookRenderer;
  }

  withSnapshot<T>(operation: () => T): T {
    return this.#requestRuntime.run(this.#runtime, operation);
  }

  replace(runtime: RuntimeProviders): void {
    this.#runtime = runtime;
  }

  replaceKnowledgeAndSpeech(runtime: KnowledgeAndSpeechProviders): void {
    const youtubeTranscriptProvider = this.#runtime.youtubeTranscriptProvider;
    this.#runtime = {
      ...runtime,
      ...(youtubeTranscriptProvider ? { youtubeTranscriptProvider } : {}),
    };
  }

  replaceYouTubeTranscriptProvider(provider: YouTubeTranscriptProvider | undefined): void {
    const { model, audiobookRenderer } = this.#runtime;
    this.#runtime = {
      model,
      ...(provider ? { youtubeTranscriptProvider: provider } : {}),
      ...(audiobookRenderer ? { audiobookRenderer } : {}),
    };
  }

  answer(context: ModelContext): Promise<ModelResult<AnswerDraft>> {
    return this.#activeRuntime().model.answer(context);
  }

  generateMindmap(context: ModelContext): Promise<ModelResult<MindmapDraft>> {
    return this.#activeRuntime().model.generateMindmap(context);
  }

  generateQuiz(context: ModelContext, count: number): Promise<ModelResult<QuizDraft>> {
    return this.#activeRuntime().model.generateQuiz(context, count);
  }

  generateStudyGuide(context: ModelContext): Promise<ModelResult<StudyGuideDraft>> {
    return this.#activeRuntime().model.generateStudyGuide(context);
  }

  editTranscript(input: TranscriptEditInput): Promise<ModelResult<TranscriptEditDraft>> {
    return this.#activeRuntime().model.editTranscript(input);
  }

  debateTurn(
    input: DebateTurnInput,
  ): Promise<ModelResult<{ content: string; citationIndexes: number[] }>> {
    return this.#activeRuntime().model.debateTurn(input);
  }

  synthesizeDebate(
    topic: string,
    transcript: AgoraMessage[],
    citations: Citation[],
  ): Promise<ModelResult<DebateSummary>> {
    return this.#activeRuntime().model.synthesizeDebate(topic, transcript, citations);
  }

  #activeRuntime(): RuntimeProviders {
    return this.#requestRuntime.getStore() ?? this.#runtime;
  }
}
