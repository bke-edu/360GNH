> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Interfaces

## Scope

This repository provides the core TypeScript package, an Express JSON API, and a bilingual browser application. The existing [HTTP API reference](API.md) is the canonical route and payload list. The browser API client is in `apps/web/src/lib/api.ts`; route registration and validation are in `apps/api/src/app.ts`.

## Interfaces provided

| Kind and path or name | Inputs and protected shape | Auth or access | Consumers | Evidence |
|---|---|---|---|---|
| HTTP health and metadata: `/health`, `/api/v1/meta` | Health state and active model or feature metadata | Global API middleware; local deployment uses the configured server boundary | Web app and local operators | `apps/api/src/app.ts`, `docs/API.md` |
| Provider settings: `/api/v1/settings/providers` and provider-specific `PUT` or `DELETE` routes | JSON settings requests; complete credentials are never returned, and responses are not cached | Bearer check when configured; exact-origin CORS; separate rate limit | Settings UI and local API callers | `apps/api/src/app.ts`, `apps/api/src/provider-settings.ts` |
| Source and transcript routes: `/api/v1/sources`, `/api/v1/youtube/import`, and `/api/v1/sources/:id/edit` | Bounded text, source identifiers, one canonical public video URL, optional language, and transcript segments | Same API boundary; expensive import and editing operations have a stricter rate limit | Web app and local API callers | `apps/api/src/app.ts`, `packages/core/src/studio.ts` |
| Learning routes: chat, mind map, quiz, grading, study guide, clips, and debate under `/api/v1/` | Validated queries and source identifiers; learner quiz responses omit answer material until grading | Same API boundary | Web app and local API callers | `apps/api/src/app.ts`, `packages/core/src/types.ts`, `docs/API.md` |
| Single audiobook render: `/api/v1/audiobooks/render` | One source, one voice and style, bounded text, and one WAV response | Same API boundary; expensive-operation limit and process-local character budget | Web app | `apps/api/src/app.ts`, `packages/core/src/audiobook.ts` |
| Core package: `@360gnh/core` | Provider-neutral TypeScript types and domain operations | Imported as an npm workspace package | API and deterministic eval | `packages/core/package.json`, `packages/core/src/index.ts` |
| Browser application | React SPA and bilingual interface; calls the HTTP API | Served locally by Vite or the Nginx container | Local operator's browser | `apps/web/src/main.tsx`, `apps/web/src/lib/api.ts`, `apps/web/nginx.conf.template` |

`API_TOKEN` is a machine-client credential, not user login or tenant authorization. Configuration rejects a non-loopback bind without it. The web bundle does not contain the token; the local Nginx proxy adds it to API requests. See `apps/api/src/config.ts` and `apps/web/nginx.conf.template`.

## Interfaces consumed

| Provider | Kind and path or name | Data used | Failure behavior | Evidence |
|---|---|---|---|---|
| OpenAI | Responses API | Retrieved source context and task input when the OpenAI knowledge model is active | Schema validation and bounded transient retries; errors are normalized | `packages/core/src/providers/openai-model.ts`, `docs/ARCHITECTURE.md` |
| OpenAI | Speech API | Selected source text after an explicit one-file render action | Provider errors are mapped to public error codes; WAV chunks are validated | `apps/api/src/openai-speech.ts`, `packages/core/src/audiobook.ts` |
| Supadata | Transcript API | A canonical public YouTube video URL and optional language | Immediate and queued jobs are supported; timeout or malformed results become provider errors | `apps/api/src/supadata-transcript.ts` |
| YouTube | oEmbed metadata endpoint | Canonical public video URL for title, author, and thumbnail metadata | Metadata failure is optional and does not block a transcript result | `apps/api/src/supadata-transcript.ts` |

Core itself has no network provider dependency. The adapters use fixed provider destinations; ordinary source URLs remain metadata. The [YouTube import specification](specs/youtube-transcript-import.md) describes the boundary.

## Compatibility and errors

- JSON endpoints return a `data` envelope or an `error` object with `code` and `message`; speech rendering returns `audio/wav`.
- Requests are validated with Zod schemas, JSON bodies are capped, and source and query sizes are bounded. The full limits and route shapes are recorded in `docs/API.md` and `apps/api/src/app.ts`.
- Provider status exposes configuration state and at most a short key hint. Failed provider verification does not replace the active settings bundle.
- Quiz grading uses the server-held quiz by ID. Do not add answer or explanation fields to pre-grading browser payloads.

## Explicitly not applicable

The core package does not expose a database protocol or a provider-specific model protocol. Its repository and model ports are internal TypeScript interfaces; see `packages/core/src/repository.ts` and `packages/core/src/model.ts`.

## Open questions

- External runtime API consumers beyond the in-repository web app: Unknown (not found in repository).
