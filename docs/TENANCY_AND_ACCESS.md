# CCU360 tenancy and access

CCU360 has two administration levels. Ayot Health Solutions (AHS) operates the platform and onboards independent facilities. Each facility administrator manages their own employees and units. Doctors, nurses and allied health professionals work within that facility’s clinical workspace.

## Implemented demo

- AHS overview, facility directory, onboarding, appointment of the first facility administrator, and workspace activation/suspension.
- Facility overview, employee creation, role/unit assignment, access suspension/restoration, and configured bed capacity.
- Doctor/nurse/allied health accounts, facility-scoped patient views, role-owned action transitions and source-linked round/handover preparation.
- Doctor/nurse admission with facility bed validation, occupied-bed protection, duplicate active identifier checks, and explicit missing clinical state.
- Role-specific server-rendered route access. Administrative roles do not receive clinical patient records; facility administrators receive aggregate counts.
- Two separate synthetic facility datasets. Patient and action lookup always follows the server-resolved facility membership, not a client-supplied facility ID.

## Session and API boundary

Demo credentials live in a server-imported fixture. Password comparisons use scrypt digests and timing-safe comparison. A signed, expiring user ID and random nonce are placed in an HttpOnly, SameSite=Strict cookie. Server functions share a private per-build signing artifact, allowing seeded accounts to remain authenticated across Vercel cold starts. No role or facility supplied by the client is trusted; identity is resolved from the server fixture. Demo sessions expire after eight hours. Logout clears the browser cookie and records revocation in the current process; shared revocation requires durable storage. Suspended users/facilities lose access when their sessions are revalidated. Repeated invalid credentials trigger a demo limiter after five failures for an account within fifteen minutes.

Mutation routes verify browser Origin against the actual request Host and protocol. They do not trust forwarded-host headers. All demo responses are private/no-store. DTOs strip password hashes and fixture passwords. Newly provisioned accounts return a generated demo password once in the creation response; directory and session responses never return passwords.

TanStack Query keys include the current facility and user. Sign-out leaves the application document to discard in-memory client caches. Zustand contains UI selections only. There is no localStorage/IndexedDB persistence of clinical data or session tokens.

## Demo routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST / GET / DELETE | `/api/demo/session` | Sign-in, session inspection, logout |
| GET | `/api/demo/directory` | Role-scoped facilities, employees, aggregate counts and administration activity |
| GET | `/api/demo/workspace` | Clinical workspace for the signed-in facility |
| POST / PATCH | `/api/demo/facilities` | AHS onboarding and workspace status |
| POST / PATCH | `/api/demo/employees` | Facility employee creation and access status |
| POST | `/api/demo/patients` | Facility-bound synthetic admission |
| POST | `/api/demo/transitions` | Versioned, role-owned action transition |

A facility in Onboarding allows its administrator to prepare the team. Clinical accounts can sign in after AHS activates the facility. A suspended facility blocks all facility accounts. A facility administrator cannot suspend their own account or grant an AHS role.

Clinical roles can read the facility’s patient records. Doctors can coordinate all encounter actions; nurses update nursing-owned actions; allied health staff update allied-owned actions. Action ownership uses an explicit role identifier. Unit assignment is displayed as responsibility context; it is not a separate authorization boundary in this demonstration. These are demonstration policies pending institution approval.

## Production boundary

Hardcoded accounts and all `/api/demo/*` endpoints are disabled unless `NEXT_PUBLIC_DEMO_MODE=true`. `.env.development` enables the local demonstration; ordinary local/Docker production builds keep it disabled. The requested Vercel demonstration explicitly enables it with the checked-in `vercel.json` build command. The default production dashboard remains in its setup state.

The demonstration stores facilities, users, revocations, audit-like activity and synthetic clinical records in a single-process memory store. Signed seeded-account sessions are portable across instances, while mutations and rate limits are not shared across instances. State resets on server restart. This is a navigable implementation of the tenant model, not a durable production identity service or clinical backend. It is unsuitable for real patient data, multi-replica deployment, or clinical audit retention.

Production work still requires the approved identity provider, durable tenant/membership tables, transaction-bound clinical and access audit, database-level tenant isolation, distributed session/rate-limit storage, invitation/password lifecycle, institution-approved role policy, TLS/cookie deployment configuration, and the FastAPI contracts in the supplied backend specification. Do not enable hardcoded demonstration accounts as a production authentication method.

## Verification

Unit tests exercise password/session handling, expiry/logout, rate limiting, server-owned tenant selection, cross-facility access denial, administrative/clinical role separation, onboarding, employee provisioning, revocation, action ownership, optimistic concurrency, and admission bed/identifier rules.

`npm run smoke:demo` targets an explicitly running local demo (`CCU360_DEMO_URL`, default port 3106). It checks actual HTTP cookies, mutation origin protection, role routes, tenant isolation, onboarding, activation, employee access and logout using synthetic fixtures. It creates disposable test facility/staff records; restart the demo afterwards to restore the initial eight accounts.

`npm run smoke:production` verifies production pages and assets and that demo endpoints remain unavailable. CI runs the unit tests, build and production check.
