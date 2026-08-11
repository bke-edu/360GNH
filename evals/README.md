# Evals

The executable deterministic suite lives in `packages/core/scripts/eval.ts`. It uses the local model and original fixture, so contributors can reproduce the baseline without an account or network access.

`baseline-2026-08-11.json` records the frozen `0.1.0` candidate result. Latency is intentionally omitted from the checked-in baseline because it varies by machine; the live command prints it for diagnostics.

Future model-provider benchmarks must record model ID, date, configuration, fixture version, sample count, cost, and failure examples. A single hand-picked success is not a benchmark.
