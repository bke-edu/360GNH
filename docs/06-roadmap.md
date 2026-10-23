> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Current State and Roadmap

## Current state

The current root and core package versions are `0.1.1`, and the repository has a `v0.1.1` tag. The default model is deterministic and local. Optional provider settings enable OpenAI knowledge or speech operations and Supadata transcript import. The API and browser app are in one npm workspace. Evidence: `package.json`, `packages/core/package.json`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, and `CHANGELOG.md`.

The owner-authored [roadmap](ROADMAP.md) has completed the initial `0.1` vertical slice and lists proposed `0.2` and `0.3` work. These plans remain owner-authored and are not reprioritized here.

## Owner-backed planned work

| Priority | Work                                                                                       | Source                         | Dependencies or impact                            |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------- |
| `0.2`    | Persistent repository adapter with migrations and deletion semantics                       | `docs/ROADMAP.md`              | Changes the persistence and retention boundary    |
| `0.2`    | Portable project bundle import and export                                                  | `docs/ROADMAP.md`              | Changes data and API contracts                    |
| `0.2`    | Hybrid retrieval benchmarked against the local BM25 baseline                               | `docs/ROADMAP.md`              | Changes core retrieval and evals                  |
| `0.2`    | Expand citation-faithfulness and prompt-injection evaluations                              | `docs/ROADMAP.md`              | Changes core eval fixtures and results            |
| `0.2`    | Consider streaming after cancellation and partial-result behavior is tested                | `docs/ROADMAP.md`              | Changes API and UI response lifecycle             |
| `0.3`    | Document a provider adapter kit and optional embedding or vector adapter                   | `docs/ROADMAP.md`              | Changes provider and retrieval interfaces         |
| `0.3`    | Add transcript providers only with strict host and input boundaries                        | `docs/ROADMAP.md`              | Changes network boundary and threat model         |
| `0.3`    | Produce reproducible model-routing and cost or quality reports                             | `docs/ROADMAP.md`              | Changes eval and reporting workflows              |
| Deferred | Study Groups, bulk media import, batch audiobook production, and public multi-user hosting | `docs/ROADMAP.md`, `AGENTS.md` | Deliberately outside the current repository scope |

## Completed work

| Work                                                                                                                        | Date                        | Evidence                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| Initial provider-neutral vertical slice with deterministic model, source-grounded learning tools, web app, tests, and evals | `0.1.0`, dated in changelog | `CHANGELOG.md`, `docs/ROADMAP.md`                                |
| Restrict YouTube timestamp links to an explicit host allowlist                                                              | `0.1.1`, dated in changelog | `CHANGELOG.md`, `packages/core/src/citations.ts`                 |
| Add server-side provider setup, key verification, and persistent API-side settings                                          | Unreleased in changelog     | `CHANGELOG.md`, `docs/adr/0001-server-side-provider-settings.md` |

## Open questions

- The root README still describes `0.1.0`, but package metadata and the latest tag show `0.1.1`. Confirm whether the README status should be updated.
- The changelog labels the latest provider setup work as unreleased. Confirm its release status before changing the roadmap state.
- Release date, production deployment target, and adoption evidence beyond the existing repository are Unknown (not found in repository).
