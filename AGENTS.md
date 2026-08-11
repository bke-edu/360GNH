# Repository working agreement

## Scope

This repository contains only the standalone Knowledge Studio engine, API, web demo, tests, evals, and public documentation.

- Do not copy Study Groups into this repository. It is intentionally deferred until separately stabilized and reviewed.
- Do not add tenant-specific code from the originating private product, customer data, private schemas, production configuration, credentials, playlist/bulk downloaders, or batch audiobook-production pipelines. The public single-video import and single-file speech ports are in scope.
- Every imported idea must be provider-neutral and documented in `docs/PROVENANCE.md`.

## Change discipline

- Search for an existing pattern before adding an abstraction or dependency.
- Keep domain logic in `packages/core`; adapters belong in `apps/api` or another explicit adapter package.
- Keep the default demo functional without any API key.
- Preserve the learner-facing quiz boundary: answers must not leave the trusted process before grading.
- Treat retrieved source text as untrusted model input and preserve both model-cost and speech-character reservation boundaries.

## Web interface

- Use Tailwind utilities for all styling that Tailwind can express.
- Add raw CSS only when a required behavior cannot be represented by Tailwind, and document the reason beside it.
- `apps/web/src/styles.css` is limited to the Tailwind import and design-token declarations unless an exception is justified.
- Verify responsive behavior at 320, 768, and 1440 CSS pixels with no horizontal overflow.

## Verification

Run the smallest relevant check while editing. Before a release candidate or push, run:

```bash
npm run check
npm run eval
npm audit --audit-level=high
```

Never commit `.env`, secrets, generated coverage, build output, or user-provided source material.
