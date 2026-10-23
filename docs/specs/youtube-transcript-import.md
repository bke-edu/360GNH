> Last verified: 2026-10-23 at commit 7647a3f

# Single-Video YouTube Transcript Import Specification

## Scope and reason for a separate spec

This is the only external URL import path in the current product. It accepts one public YouTube video, obtains native captions through the optional Supadata adapter, and preserves raw transcript text and timestamps for later editing and citations. See `packages/core/src/youtube.ts`, `packages/core/src/studio.ts`, and `apps/api/src/supadata-transcript.ts`.

## Entry points and data flow

1. The browser submits `url` and optional `language` to `POST /api/v1/youtube/import`.
2. The core accepts only supported public YouTube URL shapes and canonicalizes them to a watch URL with a video identifier.
3. The Supadata adapter requests native transcript content from its fixed API endpoint. It handles immediate content or polls a returned job until completion or timeout.
4. The adapter normalizes text and timestamped segments. YouTube oEmbed metadata is optional; failure to load it does not block transcript import.
5. `KnowledgeStudio.importYouTube` stores the transcript as both current text and `rawText`, with language and segment metadata, then chunks it for local retrieval.
6. Transcript editing is a separate explicit action. It retains `rawText`, makes the edited copy searchable, and records length and provider evidence.

Evidence: `apps/api/src/app.ts`, `apps/api/src/supadata-transcript.ts`, `packages/core/src/youtube.ts`, `packages/core/src/studio.ts`, and `packages/core/src/types.ts`.

## Contracts and invariants

- The import request selects one canonical public YouTube video and an optional transcript language.
- Arbitrary URLs remain source metadata and are not fetched by the normal ingestion path.
- The adapter sends requests only to fixed Supadata and YouTube oEmbed destinations; caller input cannot select a provider host.
- Transcript text and segments are bounded and validated before entering the repository.
- Raw transcript text remains available after explicit editing. Timestamped segments remain the basis for transcript-linked clips and citations.
- No playlist, bulk downloader, or batch import route exists in the repository.

Evidence: `packages/core/src/youtube.ts`, `packages/core/src/studio.ts`, `apps/api/src/supadata-transcript.ts`, `apps/api/src/app.ts`, `docs/API.md`, and `AGENTS.md`.

## Extension playbook

1. Keep URL parsing and canonicalization provider-neutral in `packages/core/src/youtube.ts`.
2. Keep provider-specific requests in `apps/api/src/`; do not allow caller-controlled hosts or credential-bearing URL parameters.
3. Preserve transcript language, raw text, and timestamps through `KnowledgeStudio` and update the interface documentation if request or response fields change.
4. Run `npm run check` from the repository root. Import adapter coverage is in `packages/core/test/media-workflows.test.ts` and `apps/api/test/media-adapters.test.ts`.

## Limits and open questions

- Import requires an optional configured transcript provider; the key-free demo remains usable with pasted text.
- Provider terms and data handling depend on the operator's current accounts. See `docs/LEGAL.md` and `SECURITY.md`.
