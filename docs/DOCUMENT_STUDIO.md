# Provider documents and shared work queues

Provider administrators: open **Form Studio & branding**. Create facility branding, then create a form from the reception starter or a blank canvas. Existing versions can be cloned in the version library.

## Administrator workflow

1. **Build form**: click or drag components from the palette into sections. Select a field to edit its label, input type, requirement and options. Tables have typed columns, required cells and bounded repeat rows. Reorder fields with drag-and-drop or accessible move buttons; duplicate fields/sections and move them between sections/stages. Patient identity comes from the linked patient record, so reception does not repeat it in every section. The nine canonical journey stages remain stable; their titles and sections are customizable. Empty stages do not appear to employees.
2. **PDF pages**: arrange and resize the linked fields on A4 pages with the embedded visual designer. Customize typography, colours, tables, lines, shapes and embedded PNG/JPEG images. Add headings, dividers, the authenticated facility logo and patient identity bindings. Generated headers use the facility's title, logo and colours. **Refresh facility header** updates these generated header elements after a branding change. Custom layout elements remain under the administrator's control.
3. **Teams & permissions**: link teams that read the complete ledger and choose which qualified teams may initiate journeys. Assign section writers in the Build form property panel. Administrative sections support registration duties; clinical sections require compatible clinical writing roles. Optional sign-off uses the existing authenticated employee attestation flow. It records the employee, professional role and time rather than treating an uploaded drawing as a clinical signature.
4. **Preview & test**: test the actual input types, choice controls and repeating tables. Sample responses stay in component memory and are never sent to the backend. Switch to **PDF document** to see the layout and download a clearly marked template preview. These downloads contain no patient records, attestation or signed clinical output.
5. Add a **Change reason** and **Save draft changes**. Saving uses the backend's expected revision, versioned draft endpoint and audit record. If another administrator changed the record, review the conflict and explicitly reload the saved draft instead of overwriting it. Use undo/redo while composing. Unsaved work and unapplied PDF edits trigger navigation warnings.
6. **Review & publish**: verify the form name, branding, intake roles and section ownership; save every change; **Validate for publication** against the backend; then **Approve & publish**. The approval dialog requires the administrator to acknowledge review. Publication uses the validated saved revision and the backend's optimistic version check. Published versions remain immutable; clone to change them. Retirement stops new journeys while existing encounters retain their pinned version.

The version library supports draft editing, preview, cloning, validation, publication, retirement/restoration and status/name filtering on the current paginated page. Branding is separately versioned. The backend remains authoritative for role availability, tenant isolation, department activity, access rights, form validation and clinical evidence.

## Editor state and layout synchronization

- Each mounted form has its own non-persistent Zustand store. It contains only that draft, selection and a bounded 30-snapshot undo/redo history. No form or patient data is stored in localStorage. Saving locks document mutations while the request is pending. React Query owns server reads, mutations and tenant-scoped invalidation.
- Stable `section__field` names bind the clinical definition to PDF geometry. Renaming a field updates its generated label. Removing a field removes its binding. New fields are appended to generated pages while existing geometry and custom decorative elements remain in place. Changing a field to a table updates its linked element and column header configuration.
- **Sync linked fields** repairs missing fields in the current PDF canvas. Each clinical field must appear once. **Apply page layout** commits the canvas into the in-memory draft; saving then persists both the structured definition and PDF layout in one revision.
- Client checks give immediate feedback for missing/duplicated bindings, page limits, geometry, unsupported remote images, expression-like labels and incomplete choices/tables. Server validation is always required. A4 portrait/landscape, 30 pages, 150 elements per page, 1,200 elements overall and 500 total clinical fields remain bounded by the existing API. Local property limits match supported schema capabilities.
- FormEngine informed the palette/canvas/property-panel workflow. Its commercial Designer is not bundled, licensed or emulated through a trial dependency. The application owns its clinical schema and editor; the existing MIT-licensed pdfme packages provide page design and generation. See https://formengine.io/ for the vendor's current Core/Designer licensing distinction.


Employees: open a patient journey to read the complete shared ledger and **Open document view** for its current paper layout. Write through your authorized section. **Team work queue** supports starting a shift, claiming a patient section, explicit takeover, release, completion and reopening. End the shift when handing over. PDF downloads require **Export ledger** and create the server's existing signed ledger output record; the PDF identifies that record and its source version.

The paper document shows the latest note per section, including labelled drafts. The complete dated history, comments, observations and amendments remain in the ledger and signed export. Private file links are authenticated; filenames and digests are included in exports. PNG/JPEG and static PDF uploads are limited to 2 MiB each.

## Implementation

- `features/form-studio`: visual field canvas, property inspector, team-access matrix, isolated Zustand state, undo/redo, safe PDF-binding synchronization, sample preview and revision-checked publishing.
- `features/document-studio`: lazily loaded pdfme designer/viewer, structured tables, file inputs, typed field bindings, literal text rendering, page labels and PDF provenance.
- `features/work-queue`: shared department/role work with server-side pagination and bounded shift claims. TanStack Query owns server data; Zustand holds only transient queue filter preferences.
- Patient values and drafts remain in memory. Identity changes reload the document and clear the preceding identity context. New-note inputs reset after a successful save, and pending uploads block note submission.
- The authenticated API gateway explicitly validates each new route, method, filter and body limit. The backend owns permissions, versions, file checks, encryption and evidence.
- Both Webpack development and Turbopack production use the editable A4 layout adapter. Arbitrary PDF backgrounds are not imported. Static diagrams are local PNG/JPEG content, and Inter is self-hosted with its license.

The backend's `docs/JOURNEY_DOCUMENTS.md` contains the complete workflow, limits, migration and architecture guide. No new production environment variables are needed.

## Verification

- `npm test` includes form-state isolation, locked edits, undo/redo branching, stable geometry, field/table changes, field moves, missing/duplicate bindings, unsafe expressions/images, landscape pages and branded generation.
- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run smoke:production` checks the standalone production output.
- `npm run smoke:identity` uses disposable accounts and a disposable backend test database to exercise configuration, uploaded evidence, document export, queue claims, shifts, reception, geofencing and communication on desktop/mobile.
- `node --import tsx scripts/smoke-document-pdf.mts` creates a synthetic 40-row PDF at `/tmp/ccu360-dynamic-document-qa.pdf` for continuation, literal-text, draft-label and page-number checks.

### Verified on 20 November 2026

- 70 unit tests passed, including preservation of facility headers on appended PDF pages, repeated section renames and hidden/removed section bindings.
- TypeScript and the optimized production build passed. ESLint has no errors; two existing warnings remain in the shared workspace shell and PostCSS configuration.
- The real-browser/FastAPI suite passed with owned disposable accounts and a disposable database: form design, typed tables, undo/redo, PDF layout, save/reopen, desktop/mobile preview, PDF download, validation, approval, publication and retirement. The same run passed identity/MFA, reception, patient records, clinical attestation, ledger integrity, queues/shifts, tenant/session boundaries, geofencing and realtime communication.
- Standalone production checks passed for authentication redirects, security headers, disabled demo endpoints, CSRF rejection and local assets.
- A generated template PDF was rendered and inspected for logo, typography, field labels, table columns, spacing and the preview footer. The synthetic 40-row clinical PDF check also passed for literal text, draft labels, patient references and page numbers.

This is a web-only rollout against the existing journey-document API. No backend migration, commercial designer key or new production environment variable is required.
