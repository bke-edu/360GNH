# Architecture

## Design goals

360GNH keeps the knowledge workflow reusable without tying it to one web framework, database, tenant model, or AI provider.

The main boundaries are:

- `packages/core`: immutable domain values, chunking, retrieval, learning artifacts, debate orchestration, model and repository ports;
- `apps/api`: HTTP validation, loopback/network safety, authentication hook, rate limits, quiz answer custody, and provider configuration;
- `apps/web`: React interface styled with Tailwind utilities;
- `evals` and `packages/core/scripts/eval.ts`: deterministic capability checks.

## Request flow

1. A caller submits plain text or timestamped transcript segments.
2. `KnowledgeStudio.ingest` normalizes bounded input and rejects malformed URLs or timestamps.
3. The repository stores the source and lexical chunks. The `0.1.x` adapter is process-local memory.
4. A capability retrieves relevant chunks with local BM25 scoring.
5. Retrieved text is escaped, delimited, and marked as untrusted before a model sees it.
6. The selected `KnowledgeModel` returns a typed draft.
7. Domain validation normalizes the draft and the API removes trusted-only fields such as quiz answers.
8. The web app renders the artifact and a separate evidence rail.

## Ports

### `KnowledgeRepository`

The core depends on a small repository interface rather than a database client. A future persistent adapter must preserve cloning/immutability behavior and tenant boundaries; merely implementing the TypeScript methods is not enough for public hosting.

### `KnowledgeModel`

The model interface covers answers, mind maps, quizzes, study guides, debate turns, and debate synthesis.

- `MockKnowledgeModel` is deterministic, local, free, and used by tests and the default demo.
- `OpenAIKnowledgeModel` uses the Responses API, runtime schema validation, `store: false`, bounded transient retries, and cost reservation.

Provider-specific response objects never cross into the domain API.

## Retrieval

The first public release uses BM25 over normalized Vietnamese-friendly tokens. This choice keeps the demo inspectable and avoids an embedding service or hidden index. The repository port allows a later hybrid or vector adapter without changing learning-capability interfaces.

Timestamped transcript chunks preserve the earliest and latest segment boundaries. Citations can therefore become time links for supported video hosts without guessing from generated prose.

## Debate orchestration

Agora runs two phases:

1. exploration: each selected perspective states its strongest source-grounded view;
2. collision: each perspective responds to prior arguments before a separate synthesis.

Agent identifiers are unique and bounded. The orchestrator remains sequential in `0.1.x` so cost and transcript order are predictable.

## Non-goals for `0.1.x`

- public multi-user hosting;
- persistent storage;
- file or URL fetching;
- tenant authentication and authorization;
- background jobs, queues, or distributed cost accounting;
- Study Groups or other modules from the originating private product.
