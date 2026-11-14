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

The worksite/communication integration adds **37 passing web tests**, strict type checking, lint (no errors; two existing warnings), production build/smoke and real Chromium/FastAPI checks. Browser coverage includes employee location approval/denial and account recovery, remote provider administration, registered networks, live WebSocket events, group messages, editing/redaction, participant removal and mobile layout, alongside the existing onboarding and patient-journey regression. Backend release `54f32e6` passed 180 tests and its production Docker/TLS/WSS smoke before deployment.

See [WORKSITE_AND_CONNECT.md](WORKSITE_AND_CONNECT.md) for provider setup and testing. No new environment value is required for location checks or messaging. Optional trusted-network recognition requires the same server-only `WORKSITE_PROXY_SECRET` in Vercel and the complete backend production dotenv secret, followed by redeployment of both services. It never bypasses location. Existing policies remain disabled until providers explicitly enable them.
