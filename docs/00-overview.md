> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Overview

## Purpose

360GNH is a provider-neutral TypeScript service and local web demo for turning one source, especially a YouTube transcript, into cited answers and learning materials. The bilingual interface supports English and Vietnamese. See the existing [README](../README.md), [architecture](ARCHITECTURE.md), and [provenance record](PROVENANCE.md).

## Repository type and stack

| Area                     | Evidence-based value                                       | Source                                                           |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Type                     | `service` with a domain package, HTTP API, and browser app | `package.json`, `apps/api/package.json`, `apps/web/package.json` |
| Runtime                  | Node.js `>=20`; browser app built with React               | `package.json`, `apps/web/package.json`                          |
| Package and build tool   | npm workspaces, TypeScript, Vite                           | `package.json`, `tsconfig.base.json`, `apps/web/vite.config.ts`  |
| API entry point          | `apps/api/src/server.ts`                                   | `apps/api/package.json`                                          |
| Core package entry point | `packages/core/src/index.ts`                               | `packages/core/package.json`                                     |
| Web entry point          | `apps/web/src/main.tsx`                                    | `apps/web/index.html`                                            |

## Repository shape

| Path                            | Responsibility                                                                                           | Evidence                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/core/`                | Provider-neutral domain types, ingestion, retrieval, artifacts, and model or repository ports            | `packages/core/src/index.ts`, `packages/core/src/studio.ts`   |
| `apps/api/`                     | Express adapter, validation, provider setup, transcript import, speech, and volatile quiz answer custody | `apps/api/src/server.ts`, `apps/api/src/app.ts`               |
| `apps/web/`                     | Bilingual React application and HTTP client                                                              | `apps/web/src/main.tsx`, `apps/web/src/lib/api.ts`            |
| `docs/`                         | Owner-authored architecture, API, threat model, roadmap, provenance, legal, and profile documentation    | `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/THREAT_MODEL.md` |
| `packages/core/scripts/eval.ts` | Deterministic capability evaluation using the local model                                                | `package.json`, `packages/core/scripts/eval.ts`               |

## Main flow

1. The browser or local API caller submits text, or sends one public YouTube video URL to the import route.
2. The API validates the request. The core canonicalizes a YouTube video URL, obtains native captions through the optional Supadata adapter, and preserves raw text and timestamps.
3. `KnowledgeStudio` normalizes the source, divides it into searchable chunks, and stores it through the repository port. The current adapter stores sources and chunks in process memory.
4. An explicit edit may create a clean searchable transcript while retaining the raw transcript and edit statistics.
5. The core retrieves relevant chunks with local BM25 scoring and asks the selected model to produce an artifact. Citations come from retrieved chunks.
6. The API returns learner-safe quiz data, while answer material stays in the API process until grading. Optional speech renders one source as one WAV response.

See [architecture](01-architecture.md), [API contract](02-api.md), and the existing [HTTP API reference](API.md).

## Fast start

- Prepare: `npm ci`.
- Run locally: `npm run dev`.
- Check: `npm run check` and `npm run eval`.

These commands are defined in the root `package.json` and existing [contribution guide](../CONTRIBUTING.md). The default model and fixture need no provider account.

## Three biggest traps

1. Sources and quizzes are process-local and disappear when the API restarts. Provider settings use a separate persistent path. See `packages/core/src/repository.ts`, `apps/api/src/app.ts`, and `apps/api/src/provider-settings.ts`.
2. `API_TOKEN` is a machine-client boundary, not user authentication or tenant isolation. The owner-authored [threat model](THREAT_MODEL.md) says the demo is not ready for public multi-user hosting.
3. Quiz answers and explanations must remain on the trusted API side until grading. Retrieved source text is untrusted input to a model. See `packages/core/src/types.ts` and `docs/THREAT_MODEL.md`.

## Open questions

- The README describes release `0.1.0`, while the root and core package metadata and Git tag show `0.1.1`. Which status should the owner-facing README report?
- The owner identifies the hosted repository as `bke-edu/360GNH`, while existing package metadata and some legacy links identify another repository location. Should those legacy links be updated?
- Production deployment target and rollback procedure: Unknown (not found in repository). Is there an owner-approved target outside local development and Docker Compose?
