import 'dotenv/config';
import { createApp, createDefaultStudio } from './app.js';
import { loadConfig } from './config.js';
import { createModel } from './model-factory.js';

const config = loadConfig();
const model = createModel(config);
const studio = createDefaultStudio(model);
const app = createApp({
  studio,
  ...(config.apiToken ? { apiToken: config.apiToken } : {}),
  webOrigins: config.webOrigins,
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
