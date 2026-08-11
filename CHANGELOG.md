# Changelog

All notable changes will be documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- hardened API and web container images plus a loopback-only Docker Compose stack that restarts with Docker;
- an environment-safe startup helper that can reuse a private key file without copying it into the repository.
- a bilingual first-run provider setup that verifies, stores, rotates, and removes OpenAI and Supadata keys without exposing them to the browser bundle;
- a private API-only Docker volume and atomic `0600` settings file for provider credentials, with environment variables remaining read-only overrides.

## [0.1.1] - 2026-08-11

### Security

- restrict YouTube timestamp links to an explicit host allowlist so lookalike domains remain untouched.

## [0.1.0] - 2026-08-11

### Added

- provider-neutral Knowledge Studio domain engine;
- deterministic local model and original bilingual Vietnamese-English fixture;
- cited answers, timestamped clips, mind maps, quizzes, study guides, and Agora debates;
- Express API and responsive React/Tailwind demo;
- optional OpenAI Responses adapter with schema validation and cost reservations;
- single-video YouTube transcript import through Supadata, preserving raw text and timestamps;
- explicit transcript editing with re-indexing and suspicious-length warnings;
- single-file OpenAI speech rendering with sentence-aware splitting, WAV validation, and character budgets;
- Paper & Ink React interface with light/dark themes and eight focused tools;
- complete Vietnamese-English interface with browser-language detection, persisted choice, localized errors, and query-language model output;
- tests, deterministic eval, security/provenance documentation, and public-project CI files.

### Security

- source text is bounded, normalized, escaped, and marked untrusted before model use;
- learner-facing quiz responses omit answer material until grading;
- non-loopback API binds require a machine token;
- ordinary source URLs remain metadata; the dedicated YouTube route is restricted to canonical video IDs and fixed provider endpoints;
- expensive media operations have a separate rate limit, server-only keys, and no playlist or bulk-download route.

[Unreleased]: https://github.com/nguyenduyhung1989/360GNH/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/nguyenduyhung1989/360GNH/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nguyenduyhung1989/360GNH/releases/tag/v0.1.0
