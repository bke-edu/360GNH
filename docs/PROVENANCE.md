# Provenance and extraction boundary

## Origin

360GNH Knowledge Studio is a clean, standalone implementation of reusable knowledge-workflow ideas developed while maintaining a private knowledge platform. The public repository starts with a new history and a provider-neutral architecture; it is not a mirror of the private monorepo.

Nguyễn Duy Hưng is the primary maintainer. This public release is made on the maintainer's representation that the included project code, documentation, fixture, and screenshot are original or cleared for publication under MIT. Third-party dependencies retain their own licenses, and contributors must submit only material they have the right to license.

## Included

- source ingestion and timestamp-preserving chunking;
- a clean single-video Supadata adapter and explicit raw-transcript-to-edited-source workflow;
- a clean single-file OpenAI speech adapter and WAV composition workflow;
- local BM25 retrieval and citations;
- cited answers, mind maps, quizzes, study guides, smart clips, and evidence-bound debates;
- deterministic original fixture and eval cases;
- optional OpenAI adapter;
- a new generic React/Tailwind interface and generic debate personas.

## Explicitly excluded

- Study Groups, which remains under active separate development and is not cleared for this repository;
- tenant identifiers, authentication, profiles, permissions, schemas, private routes, and deployment configuration from the originating product;
- customer, learner, staff, or production data;
- proprietary source documents, media, prompts, logs, and analytics;
- playlist or bulk download, background transcription operations, batch audiobook production, and unrelated product modules;
- credentials, environment files, SSH material, provider account identifiers, and private endpoints.

## Public fixtures

`DEMO_SOURCE` is original synthetic bilingual Vietnamese-English text written for this repository. It does not claim to quote or summarize a particular video or publication. Tests may attach an example URL solely to verify timestamp-link construction; the default demo does not present that URL as a real source.

`docs/assets/knowledge-studio-desktop.png` is an original screenshot of this repository running with the synthetic fixture. It contains no customer, tenant, or production data.

## Release review

Before every public release:

1. scan for private brands, tenant names, paths, secrets, personal data, and generated artifacts;
2. review dependency licenses and the lockfile;
3. confirm that changed code and assets can be published under MIT;
4. run the repository check, deterministic eval, and production-dependency audit;
5. review the final staged diff rather than trusting an older scan.
