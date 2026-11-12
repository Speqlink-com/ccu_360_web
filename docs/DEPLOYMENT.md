# CCU360 web production

Vercel builds this repository's `main`, using Node.js 24.x, `npm ci` and `npm run build`. Set the production domain to **ccu360.health**. Bulk-import:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
API_PROXY_TARGET=https://api.ccu360.health
```

The API target is server-only. Production uses a fixed-origin backend-for-frontend with HttpOnly/Secure host-only access, refresh and restricted MFA cookies. No backend credentials, JWT signing secret, patient information or tokens belong in public environment variables or browser storage. Exact-origin protection applies to every mutation. Error bodies are sanitized. Clinical and identity data are private and uncached.

TanStack Query owns runtime-validated server data and queries are scoped to both user and selected facility. Zustand owns transient interface state. Sign-out, sign-in and tenant changes cancel requests, clear query data, notify other tabs and reload the document. Refresh uses browser Web Locks and single-flight rotation.

See the companion backend [integration/testing guide](../../ccu_360_infra/docs/WEB_INTEGRATION.md) and [VPS deployment guide](../../ccu_360_infra/docs/DEPLOYMENT.md) for initial-administrator provisioning, real email invitations and the AHS → facility administrator → employee → patient journey testing path.

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run smoke:production`. Local real-browser/FastAPI verification: `npm run smoke:identity` (see companion guide for disposable PostgreSQL and Playwright prerequisites). Test artifacts and per-run build directories remain ignored. Production never enables the demo accounts.

Verified for this integration: **30 web tests**, strict type checking, lint (no errors), production build/smoke, and a real Chromium/FastAPI workflow covering initial-admin MFA, provider/admin invitations, employee onboarding, patient registration/admission, clinical drafts/attestation/comments, team actions, shared observations, ledger integrity, concurrent refresh and cross-tab logout. The companion backend suite passed 140 tests and the production Docker/TLS/auth smoke. Screenshots were reviewed at desktop and mobile sizes using synthetic records only.
