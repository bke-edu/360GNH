import { MockKnowledgeModel, OpenAIKnowledgeModel } from '@360gnh/core';
import type { KnowledgeModel, UsageBudget } from '@360gnh/core';
import type { RuntimeConfig } from './config.js';

export function createModel(config: RuntimeConfig, usageBudget?: UsageBudget): KnowledgeModel {
  if (config.aiProvider === 'mock') return new MockKnowledgeModel();
  if (!config.openaiApiKey) throw new Error('OpenAI API key is required');
  return new OpenAIKnowledgeModel({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
    budgetUsd: config.aiBudgetUsd,
    ...(usageBudget ? { usageBudget } : {}),
    ...(config.openaiInputUsdPerMillion === undefined
      ? {}
      : { inputUsdPerMillion: config.openaiInputUsdPerMillion }),
    ...(config.openaiOutputUsdPerMillion === undefined
      ? {}
      : { outputUsdPerMillion: config.openaiOutputUsdPerMillion }),
  });
}
