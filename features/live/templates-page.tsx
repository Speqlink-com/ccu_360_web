"use client";
import { useState } from "react";
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
import { TemplatePreview } from "./template-preview";

type Brand = z.infer<typeof brand>;
type Template = z.infer<typeof formTemplate>;
function BrandForm({ org, existing }: { org: string; existing?: Brand }) {
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
          defaultValue={existing?.primary_color ?? "#092744"}
        />
        <Field
          name="accent_color"
          label="Accent colour"
          type="color"
          defaultValue={existing?.accent_color ?? "#008f89"}
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
  const [previewStage, setPreviewStage] = useState("admission");
  const base = useLiveQuery(org, "journey/config/baseline", definition);
  const templates = useLiveQuery(
    org,
    `journey/config/templates?offset=${offset}&limit=20`,
    pageOf(formTemplate),
  );
  const brandsPage = useLiveQuery(
    org,
    `journey/config/brands?offset=${brandOffset}&limit=20`,
    pageOf(brand),
  );
  const brands = useChoices(org, "journey/config/brands", brand);
  const roles = useChoices(org, "workforce/roles", teamRole);
  const allBrands = brands.data?.pages.flatMap((page) => page.items) ?? [];
  const allRoles = roles.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      <Heading
        title="Journey forms & branding"
        detail="Design your facility’s shared patient document. Publish reviewed form versions, preserve existing encounters, and give every professional team a clear place to contribute."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          [
            "01",
            "Define the facility",
            "Set the document title, colours and logo.",
          ],
          [
            "02",
            "Design the journey",
            "Customize fields and assign shared care teams.",
          ],
          [
            "03",
            "Review & publish",
            "Preview, validate and approve a pinned version.",
          ],
        ].map(([number, title, detail]) => (
          <div
            key={number}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <span className="font-mono text-sm text-teal-dark">{number}</span>
            <h2 className="mt-2 font-semibold text-navy">{title}</h2>
            <p className="mt-2 text-sm text-muted">{detail}</p>
          </div>
        ))}
      </div>
      {!editing && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Panel
            title="Facility identity"
            detail="Create reusable branding for the final journey ledger."
          >
            <details>
              <summary className="mb-4 cursor-pointer font-semibold text-teal-dark">
                Add facility branding
              </summary>
              <BrandForm org={org} />
            </details>
            <QueryState query={brandsPage} />
            {brandsPage.data?.items.map((item) => (
              <div key={item.id} className="border-t border-border py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="text-sm text-muted">
                      Brand v{item.version}
                      {item.source_brand_id ? " · Revised identity" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2" aria-label="Brand colours">
                    <span
                      className="h-7 w-7 rounded-full border border-border"
                      style={{ backgroundColor: item.primary_color }}
                    />
                    <span
                      className="h-7 w-7 rounded-full border border-border"
                      style={{ backgroundColor: item.accent_color }}
                    />
                  </div>
                  <Status value={item.active ? "active" : "archived"} />
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-teal-dark">
                    Revise branding
                  </summary>
                  <div className="mt-4">
                    <BrandForm org={org} existing={item} />
                  </div>
                </details>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted">
                    {item.active ? "Archive branding" : "Restore branding"}
                  </summary>
                  <ActionForm
                    scope={org}
                    path={`journey/config/brands/${item.id}`}
                    method="PATCH"
                    label={
                      item.active
                        ? "Archive branding version"
                        : "Restore branding version"
                    }
                    body={(data) => ({
                      active: !item.active,
                      expected_version: item.revision,
                      reason: value(data, "reason"),
                    })}
                  >
                    <Field
                      name="reason"
                      label="Reason"
                      minLength={3}
                      maxLength={500}
                    />
                  </ActionForm>
                </details>
              </div>
            ))}
            <Pager
              offset={brandOffset}
              count={brandsPage.data?.items.length ?? 0}
              change={setBrandOffset}
            />
          </Panel>
          <Panel
            title="Start a journey form"
            detail="Start from the standard nine-stage ledger. Existing versions can be cloned below."
          >
            <QueryState query={base} />
            <ChoiceLoader query={brands} />
            <ChoiceLoader query={roles} />
            {base.data && (
              <ActionForm
                disabled={!!editing}
                scope={org}
                path="journey/config/templates"
                label="Create & open draft"
                body={(data) => ({
                  name: value(data, "name"),
                  brand_id: value(data, "brand_id"),
                  definition: base.data,
                })}
                onSuccess={(result) => {
                  setEditing(formTemplate.parse(result));
                  setPreview(null);
                }}
              >
                <Field
                  name="name"
                  label="Form name"
                  minLength={2}
                  maxLength={120}
                />
                <Field name="brand_id" label="Facility branding">
                  <option value="">Choose active branding</option>
                  {allBrands
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · v{item.version}
                      </option>
                    ))}
                </Field>
                {editing && (
                  <p className="mb-4 text-sm text-muted">
                    Close the open editor before starting another draft.
                  </p>
                )}
              </ActionForm>
            )}
            <p className="mt-4 text-sm text-muted">
              Create departments and compatible care-team roles before
              publishing. Link the participating teams, select an intake team,
              then assign writers to each section. Attestation is optional for
              clinical sections.
            </p>
          </Panel>
        </div>
      )}
      {editing && base.data && (
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
      )}
      {preview && (
        <Panel
          title={`Document preview · ${preview.name}`}
          detail={`Version ${preview.version} · ${preview.status} · Illustrative data only`}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              aria-label="Preview stage"
              value={previewStage}
              onChange={(event) => setPreviewStage(event.target.value)}
            >
              {preview.definition.stages.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() => setPreview(null)}
            >
              Close preview
            </button>
          </div>
          <TemplatePreview
            definition={preview.definition}
            branding={allBrands.find((item) => item.id === preview.brand_id)}
            stageKey={previewStage}
          />
        </Panel>
      )}
      <Panel
        title="Form version library"
        detail="Published versions are immutable. Clone a version for changes; retiring a form prevents new admissions while existing patient journeys retain it."
      >
        <QueryState query={templates} />
        {templates.data?.items.map((item) => (
          <article key={item.id} className="border-b border-border py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <strong className="text-lg text-navy">{item.name}</strong>
                <p className="mt-1 text-sm text-muted">
                  Version {item.version} · Revision {item.revision} ·{" "}
                  {item.definition.stages.reduce(
                    (sum, stage) =>
                      sum +
                      stage.sections.filter((section) => section.enabled)
                        .length,
                    0,
                  )}{" "}
                  enabled sections
                  {item.source_template_id ? " · Cloned version" : ""}
                </p>
              </div>
              <Status value={item.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <button
                className={buttonClasses.secondary}
                onClick={() => {
                  setPreview(item);
                  setPreviewStage("admission");
                }}
              >
                Preview ledger
              </button>
              {item.status === "draft" && (
                <button
                  className={buttonClasses.secondary}
                  disabled={!!editing}
                  onClick={() => {
                    setEditing(item);
                    setPreview(null);
                  }}
                >
                  Edit saved draft
                </button>
              )}
              {!editing && (
                <ActionButton
                  scope={org}
                  path={`journey/config/templates/${item.id}/clone`}
                  body={{
                    expected_version: item.revision,
                    reason: "Create a new draft from this form version",
                  }}
                  onSuccess={(result) => {
                    setEditing(formTemplate.parse(result));
                    setPreview(null);
                  }}
                >
                  Clone to new draft
                </ActionButton>
              )}
              {item.status === "draft" && !editing && (
                <>
                  <ActionButton
                    scope={org}
                    path={`journey/config/templates/${item.id}/validate`}
                  >
                    Validate for publication
                  </ActionButton>
                  <ActionButton
                    scope={org}
                    path={`journey/config/templates/${item.id}/publish`}
                    body={{ approved: true, expected_version: item.revision }}
                    confirm="Approve and publish this form for new patient journeys? The published version becomes immutable."
                  >
                    Approve & publish
                  </ActionButton>
                </>
              )}
            </div>
            {!editing && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted">
                  {item.active
                    ? item.status === "published"
                      ? "Retire version"
                      : "Archive draft"
                    : "Restore version"}
                </summary>
                <ActionForm
                  scope={org}
                  path={`journey/config/templates/${item.id}`}
                  method="PATCH"
                  label={
                    item.active
                      ? "Archive this version"
                      : "Restore this version"
                  }
                  body={(data) => ({
                    active: !item.active,
                    expected_version: item.revision,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="reason"
                    label="Reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
              </details>
            )}
          </article>
        ))}
        {templates.data && !templates.data.items.length && (
          <p>
            No form versions yet. Create branding and start your first draft.
          </p>
        )}
        <Pager
          offset={offset}
          count={templates.data?.items.length ?? 0}
          change={setOffset}
        />
      </Panel>
    </>
  );
}
