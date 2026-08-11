# Changelog

All notable changes will be documented here. The project follows [Semantic Versioning](https://semver.org/) after the first public release.

## [Unreleased]

### Added

- provider-neutral Knowledge Studio domain engine;
- deterministic local model and original Vietnamese fixture;
- cited answers, timestamped clips, mind maps, quizzes, study guides, and Agora debates;
- Express API and responsive React/Tailwind demo;
- optional OpenAI Responses adapter with schema validation and cost reservations;
- tests, deterministic eval, security/provenance documentation, and public-project CI files.

### Security

- source text is bounded, normalized, escaped, and marked untrusted before model use;
- learner-facing quiz responses omit answer material until grading;
- non-loopback API binds require a machine token;
- submitted URLs are never fetched by the server.

[Unreleased]: https://github.com/nguyenduyhung1989/360GNH/commits/main
