> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Security

## Controls evidenced in the repository

| Control | What it protects | Evidence |
|---|---|---|
| Loopback default and configuration guard for other binds | Reduces accidental network exposure; a non-loopback bind requires `API_TOKEN` | `apps/api/src/config.ts`, `docs/THREAT_MODEL.md` |
| Bearer comparison, exact-origin CORS, Helmet, request-size limit, and rate limits | API access, browser origin, common response headers, and request volume | `apps/api/src/app.ts` |
| Canonical YouTube video parsing and fixed provider destinations | Prevents ordinary source metadata from becoming arbitrary outbound requests | `packages/core/src/youtube.ts`, `apps/api/src/supadata-transcript.ts`, `docs/THREAT_MODEL.md` |
| Source cleanup and untrusted-context delimiting | Limits control characters and tells the model that retrieved text is untrusted input | `packages/core/src/security.ts`, `packages/core/src/providers/openai-model.ts` |
| Runtime schema validation and bounded inputs | Rejects malformed requests and provider output | `apps/api/src/app.ts`, `packages/core/src/providers/openai-model.ts` |
| Server-side quiz answer custody | Keeps answers and explanations out of learner payloads until grading | `apps/api/src/app.ts`, `packages/core/src/types.ts` |
| Provider keys stay on the API side | Keeps complete keys out of the browser bundle and API responses; settings writes are atomic and restrictive | `apps/api/src/provider-settings.ts`, `apps/api/src/app.ts`, `apps/web/src/lib/useProviderSettings.ts` |
| Model cost and speech character reservation | Reserves process-local budgets before paid operations | `packages/core/src/budget.ts`, `packages/core/src/audiobook.ts` |
| CI dependency audit | Checks production dependencies during repository CI | `.github/workflows/ci.yml` |

## Resolved security-relevant change

| Issue | Resolution | Evidence and date |
|---|---|---|
| YouTube timestamp links could be generated for lookalike hosts | Restrict links to an explicit host allowlist | `CHANGELOG.md` release `0.1.1`; `packages/core/src/citations.ts`; commit `f5a9517` |

The existing [threat model](THREAT_MODEL.md) and [security policy](../SECURITY.md) remain the detailed owner-authored references. Open exploitable findings are reported to the owner in chat and are not documented here.

## Safe verification

- `npm run check` runs formatting, builds, lint, and tests.
- `npm run eval` exercises the deterministic core workflow.
- `npm audit --omit=dev --audit-level=high` is the dependency audit used by CI. The root [working agreement](../AGENTS.md) specifies its release check separately.

These commands are defined by `package.json` and `.github/workflows/ci.yml`.

## Open questions

- A new public hosting mode would require a separate security review and documented user identity, authorization, storage lifecycle, and shared-budget design. The existing threat model explicitly limits this service to local single-user evaluation.
