"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api/client";
import { buttonClasses } from "@/lib/presentation";
import {
  brand,
  formTemplate,
  teamRole,
  type Definition,
  type Section,
} from "./journey-contract";
import { Notice, Status } from "./shared";
import dynamic from "next/dynamic";
import { TableColumns } from "@/features/document-studio/table-columns";
const DocumentDesigner = dynamic(
  () =>
    import("@/features/document-studio/designer").then(
      (m) => m.DocumentDesigner,
    ),
  { ssr: false },
);
import { TemplatePreview } from "./template-preview";
type Template = z.infer<typeof formTemplate>;
type Role = z.infer<typeof teamRole>;
type ClinicalField = Section["fields"][number];
const types: [ClinicalField["type"], string][] = [
  ["text", "Short text"],
  ["textarea", "Long text"],
  ["number", "Number"],
  ["boolean", "Yes / no"],
  ["choice", "Dropdown"],
  ["radio", "Single choice"],
  ["multichoice", "Multiple choices"],
  ["date", "Date"],
  ["time", "Time"],
  ["datetime", "Date and time"],
  ["table", "Repeating table"],
  ["attachment", "Clinical images / files"],
  ["link", "External HTTPS link"],
  ["observation_refs", "Shared observation references"],
];
const key = (kind: string) =>
  `${kind}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
export function TemplateEditor({
  org,
  initial,
  brands,
  roles,
  roleLoader,
  brandingLoader,
  onClose,
}: {
  org: string;
  initial: Template;
  baseline: Definition;
  brands: z.infer<typeof brand>[];
  roles: Role[];
  roleLoader?: ReactNode;
  brandingLoader?: ReactNode;
  onClose: () => void;
}) {
  const [studio, setStudio] = useState(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const client = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial.name),
    [brandId, setBrandId] = useState(initial.brand_id);
  const [draft, setDraft] = useState<Definition>(() =>
    structuredClone(initial.definition),
  );
  const [revision, setRevision] = useState(initial.revision),
    [reason, setReason] = useState("");
  const [stageKey, setStageKey] = useState(initial.definition.stages[0].key);
  const [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/journey/config/templates/${initial.id}`,
        formTemplate,
        {
          method: "PUT",
          body: {
            name,
            brand_id: brandId,
            definition: draft,
            expected_version: revision,
            reason,
          },
        },
      ),
    onError: (error) => {
      if (error instanceof ApiError) {
        const path = error.issues[0]?.path ?? [];
        const index = path.indexOf("stages");
        const stage =
          typeof path[index + 1] === "number"
            ? draft.stages[path[index + 1] as number]
            : undefined;
        if (stage) setStageKey(stage.key);
      }
    },
    onSuccess: async (saved) => {
      setDraft(saved.definition);
      setRevision(saved.revision);
      setDirty(false);
      setReason("");
      await client.invalidateQueries({ queryKey: ["live", org] });
    },
  });
  const reload = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/journey/config/templates/${initial.id}`,
        formTemplate,
      ),
    onSuccess: (saved) => {
      setDraft(saved.definition);
      setName(saved.name);
      setBrandId(saved.brand_id);
      setRevision(saved.revision);
      setDirty(false);
      setReason("");
    },
  });
  const change = (fn: (next: Definition) => void) => {
    setDraft((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
    setDirty(true);
    save.reset();
  };
  const activeRoles = roles.filter((role) => role.active);
  const linked = new Set([
    ...draft.access_role_ids,
    ...draft.stages.flatMap((stage) =>
      stage.sections.filter((s) => s.enabled).flatMap((s) => s.role_ids),
    ),
  ]);
  const roleOptions = roles.filter(
    (role) => role.active || linked.has(role.id),
  );
  const stage = draft.stages.find((s) => s.key === stageKey) ?? draft.stages[0];
  const stageIndex = draft.stages.findIndex((s) => s.key === stage.key);
  const sectionPath = (index: number) =>
    `definition.stages.${stageIndex}.sections.${index}`;
  const update = (index: number, fn: (section: Section) => void) =>
    change((next) =>
      fn(next.stages.find((s) => s.key === stage.key)!.sections[index]),
    );
  const writable = (role: Role, section: Section) =>
    section.kind === "administrative"
      ? (role.capabilities.includes("register") ||
          role.capabilities.includes("write")) &&
        role.identity_roles.some((v) => v !== "auditor")
      : role.identity_roles.some((v) =>
          ["doctor", "nurse", "allied"].includes(v),
        ) && role.capabilities.includes("write");
  const writers = (s: Section) => s.write_role_ids ?? s.role_ids;
  const warnings = draft.stages.flatMap((s) =>
    s.sections
      .filter((x) => x.enabled)
      .flatMap((x) =>
        !writers(x).length
          ? [`${s.label}: choose a team to complete ${x.label}.`]
          : x.attestation_required &&
              writers(x).some(
                (id) =>
                  !activeRoles.some(
                    (r) => r.id === id && r.capabilities.includes("attest"),
                  ),
              )
            ? [
                `${x.label}: every writing team needs Attest notes, or turn off attestation.`,
              ]
            : [],
      ),
  );
  return (
    <section
      aria-label="Journey form editor"
      className="mb-8 rounded-2xl border border-border bg-surface p-5 sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-dark">
            FORM DESIGNER · Draft v{initial.version}
          </p>
          <h2 className="text-2xl">{name}</h2>
          <p className="mt-2 text-muted">
            Patient details are captured once. Link the care teams, then give
            each section its writers.
          </p>
        </div>
        <Status value={dirty ? "Unsaved changes" : "Saved draft"} />
        <button
          className={buttonClasses.secondary}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved form changes?"))
              onClose();
          }}
        >
          Close editor
        </button>
      </div>
      {draft.design_version === 1 && (
        <div className="mb-6 rounded-xl border border-border bg-[#f4f8fa] p-5">
          <h3 className="font-semibold">
            This draft uses the original predefined sections
          </h3>
          <p className="my-3 text-sm text-muted">
            Enable flexible editing to rename or remove repeated fields and
            sections. Existing patient journeys keep their original published
            version.
          </p>
          <button
            className={buttonClasses.secondary}
            onClick={() =>
              change((next) => {
                next.design_version = 2;
                next.access_role_ids = [...linked];
                next.intake_role_ids = activeRoles
                  .filter(
                    (r) =>
                      linked.has(r.id) &&
                      (r.capabilities.includes("admit") ||
                        (r.identity_roles.includes("receptionist") &&
                          r.capabilities.includes("register"))),
                  )
                  .map((r) => r.id);
              })
            }
          >
            Enable flexible sections
          </button>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClasses.secondary}
          onClick={() => {
            if (
              !studio ||
              !canvasDirty ||
              window.confirm("Discard unapplied canvas changes?")
            ) {
              setStudio(!studio);
              setCanvasDirty(false);
            }
          }}
        >
          {studio ? "Close page designer" : "Design document pages"}
        </button>
        <span className="text-sm text-muted">
          {draft.document
            ? `${draft.document.schemas.length} designed pages`
            : "Automatic paper layout"}
        </span>
        {draft.document && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              if (
                window.confirm(
                  "Remove the custom layout? Structured fields and permissions will remain.",
                )
              )
                change((next) => {
                  next.document = null;
                });
            }}
          >
            Use automatic layout
          </button>
        )}
      </div>
      {studio && (
        <DocumentDesigner
          definition={draft}
          title={name}
          onPending={(value) => {
            setCanvasDirty(value);
            if (value) setDirty(true);
          }}
          onApply={(document) =>
            change((next) => {
              next.document = document;
            })
          }
        />
      )}
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-bold text-teal-dark">
              1 · DOCUMENT DETAILS
            </p>
            <label className="live-field">
              Form name
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="live-field">
              Facility branding
              <select
                aria-label="Facility branding"
                name="brand_id"
                required
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setDirty(true);
                }}
              >
                {brands
                  .filter((b) => b.active || b.id === brandId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} · v{b.version}
                    </option>
                  ))}
              </select>
            </label>
            {brandingLoader}
          </div>
          <fieldset className="rounded-xl border border-border p-5">
            <legend className="px-2 text-sm font-bold text-teal-dark">
              2 · LINKED CARE TEAMS
            </legend>
            <p className="mb-4 text-sm text-muted">
              Every linked team reads the entire ledger. Select intake teams who
              may start it. Writing is configured separately for each section.
            </p>
            {roleOptions.map((role) => (
              <div
                className="flex flex-wrap justify-between gap-3 border-t border-border py-3"
                key={role.id}
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Link ${role.name}`}
                    checked={linked.has(role.id)}
                    onChange={(e) =>
                      change((next) => {
                        if (e.target.checked)
                          next.access_role_ids = [
                            ...new Set([...next.access_role_ids, role.id]),
                          ];
                        else {
                          next.access_role_ids = next.access_role_ids.filter(
                            (id) => id !== role.id,
                          );
                          next.intake_role_ids = next.intake_role_ids.filter(
                            (id) => id !== role.id,
                          );
                          for (const st of next.stages)
                            for (const section of st.sections) {
                              section.role_ids = section.role_ids.filter(
                                (id) => id !== role.id,
                              );
                              if (section.write_role_ids)
                                section.write_role_ids =
                                  section.write_role_ids.filter(
                                    (id) => id !== role.id,
                                  );
                            }
                        }
                      })
                    }
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small className="block text-muted">
                      {role.identity_roles.join(" · ")}
                    </small>
                  </span>
                </label>
                {linked.has(role.id) &&
                  (role.capabilities.includes("admit") ||
                    (role.identity_roles.includes("receptionist") &&
                      role.capabilities.includes("register"))) && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.intake_role_ids.includes(role.id)}
                        onChange={(e) =>
                          change((next) => {
                            next.intake_role_ids = e.target.checked
                              ? [...next.intake_role_ids, role.id]
                              : next.intake_role_ids.filter(
                                  (id) => id !== role.id,
                                );
                          })
                        }
                      />
                      Can start journey
                    </label>
                  )}
              </div>
            ))}
            {roleLoader}
            {!activeRoles.length && (
              <p>
                Create care-team roles under Departments & care teams first.
              </p>
            )}
            {!draft.intake_role_ids.length && draft.design_version === 2 && (
              <p className="mt-3 text-sm text-amber-800">
                Choose at least one intake team. A reception team needs
                “Register patients”; a clinical intake team needs “Open
                journeys”.
              </p>
            )}
          </fieldset>
        </div>
        <div className="my-7 border-t border-border pt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">3 · Sections & fields</h3>
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Back to editing" : "Preview document"}
            </button>
          </div>
          <nav
            className="mb-5 flex gap-2 overflow-x-auto"
            aria-label="Form stages"
          >
            {draft.stages.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`shrink-0 rounded-lg border px-4 py-3 text-sm ${stage.key === item.key ? "border-teal bg-mint text-teal-dark" : "border-border"}`}
                onClick={() => setStageKey(item.key)}
              >
                {item.label}
                <small className="ml-2 text-muted">
                  {item.sections.filter((s) => s.enabled).length}
                </small>
              </button>
            ))}
          </nav>
          {preview ? (
            <TemplatePreview
              definition={draft}
              branding={brands.find((b) => b.id === brandId)}
              stageKey={stageKey}
            />
          ) : (
            <>
              <label className="live-field">
                Stage title
                <input
                  name={`definition.stages.${stageIndex}.label`}
                  value={stage.label}
                  required
                  minLength={2}
                  maxLength={120}
                  onChange={(e) =>
                    change((next) => {
                      next.stages.find((s) => s.key === stage.key)!.label =
                        e.target.value;
                    })
                  }
                />
              </label>
              {!stage.sections.length && (
                <p className="my-6 rounded-xl border border-dashed border-border p-6 text-muted">
                  No section in this stage. Add only what your facility needs.
                  Empty stages stay out of the employee’s ledger.
                </p>
              )}
              {stage.sections.map((section, index) => (
                <div
                  className="my-5 rounded-xl border border-border p-5"
                  key={section.key}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold">{section.label}</h4>
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) =>
                          update(index, (s) => {
                            s.enabled = e.target.checked;
                          })
                        }
                      />
                      Include in published document
                    </label>
                    {draft.design_version === 2 && (
                      <button
                        type="button"
                        className="text-sm text-red-700 underline"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${section.label} from this draft?`,
                            )
                          )
                            change((next) => {
                              next.stages
                                .find((s) => s.key === stage.key)!
                                .sections.splice(index, 1);
                            });
                        }}
                      >
                        Remove section
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="live-field">
                      Section title
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        name={`${sectionPath(index)}.label`}
                        value={section.label}
                        onChange={(e) =>
                          update(index, (s) => {
                            s.label = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label className="live-field">
                      Section purpose
                      <select
                        disabled={draft.design_version === 1}
                        aria-label="Section purpose"
                        name={`${sectionPath(index)}.kind`}
                        value={section.kind}
                        onChange={(e) =>
                          update(index, (s) => {
                            s.kind = e.target.value as Section["kind"];
                            s.attestation_required = false;
                            s.write_role_ids = [];
                            s.role_ids = [];
                            s.identity_roles =
                              s.kind === "administrative"
                                ? ["receptionist"]
                                : ["doctor", "nurse", "allied"];
                          })
                        }
                      >
                        <option value="clinical">Clinical care</option>
                        <option value="administrative">
                          Reception / administrative intake
                        </option>
                      </select>
                    </label>
                  </div>
                  <fieldset className="mb-4 rounded-lg border border-border p-4">
                    <legend className="px-2 font-semibold">
                      Teams allowed to complete this section
                    </legend>
                    <p className="mb-3 text-sm text-muted">
                      All linked teams can read it. These teams can also enter
                      information.
                    </p>
                    {activeRoles
                      .filter((r) => linked.has(r.id))
                      .map((role) => (
                        <label
                          className="mr-6 mb-3 inline-flex items-center gap-2"
                          key={role.id}
                        >
                          <input
                            type="checkbox"
                            disabled={!writable(role, section)}
                            name={`${sectionPath(index)}.role_ids`}
                            checked={writers(section).includes(role.id)}
                            onChange={(e) =>
                              update(index, (s) => {
                                const selected = e.target.checked
                                  ? [...writers(s), role.id]
                                  : writers(s).filter((id) => id !== role.id);
                                s.role_ids = [...new Set(selected)];
                                s.write_role_ids = s.role_ids;
                                s.identity_roles = [
                                  ...new Set(
                                    roles
                                      .filter((r) => s.role_ids.includes(r.id))
                                      .flatMap((r) => r.identity_roles),
                                  ),
                                ];
                                if (!s.identity_roles.length)
                                  s.identity_roles =
                                    s.kind === "administrative"
                                      ? ["receptionist"]
                                      : ["doctor", "nurse", "allied"];
                              })
                            }
                          />
                          {role.name}
                          {!writable(role, section) && (
                            <small className="text-muted">(read only)</small>
                          )}
                        </label>
                      ))}
                  </fieldset>
                  {section.kind === "clinical" && (
                    <label className="mb-5 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={section.attestation_required}
                        onChange={(e) =>
                          update(index, (s) => {
                            s.attestation_required = e.target.checked;
                          })
                        }
                      />
                      Require the author’s password-confirmed attestation
                    </label>
                  )}
                  <div className="space-y-4">
                    {section.fields.map((field, fi) => (
                      <div
                        key={field.key}
                        className="rounded-lg border border-border bg-[#f8fafb] p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                          <label className="live-field">
                            Field label
                            <input
                              required
                              minLength={2}
                              maxLength={120}
                              name={`${sectionPath(index)}.fields.${fi}.label`}
                              value={field.label}
                              onChange={(e) =>
                                update(index, (s) => {
                                  s.fields[fi].label = e.target.value;
                                })
                              }
                            />
                          </label>
                          <label className="live-field">
                            Field type
                            <select
                              aria-label="Field type"
                              name={`${sectionPath(index)}.fields.${fi}.type`}
                              value={field.type}
                              disabled={draft.design_version === 1}
                              onChange={(e) =>
                                update(index, (s) => {
                                  s.fields[fi].type = e.target
                                    .value as ClinicalField["type"];
                                  s.fields[fi].choices = [];
                                  s.fields[fi].columns =
                                    e.target.value === "table"
                                      ? [
                                          {
                                            key: "column_one",
                                            label: "Details",
                                            type: "text",
                                            required: false,
                                            choices: [],
                                          },
                                        ]
                                      : [];
                                  s.fields[fi].max_rows = 20;
                                })
                              }
                            >
                              {types.map(([kind, label]) => (
                                <option key={kind} value={kind}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {field.type === "table" && (
                          <TableColumns
                            field={field}
                            onChange={(field) =>
                              update(index, (s) => {
                                s.fields[fi] = field;
                              })
                            }
                          />
                        )}
                        {["choice", "radio", "multichoice"].includes(
                          field.type,
                        ) && (
                          <label className="live-field">
                            Choices (one per line)
                            <textarea
                              required
                              name={`${sectionPath(index)}.fields.${fi}.choices`}
                              value={field.choices.join("\n")}
                              onChange={(e) =>
                                update(index, (s) => {
                                  s.fields[fi].choices =
                                    e.target.value.split("\n");
                                })
                              }
                            />
                          </label>
                        )}
                        <div className="flex justify-between gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                update(index, (s) => {
                                  s.fields[fi].required = e.target.checked;
                                })
                              }
                            />
                            Required
                          </label>
                          {draft.design_version === 2 &&
                            section.fields.length > 1 && (
                              <button
                                type="button"
                                className="text-sm text-red-700 underline"
                                onClick={() =>
                                  update(index, (s) => {
                                    s.fields.splice(fi, 1);
                                  })
                                }
                              >
                                Remove field
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`${buttonClasses.secondary} mt-4`}
                    disabled={section.fields.length >= 30}
                    onClick={() =>
                      update(index, (s) => {
                        s.fields.push({
                          key: key("field"),
                          label: "New field",
                          type: "text",
                          required: false,
                          choices: [],
                        });
                      })
                    }
                  >
                    Add field
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={buttonClasses.secondary}
                disabled={stage.sections.length >= 32}
                onClick={() =>
                  change((next) => {
                    next.stages
                      .find((s) => s.key === stage.key)!
                      .sections.push({
                        key: key("section"),
                        label: "New section",
                        kind: "clinical",
                        identity_roles: ["doctor", "nurse", "allied"],
                        role_ids: [],
                        write_role_ids: [],
                        attestation_required: false,
                        enabled: true,
                        fields: [
                          {
                            key: key("field"),
                            label: "Professional note",
                            type: "textarea",
                            required: true,
                            choices: [],
                          },
                        ],
                      });
                  })
                }
              >
                Add section
              </button>
            </>
          )}
        </div>
        {warnings.length > 0 && (
          <details className="mb-5 rounded-lg border border-border p-4">
            <summary>
              {warnings.length} section assignment
              {warnings.length === 1 ? "" : "s"} to review before publishing
            </summary>
            <ul className="mt-3 list-disc pl-5 text-sm">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
        <label className="live-field">
          Change reason
          <input
            name="reason"
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {canvasDirty && (
          <p role="status" className="my-3 text-sm text-amber-800">
            Apply the page layout before saving this draft.
          </p>
        )}
        <Notice error={save.error} formRef={formRef} />
        <Notice error={reload.error} />
        {save.isSuccess && !dirty && (
          <p role="status" className="mb-4 text-teal-dark">
            Draft saved. Review the preview, then publish from the form list.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            className={buttonClasses.primary}
            disabled={save.isPending || !dirty || canvasDirty}
          >
            {save.isPending ? "Saving…" : "Save draft changes"}
          </button>
          <button
            type="button"
            className={buttonClasses.secondary}
            disabled={reload.isPending}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Discard unsaved changes and load the latest saved draft?",
                )
              )
                reload.mutate();
            }}
          >
            Reload saved draft
          </button>
        </div>
      </form>
    </section>
  );
}
