# Threat model

This document describes the implemented `0.1.x` local demo, not a hypothetical hosted product.

## Assets

- source text and transcript segments;
- API keys and the process-level cost budget;
- quiz answer material before grading;
- integrity of citations and generated learning artifacts;
- maintainer and contributor trust in the public repository.

## Trust boundaries

1. browser or API caller → Express API;
2. API → core domain;
3. retrieved source text → model prompt;
4. optional OpenAI adapter → external provider;
5. dependency and pull-request supply chain → maintainer workstation and CI.

All submitted source text, URLs, titles, queries, and transcript segments are untrusted.

## Implemented controls

| Threat                               | Current control                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Accidental public API exposure       | Loopback bind by default; non-loopback bind fails without `API_TOKEN`                                                           |
| Browser token disclosure             | No API token is compiled into the web bundle                                                                                    |
| Oversized input and memory abuse     | Body, source, query, segment, quiz-count, and agent-count limits; API rate limit                                                |
| Server-side request forgery          | URLs are validated metadata and are never fetched                                                                               |
| Prompt injection through source text | Control/bidirectional cleanup, XML escaping, explicit untrusted-source delimiters, system instruction to ignore source commands |
| Malformed model output               | Zod validation and bounded output fields                                                                                        |
| Concurrent API cost race             | Conservative maximum cost is reserved synchronously before a model request                                                      |
| Hidden quiz-answer leak              | A separate learner DTO strips answer and explanation fields until grading                                                       |
| Unbounded quiz memory                | One-hour expiry and 100-quiz cap per process                                                                                    |
| Secret retention by OpenAI           | Adapter sets `store: false`; provider remains an external data recipient                                                        |
| Framework metadata exposure          | Express signature disabled; Helmet headers enabled                                                                              |

## Known gaps

- There is no user identity, authorization, tenant isolation, audit log, or persistent encrypted storage.
- `API_TOKEN` is one process-wide machine credential, not browser user authentication.
- Rate limits and cost budgets are not shared across replicas.
- Retrieval relevance does not prove factual truth; citations prove which source passage was used, not that the source is correct.
- Prompt-injection defenses reduce risk but cannot guarantee model compliance.
- There is no malware/file parser surface because file upload and URL fetching do not exist yet. Adding either requires a new threat review.
- OpenAI data handling is governed by the operator's account and OpenAI terms; `store: false` is not a promise that no provider-side security logging exists.

## Hosting gate

Do not expose this demo as a public multi-user service until authentication, per-user authorization, persistent data lifecycle, distributed rate/cost control, abuse handling, observability, and a fresh security review exist.
