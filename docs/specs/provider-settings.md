> Last verified: 2026-10-23 at commit 7647a3f

# Provider Settings Specification

## Scope and reason for a separate spec

This flow accepts and rotates optional model and transcript-provider credentials without putting complete credentials in the web bundle, browser storage, or API responses. It spans environment precedence, JSON settings persistence, validation, provider construction, and request-stable runtime snapshots. See `apps/api/src/provider-settings.ts`, `apps/api/src/provider-registry.ts`, `apps/api/src/app.ts`, and [ADR 0001](../adr/0001-server-side-provider-settings.md).

## Entry points and data flow

1. `apps/api/src/server.ts` loads environment configuration and calls `ProviderSettingsService.bootstrap` before constructing the app.
2. Environment-provided credentials take precedence and remain read-only through the settings API. Without an environment credential, the service loads the versioned settings file.
3. The settings UI sends a JSON `PUT` request. The API validates and verifies the candidate credential, constructs replacement providers, writes the settings file atomically, then swaps the registry bundle.
4. An API request captures one immutable provider bundle. A provider change does not switch models halfway through an in-flight request.
5. The browser receives configuration status and a short key hint, never the complete stored credential.

Evidence: `apps/api/src/server.ts`, `apps/api/src/provider-settings.ts`, `apps/api/src/provider-registry.ts`, `apps/api/src/app.ts`, and `apps/web/src/lib/useProviderSettings.ts`.

## Contracts and invariants

- Provider writes use authenticated JSON `PUT` and `DELETE` routes and return no-store responses.
- A failed credential verification or settings write leaves the previously active provider bundle in place.
- The settings file uses atomic replacement and restrictive file permissions. Docker stores it in an API-only named volume.
- Provider cost and speech character ledgers are shared across provider bundle swaps but remain process-local.
- Environment credentials override stored values and cannot be changed or deleted through the settings UI.

Evidence: `apps/api/src/app.ts`, `apps/api/src/provider-settings.ts`, `apps/api/src/provider-registry.ts`, `packages/core/src/budget.ts`, and `docs/ARCHITECTURE.md`.

## Extension playbook

1. Add new provider configuration to `apps/api/src/config.ts` and the versioned settings schema in `apps/api/src/provider-settings.ts`.
2. Implement provider creation in `apps/api/src/provider-registry.ts` and preserve validation-before-persist, atomic write, and request snapshot ordering.
3. Update the provider settings routes and browser form without storing complete credentials in browser state.
4. Run `npm run check` from the repository root. Provider setup coverage is in `apps/api/test/provider-settings.test.ts` and `apps/api/test/app.test.ts`.

## Limits and open questions

- The settings file is not encrypted. Host account or Docker administrators can read it; this is documented in `docs/THREAT_MODEL.md` and ADR 0001.
- A credential retention period beyond deletion or volume removal is Unknown (not found in repository).
