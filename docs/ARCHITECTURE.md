# CCU360 web architecture

Next.js App Router, React, TypeScript, Tailwind CSS 4, self-hosted Inter Variable, Zustand, TanStack Query and Zod form the web application. Production connects real identity, patient journeys, worksite access and communication to the FastAPI backend. Synthetic demonstrations require an explicit local demo build and are disabled in production.

## Ownership

| Directory | Responsibility |
| --- | --- |
| `app/` | Routes/layouts, same-origin API handler, global brand styles and collaboration styles |
| `features/identity/` | Identity query, rotating-session integration and identity transitions |
| `features/live/` | Live AHS/provider administration, workforce, forms, patient journeys and account security |
| `features/worksite/` | Validated worksite contracts, shared employee access boundary and provider configuration |
| `features/communication/` | Validated messaging contracts, scoped queries/history, realtime lifecycle, conversations and participants |
| `lib/server/` | Authenticated gateway, HttpOnly cookie handling, approved routes, origin checks and optional signed network observations |
| `lib/api/` | Runtime-validated HTTP transport, safe error descriptions, single-flight refresh and identity events |
| `providers/` | Per-application QueryClient, session context and isolated UI-store instances |
| `store/` | Transient sidebar, identity selection and communication connection/cursor/selection state; no persistence |
| `components/` | Shared accessible dialogs, supplied PNG/WebP icon registry, forms, brand and workspace shell |
| `lib/demo/`, `features/workspace/`, `features/administration/` | Explicit local synthetic demonstration only |
| `scripts/`, `tests/` | Contract tests, production smoke and disposable-backend browser verification |

## Data and authority

TanStack Query owns server records. Keys identify both the user and selected provider. Communication history has bounded cursor pagination. Every response is validated with Zod before use. Zustand stores only transient UI/metadata state; message content, credentials and patient information never enter persisted browser storage. Identity transitions cancel requests, clear caches, notify other tabs and reload the document to discard the previous server-rendered tree.

Access and refresh credentials remain in server-set HttpOnly/Secure host-only cookies. Browser mutations use an origin-checked same-origin gateway; it forwards only explicitly allowed API paths/methods to a fixed approved backend. Refresh uses single-flight rotation and browser Web Locks. The gateway never forwards arbitrary caller credentials or network-proof headers. The backend remains the authority for membership, MFA, geofencing, patient coverage, participant access and audits.

Worksite policies are opt-in per provider. Employee presence uses short-lived server grants and fresh browser samples; administrators remain exempt and personal internet is permitted. Protected workspaces are removed and their queries cleared when location access is lost, while account-security recovery remains available. See [WORKSITE_AND_CONNECT.md](WORKSITE_AND_CONNECT.md).

Realtime connections use a one-use origin/session-bound ticket delivered in the first socket frame, not a URL credential. One socket per active facility tab receives metadata, then invalidates HTTP resources. Recipient cursors survive reconnection in memory, with bounded processing, replay, backoff and polling fallback. Removed participants lose cached conversation data. Patient-linked access is also rechecked by periodic HTTP refresh. Read receipts do not replace clinical attestations.

## Presentation

The supplied logo informs the navy/teal palette. Dashboards use the full viewport, with a collapsible sidebar and mobile drawer. Inter is self-hosted. Supplied PNG/WebP icon artwork retains its original colours. Message text is rendered as text rather than HTML. New facility-access and communication styles live in `app/collaboration.css`, imported after the shared brand stylesheet from the root layout.

## Delivery and verification

Vercel publishes main at `https://ccu360.health`; the API is `https://api.ccu360.health`. Production uses standalone-compatible Next output and disables demo routes/accounts. Camera/microphone are disabled; geolocation is allowed only for the same origin. No shared server cache stores clinical records.

Unit/contract tests, strict type checks, lint, production build/smoke and real-browser integration cover the implemented boundaries. Browser verification creates a uniquely named disposable local `_test` database, disables email, and removes only its owned fixture resources. Production account testing and clinical operations are separate from those synthetic checks. Backend backups, retention, monitoring and deployment controls remain the backend/operator's responsibility.

## Journey configuration and shared ledger

`features/live/template-editor.tsx` owns transient form-editing state; server drafts,
versions, care teams and brands remain in TanStack Query. No clinical drafts or
credentials enter persisted browser storage. Draft saves carry a lifecycle revision;
conflicts preserve local edits and provide a reload action. A branded preview uses
illustrative data only. Uploads have a matching 2 MiB limit at the UI, gateway and
backend; other gateway requests retain their existing limit.

Provider CRUD uses audited archive/restore for historical configuration. Branding
revisions create immutable versions. Published forms are cloned for changes and
retired for new admissions without rewriting existing patient encounters. The
backend's separate lifecycle table preserves original source hashes. Date, time,
radio and multiple-choice fields supplement the existing schema renderer.

The employee ledger uses pinned facility branding and a nine-stage navigator.
Shared entries refresh every 15 seconds while the page is visible; the documentation
form retains its starting ledger version and prompts for review after concurrent
changes. Unsaved form text is preserved during refresh, and changing sections/areas
asks before discarding it. Authenticated entries, comments and attestation revisions
remain individually attributed. Printable branded exports use the same source
records, include all enabled stages and expose accountability/evidence history.

`npm run smoke:identity` additionally checks provider department editing, role
creation, real logo upload, draft custom fields and professional sections, preview,
validation, publication, retirement and desktop/mobile document layout. All accounts
and records are confined to the runner's disposable local database.

## Production errors

`lib/api/problem-contract.ts` accepts only public field paths, approved validation
codes and numeric schema bounds. The gateway strips raw upstream inputs, exception
contexts and messages. `lib/api/error-messages.ts` owns safe workflow descriptions;
`lib/api/errors.ts` formats field labels/rules and status-specific guidance.
`components/ui/request-error.tsx` is shared by workspace and authentication forms.
It retains entered values, focuses/marks invalid controls, provides accessible error
summaries and keeps copyable support references inside a collapsed details section.

Publication preflight identifies missing/incompatible care teams by stage and
section. It does not refer to password policy. Connection failures, response
validation, timeouts, stale records and permission denials have distinct guidance.
Uncertain writes are not automatically retried; users are asked to verify the
record first. Client requests have a bounded AbortController deadline, including
compatibility with browsers without AbortSignal.any/timeout. Route/root error
boundaries never display raw exceptions or promise that a pending change was not
saved. See backend `docs/error-handling.md` for the wire contract and redaction rules.
