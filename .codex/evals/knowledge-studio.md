# Knowledge Studio deterministic eval

Run:

```bash
npm run eval
```

The local suite must pass all cases without network access or an API key:

1. a relevant question returns an answer and at least one citation;
2. a timestamped transcript produces a non-zero smart clip and a supported-host time link;
3. quiz generation returns the requested count with source excerpts;
4. a three-perspective debate produces bounded exploration/collision turns and open questions.

This suite is a capability smoke test, not a truthfulness benchmark. Changes to retrieval, model adapters, chunking, citations, quiz validation, or debate orchestration must preserve it and add a targeted regression test for the changed failure mode.
