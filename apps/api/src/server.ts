import 'dotenv/config';
import { AudiobookRenderer } from '@360gnh/core';
import { createApp, createDefaultStudio } from './app.js';
import { loadConfig } from './config.js';
import { createModel } from './model-factory.js';
import { OpenAISpeechProvider } from './openai-speech.js';
import { SupadataTranscriptProvider } from './supadata-transcript.js';

const config = loadConfig();
const model = createModel(config);
const studio = createDefaultStudio(model);
const youtubeTranscriptProvider = config.supadataApiKey
  ? new SupadataTranscriptProvider({ apiKey: config.supadataApiKey })
  : undefined;
const audiobookRenderer = config.openaiApiKey
  ? new AudiobookRenderer(
      new OpenAISpeechProvider({
        apiKey: config.openaiApiKey,
        model: config.openaiTtsModel,
      }),
      {
        maxBookCharacters: config.audiobookMaxCharacters,
        maxSessionCharacters: config.audiobookSessionCharacterBudget,
      },
    )
  : undefined;
const app = createApp({
  studio,
  ...(config.apiToken ? { apiToken: config.apiToken } : {}),
  webOrigins: config.webOrigins,
  ...(youtubeTranscriptProvider ? { youtubeTranscriptProvider } : {}),
  ...(audiobookRenderer ? { audiobookRenderer } : {}),
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `360GNH API listening on http://${config.host}:${config.port} (${model.provider}/${model.model})`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close((error) => {
      if (error) {
        console.error('Failed to stop HTTP server cleanly:', error.message);
        process.exitCode = 1;
      }
    });
  });
}
