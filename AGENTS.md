<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository synchronization

Before implementation, inspect the working tree and run `git pull --ff-only origin main`. Repeat before a deployment push. Preserve unrelated user changes and assets; never discard or automatically stash them just to complete a pull. Review and verify the integrated result, then push only the task files. For backend-dependent releases, verify backend readiness before publishing web changes.
