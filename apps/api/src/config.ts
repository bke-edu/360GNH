import { z } from 'zod';

const EnvironmentSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4310),
  WEB_ORIGIN: z.string().default('http://127.0.0.1:4311'),
  API_TOKEN: z.string().optional(),
  AI_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.6-luna'),
  AI_BUDGET_USD: z.coerce.number().min(0).max(10_000).default(1),
  OPENAI_INPUT_USD_PER_MTOK: z.coerce.number().min(0).optional(),
  OPENAI_OUTPUT_USD_PER_MTOK: z.coerce.number().min(0).optional(),
});

export interface RuntimeConfig {
  host: string;
  port: number;
  webOrigins: string[];
  apiToken?: string;
  aiProvider: 'mock' | 'openai';
  openaiApiKey?: string;
  openaiModel: string;
  aiBudgetUsd: number;
  openaiInputUsdPerMillion?: number;
  openaiOutputUsdPerMillion?: number;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = EnvironmentSchema.parse(environment);
  const config: RuntimeConfig = {
    host: parsed.HOST,
    port: parsed.PORT,
    webOrigins: parsed.WEB_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(parsed.API_TOKEN?.trim() ? { apiToken: parsed.API_TOKEN.trim() } : {}),
    aiProvider: parsed.AI_PROVIDER,
    ...(parsed.OPENAI_API_KEY?.trim() ? { openaiApiKey: parsed.OPENAI_API_KEY.trim() } : {}),
    openaiModel: parsed.OPENAI_MODEL,
    aiBudgetUsd: parsed.AI_BUDGET_USD,
    ...(parsed.OPENAI_INPUT_USD_PER_MTOK === undefined
      ? {}
      : { openaiInputUsdPerMillion: parsed.OPENAI_INPUT_USD_PER_MTOK }),
    ...(parsed.OPENAI_OUTPUT_USD_PER_MTOK === undefined
      ? {}
      : { openaiOutputUsdPerMillion: parsed.OPENAI_OUTPUT_USD_PER_MTOK }),
  };

  if (!isLoopback(config.host) && !config.apiToken) {
    throw new Error('API_TOKEN is required when HOST is not a loopback address');
  }
  if (config.aiProvider === 'openai' && !config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
  }
  return config;
}

function isLoopback(host: string): boolean {
  return ['127.0.0.1', '::1', 'localhost'].includes(host.toLocaleLowerCase('en'));
}
