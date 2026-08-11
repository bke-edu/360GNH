# Security policy

## Supported versions

Until the first stable release, security fixes target the latest `0.1.x` release and the default branch.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Please do not publish an exploit, credential, private source text, or personal data in a public issue.

Include:

- the affected version or commit;
- the smallest reproduction that does not contain private data;
- realistic impact and preconditions;
- any suggested mitigation.

The project is currently maintained by one person. Reports are acknowledged and handled on a best-effort basis; no response-time or bounty promise is made.

## Security boundaries in `0.1.x`

- The default server is local-only, in-memory, and single-process.
- `API_TOKEN` protects machine clients against accidental unauthenticated network exposure. It is not browser-safe user authentication or tenant isolation.
- Submitted URLs are stored as metadata and are never fetched by the server.
- The optional OpenAI adapter sends retrieved source text to OpenAI. It uses `store: false`, but operators remain responsible for checking whether their data may be sent to that provider.
- The configured cost budget is process-local. Multiple API replicas do not share one budget.
- Persistence, file upload, URL ingestion, and public multi-user hosting are out of scope and have not been security-reviewed.

See [Threat model](docs/THREAT_MODEL.md) for controls and known gaps.
