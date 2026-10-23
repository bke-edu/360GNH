> Last verified: 2026-10-23 at commit 7647a3f

# 360GNH Knowledge Studio Data and Persistence

## Persistence overview

There is no database engine, schema migration, or persistent source repository in the current implementation. Sources and search chunks live in `InMemoryKnowledgeRepository`; quiz answer sets live in an API-process map. Provider credentials use a separate versioned settings file when not supplied by the environment. See `packages/core/src/repository.ts`, `apps/api/src/app.ts`, and `apps/api/src/provider-settings.ts`.

## Stores and data sensitivity

| Store and field                                  | Type                                                  | Purpose                                                                                 | Personal data?                                                                                                                     | Retention                                                                                      | Evidence                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `InMemoryKnowledgeRepository` sources and chunks | Process memory                                        | Imported or entered source text, transcript metadata, timestamps, and searchable chunks | May contain personal data if users include it in source content; the schema does not define identity fields                        | Lost when the API process restarts                                                             | `packages/core/src/repository.ts`, `packages/core/src/types.ts`                                       |
| API quiz map                                     | Process memory                                        | Full quiz, answer keys, explanations, and grading data                                  | User submissions may contain personal information depending on the response; no account identity is attached by the current schema | Entries expire after one hour; the process retains at most 100 quizzes                         | `apps/api/src/app.ts`, `packages/core/src/types.ts`                                                   |
| Provider settings file                           | JSON file on the API side; Docker uses a named volume | Provider configuration and credentials                                                  | No personal-data fields are documented; it contains sensitive provider credentials                                                 | Persists until settings are removed or the volume is deleted; no automatic expiry is evidenced | `apps/api/src/provider-settings.ts`, `compose.yaml`, `docs/adr/0001-server-side-provider-settings.md` |
| Browser local storage                            | Browser key/value storage                             | Interface language, theme, and whether provider setup was dismissed                     | No source content or provider credentials are written by these keys                                                                | Remains until browser storage is cleared                                                       | `apps/web/src/lib/i18n.ts`, `apps/web/src/App.tsx`, `apps/web/src/lib/useProviderSettings.ts`         |

## Access patterns and migrations

- Source and chunk reads and writes go through the `KnowledgeRepository` port. The current adapter is in memory and clones values at its boundary.
- Quiz answers are removed from the learner-facing response and used by the grading route while still held in the API process.
- Provider settings are written through an atomic temporary-file replacement with restrictive file permissions. Environment-supplied credentials take precedence and are read-only through the settings API.
- There are no database migrations. The settings file is versioned, but no separate migration or retention runbook is documented.
- Backups and restore procedures for local provider settings are Unknown (not found in repository).

## Explicitly not applicable

Relational tables and database columns are not applicable because this repository has no database schema. The in-memory and file-backed stores above are the persistence boundary for the current release.

## Open questions

- The repository does not define an operator retention period for provider settings or imported source text beyond the process and file behavior described above.
