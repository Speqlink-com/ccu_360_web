"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import { buttonClasses } from "@/lib/presentation";
import { definition, brand, formTemplate, teamRole } from "./journey-contract";
import {
  Heading,
  Panel,
  Field,
  ActionForm,
  ActionButton,
  QueryState,
  Status,
  Pager,
  value,
} from "./shared";
import { useChoices, ChoiceLoader } from "./choices";
import { TemplateEditor } from "./template-editor";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/icon";
import { SideDrawer } from "@/components/ui/side-drawer";
import { WebSelect } from "@/components/ui/web-select";
import "@/features/form-studio/studio.css";
const FormPreview = dynamic(
  () => import("@/features/form-studio/preview").then((m) => m.FormPreview),
  { ssr: false },
);

type Brand = z.infer<typeof brand>;
type Template = z.infer<typeof formTemplate>;
function BrandForm({ org, existing, onSaved }: { org: string; existing?: Brand; onSaved?: () => void }) {
  const [logo, setLogo] = useState(existing?.logo_id ?? "");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  return (
    <ActionForm
      disabled={uploading}
      scope={org}
      path={
        existing
          ? `journey/config/brands/${existing.id}/revisions`
          : "journey/config/brands"
      }
      label={
        existing ? "Save new branding version" : "Create facility branding"
      }
      reset={false}
      onSuccess={onSaved}
      body={(data) => ({
        title: value(data, "title"),
        primary_color: value(data, "primary_color"),
        accent_color: value(data, "accent_color"),
        logo_id: logo || null,
        ...(existing
          ? {
              expected_version: existing.revision,
              reason: value(data, "reason"),
            }
          : {}),
      })}
    >
      <Field
        name="title"
        label="Facility document title"
        defaultValue={existing?.title}
        minLength={2}
        maxLength={160}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="primary_color"
          label="Primary colour"
          type="color"
          defaultValue={existing?.primary_color ?? "#006d69"}
        />
        <Field
          name="accent_color"
          label="Accent colour"
          type="color"
          defaultValue={existing?.accent_color ?? "#008f87"}
        />
      </div>
      <label className="live-field">
        Facility logo (PNG, JPEG or WebP, up to 2 MiB)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploadError("");
            if (!file.size || file.size > 2_097_152) {
              setUploadError("Choose a logo up to 2 MiB.");
              return;
            }
            setUploading(true);
            try {
              const { apiRequest } = await import("@/lib/api/client");
              const result = await apiRequest(
                "/api/v1/journey/config/logos",
                z.object({ id: z.string() }),
                { method: "POST", body: file },
              );
              setLogo(result.id);
            } catch (error) {
              setUploadError(
                error instanceof Error ? error.message : "Logo upload failed.",
              );
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {uploading && (
        <p role="status">Uploading logo. Wait for the preview before saving.</p>
      )}
      {uploadError && (
        <p role="alert" className="text-red-700">
          {uploadError}
        </p>
      )}
      {logo && (
        <div className="mb-4 flex items-center gap-5 rounded-lg border border-border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/v1/journey/config/logos/${logo}`}
            alt="Facility logo"
            className="max-h-20 max-w-44 object-contain"
          />
          <button
            className="text-sm text-red-700"
            type="button"
            onClick={() => setLogo("")}
          >
            Remove logo from this version
          </button>
        </div>
      )}
      {existing && (
        <Field
          name="reason"
          label="Change reason"
          minLength={3}
          maxLength={500}
        />
      )}
      <p className="mb-4 text-sm text-muted">
        Branding is versioned. Choose this version on a draft form to apply it
        to future patient journeys.
      </p>
    </ActionForm>
  );
}
export function TemplatesPage() {
  const org = useIdentity().data!.organization_id!;
  const [offset, setOffset] = useState(0);
  const [brandOffset, setBrandOffset] = useState(0);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [brandManage, setBrandManage] = useState<Brand | null>(null);
  const [manage, setManage] = useState<Template | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const previewTarget = useRef<HTMLDivElement>(null);
  const base = useLiveQuery(org, "journey/config/baseline", definition);
  const templates = useLiveQuery(org, `journey/config/templates?offset=${offset}&limit=8`, pageOf(formTemplate));
  const brandsPage = useLiveQuery(org, `journey/config/brands?offset=${brandOffset}&limit=5`, pageOf(brand));
  const brands = useChoices(org, "journey/config/brands", brand);
  const roles = useChoices(org, "workforce/roles", teamRole);
  const allBrands = brands.data?.pages.flatMap((page) => page.items) ?? [];
  const activeBrands = allBrands.filter((item) => item.active);
  const allRoles = roles.data?.pages.flatMap((page) => page.items) ?? [];
  const shown = templates.data?.items.slice(0, 7).filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (statusFilter === "all" || item.status === statusFilter),
  );
  useEffect(() => {
    if (preview) requestAnimationFrame(() => previewTarget.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [preview]);
  if (editing && base.data)
    return (
      <TemplateEditor
        key={editing.id}
        org={org}
        initial={editing}
        baseline={base.data}
        brands={allBrands}
        roles={allRoles}
        roleLoader={<ChoiceLoader query={roles} />}
        brandingLoader={<ChoiceLoader query={brands} />}
        onClose={() => setEditing(null)}
      />
    );
  return (
    <div className="form-studio-home">
      <Heading title="Form Studio" detail="Create digital patient-journey forms, assign care-team responsibilities, design their PDF pages, test, and publish approved versions." />
      <section className="studio-home-intro" aria-label="Form Studio workflow">
        <div>
          <span className="studio-home-eyebrow">DIGITAL CARE DOCUMENTS</span>
          <h2>Build a form your teams can use together.</h2>
          <p>Structure the clinical journey, connect each section to a care team, then shape the final document in PDFme before publication.</p>
        </div>
        <div className="studio-home-actions">
          <button className={buttonClasses.primary} type="button" onClick={() => setCreating(true)}><Icon name="plus" size={17} outline /> Create digital form</button>
          <button className={buttonClasses.secondary} type="button" onClick={() => setAddingBrand(true)}><Icon name="facilities" size={17} outline /> Facility branding</button>
        </div>
      </section>
      <div className="studio-home-steps" aria-label="Form creation steps">
        <span><b>01</b> Build fields</span><span><b>02</b> Design PDF pages</span><span><b>03</b> Assign teams</span><span><b>04</b> Preview & publish</span>
      </div>
      <div className="studio-home-grid">
        <Panel title="Form version library" icon="form" detail="Published versions are immutable. Clone one to make changes. Existing patient journeys retain their original form version.">
          <QueryState query={templates} />
          <div className="studio-library-toolbar">
            <label className="studio-library-search"><Icon name="search" size={16} outline /><input aria-label="Search forms on this page" placeholder="Search forms on this page" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <WebSelect label="Status" className="studio-status-filter" value={statusFilter} onChange={setStatusFilter} options={[
              { value: "all", label: "All statuses" }, { value: "draft", label: "Drafts" }, { value: "published", label: "Published" }, { value: "retired", label: "Retired" },
            ]} />
            <span className="studio-library-count">{shown?.length ?? 0} shown</span>
          </div>
          <div className="studio-version-list">
            {shown?.map((item) => {
              const sectionCount = item.definition.stages.reduce((count, stage) => count + stage.sections.filter((section) => section.enabled).length, 0);
              return (
                <article className="studio-version-row" key={item.id}>
                  <span className="studio-version-icon"><Icon name="form" size={21} /></span>
                  <div className="studio-version-copy">
                    <div className="studio-version-name"><strong>{item.name}</strong><Status value={item.status} /></div>
                    <small>Version {item.version} · {sectionCount} sections · {item.definition.document ? `${item.definition.document.schemas.length} PDF pages` : "Automatic PDF"}{item.source_template_id ? " · Cloned" : ""}</small>
                  </div>
                  <div className="studio-version-actions">
                    <button type="button" onClick={() => setPreview(item)} aria-label={`Preview ${item.name}`}><Icon name="show" size={16} outline /><span>Preview</span></button>
                    <button type="button" onClick={() => item.status === "draft" ? setEditing(item) : setManage(item)} aria-label={`${item.status === "draft" ? "Edit" : "Manage"} ${item.name}`}><Icon name={item.status === "draft" ? "form" : "settings"} size={16} outline /><span>{item.status === "draft" ? "Edit" : "Manage"}</span></button>
                    {item.status === "draft" && <button type="button" onClick={() => setManage(item)} aria-label={`Manage ${item.name}`}><Icon name="settings" size={16} outline /></button>}
                  </div>
                </article>
              );
            })}
            {templates.data && !templates.data.items.length && <p className="studio-empty-list">No form versions yet. Create your first digital form.</p>}
            {templates.data && !!templates.data.items.length && !shown?.length && <p className="studio-empty-list">No forms on this page match the search or status.</p>}
          </div>
          <Pager offset={offset} count={Math.min(templates.data?.items.length ?? 0, 7)} size={7} hasMore={(templates.data?.items.length ?? 0) > 7} change={setOffset} />
        </Panel>
        <Panel title="Facility identity" icon="facilities" detail="Branding versions apply the facility title, colours, and logo to the final journey ledger.">
          <div className="studio-brand-intro"><p>Choose an identity when you create a form. Each saved branding version stays available to existing documents.</p><button type="button" onClick={() => setAddingBrand(true)}><Icon name="plus" size={15} outline /> Add branding</button></div>
          <QueryState query={brandsPage} />
          <div className="studio-brand-list">
            {brandsPage.data?.items.slice(0, 4).map((item) => (
              <article className="studio-brand-row" key={item.id}>
                <span className="studio-brand-swatches" aria-label="Brand colours"><i style={{ backgroundColor: item.primary_color }} /><i style={{ backgroundColor: item.accent_color }} /></span>
                <div><strong>{item.title}</strong><small>Brand v{item.version}{item.source_brand_id ? " · Revised" : ""}</small></div>
                <Status value={item.active ? "active" : "archived"} />
                <button type="button" onClick={() => setBrandManage(item)} aria-label={`Manage ${item.title}`}><Icon name="arrow" size={16} outline /></button>
              </article>
            ))}
            {brandsPage.data && !brandsPage.data.items.length && <p className="studio-empty-list">Create branding to give your forms a facility identity.</p>}
          </div>
          <Pager offset={brandOffset} count={Math.min(brandsPage.data?.items.length ?? 0, 4)} size={4} hasMore={(brandsPage.data?.items.length ?? 0) > 4} change={setBrandOffset} />
        </Panel>
      </div>
      {preview && <div ref={previewTarget} className="studio-home-preview"><Panel title={`Document preview · ${preview.name}`} icon="show" detail={`Version ${preview.version} · ${preview.status} · Illustrative data only`}><button type="button" className={buttonClasses.secondary} onClick={() => setPreview(null)}>Close preview</button><FormPreview title={preview.name} definition={preview.definition} branding={allBrands.find((item) => item.id === preview.brand_id)} /></Panel></div>}
      {creating && <SideDrawer title="Create a digital form" subtitle="Start a private draft, then build its fields and PDF pages." eyebrow="FORM STUDIO / NEW" closeLabel="Close new form" className="studio-home-drawer" onClose={() => setCreating(false)}>
        <QueryState query={base} /><ChoiceLoader query={brands} />
        {!activeBrands.length && brands.data && <p className="studio-home-guidance">Create an active facility branding version before starting a form.</p>}
        {base.data && !!activeBrands.length && <ActionForm scope={org} path="journey/config/templates" label="Create & open draft" icon="arrow" compactError body={(data) => ({
          name: value(data, "name"), brand_id: value(data, "brand_id"), definition: value(data, "starting_point") === "blank" ? {
            ...base.data, design_version: 2, access_role_ids: [], intake_role_ids: [], document: null,
            stages: base.data!.stages.map((stage) => ({ ...stage, sections: [] })),
          } : base.data,
        })} onSuccess={(result) => { setCreating(false); setEditing(formTemplate.parse(result)); setPreview(null); }}>
          <Field name="name" label="Form name" minLength={2} maxLength={120} />
          <WebSelect name="starting_point" label="Starting point" defaultValue="intake" required options={[{ value: "intake", label: "Reception intake starter" }, { value: "blank", label: "Blank form canvas" }]} />
          <WebSelect name="brand_id" label="Facility branding" defaultValue={activeBrands[0]?.id} required searchable={activeBrands.length > 5} options={activeBrands.map((item) => ({ value: item.id, label: `${item.title} · v${item.version}` }))} />
          <p className="studio-home-guidance">The draft remains private until it passes validation and publication approval. Set up departments and care-team roles before assigning section writers.</p>
        </ActionForm>}
        {!activeBrands.length && <button type="button" className={buttonClasses.secondary} onClick={() => { setCreating(false); setAddingBrand(true); }}>Add facility branding</button>}
      </SideDrawer>}
      {addingBrand && <SideDrawer title="Facility branding" subtitle="Create a reusable title, colours, and logo for clinical documents." eyebrow="FORM STUDIO / IDENTITY" closeLabel="Close branding form" className="studio-home-drawer" onClose={() => setAddingBrand(false)}><BrandForm org={org} onSaved={() => setAddingBrand(false)} /></SideDrawer>}
      {brandManage && <SideDrawer title="Manage branding" subtitle={`${brandManage.title} · version ${brandManage.version}`} eyebrow="FORM STUDIO / IDENTITY" closeLabel="Close branding details" className="studio-home-drawer" onClose={() => setBrandManage(null)}>
        <BrandForm org={org} existing={brandManage} onSaved={() => setBrandManage(null)} />
        <div className="studio-drawer-divider"><h3>{brandManage.active ? "Archive" : "Restore"} this version</h3><ActionForm scope={org} path={`journey/config/brands/${brandManage.id}`} method="PATCH" label={brandManage.active ? "Archive branding" : "Restore branding"} compactError body={(data) => ({ active: !brandManage.active, expected_version: brandManage.revision, reason: value(data, "reason") })} onSuccess={() => setBrandManage(null)}><Field name="reason" label="Reason" minLength={3} maxLength={500} /></ActionForm></div>
      </SideDrawer>}
      {manage && <SideDrawer title="Manage form version" subtitle={`${manage.name} · version ${manage.version}`} eyebrow="FORM STUDIO / CONTROL" closeLabel="Close form actions" className="studio-home-drawer" onClose={() => setManage(null)}>
        <div className="studio-manage-summary"><Status value={manage.status} /><span>{manage.definition.stages.reduce((count, stage) => count + stage.sections.filter((section) => section.enabled).length, 0)} enabled sections</span><span>Revision {manage.revision}</span></div>
        <div className="studio-manage-actions">
          <ActionButton scope={org} path={`journey/config/templates/${manage.id}/clone`} body={{ expected_version: manage.revision, reason: "Create a new draft from this form version" }} onSuccess={(result) => { setManage(null); setEditing(formTemplate.parse(result)); setPreview(null); }}>Clone to new draft</ActionButton>
          {manage.status === "draft" && <button type="button" className={buttonClasses.secondary} onClick={() => { setManage(null); setEditing(manage); }}>Open editor to review & publish</button>}
        </div>
        <div className="studio-drawer-divider"><h3>{manage.active ? manage.status === "published" ? "Retire" : "Archive" : "Restore"} this version</h3><ActionForm scope={org} path={`journey/config/templates/${manage.id}`} method="PATCH" label={manage.active ? "Archive version" : "Restore version"} compactError body={(data) => ({ active: !manage.active, expected_version: manage.revision, reason: value(data, "reason") })} onSuccess={() => setManage(null)}><Field name="reason" label="Reason" minLength={3} maxLength={500} /></ActionForm></div>
      </SideDrawer>}
    </div>
  );
}
