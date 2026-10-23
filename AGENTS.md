> Last verified: 2026-10-23 at commit 7647a3f

# Repository working agreement

## Scope

This repository contains only the standalone Knowledge Studio engine, API, web demo, tests, evals, and public documentation.

- Do not copy Study Groups into this repository. It is intentionally deferred until separately stabilized and reviewed.
- Do not add tenant-specific code from the originating private product, customer data, private schemas, production configuration, credentials, playlist/bulk downloaders, or batch audiobook-production pipelines. The public single-video import and single-file speech ports are in scope.
- Every imported idea must be provider-neutral and documented in `docs/PROVENANCE.md`.

## Change discipline

- Search for an existing pattern before adding an abstraction or dependency.
- Keep domain logic in `packages/core`; adapters belong in `apps/api` or another explicit adapter package.
- Keep the default demo functional without any API key.
- Preserve the learner-facing quiz boundary: answers must not leave the trusted process before grading.
- Treat retrieved source text as untrusted model input and preserve both model-cost and speech-character reservation boundaries.

## Web interface

- Use Tailwind utilities for all styling that Tailwind can express.
- Add raw CSS only when a required behavior cannot be represented by Tailwind, and document the reason beside it.
- `apps/web/src/styles.css` is limited to the Tailwind import and design-token declarations unless an exception is justified.
- Verify responsive behavior at 320, 768, and 1440 CSS pixels with no horizontal overflow.

## Verification

Run the smallest relevant check while editing. Before a release candidate or push, run:

```bash
npm run check
npm run eval
npm audit --audit-level=high
```

Never commit `.env`, secrets, generated coverage, build output, or user-provided source material.

## Repository profile

- Type: `service`, with the reusable TypeScript engine, HTTP adapter, and local web demo in one npm workspace.
- API entry point: `apps/api/src/server.ts`; core package entry point: `packages/core/src/index.ts`; web entry point: `apps/web/src/main.tsx`.
- Read [the repository overview](docs/00-overview.md) before broad changes. The seven profile documents start at [architecture](docs/01-architecture.md), [interfaces](docs/02-api.md), [data](docs/03-database.md), [deployment](docs/04-deployment.md), [security](docs/05-security.md), and [roadmap](docs/06-roadmap.md).
- Existing owner guides remain authoritative: [README](README.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [threat model](docs/THREAT_MODEL.md), [provenance](docs/PROVENANCE.md), and [roadmap](docs/ROADMAP.md).

## Dependency map

- `apps/api` calls the `@360gnh/core` domain package; `apps/web` calls the HTTP API; the deterministic eval constructs the core directly. See `apps/api/src/app.ts`, `apps/web/src/lib/api.ts`, and `packages/core/scripts/eval.ts`.
- Optional provider calls: OpenAI Responses and speech APIs, Supadata transcript API, and YouTube oEmbed metadata. Their adapters are in `packages/core/src/providers/` and `apps/api/src/`.
- External runtime consumers: Unknown (not found in repository). The repository's in-tree consumer is the web app; the API is also usable by local machine clients.
- Shared state: sources, chunks, quizzes, and usage budgets are process-local; provider settings may persist in an API-side settings file or Docker volume. See `packages/core/src/repository.ts`, `apps/api/src/app.ts`, and `apps/api/src/provider-settings.ts`.

## Change playbooks

### Change source or model contracts

1. Update the provider-neutral interfaces in `packages/core/src/types.ts`, `model.ts`, `repository.ts`, or `youtube.ts` as appropriate.
2. Update the API adapter and web types or calls that consume the changed contract.
3. Preserve raw transcript provenance, source citation boundaries, and quiz answer custody.
4. Run `npm run check` and `npm run eval`; update [interface documentation](docs/02-api.md) when an HTTP contract changes.

### Change provider setup or paid operations

1. Follow the provider registry and settings flow in `apps/api/src/provider-registry.ts` and `provider-settings.ts`.
2. Keep provider credentials server-side, preserve atomic settings replacement, and reserve process-local usage before paid work.
3. Update [provider settings specification](docs/specs/provider-settings.md) and the existing [ADR](docs/adr/0001-server-side-provider-settings.md) only when the implementation or recorded decision changes.
4. Run `npm run check`; run `npm run eval` when core behavior or model outputs change.

## Key decisions and gotchas

- The default model is deterministic and key-free. Provider adapters are optional and activated by server-side settings; see `apps/api/src/config.ts` and `docs/ARCHITECTURE.md`.
- Source and quiz state is in memory and is lost when the API process restarts. Provider settings have a separate persistence path.
- The API machine token is not user authentication or tenant isolation. Do not expose this single-user demo as a public multi-user service.
- Retrieved source text is untrusted model input. Learner-facing quiz responses must omit answers and explanations until grading.
- Speech and model usage limits are process-local. Multiple API replicas would not share one limit.
