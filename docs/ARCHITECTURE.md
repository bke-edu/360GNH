# Architecture

## Design goals

360GNH keeps the knowledge workflow reusable without tying it to one web framework, database, tenant model, or AI provider.

The main boundaries are:

- `packages/core`: immutable domain values, chunking, retrieval, learning artifacts, debate orchestration, model and repository ports;
- `apps/api`: HTTP validation, loopback/network safety, authentication hook, rate limits, quiz answer custody, and provider configuration;
- `apps/web`: React interface styled with Tailwind utilities;
- `evals` and `packages/core/scripts/eval.ts`: deterministic capability checks.

## Request flow

1. A caller submits plain text or timestamped transcript segments, or asks the dedicated adapter to import one canonical YouTube video.
2. `KnowledgeStudio.ingest` normalizes bounded input and rejects malformed URLs or timestamps. YouTube import preserves `rawText`, language metadata, and timestamped segments.
3. The repository stores the source and lexical chunks. The `0.1.x` adapter is process-local memory.
4. Transcript editing runs only after a separate request, keeps the raw text immutable, replaces the active searchable text with the edited version, and records provider, cost, and length-ratio evidence.
5. A capability retrieves relevant chunks with local BM25 scoring.
6. Retrieved text is escaped, delimited, and marked as untrusted before a model sees it.
7. The selected `KnowledgeModel` returns a typed draft.
8. Domain validation normalizes the draft and the API removes trusted-only fields such as quiz answers.
9. The web app renders the artifact and a separate evidence rail.

Audiobook rendering is a parallel reuse path: the API selects the edited text when available, reserves the whole job against a process-local character budget, splits at safe sentence boundaries, calls the speech provider sequentially, validates compatible WAV chunks, and returns one merged file.

## Ports

### `KnowledgeRepository`

The core depends on a small repository interface rather than a database client. A future persistent adapter must preserve cloning/immutability behavior and tenant boundaries; merely implementing the TypeScript methods is not enough for public hosting.

### `KnowledgeModel`

The model interface covers transcript editing, answers, mind maps, quizzes, study guides, debate turns, and debate synthesis.

- `MockKnowledgeModel` is deterministic, local, free, and used by tests and the default demo.
- `OpenAIKnowledgeModel` uses the Responses API, runtime schema validation, `store: false`, bounded transient retries, and cost reservation.

Provider-specific response objects never cross into the domain API.

### Runtime provider settings

`ProviderSettingsService` owns the single-user provider configuration boundary. Environment variables have highest precedence and are read-only from the web interface. When no environment key exists, the service reads and atomically writes a versioned JSON file with mode `0600`. Docker mounts that file's directory from a named volume visible only to the API container.

`ProviderRegistry` implements the stable `KnowledgeModel` port and delegates each HTTP operation to one immutable provider-bundle snapshot. Saving a key first verifies credentials, constructs the affected candidate providers, writes the settings atomically, and then swaps the registry reference. Failed verification or storage leaves the prior bundle active; work already in flight finishes on the bundle it started with. Shared process-level usage ledgers survive provider swaps, so rotating Supadata or OpenAI cannot reset model or speech spending. OpenAI verification reads model metadata without generating content; this confirms key validity and model visibility, not endpoint-specific generation permission. Supadata verification checks a deliberately absent job identifier because documented job-status checks do not consume transcript credits.

The browser receives only provider state, configuration values that are not secret, and a four-character key hint. It never receives a stored key. See [ADR 0001](adr/0001-server-side-provider-settings.md).

### `YouTubeTranscriptProvider`

The core accepts a provider-neutral transcript port. The public API adapter uses Supadata's native-caption mode through a fixed provider endpoint, supports immediate and asynchronous job responses, and treats YouTube oEmbed metadata as optional. The adapter never receives raw credentials in a URL and cannot be redirected to an arbitrary host by the caller.

### `SpeechProvider`

The core speech port returns WAV bytes for one bounded text chunk. `AudiobookRenderer` owns splitting, sequential composition, format validation, and process-local character accounting. The current API adapter uses OpenAI speech; provider keys never enter the browser bundle.

## Retrieval

The first public release uses BM25 over normalized Unicode-friendly tokens. This choice keeps the bilingual demo inspectable and avoids an embedding service or hidden index. The repository port allows a later hybrid or vector adapter without changing learning-capability interfaces.

Timestamped transcript chunks preserve the earliest and latest segment boundaries. Citations can therefore become time links for supported video hosts without guessing from generated prose.

## Debate orchestration

Agora runs two phases:

1. exploration: each selected perspective states its strongest source-grounded view;
2. collision: each perspective responds to prior arguments before a separate synthesis.

Agent identifiers are unique and bounded. The orchestrator remains sequential in `0.1.x` so cost and transcript order are predictable.

## Non-goals for `0.1.x`

- public multi-user hosting;
- persistent source and project storage;
- file upload or arbitrary URL fetching;
- tenant authentication and authorization;
- background jobs, queues, or distributed cost accounting;
- playlist import, bulk download, or batch audiobook production;
- Study Groups or other modules from the originating private product.
