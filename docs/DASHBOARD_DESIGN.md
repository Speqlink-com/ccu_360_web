# CCU360 workspace design

The 21 November 2026 refresh uses the existing CCU360 navy (`#082b4d`), teal (`#008f87`) and deep teal (`#006d69`). Dark navigation, restrained gradients, raised cards and a stronger canvas replace the pale dashboard treatment. Inter remains self-hosted.

## Structure

- `app/workspace.css` owns the workspace treatment. It is scoped to `.workspace`; facility-designed clinical document colours and the sign-in theme remain independent.
- `features/dashboard/overview-page.tsx` provides AHS, facility-administrator and employee overviews. Links lead to real modules. Data comes from authenticated, identity-scoped TanStack Query reads; sidebar preferences remain in the existing Zustand workspace store.
- Facility, employee, role and form lists are bounded previews, labelled with the number shown and their allowance. They are not presented as whole-platform totals. Patient registry totals come from the registry API. No trends, occupancy rates or activity figures are fabricated.
- Form previews use `journey/config/templates` and refresh on entry, focus or explicit refresh rather than polling complete template definitions. Other lightweight overview lists refresh every 30 seconds.
- Dashboard list headers and footers stay outside the scroll area. Lists, long tables and selected directory panels scroll independently; focusable regions support keyboard navigation. `Panel` accepts `scroll` for long lists. Clinical entry forms keep the normal page flow.
- Page guides and panel context are expandable. Field labels, validation, access errors, clinical provenance and confirmation flows remain available. Reception's introduction is a compact three-step workflow.
- The sidebar scrolls separately from account controls. Desktop collapse, the mobile drawer, Escape handling and focus restoration use the existing workspace state and focus management.

## Supplied artwork

`components/ui/icon.tsx` is the central asset map. It uses the supplied facility, bed, team, form, shield, location, settings, message, search, notification, sidebar-toggle and logout images from `public/icons`. Images retain their original colours and aspect ratio. Navigation icons have a consistent tile; simple directional controls retain the existing vector icons. No remote artwork service or new font dependency is required.

The unused `.next-integration-15fb98fe` build cache was removed after checking it had no open files. Other user build folders and supplied artwork were preserved.

## Verification

`npm run smoke:identity` includes `scripts/dashboard-check.mts`: real server-backed previews, supplied-image loading, an actually scrollable synthetic facility list, keyboard scrolling, desktop collapse, mobile drawer/Escape, and horizontal-overflow checks at 390px. It saves AHS, facility-admin and clinical screenshots under `/tmp/ccu360-premium-*-desktop.png` and `*-mobile.png`. All fixture records and invitations are confined to the runner's owned disposable database; email delivery is disabled.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run smoke:identity`, `npm run build`, then `npm run smoke:production`.

This visual update introduces no additional environment variables or backend migration. The shared-role release requirements in `DOCUMENT_STUDIO.md`, including backend migration 0010 before web, still apply when releasing those pending changes together.

Verified on 21 November 2026: 70 web tests passed; TypeScript and the optimized production build passed. ESLint reported no errors and one existing PostCSS configuration warning. The full real-browser/FastAPI suite passed dashboard layout and scrolling, form editing/publishing, reception, shared nursing access, clinical attestation, document exports, shifts, cross-tab identity boundaries, geofencing and realtime communication. Standalone production checks passed for authentication redirects, security headers, disabled demo endpoints, CSRF rejection and local assets.
