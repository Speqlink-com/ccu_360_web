# Web production deployment

Connect this repository to the existing Vercel project. Select Node 24.x, production branch `main`, and add `ccu360.health` as the production domain. Use the exact DNS values Vercel displays in Cloudflare, with the web record DNS-only during verification. Vercel manages the web certificate. `vercel.json` uses `npm ci` and `npm run build`; it no longer forces demo mode.

Bulk import these production values in Vercel:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
API_PROXY_TARGET=https://api.ccu360.health
```

The proxy target is allowlisted and server-side. Backend credentials never belong in the web project. Production builds reject demo mode. Main-branch pushes trigger Vercel's native Git deployment; the GitHub web workflow runs lint, type checking, tests, build and production smoke checks. Require that check before merging if using protected main.

The real authentication/session UI and patient-journey workbench integration remain pending. The transport rewrite does not translate the existing demo data models or create authenticated sessions.

The full backend/runner/TLS setup and your step-by-step VPS actions are in the companion backend repository's [deployment guide](https://github.com/Speqlink-com/ccu_360_infra/blob/main/docs/DEPLOYMENT.md).
