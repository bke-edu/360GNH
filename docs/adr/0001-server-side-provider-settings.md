> Last verified: 2026-10-23 at commit 7647a3f

# ADR 0001: Server-side provider settings

**Date:** 2026-08-11
**Status:** accepted

## Context

The first public demo required operators to edit an environment file before using OpenAI, Supadata, or speech. That is safe but creates avoidable installation friction. A first-run interface needs to accept and rotate keys without placing them in the React bundle, browser storage, logs, or API responses. The current release is explicitly a loopback-bound, single-user application rather than a hosted tenant service.

## Decision

Add a bilingual provider-settings interface backed by authenticated, JSON-only API routes. Environment variables remain the highest-priority, read-only source. Otherwise, the API stores a versioned settings file with mode `0600` in an API-only Docker named volume. The file and every atomic-write temporary sibling are excluded from Git and Docker build contexts. New credentials are checked and the affected provider objects are constructed before the file is atomically replaced and `ProviderRegistry` swaps the active bundle.

Each HTTP request captures one immutable provider bundle so a multi-part transcript or debate cannot change model halfway through. Process-level model and speech usage ledgers are shared across bundles and therefore survive key or provider changes. The no-cost OpenAI check reads model metadata: it confirms key validity and model visibility, while endpoint-specific content-generation permission is deferred to the first real call and described honestly in the interface.

The file is not encrypted. The application documents that a user controlling the host account or Docker daemon can read the same secrets from either files or container configuration.

## Alternatives considered

### Keep environment files only

- Simple and conventional for operators.
- Rejected as the only path because it makes a local graphical application unnecessarily hard to install.

### Store keys in `localStorage` or a frontend environment variable

- Easy to implement.
- Rejected because browser scripts, extensions, cross-site scripting, and built assets could expose the keys.

### Encrypt the file with a key stored beside it

- Looks encrypted in screenshots.
- Rejected because it does not protect against any attacker who can read the volume.

### Integrate every operating-system credential vault now

- Stronger host-level secret handling.
- Deferred because Windows Credential Manager, macOS Keychain, and Linux Secret Service require separate native integration and container-host bridges. This remains a possible native-distribution adapter, not a blocker for the local Docker release.

## Consequences

### Positive

- A new user can configure providers from the product interface.
- Stored keys never enter the frontend bundle or persist in browser storage.
- Failed checks and failed writes preserve the last working provider bundle.
- Container restarts retain provider settings without copying a `.env` file into the repository.

### Negative and risks

- Host or Docker administrators can read the plaintext settings file.
- The design is unsuitable for public multi-user hosting.
- Environment credentials override but do not erase an older stored fallback; operators must remove that file deliberately if they do not want it to become active after removing the environment override.
- Provider budgets remain process-local and reset when the API process restarts; they are not distributed across replicas.
