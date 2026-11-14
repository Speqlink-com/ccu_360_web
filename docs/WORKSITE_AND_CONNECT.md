# Facility access and Connect 360

The live web app integrates the backend's worksite and communication APIs through the existing same-origin BFF. Production uses `https://ccu360.health` and `https://api.ccu360.health`. Demo mode remains disabled in production.

## Workspaces

- **Facility access** (`/dashboard/worksite`): selected-provider administrators configure sites, location policies and registered public WAN ranges. Policy/site updates carry current versions and reasons. A site must exist before enforcement can be enabled. Administrators retain remote access.
- **Employee access**: a shared boundary checks server status before mounting protected workspaces. The employee explicitly starts a location check; the browser obtains a new high-accuracy reading after a one-use challenge. Successful checks renew during active use. Expiry, failed status verification or server location denial hides protected workspaces and clears their queries. Account/security and facility selection remain available for recovery.
- **Connect 360** (`/dashboard/connect`): provider administrators and employees create direct/group conversations with same-provider colleagues. Group owners manage participants and ownership; eligible participants can request orphan-group recovery. Newly joined members see only their permitted history. Messages support author edits, reasoned redaction and immutable revision metadata. A discussion can be started from a patient journey; the backend checks every participant's current care coverage.

Personal internet connections are allowed. A registered facility network never replaces location. The employee's raw coordinates stay within the location mutation and are not stored in Zustand, query variables, localStorage or sessionStorage. Browser coordinates can be spoofed and do not constitute device attestation.

## State and transport

TanStack Query owns Zod-validated, user/provider-scoped server data. Conversation histories are cursor-paginated with a bounded in-memory window. Zustand owns only transient conversation selection and connection state. Message/composer state remains in component memory. Identity changes cancel requests, clear queries and reload all tabs through the existing identity boundary.

The server gateway permits explicit feature routes/methods and bounded, resource-specific cursors. It propagates safe backend problem codes, forwards the validated browser origin when minting socket tickets, and keeps access/refresh credentials in HttpOnly cookies. Browser code receives only a one-use socket ticket.

The realtime provider opens one direct API socket per active facility tab, authenticates in the first frame and processes recipient cursors serially. Ticket URLs and credentials in query strings are rejected. The client validates socket destinations, bounds queued event batches, reconnects with jitter/backoff, observes rate-limit delays, and uses HTTP event polling during outages. Events invalidate resources; message content is fetched through the authenticated HTTP gateway. Revocation erases cached conversation resources. Status/history refresh also revalidates patient-linked access without relying solely on events. Read receipts describe viewed messages, not formal clinical acknowledgements.

Device location is enabled only for the same origin through `Permissions-Policy: geolocation=(self)`. Camera and microphone remain disabled.

## Optional trusted-network recognition

Both the backend production environment and Vercel need the **same independent server-only** `WORKSITE_PROXY_SECRET` (at least 32 random characters). This is optional for location checks and messaging; without it, registration still works but the gateway cannot attest the employee's connection to the API.

Generate one value privately, for example with `openssl rand -hex 32`, then add that same value to the complete backend dotenv secret and to Vercel's server environment. Redeploy both services. Never prefix it with `NEXT_PUBLIC_` or enter it in an employee-facing form.

On Vercel only, the BFF reads the platform-controlled `x-vercel-forwarded-for` value, validates a single IP, discards caller-supplied proof headers and signs method/path/body hash/IP/time using the backend's HMAC contract. Self-hosted/local servers do not trust request forwarding headers by default. The recognition source may be a proxy when the web deployment is itself behind another proxy; do not register Cloudflare/Vercel infrastructure as facility WAN networks. See [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers).

Production API CORS must include the actual browser web origin because socket tickets are origin-bound. Use the custom production web hostname for end-user testing. Preview/local origins require explicit corresponding backend CORS configuration; the client does not bypass an origin denial.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run smoke:production
npm run smoke:identity
```

The last command requires the companion local backend, development PostgreSQL and Playwright Chromium. It creates and removes a uniquely named disposable `_test` database, disables email, and checks real browser authentication plus facility configuration, employee location approval/denial, remote-admin access, live socket events, group messaging, editing/redaction, participant removal and mobile layout. It never uses production accounts. Screenshots contain synthetic records only. The browser permission/location override is confined to that test context.

Existing production policies remain unchanged until a provider administrator explicitly enables them. The shared network-signing secret was absent during implementation; signed recognition requires the environment setup above before it can be exercised in production.
