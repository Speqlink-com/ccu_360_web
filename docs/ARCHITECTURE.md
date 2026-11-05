# CCU360 web architecture

CCU360 uses Next.js App Router, React, TypeScript, Tailwind CSS 4, self-hosted Inter Variable, Zustand, TanStack Query and Zod. The web foundation now includes a navigable multi-facility demonstration with AHS administration, facility administration and clinical role workspaces.

## Design

The sign-in composition follows PL/client. Dashboard navigation and typography draw from BizLead. The supplied logo informs navy `#082B4D`, teal `#008F87` and green supporting colours. The workspace uses the full viewport width, with a collapsible desktop sidebar and mobile drawer. Dashboard body text is 15px, primary navigation and table content are 13–15px, and headings are 27–32px. Supplied PNG/WebP icons render with their original colours.

## Boundaries

| Directory | Responsibility |
| --- | --- |
| `app/` | Server routes, session-aware layout, role gating, API handlers, errors/loading |
| `features/administration/` | AHS/facility dashboards, directories, roles, units, tenant-scoped queries |
| `features/workspace/` | Clinical overview, patient state, actions, round/handover preparation |
| `lib/domain/` | Response/input schemas, role capability helpers and action transition invariants |
| `lib/demo/` | Server-used synthetic accounts/control plane, initial clinical fixtures, isolated test repository |
| `lib/server/` | Server-only demo session resolution, API guards, Origin checks, safe responses |
| `lib/api/` | Client DTO validation, request/error handling, future same-origin API boundary |
| `providers/` | Per-browser QueryClient, server-provided session context and UI store |
| `store/` | Unit filter and sidebar selections only |
| `components/` | Accessible dialogs, supplied icon registry, forms, brand and shell |
| `scripts/` | Standalone launcher, demo HTTP checks and production smoke checks |

The server resolves facility membership for every demo operation. Query keys contain facility and user identifiers. Administrative roles see organizational data/aggregates; clinical roles access patient records. Source observations remain shared across clinical, round and handover views. Draft commentary stays separate. Missing, stale, unverified and conflicting states remain visible. Action transitions validate expected versions and retain actor/time/history.

See `TENANCY_AND_ACCESS.md` for the exact implemented role model, endpoint contracts, session handling and production boundary.

## Deployment

Production builds use Next standalone output. `npm start` copies build-matched static/public assets into the standalone directory and launches its server with a bounded graceful shutdown. The multistage Dockerfile runs under an unprivileged account. Security headers disable framing, MIME sniffing, referrer transmission and unused device capabilities.

`NEXT_PUBLIC_DEMO_MODE` is compiled into the application. It defaults off in production. Do not enable the demonstration for clinical deployment. A nonce-based CSP, institution identity integration, tenant-aware durable backend, transactional audit, TLS/HSTS, production CSRF/session policy and operational validation remain integration work.

`npm run dev:preview` uses `.next-preview` on port 3106 and polling. Its filesystem webpack cache is disabled to limit disk usage. It can coexist with a normal development server on port 3000. `.next-preview` is ignored by Git and Docker. A compiled local-only demonstration is available with `npm run demo:build` and `npm run demo:start`, using `.next-demo` on the same port. These explicit custom builds use two workers and skip the persistent build cache. The ordinary production build keeps demo accounts disabled.

## Verification and remaining scope

TypeScript, unit checks, production build, production smoke checks and local demo HTTP checks cover the implemented boundaries. Visual review includes AHS, facility and clinical workspaces plus mobile layouts. Runtime dependency auditing previously reported no known runtime vulnerabilities; the existing moderate development lint-tool findings are not addressed by downgrading framework tooling.

No database migrations or FastAPI API changes are included. No external invitations, email, clinical notifications or real referrals are sent. Permanent identity, persisted tenant data, clinical validation and production deployment remain subsequent work under the backend implementation blueprint.
