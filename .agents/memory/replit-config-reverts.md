---
name: Replit config reverted by GitHub pulls
description: This repl syncs with a GitHub repo; pulls overwrite Replit-specific setup
---

The user syncs this project with its GitHub origin. Pulls/rollbacks have overwritten Replit-specific setup: the `.replit` workflow + port 5000 mapping, the `[postMerge]` section, and the `allowedHosts: true` fix in the Vite middleware options in `server/index.ts` (without it the public `.replit.dev` URL returns 403 while localhost works).

**Why:** The upstream repo assumes port 8081 and has no Replit workflow config, so every sync breaks the preview with "We couldn't reach this app".

**How to apply:** After any pull/merge/rollback that touches `.replit` or `server/index.ts`, re-verify: workflow serves on port 5000 (webview), `allowedHosts: true` present, post-merge script configured. Best permanent fix: push these Replit-specific changes to the GitHub repo.
