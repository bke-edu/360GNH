# Roadmap

The roadmap is ordered by evidence and safety, not by feature count.

## `0.1` — inspectable vertical slice

- [x] provider-neutral domain package;
- [x] deterministic no-key model and original fixture;
- [x] cited answers, mind maps, quizzes, study guides, clips, and Agora debate;
- [x] responsive React/Tailwind demo;
- [x] optional OpenAI Responses adapter with validation and cost reservations;
- [x] tests, deterministic eval, threat model, provenance, and contribution docs;
- [ ] first public GitHub release and release notes;
- [ ] real outside-user feedback and documented adoption evidence.

## `0.2` — durable single-user projects

- persistent repository adapter with migrations and deletion semantics;
- import/export of a portable project bundle;
- hybrid retrieval benchmarked against the local BM25 baseline;
- citation-faithfulness and prompt-injection eval expansion;
- streaming only after cancellation and partial-result behavior is tested.

## `0.3` — extensibility

- documented provider adapter kit;
- optional embedding/vector adapter;
- pluggable transcript parsers with strict file and URL threat boundaries;
- reproducible model-routing and cost/quality reports.

## Deferred without a date

Study Groups is intentionally outside this repository until its separate implementation is stable, ownership-cleared, and reviewed as an independent public boundary. Public multi-user hosting is also deferred until identity, authorization, storage lifecycle, abuse controls, and distributed budgets exist.
