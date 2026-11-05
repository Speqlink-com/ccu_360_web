# CCU360 Web

Multi-facility critical-care frontend with AHS platform administration, facility administration and clinical role workspaces. Built with Next.js, React, TypeScript, Tailwind CSS, self-hosted Inter, Zustand, TanStack Query and Zod.

## Development

```sh
npm ci
npm run dev:poll
```

Open `http://localhost:3000`. If another development server is running, use the isolated preview:

```sh
npm run dev:preview
```

Open `http://127.0.0.1:3106`. Use a demo account below. Facilities, employee accounts and clinical changes are scoped on the server and reset when that demo process restarts.

For a compiled local demo without development recompilation:

```sh
npm run demo:build
npm run demo:start
```

This explicit demo build uses `.next-demo` and port 3106. It keeps the ordinary production build separate. Custom local builds use two build workers and skip the persistent compiler cache to limit workstation disk/memory pressure.

## Demonstration accounts

| Workspace | Email | Password |
| --- | --- | --- |
| AHS platform administrator | comphortine@ayothealthsolutions.ke | Ahs360!Demo26 |
| Evergreen facility administrator | admin@evergreen.ccu360.test | Evergreen!360 |
| Cedar Valley facility administrator | admin@cedar.ccu360.test | Cedar!360 |
| Evergreen doctor | doctor@evergreen.ccu360.test | Doctor!360 |
| Evergreen nurse | nurse@evergreen.ccu360.test | Nurse!360 |
| Evergreen allied health | allied@evergreen.ccu360.test | Allied!360 |
| Cedar Valley doctor | doctor@cedar.ccu360.test | Doctor!360 |
| Cedar Valley nurse | nurse@cedar.ccu360.test | Nurse!360 |

These are hardcoded synthetic demo credentials, disabled in ordinary production builds. Newly onboarded facilities/employees receive generated demo credentials shown in the provisioning dialog. No email is sent.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run smoke:production
npm audit --omit=dev
```

With the isolated demo running:

```sh
CCU360_DEMO_URL=http://127.0.0.1:3106 npm run smoke:demo
```

The demo HTTP check creates disposable facility/staff records. Restart the demo to reset them. CI runs install, typecheck, unit tests, production build, production smoke and runtime audit.

## Production

```sh
npm run build
npm start
```

Production defaults to `NEXT_PUBLIC_DEMO_MODE=false`. All demo API endpoints return 404. The live institution identity service, durable tenancy and clinical backend are not yet integrated, so production shows a setup state. Environment variables beginning `NEXT_PUBLIC_` are compiled at build time.

```sh
docker build -t ccu360-web .
docker run --rm -p 3000:3000 ccu360-web
```

See `docs/ARCHITECTURE.md`, `docs/TENANCY_AND_ACCESS.md` and `docs/ICON_ASSETS.md`.

## Vercel demonstration deployment

`vercel.json` explicitly builds the hosted demonstration with `NEXT_PUBLIC_DEMO_MODE=true`, so the eight account fixtures work on the Vercel URL. Normal local/Docker production builds still default to demo mode off.

The build prepares a random private signing key at `lib/server/.demo-session-key`. Next traces it into all server functions; it is ignored by Git and excluded from client assets. Demo cookies carry signed, expiring subject IDs, so a seeded account remains signed in when Vercel serves the next request in a different function instance. A redeployment rotates the generated key. Optionally configure a stable server-only `DEMO_SESSION_SECRET` of at least 32 characters to retain sessions across deployments.

Facility/employee/patient mutations, access revocations and rate limits still live in each function’s temporary memory. They are not durable or synchronized across Vercel instances. Use the seeded accounts to review the hosted demonstration; shared production identity and clinical storage require the backend/database integration.
