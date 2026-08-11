import 'dotenv/config';
import { createApp, createDefaultStudio } from './app.js';
import { loadConfig } from './config.js';
import { ProviderSettingsService } from './provider-settings.js';

const config = loadConfig();
const providerSettings = await ProviderSettingsService.bootstrap(config);
const studio = createDefaultStudio(providerSettings.registry);
const app = createApp({
  studio,
  providerSettings,
  providerRegistry: providerSettings.registry,
  ...(config.apiToken ? { apiToken: config.apiToken } : {}),
  webOrigins: config.webOrigins,
  youtubeTranscriptProvider: () => providerSettings.registry.youtubeTranscriptProvider,
  audiobookRenderer: () => providerSettings.registry.audiobookRenderer,
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `360GNH API listening on http://${config.host}:${config.port} (${providerSettings.registry.provider}/${providerSettings.registry.model})`,
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
