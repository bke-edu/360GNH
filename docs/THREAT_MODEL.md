# Threat model

This document describes the implemented `0.1.x` local demo, not a hypothetical hosted product.

## Assets

- source text and transcript segments;
- OpenAI and Supadata API keys plus process-level text and speech budgets;
- quiz answer material before grading;
- integrity of citations and generated learning artifacts;
- maintainer and contributor trust in the public repository.

## Trust boundaries

1. browser or API caller → Express API;
2. API → core domain;
3. retrieved source text → model prompt;
4. optional transcript adapter → Supadata and YouTube oEmbed;
5. optional model and speech adapters → OpenAI;
6. dependency and pull-request supply chain → maintainer workstation and CI.

All submitted source text, URLs, titles, queries, and transcript segments are untrusted.

## Implemented controls

| Threat                               | Current control                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Accidental public API exposure       | Loopback bind by default; non-loopback bind fails without `API_TOKEN`                                                            |
| Browser token disclosure             | No API token is compiled into the web bundle                                                                                     |
| Oversized input and memory abuse     | Body, source, query, segment, quiz-count, and agent-count limits; API rate limit                                                 |
| Server-side request forgery          | Ordinary source URLs remain metadata; the import route canonicalizes YouTube IDs and calls only fixed Supadata/YouTube endpoints |
| Prompt injection through source text | Control/bidirectional cleanup, XML escaping, explicit untrusted-source delimiters, system instruction to ignore source commands  |
| Malformed model output               | Zod validation and bounded output fields                                                                                         |
| Concurrent API cost race             | Model cost and whole-book speech characters are reserved synchronously before paid calls                                         |
| Hidden quiz-answer leak              | A separate learner DTO strips answer and explanation fields until grading                                                        |
| Unbounded quiz memory                | One-hour expiry and 100-quiz cap per process                                                                                     |
| Responses data retention control     | The model adapter sets `store: false`; OpenAI remains an external data recipient                                                 |
| Accidental media cost amplification  | Expensive routes have a stricter limit; imports are single-video, speech is sequential and single-file, and no bulk route exists |
| Framework metadata exposure          | Express signature disabled; Helmet headers enabled                                                                               |

## Known gaps

- There is no user identity, authorization, tenant isolation, audit log, or persistent encrypted storage.
- `API_TOKEN` is one process-wide machine credential, not browser user authentication.
- Rate limits and cost budgets are not shared across replicas.
- Retrieval relevance does not prove factual truth; citations prove which source passage was used, not that the source is correct.
- Prompt-injection defenses reduce risk but cannot guarantee model compliance.
- There is no file parser or arbitrary URL-fetching surface. The dedicated YouTube path does make external requests, so expanding its host allowlist or adding file upload requires a new threat review.
- Supadata and OpenAI data handling is governed by the operator's accounts and their current terms. Transcript and speech calls do not use the Responses API `store: false` control; for Responses calls, that flag is not a promise that no provider-side security logging exists.

## Hosting gate

Do not expose this demo as a public multi-user service until authentication, per-user authorization, persistent data lifecycle, distributed rate/cost control, abuse handling, observability, and a fresh security review exist.
