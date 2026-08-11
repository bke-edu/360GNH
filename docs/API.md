# HTTP API

The API is a local evaluation adapter, not a stable public service contract yet. All JSON responses use either `{ "data": ... }` or `{ "error": { "code", "message" } }`.

## Routes

| Method | Path                     | Purpose                                        |
| ------ | ------------------------ | ---------------------------------------------- |
| `GET`  | `/health`                | Process health                                 |
| `GET`  | `/api/v1/meta`           | Active model and available debate perspectives |
| `GET`  | `/api/v1/sources`        | List in-memory sources                         |
| `POST` | `/api/v1/sources`        | Add bounded text or timestamped segments       |
| `POST` | `/api/v1/demo/seed`      | Add the original deterministic fixture once    |
| `POST` | `/api/v1/chat`           | Generate a cited answer                        |
| `POST` | `/api/v1/mindmap`        | Generate a source-backed tree                  |
| `POST` | `/api/v1/quiz`           | Generate a learner-safe quiz without answers   |
| `POST` | `/api/v1/quiz/:id/grade` | Grade against the server-held quiz             |
| `POST` | `/api/v1/study-guide`    | Generate a study guide                         |
| `POST` | `/api/v1/clips`          | Find relevant timestamp ranges                 |
| `POST` | `/api/v1/debate`         | Run exploration, collision, and synthesis      |

Queries accept a `query` string and optional source identifiers. Ingest requests accept `title`, `text`, optional `kind`, optional `sourceUrl`, and optional transcript `segments`.

## Network behavior

The default bind is `127.0.0.1:4310`. A non-loopback `HOST` requires `API_TOKEN`, checked with a timing-safe comparison. This token is intended for machine clients; the bundled browser app does not embed it.

`WEB_ORIGIN` is a comma-separated exact allowlist. Requests are limited to 60 per minute per process, and JSON bodies are capped at 256 KiB.

## Volatile state

Sources disappear when the API restarts. Full quiz answer sets are held for at most one hour, with at most 100 quizzes retained per process. The learner-facing quiz response omits `correctAnswer` and `explanation`; grading returns them after submission.
