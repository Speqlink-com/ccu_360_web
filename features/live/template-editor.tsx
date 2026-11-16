"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api/client";
import { buttonClasses } from "@/lib/presentation";
import {
  brand,
  formTemplate,
  teamRole,
  type Definition,
} from "./journey-contract";
import { Notice, Status } from "./shared";
import { TemplatePreview } from "./template-preview";

type Template = z.infer<typeof formTemplate>;
type Field = Definition["stages"][number]["sections"][number]["fields"][number];
const types: [Field["type"], string][] = [
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
  ["observation_refs", "Original observation references"],
];
const newKey = (kind: string) =>
  `${kind}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
export function TemplateEditor({
  org,
  initial,
  baseline,
  brands,
  roles,
  onClose,
}: {
  org: string;
  initial: Template;
  baseline: Definition;
  brands: z.infer<typeof brand>[];
  roles: z.infer<typeof teamRole>[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial.name);
  const [brandId, setBrandId] = useState(initial.brand_id);
  const [draft, setDraft] = useState<Definition>(() =>
    structuredClone(initial.definition),
  );
  const [revision, setRevision] = useState(initial.revision);
  const [reason, setReason] = useState("");
  const [stageKey, setStageKey] = useState(initial.definition.stages[0].key);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async () =>
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
        if (index >= 0 && stage) setStageKey(stage.key);
      }
    },
    onSuccess: async (saved) => {
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
      setName(saved.name);
      setBrandId(saved.brand_id);
      setDraft(structuredClone(saved.definition));
      setRevision(saved.revision);
      setReason("");
      setDirty(false);
      save.reset();
    },
  });
  const stageIndex = draft.stages.findIndex((stage) => stage.key === stageKey);
  const stage = draft.stages[stageIndex];
  const change = (update: (next: Definition) => void) => {
    setDraft((current) => {
      const next = structuredClone(current);
      update(next);
      return next;
    });
    setDirty(true);
    save.reset();
  };
  return (
    <section
      className="mb-6 overflow-hidden rounded-[14px] border border-border bg-surface"
      aria-label="Saved draft editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-dark">
            Journey design studio
          </p>
          <h2 className="mt-2 text-2xl text-navy">{name}</h2>
          <p className="mt-1 text-sm text-muted">
            Form version {initial.version} · Revision {revision} ·{" "}
            {dirty ? "Unsaved changes" : "Saved draft"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClasses.secondary}
            disabled={save.isPending || reload.isPending}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Discard unsaved changes and reload the saved draft?",
                )
              )
                reload.mutate();
            }}
          >
            Reload saved draft
          </button>
          <button
            type="button"
            className={buttonClasses.secondary}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Edit fields" : "Preview document"}
          </button>
          <button
            type="button"
            className={buttonClasses.secondary}
            disabled={save.isPending}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved form changes?"))
                onClose();
            }}
          >
            Close editor
          </button>
        </div>
      </div>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={save.isPending || reload.isPending}>
          <div className="grid gap-4 border-b border-border p-6 md:grid-cols-2">
            <label className="live-field">
              Form name
              <input
                required
                minLength={2}
                maxLength={120}
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="live-field">
              Facility branding
              <select
                required
                name="brand_id"
                value={brandId}
                onChange={(event) => {
                  setBrandId(event.target.value);
                  setDirty(true);
                }}
              >
                {brands
                  .filter((item) => item.active || item.id === brandId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · v{item.version}
                      {!item.active ? " (archived)" : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="border-b border-border px-6 py-4">
            <label className="live-field">
              Apply a medical team role across all stages
              <select
                defaultValue=""
                onChange={(event) => {
                  const roleId = event.target.value;
                  if (!roleId) return;
                  change((next) => {
                    for (const item of next.stages)
                      for (const section of item.sections)
                        if (
                          section.identity_roles.length === 1 &&
                          section.identity_roles[0] === "doctor"
                        ) {
                          section.role_ids = [roleId];
                          section.enabled = true;
                        }
                  });
                }}
              >
                <option value="">Choose a shared medical team</option>
                {roles
                  .filter(
                    (role) =>
                      role.active &&
                      role.identity_roles.length === 1 &&
                      role.identity_roles[0] === "doctor" &&
                      ["read", "write", "attest"].every((capability) =>
                        role.capabilities.includes(capability),
                      ),
                  )
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav
              aria-label="Form stages"
              className="flex gap-2 overflow-x-auto border-b border-border bg-[#f7fafb] p-4 lg:flex-col lg:border-r lg:border-b-0"
            >
              {draft.stages.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  aria-current={stageKey === item.key ? "step" : undefined}
                  className={`shrink-0 rounded-lg border p-3 text-left text-sm ${stageKey === item.key ? "border-teal bg-mint text-teal-dark" : "border-transparent text-muted"}`}
                  onClick={() => setStageKey(item.key)}
                >
                  <span className="mr-2 font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                  <small className="mt-1 block lg:ml-6">
                    {item.sections.filter((section) => section.enabled).length}{" "}
                    active sections
                  </small>
                </button>
              ))}
            </nav>
            <div className="min-w-0 p-5 md:p-6">
              {preview ? (
                <TemplatePreview
                  definition={draft}
                  branding={brands.find((item) => item.id === brandId)}
                  stageKey={stageKey}
                />
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl text-navy">{stage.label}</h3>
                      <p className="text-sm text-muted">
                        Standard fields preserve clinical meaning. Add local
                        fields or a shared professional section.
                      </p>
                    </div>
                    <button
                      className={buttonClasses.secondary}
                      type="button"
                      disabled={stage.sections.length >= 32}
                      onClick={() =>
                        change((next) =>
                          next.stages[stageIndex].sections.push({
                            key: newKey("section"),
                            label: "Additional clinical section",
                            enabled: true,
                            identity_roles: ["doctor"],
                            role_ids: [],
                            fields: [
                              {
                                key: "note",
                                label: "Professional assessment",
                                type: "textarea",
                                required: true,
                                choices: [],
                              },
                            ],
                          }),
                        )
                      }
                    >
                      Add section
                    </button>
                  </div>
                  {stage.sections.map((section, sectionIndex) => {
                    const standard = baseline.stages
                      .find((item) => item.key === stage.key)
                      ?.sections.find((item) => item.key === section.key);
                    const editSection = (
                      update: (item: typeof section) => void,
                    ) =>
                      change((next) =>
                        update(next.stages[stageIndex].sections[sectionIndex]),
                      );
                    const eligible = roles.filter(
                      (role) =>
                        role.active &&
                        role.identity_roles.every((identity) =>
                          section.identity_roles.includes(identity),
                        ) &&
                        ["read", "write", "attest"].every((capability) =>
                          role.capabilities.includes(capability),
                        ),
                    );
                    return (
                      <details
                        key={section.key}
                        open={section.enabled}
                        className="mb-4 rounded-xl border border-border p-5"
                      >
                        <summary className="cursor-pointer font-semibold text-navy">
                          {section.label}{" "}
                          <Status
                            value={section.enabled ? "active" : "disabled"}
                          />
                        </summary>
                        <div className="mt-4">
                          <label className="check-label mb-4">
                            <input
                              type="checkbox"
                              checked={section.enabled}
                              onChange={(event) =>
                                editSection((item) => {
                                  item.enabled = event.target.checked;
                                })
                              }
                            />
                            Enable this section
                          </label>
                          <label className="live-field">
                            Section title
                            <input
                              required
                              minLength={2}
                              maxLength={120}
                              name={`definition.stages.${stageIndex}.sections.${sectionIndex}.label`}
                              value={section.label}
                              onChange={(event) =>
                                editSection((item) => {
                                  item.label = event.target.value;
                                })
                              }
                            />
                          </label>
                          {!standard && (
                            <fieldset className="option-grid">
                              <legend>Eligible professions</legend>
                              {["doctor", "nurse", "allied"].map(
                                (profession) => (
                                  <label
                                    className="check-label"
                                    key={profession}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={section.identity_roles.includes(
                                        profession,
                                      )}
                                      onChange={(event) =>
                                        editSection((item) => {
                                          item.identity_roles = event.target
                                            .checked
                                            ? [
                                                ...item.identity_roles,
                                                profession,
                                              ]
                                            : item.identity_roles.filter(
                                                (value) => value !== profession,
                                              );
                                          item.role_ids = [];
                                        })
                                      }
                                    />
                                    {profession}
                                  </label>
                                ),
                              )}
                            </fieldset>
                          )}
                          {section.enabled && (
                            <>
                              <fieldset className="option-grid">
                                <legend>Responsible shared care teams</legend>
                                {eligible.map((role) => (
                                  <label className="check-label" key={role.id}>
                                    <input
                                      type="checkbox"
                                      checked={section.role_ids.includes(
                                        role.id,
                                      )}
                                      onChange={(event) =>
                                        editSection((item) => {
                                          item.role_ids = event.target.checked
                                            ? [...item.role_ids, role.id]
                                            : item.role_ids.filter(
                                                (id) => id !== role.id,
                                              );
                                        })
                                      }
                                    />
                                    {role.name}
                                  </label>
                                ))}
                                {!eligible.length && (
                                  <p className="text-sm text-muted">
                                    Create an active compatible team role with
                                    read, write and attest permissions.
                                  </p>
                                )}
                              </fieldset>
                              {section.role_ids.some(
                                (id) =>
                                  !eligible.some((role) => role.id === id),
                              ) && (
                                <p className="mb-3 text-sm text-red-700">
                                  Some assigned roles are unavailable or
                                  incompatible. Reassign before publishing.
                                  <button
                                    type="button"
                                    className="mt-2 block font-semibold underline"
                                    onClick={() =>
                                      editSection((item) => {
                                        item.role_ids = item.role_ids.filter(
                                          (id) =>
                                            eligible.some(
                                              (role) => role.id === id,
                                            ),
                                        );
                                      })
                                    }
                                  >
                                    Remove unavailable role mappings
                                  </button>
                                </p>
                              )}
                              <div className="mt-5 space-y-3">
                                {section.fields.map((field, fieldIndex) => {
                                  const canonical = standard?.fields.find(
                                    (item) => item.key === field.key,
                                  );
                                  const editField = (
                                    update: (item: Field) => void,
                                  ) =>
                                    editSection((item) =>
                                      update(item.fields[fieldIndex]),
                                    );
                                  return (
                                    <div
                                      key={field.key}
                                      className="rounded-lg border border-border bg-[#f8fafb] p-4"
                                    >
                                      <div className="mb-3 flex flex-wrap justify-between gap-2">
                                        <small className="font-mono text-muted">
                                          {field.key} ·{" "}
                                          {canonical
                                            ? "Standard field"
                                            : "Facility field"}
                                        </small>
                                        <div className="flex gap-3">
                                          {[-1, 1].map((direction) => (
                                            <button
                                              type="button"
                                              key={direction}
                                              disabled={
                                                fieldIndex + direction < 0 ||
                                                fieldIndex + direction >=
                                                  section.fields.length
                                              }
                                              className="text-sm text-teal-dark disabled:opacity-30"
                                              aria-label={`${direction < 0 ? "Move up" : "Move down"} ${field.label}`}
                                              onClick={() =>
                                                editSection((item) => {
                                                  [
                                                    item.fields[fieldIndex],
                                                    item.fields[
                                                      fieldIndex + direction
                                                    ],
                                                  ] = [
                                                    item.fields[
                                                      fieldIndex + direction
                                                    ],
                                                    item.fields[fieldIndex],
                                                  ];
                                                })
                                              }
                                            >
                                              {direction < 0
                                                ? "↑ Up"
                                                : "↓ Down"}
                                            </button>
                                          ))}
                                          {!canonical && (
                                            <button
                                              type="button"
                                              className="text-sm text-red-700"
                                              onClick={() =>
                                                editSection((item) => {
                                                  item.fields.splice(
                                                    fieldIndex,
                                                    1,
                                                  );
                                                })
                                              }
                                            >
                                              Remove field
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <label className="live-field">
                                          Field label
                                          <input
                                            required
                                            minLength={2}
                                            maxLength={120}
                                            name={`definition.stages.${stageIndex}.sections.${sectionIndex}.fields.${fieldIndex}.label`}
                                            value={field.label}
                                            onChange={(event) =>
                                              editField((item) => {
                                                item.label = event.target.value;
                                              })
                                            }
                                          />
                                        </label>
                                        <label className="live-field">
                                          Field type
                                          <select
                                            aria-label="Field type"
                                            name={`definition.stages.${stageIndex}.sections.${sectionIndex}.fields.${fieldIndex}.type`}
                                            value={field.type}
                                            disabled={!!canonical}
                                            onChange={(event) =>
                                              editField((item) => {
                                                item.type = event.target
                                                  .value as Field["type"];
                                                item.choices = [
                                                  "choice",
                                                  "radio",
                                                  "multichoice",
                                                ].includes(item.type)
                                                  ? ["Option one", "Option two"]
                                                  : [];
                                              })
                                            }
                                          >
                                            {types.map(([key, label]) => (
                                              <option key={key} value={key}>
                                                {label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                      {[
                                        "choice",
                                        "radio",
                                        "multichoice",
                                      ].includes(field.type) && (
                                        <label className="live-field">
                                          Choices (one per line)
                                          <textarea
                                            required
                                            maxLength={6000}
                                            name={`definition.stages.${stageIndex}.sections.${sectionIndex}.fields.${fieldIndex}.choices`}
                                            value={field.choices.join("\n")}
                                            onChange={(event) =>
                                              editField((item) => {
                                                item.choices =
                                                  event.target.value.split(
                                                    "\n",
                                                  );
                                              })
                                            }
                                          />
                                        </label>
                                      )}
                                      <label className="check-label">
                                        <input
                                          type="checkbox"
                                          checked={field.required}
                                          disabled={!!canonical?.required}
                                          onChange={(event) =>
                                            editField((item) => {
                                              item.required =
                                                event.target.checked;
                                            })
                                          }
                                        />
                                        Required, or an explicit reason why
                                        unavailable
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                className={`${buttonClasses.secondary} mt-4`}
                                type="button"
                                disabled={section.fields.length >= 30}
                                onClick={() =>
                                  editSection((item) =>
                                    item.fields.push({
                                      key: newKey("field"),
                                      label: "Additional information",
                                      type: "text",
                                      required: false,
                                      choices: [],
                                    }),
                                  )
                                }
                              >
                                Add custom field
                              </button>
                            </>
                          )}
                          {!standard && (
                            <button
                              type="button"
                              className="mt-4 block text-sm text-red-700"
                              onClick={() =>
                                change((next) => {
                                  next.stages[stageIndex].sections.splice(
                                    sectionIndex,
                                    1,
                                  );
                                })
                              }
                            >
                              Remove custom section
                            </button>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          <div className="border-t border-border bg-[#f7fafb] p-6">
            <label className="live-field">
              Change reason
              <input
                required
                minLength={3}
                maxLength={500}
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Describe the change for the configuration audit"
              />
            </label>
            <Notice error={save.error} formRef={formRef} />
            <Notice error={reload.error} />
            {save.isSuccess && (
              <p role="status" className="mb-3 text-teal-dark">
                Draft saved. Preview and validate it before publication.
              </p>
            )}
            <button
              className={buttonClasses.primary}
              disabled={save.isPending || !dirty}
            >
              {save.isPending ? "Saving…" : "Save draft changes"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
