> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Build and Deployment

## Prerequisites and configuration

| Name | Purpose | Required where | Evidence |
|---|---|---|---|
| `HOST`, `PORT`, `WEB_ORIGIN` | API bind, API port, and exact browser-origin allowlist | Local development or API container | `.env.example`, `apps/api/src/config.ts` |
| `API_TOKEN` | Machine-client authorization when configured; required for a non-loopback bind | API process; Compose requires it for the internal web proxy | `apps/api/src/config.ts`, `compose.yaml` |
| `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional knowledge model configuration | API process or provider settings UI | `.env.example`, `apps/api/src/config.ts` |
| `AI_BUDGET_USD`, `OPENAI_INPUT_USD_PER_MTOK`, `OPENAI_OUTPUT_USD_PER_MTOK` | Process-local model cost limit and explicit rates for unlisted models | API process | `.env.example`, `apps/api/src/config.ts`, `packages/core/src/budget.ts` |
| `SUPADATA_API_KEY` | Optional one-video transcript import | API process or provider settings UI | `.env.example`, `apps/api/src/config.ts` |
| `OPENAI_TTS_MODEL`, `AUDIOBOOK_MAX_CHARS`, `AUDIOBOOK_SESSION_CHAR_BUDGET` | Optional one-file speech model and process-local character limits | API process | `.env.example`, `apps/api/src/config.ts`, `packages/core/src/audiobook.ts` |
| `PROVIDER_SETTINGS_PATH` | Optional API-side settings file location; Compose uses an API-only named volume | API process | `.env.example`, `apps/api/src/config.ts`, `compose.yaml` |

Only variable names and storage roles are listed here. Keep actual credentials in a local environment or the API settings interface; never commit their values.

## Local build and run

```bash
npm ci
npm run dev
```

The web app is available at `http://localhost:4311`; the API uses port `4310`. These local defaults are documented in `README.md` and `apps/api/src/config.ts`.

For local container use, the existing README documents copying `.env.example` to `.env` and running `./scripts/docker-up.sh`. The helper can also take a path supplied by the operator. It creates a process token when none is already set and starts `docker compose up -d --build`; see `scripts/docker-up.sh` and `compose.yaml`.

## Delivery flow

- `npm run build` builds the core, API, and web workspaces.
- `npm run check` runs formatting, build, lint, and tests; `npm run eval` runs deterministic capability checks.
- GitHub Actions runs `npm ci --ignore-scripts`, `npm run check`, `npm run eval`, and a production dependency audit for pushes to `main` and pull requests. See `.github/workflows/ci.yml`.
- Docker Compose builds a separate API image and static web image. Its port mappings bind on the host loopback interface. This is local container configuration, not evidence of a production deployment.

## Health, rollback, and recovery

- Health check: the API exposes `GET /health`; Compose uses it for container health.
- Rollback: Unknown (not found in repository). No production release or rollback procedure is documented.
- Related runbook: none is present. Local startup and status commands are documented in `README.md`.

## Explicitly not applicable

No production host, production secret store, or production delivery pipeline is evidenced in this repository. The checked-in automation is CI verification and local Docker Compose.

## Open questions

- Is there an owner-approved production target outside the local development and Compose workflows? If so, its delivery and rollback procedure is Unknown (not found in repository).
