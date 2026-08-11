# Contributing

Thank you for helping make source-grounded learning software easier to inspect and reuse.

## Before changing code

1. Search existing issues and the roadmap.
2. Open an issue before a new provider, storage backend, public deployment mode, or major product surface.
3. Keep Study Groups and all tenant-specific modules from the originating private product out of scope.
4. Do not paste private source material, production logs, credentials, personal data, or proprietary prompts into an issue or test fixture.

## Local development

```bash
npm ci
npm run dev
```

The default fixture and model are deterministic and require no account. Tests must not make network calls.

Before opening a pull request:

```bash
npm run check
npm run eval
```

## Pull requests

- Keep one coherent objective per pull request.
- Explain the user-visible behavior, risk, and verification evidence.
- Add or update a regression test when behavior changes.
- Preserve API compatibility unless the change is explicitly marked breaking.
- Do not weaken input bounds, prompt-injection handling, quiz answer isolation, loopback defaults, or cost reservations.
- Use Tailwind utilities for web styling whenever Tailwind can express the requirement.

Maintainers may ask for a smaller change when a proposal combines unrelated concerns. Review is based on correctness, evidence, maintainability, and scope—not the number of changed lines.

## Commit messages

Use a short imperative subject that names the outcome, for example:

```text
Hide quiz answers until grading
```

By contributing, you agree that your contribution is licensed under the repository's MIT license and that you have the right to submit it.
