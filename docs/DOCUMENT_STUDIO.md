# Provider documents and shared work queues

Provider administrators: open **Journey forms & branding**, create or clone a draft, configure linked/intake teams and section writers, add fields and table columns, then select **Design document pages**. Apply the canvas layout, save with a change reason, validate and publish. Existing encounters retain their published version.

Employees: open a patient journey to read the complete shared ledger and **Open document view** for its current paper layout. Write through your authorized section. **Team work queue** supports starting a shift, claiming a patient section, explicit takeover, release, completion and reopening. End the shift when handing over. PDF downloads require **Export ledger** and create the server's existing signed ledger output record; the PDF identifies that record and its source version.

The paper document shows the latest note per section, including labelled drafts. The complete dated history, comments, observations and amendments remain in the ledger and signed export. Private file links are authenticated; filenames and digests are included in exports. PNG/JPEG and static PDF uploads are limited to 2 MiB each.

## Implementation

- `features/document-studio`: lazily loaded pdfme designer/viewer, structured tables, file inputs, typed field bindings, literal text rendering, page labels and PDF provenance.
- `features/work-queue`: shared department/role work with server-side pagination and bounded shift claims. TanStack Query owns server data; Zustand holds only transient queue filter preferences.
- Patient values and drafts remain in memory. Identity changes reload the document and clear the preceding identity context. New-note inputs reset after a successful save, and pending uploads block note submission.
- The authenticated API gateway explicitly validates each new route, method, filter and body limit. The backend owns permissions, versions, file checks, encryption and evidence.
- Both Webpack development and Turbopack production use the editable A4 layout adapter. Arbitrary PDF backgrounds are not imported. Static diagrams are local PNG/JPEG content, and Inter is self-hosted with its license.

The backend's `docs/JOURNEY_DOCUMENTS.md` contains the complete workflow, limits, migration and architecture guide. No new production environment variables are needed.

## Verification

- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run smoke:production` checks the standalone production output.
- `npm run smoke:identity` uses disposable accounts and a disposable backend test database to exercise configuration, uploaded evidence, document export, queue claims, shifts, reception, geofencing and communication on desktop/mobile.
- `node --import tsx scripts/smoke-document-pdf.mts` creates a synthetic 40-row PDF at `/tmp/ccu360-dynamic-document-qa.pdf` for continuation, literal-text, draft-label and page-number checks.
