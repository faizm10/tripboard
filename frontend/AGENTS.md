<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Versioning and changelog

The current version is the top entry of the changelog. It shows in the site footer and the full history lives at `/changelog`.

- **Source of truth:** `src/lib/changelog.ts`. `APP_VERSION` is the top entry. `package.json` (and the top of `package-lock.json`) must carry the same number; `src/lib/changelog.test.ts` fails CI when they drift or when entries are out of order.
- **Every PR that changes what people see** adds one entry at the top of `CHANGELOG` and bumps the version in the same commit:
  - new feature or visible change → bump the **minor** (`0.42.0` → `0.43.0`)
  - fix-only or copy tweak → bump the **patch** (`0.42.0` → `0.42.1`)
  - internal-only changes (CI, refactors, tests) don't need an entry
- **Entry shape:** `{ version, date: "YYYY-MM-DD", title, pr, changes: [...] }`. Write `changes` for the people using the app, in plain words: what they can now do, not which files moved. Set `pr` once the PR number is known.
- **History:** entries up to v0.41.0 were rebuilt from the merged PRs on GitHub (one minor per PR number, starting at #7, where the app became Tripboard). To catch up after missed releases, list what merged since the top entry and add one entry per PR:

  ```bash
  gh pr list --state merged --limit 20 --json number,title,mergedAt,body
  ```
