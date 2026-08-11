# Third-party notices

360GNH project code is licensed under MIT. Third-party packages and font files keep their own licenses. The resolved versions are recorded in `package-lock.json`; this file highlights direct runtime dependencies and assets that may be present in a compiled distribution.

## Direct runtime dependencies

| Package                                                  | License                   |
| -------------------------------------------------------- | ------------------------- |
| `@fontsource-variable/fraunces`                          | SIL Open Font License 1.1 |
| `@fontsource/be-vietnam-pro`                             | SIL Open Font License 1.1 |
| `lucide-react`                                           | ISC                       |
| `react`, `react-dom`                                     | MIT                       |
| `cors`, `express`, `express-rate-limit`, `helmet`, `zod` | MIT                       |
| `dotenv`                                                 | BSD-2-Clause              |
| `openai`                                                 | Apache-2.0                |

The production lockfile audit for `0.1.0` found only MIT, OFL-1.1, ISC, BSD-2-Clause, BSD-3-Clause, and Apache-2.0 dependencies. Development-only tools use additional open-source licenses and are not shipped as application runtime code.

## Files embedded in the web build

- Fraunces: Copyright 2020 The Fraunces Project Authors, <https://github.com/undercasetype/Fraunces>.
- Be Vietnam Pro: Copyright 2021 The Be Vietnam Pro Project Authors, <https://github.com/bettergui/BeVietnamPro>.
- Lucide: portions Copyright 2013–2022 Cole Bemis; all other portions Copyright 2022 Lucide Contributors.
- React and React DOM: Copyright Meta Platforms, Inc. and affiliates.

The applicable license texts are included in [`docs/licenses`](docs/licenses). A distributor that ships a compiled web build must ship these notices and license texts with it. Licenses for server-side packages remain included in their installed npm packages.
