"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import {
  definition,
  brand,
  formTemplate,
  teamRole,
  type Definition,
} from "./journey-contract";
import {
  Heading,
  Panel,
  Field,
  ActionForm,
  ActionButton,
  Notice,
  QueryState,
  Status,
  Pager,
  value,
} from "./shared";
import { useChoices, ChoiceLoader } from "./choices";

export function TemplatesPage() {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Definition | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const base = useLiveQuery(org, "journey/config/baseline", definition);
  const templates = useLiveQuery(
    org,
    `journey/config/templates?offset=${offset}&limit=20`,
    pageOf(formTemplate),
  );
  const brands = useChoices(org, "journey/config/brands", brand);
  const roles = useChoices(org, "workforce/roles", teamRole);
  const options =
    roles.data?.pages
      .flatMap((page) => page.items)
      .filter((role) => role.active) ?? [];
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.size || file.size > 256_000)
        throw new Error("Choose a PNG, JPEG or WebP logo smaller than 250 KB.");
      const result = await apiRequest(
        "/api/v1/journey/config/logos",
        z.object({ id: z.string() }),
        { method: "POST", body: file },
      );
      setLogo(result.id);
    },
  });
  const save = useMutation({
    mutationFn: (data: FormData) => {
      if (!draft) throw new Error("Prepare a journey form first.");
      return apiRequest("/api/v1/journey/config/templates", formTemplate, {
        method: "POST",
        body: {
          name: value(data, "name"),
          brand_id: value(data, "brand_id"),
          definition: definition.parse(draft),
        },
      });
    },
    onSuccess: async () => {
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["live", org] });
    },
  });
  function update(change: (next: Definition) => void) {
    setDraft((previous) => {
      if (!previous) return previous;
      const next = structuredClone(previous);
      change(next);
      return next;
    });
  }
  return (
    <>
      <Heading
        title="Journey forms & branding"
        detail="Customize your facility’s document identity and professional sections while retaining the shared nine-stage journey. Published versions remain fixed for existing patient records."
      />
      <div className="live-grid">
        <Panel
          title="Document branding"
          detail="Each change creates a new brand version."
        >
          <label className="live-field">
            <span>Facility logo (PNG, JPEG or WebP, up to 250 KB)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
          </label>
          {upload.isPending && <p role="status">Uploading logo…</p>}
          {logo && (
            <p className="success-message" role="status">
              Logo uploaded. Save the brand to attach it.
            </p>
          )}
          <Notice error={upload.error} />
          <ActionForm
            scope={org}
            path="journey/config/brands"
            label="Save brand version"
            body={(data) => ({
              title: value(data, "title"),
              primary_color: value(data, "primary_color"),
              accent_color: value(data, "accent_color"),
              logo_id: logo,
            })}
            onSuccess={() => setLogo(null)}
          >
            <Field
              name="title"
              label="Document title"
              defaultValue={
                user.memberships.find(
                  (member) => member.organization_id === org,
                )?.provider_name
              }
              minLength={2}
            />
            <div className="live-form-grid">
              <Field
                name="primary_color"
                label="Primary colour"
                type="color"
                defaultValue="#06234c"
              />
              <Field
                name="accent_color"
                label="Accent colour"
                type="color"
                defaultValue="#008f87"
              />
            </div>
          </ActionForm>
        </Panel>
        <Panel
          title="Create a journey form"
          detail="Start from the standard form or copy a prior version. Assign a responsible team role to every enabled section before publishing."
        >
          <QueryState query={base} />
          <button
            className="btn btn-primary"
            disabled={!base.data || !!draft}
            onClick={() => base.data && setDraft(structuredClone(base.data))}
          >
            Customize standard journey
          </button>
          <ChoiceLoader query={roles} />
          <ChoiceLoader query={brands} />
          {!options.length && (
            <p>
              First create care-team roles with reading, documentation and
              attestation permissions under Departments & care teams.
            </p>
          )}
        </Panel>
      </div>
      {draft && (
        <Panel
          title="Draft form editor"
          detail="Canonical stages and required clinical fields are retained. New fields belong to their professional section."
        >
          <form
            className="live-form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(new FormData(event.currentTarget));
            }}
          >
            <fieldset disabled={save.isPending}>
              <div className="live-form-grid">
                <Field
                  name="name"
                  label="Form name"
                  minLength={2}
                  maxLength={120}
                />
                <Field name="brand_id" label="Brand version">
                  <option value="">Select brand</option>
                  {brands.data?.pages
                    .flatMap((page) => page.items)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · version {item.version}
                      </option>
                    ))}
                </Field>
              </div>
              <label className="live-field">
                <span>Apply a medical team role across all stages</span>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id)
                      update((next) => {
                        for (const stage of next.stages)
                          for (const section of stage.sections)
                            if (
                              section.identity_roles.length === 1 &&
                              section.identity_roles[0] === "doctor"
                            ) {
                              section.role_ids = [id];
                              section.enabled = true;
                            }
                      });
                  }}
                >
                  <option value="">Choose a medical role</option>
                  {options
                    .filter((role) =>
                      role.identity_roles.every(
                        (profession) => profession === "doctor",
                      ),
                    )
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </label>
              {draft.stages.map((stage, stageIndex) => (
                <details className="stage-editor" key={stage.key}>
                  <summary>{stage.label}</summary>
                  {stage.sections.map((section, sectionIndex) => (
                    <section key={section.key} className="section-editor">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(event) =>
                            update((next) => {
                              next.stages[stageIndex].sections[
                                sectionIndex
                              ].enabled = event.target.checked;
                            })
                          }
                        />
                        {section.label}
                      </label>
                      {section.enabled && (
                        <>
                          <label className="live-field">
                            <span>Responsible team role</span>
                            <select
                              required
                              value={section.role_ids[0] ?? ""}
                              onChange={(event) =>
                                update((next) => {
                                  next.stages[stageIndex].sections[
                                    sectionIndex
                                  ].role_ids = event.target.value
                                    ? [event.target.value]
                                    : [];
                                })
                              }
                            >
                              <option value="">Select a compatible role</option>
                              {options
                                .filter((role) =>
                                  role.identity_roles.every((profession) =>
                                    section.identity_roles.includes(profession),
                                  ),
                                )
                                .map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="field-inventory">
                            {section.fields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="custom-field">
                                <label>
                                  Field label
                                  <input
                                    required
                                    minLength={2}
                                    maxLength={120}
                                    value={field.label}
                                    onChange={(event) =>
                                      update((next) => {
                                        next.stages[stageIndex].sections[
                                          sectionIndex
                                        ].fields[fieldIndex].label =
                                          event.target.value;
                                      })
                                    }
                                  />
                                </label>
                                {fieldIndex >=
                                (base.data?.stages[stageIndex].sections[
                                  sectionIndex
                                ]?.fields.length ?? 99) ? (
                                  <>
                                    <label>
                                      Field key
                                      <input
                                        required
                                        pattern="[a-z][a-z0-9_]{1,49}"
                                        value={field.key}
                                        onChange={(event) =>
                                          update((next) => {
                                            next.stages[stageIndex].sections[
                                              sectionIndex
                                            ].fields[fieldIndex].key =
                                              event.target.value;
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Type
                                      <select
                                        value={field.type}
                                        onChange={(event) =>
                                          update((next) => {
                                            const item =
                                              next.stages[stageIndex].sections[
                                                sectionIndex
                                              ].fields[fieldIndex];
                                            item.type = event.target
                                              .value as typeof field.type;
                                            item.choices = [];
                                          })
                                        }
                                      >
                                        {[
                                          "text",
                                          "textarea",
                                          "number",
                                          "boolean",
                                          "choice",
                                          "datetime",
                                        ].map((kind) => (
                                          <option key={kind}>{kind}</option>
                                        ))}
                                      </select>
                                    </label>
                                    {field.type === "choice" && (
                                      <label>
                                        Choices (one per line)
                                        <textarea
                                          required
                                          value={field.choices.join("\n")}
                                          onChange={(event) =>
                                            update((next) => {
                                              next.stages[stageIndex].sections[
                                                sectionIndex
                                              ].fields[fieldIndex].choices =
                                                event.target.value.split("\n");
                                            })
                                          }
                                        />
                                      </label>
                                    )}
                                    <label className="check-label">
                                      <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(event) =>
                                          update((next) => {
                                            next.stages[stageIndex].sections[
                                              sectionIndex
                                            ].fields[fieldIndex].required =
                                              event.target.checked;
                                          })
                                        }
                                      />
                                      Required
                                    </label>
                                    <button
                                      className="text-button"
                                      type="button"
                                      onClick={() =>
                                        update((next) => {
                                          next.stages[stageIndex].sections[
                                            sectionIndex
                                          ].fields.splice(fieldIndex, 1);
                                        })
                                      }
                                    >
                                      Remove custom field
                                    </button>
                                  </>
                                ) : (
                                  <small>
                                    {field.type.replaceAll("_", " ")} ·{" "}
                                    {field.required ? "Required" : "Optional"} ·
                                    Standard field
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={section.fields.length >= 30}
                            onClick={() =>
                              update((next) => {
                                next.stages[stageIndex].sections[
                                  sectionIndex
                                ].fields.push({
                                  key: "custom_" + section.fields.length,
                                  label: "Additional information",
                                  type: "text",
                                  required: false,
                                  choices: [],
                                });
                              })
                            }
                          >
                            Add custom field
                          </button>
                        </>
                      )}
                    </section>
                  ))}
                </details>
              ))}
              <Notice error={save.error} />
              <div className="live-heading-actions">
                <button className="btn btn-primary" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save draft version"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (window.confirm("Discard this unsaved form?"))
                      setDraft(null);
                  }}
                >
                  Discard draft
                </button>
              </div>
            </fieldset>
          </form>
        </Panel>
      )}
      <Panel title="Form versions">
        <QueryState query={templates} />
        {templates.data?.items.map((item) => (
          <div className="live-list-row" key={item.id}>
            <div>
              <strong>
                {item.name} · v{item.version}
              </strong>
              <p>
                Nine stages ·{" "}
                {item.definition.stages.reduce(
                  (sum, stage) =>
                    sum +
                    stage.sections.filter((section) => section.enabled).length,
                  0,
                )}{" "}
                enabled professional sections
              </p>
            </div>
            <Status value={item.status} />
            <button
              className="btn btn-secondary"
              disabled={!!draft}
              onClick={() => setDraft(structuredClone(item.definition))}
            >
              Copy to new draft
            </button>
            {item.status === "draft" && (
              <ActionButton
                scope={org}
                path={`journey/config/templates/${item.id}/publish`}
                body={{ approved: true }}
                confirm="Publish this immutable form version for new patient journeys?"
              >
                Approve & publish
              </ActionButton>
            )}
          </div>
        ))}
        {templates.data && !templates.data.items.length && (
          <p>
            No form versions yet. Save a brand, then customize the standard
            journey.
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
