"use client";
import { useStore } from "zustand";
import type { StudioStore } from "./store";
import { fieldTypes, newField, uid } from "./model";
import type { Section, teamRole } from "@/features/live/journey-contract";
import type { z } from "zod";
import { TableColumns } from "@/features/document-studio/table-columns";
import { WebSelect } from "@/components/ui/web-select";
export type TeamRole = z.infer<typeof teamRole>;
export function canWrite(role: TeamRole, section: Section) {
  return (
    role.active &&
    role.identity_roles.some((p) => section.identity_roles.includes(p)) &&
    (section.kind === "administrative"
      ? role.capabilities.includes("register") ||
        role.capabilities.includes("write")
      : role.identity_roles.every((p) =>
          ["doctor", "nurse", "allied"].includes(p),
        ) && role.capabilities.includes("write"))
  );
}
export function Inspector({
  store,
  roles,
}: {
  store: StudioStore;
  roles: TeamRole[];
}) {
  const { draft, selection, edit, select } = useStore(store);
  const stage =
    draft.definition.stages.find((s) => s.key === selection.stage) ??
    draft.definition.stages[0];
  const section = stage.sections.find((s) => s.key === selection.section),
    field = section?.fields.find((f) => f.key === selection.field);
  const update = (fn: (s: Section) => void) =>
    edit((d) =>
      fn(
        d.definition.stages
          .find((s) => s.key === stage.key)!
          .sections.find((s) => s.key === section!.key)!,
      ),
    );
  const patchField = (value: Partial<NonNullable<typeof field>>) =>
    update((s) => {
      Object.assign(
        s.fields.find((f) => f.key === field!.key)!,
        value,
      );
    });
  return (
    <aside className="studio-inspector" aria-label="Component properties">
      <p className="studio-kicker">PROPERTIES</p>
      <h3>
        {field
          ? "Field settings"
          : section
            ? "Section settings"
            : "Stage settings"}
      </h3>
      <p className="studio-helper">
        {field
          ? "Configure the selected field. Its data binding stays stable."
          : "Choose a field on the canvas to configure its input."}
      </p>
      {!field && (
        <label className="live-field">
          Stage title
          <input
            minLength={2}
            maxLength={120}
            value={stage.label}
            onChange={(e) =>
              edit((d) => {
                d.definition.stages.find((s) => s.key === stage.key)!.label =
                  e.target.value;
              })
            }
          />
        </label>
      )}
      {field && (
        <>
          <label className="live-field">
            Field label
            <input
              name="field-label"
              minLength={2}
              maxLength={120}
              value={field.label}
              onChange={(e) => patchField({ label: e.target.value })}
            />
          </label>
          <WebSelect
              label="Field type"
              value={field.type}
              onChange={(value) => {
                const fresh = newField(value as typeof field.type);
                patchField({
                  ...fresh,
                  key: field.key,
                  label: field.label,
                  required: field.required,
                });
              }}
              options={fieldTypes.map(([type, label]) => ({ value: type, label }))}
            />
          <label className="studio-check">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patchField({ required: e.target.checked })}
            />
            Required answer
          </label>
          {["choice", "radio", "multichoice"].includes(field.type) && (
            <label className="live-field">
              Choices (one per line)
              <textarea
                rows={5}
                value={field.choices.join("\n")}
                onChange={(e) =>
                  patchField({ choices: e.target.value.split("\n") })
                }
              />
              <small>Up to 50 distinct, non-empty choices.</small>
            </label>
          )}
          {field.type === "table" && (
            <TableColumns
              field={field}
              onChange={(value) => patchField(value)}
            />
          )}
          {field.type === "attachment" && (
            <p className="studio-info">
              Employees can attach PNG, JPEG and static PDF evidence. Files
              remain private to the patient journey and are encrypted by the
              backend.
            </p>
          )}
          {field.type === "link" && (
            <p className="studio-info">
              Employees enter HTTPS links. Patient links are recorded as data
              and are never fetched by the form designer.
            </p>
          )}
          <WebSelect
              label="Move field to section"
              value={section!.key}
              onChange={(targetKey) => {
                edit((d) => {
                  const st = d.definition.stages.find(
                    (s) => s.key === stage.key,
                  )!;
                  const source = st.sections.find(
                    (s) => s.key === section!.key,
                  )!;
                  const target = st.sections.find((s) => s.key === targetKey)!;
                  if (source.fields.length > 1 && target.fields.length < 30) {
                    const i = source.fields.findIndex(
                      (f) => f.key === field.key,
                    );
                    target.fields.push(source.fields.splice(i, 1)[0]);
                  }
                });
                if (section!.fields.length > 1)
                  select({
                    stage: stage.key,
                    section: targetKey,
                    field: field.key,
                  });
              }}
              options={stage.sections.filter((s) => s.key === section!.key || (section!.fields.length > 1 && s.fields.length < 30)).map((s) => ({ value: s.key, label: s.label }))}
              searchable={stage.sections.length > 6}
            />
          <div className="studio-binding">
            <small>Stable data binding</small>
            <code>
              {section!.key}__{field.key}
            </code>
          </div>
          <button
            type="button"
            className="studio-danger"
            disabled={section!.fields.length <= 1}
            onClick={() => {
              if (window.confirm(`Remove “${field.label}” from this draft?`)) {
                update((s) => {
                  s.fields = s.fields.filter((f) => f.key !== field.key);
                });
                select({ stage: stage.key, section: section!.key });
              }
            }}
          >
            Remove field
          </button>
          <button
            type="button"
            className="studio-text-button"
            onClick={() => select({ stage: stage.key, section: section!.key })}
          >
            ← Section settings & permissions
          </button>
        </>
      )}
      {section && !field && (
        <>
          <label className="live-field">
            Section title
            <input
              minLength={2}
              maxLength={120}
              value={section.label}
              onChange={(e) =>
                update((s) => {
                  s.label = e.target.value;
                })
              }
            />
          </label>
          <WebSelect
              label="Section purpose"
              value={section.kind}
              onChange={(value) =>
                update((s) => {
                  s.kind = value as Section["kind"];
                  s.identity_roles =
                    s.kind === "administrative"
                      ? ["receptionist", "doctor", "nurse", "allied"]
                      : ["doctor", "nurse", "allied"];
                  if (s.kind === "administrative")
                    s.attestation_required = false;
                })
              }
              options={[{ value: "administrative", label: "Reception / administration" }, { value: "clinical", label: "Clinical documentation" }]}
            />
          <label className="studio-check">
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={(e) =>
                update((s) => {
                  s.enabled = e.target.checked;
                })
              }
            />
            Include in published document
          </label>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={section.attestation_required}
              onChange={(e) =>
                update((s) => {
                  s.attestation_required = e.target.checked;
                })
              }
            />
            Require authenticated attestation
          </label>
          <p className="studio-helper">
            Sign-off records the authenticated employee, role and time. Writing
            teams must have Attest notes when this is enabled.
          </p>
          <fieldset className="studio-team-choices">
            <legend>Teams allowed to complete this section</legend>
            <p className="studio-helper">
              All linked teams can read the whole ledger. Only selected writing
              teams can complete this section.
            </p>
            {roles
              .filter((r) => r.active || section.role_ids.includes(r.id))
              .map((role) => (
                <label className="studio-check" key={role.id}>
                  <input
                    type="checkbox"
                    aria-label={`Write ${role.name}`}
                    checked={(
                      section.write_role_ids ?? section.role_ids
                    ).includes(role.id)}
                    disabled={!canWrite(role, section)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      edit((d) => {
                        const s = d.definition.stages
                          .find((st) => st.key === stage.key)!
                          .sections.find((s) => s.key === section.key)!;
                        s.write_role_ids = checked
                          ? [
                              ...new Set([
                                ...(s.write_role_ids ?? s.role_ids),
                                role.id,
                              ]),
                            ]
                          : (s.write_role_ids ?? s.role_ids).filter(
                              (id) => id !== role.id,
                            );
                        s.role_ids = checked
                          ? [...new Set([...s.role_ids, role.id])]
                          : s.role_ids.filter((id) => id !== role.id);
                        if (
                          checked &&
                          role.identity_roles.includes("receptionist") &&
                          role.capabilities.includes("register") &&
                          s.kind === "administrative"
                        )
                          d.definition.intake_role_ids = [
                            ...new Set([
                              ...d.definition.intake_role_ids,
                              role.id,
                            ]),
                          ];
                        if (checked)
                          d.definition.access_role_ids = [
                            ...new Set([
                              ...d.definition.access_role_ids,
                              role.id,
                            ]),
                          ];
                      });
                    }}
                  />
                  <span>
                    {role.name}
                    <small>
                      {role.identity_roles.join(" · ")}
                      {!canWrite(role, section)
                        ? " · Responsibility unavailable"
                        : ""}
                    </small>
                  </span>
                </label>
              ))}
          </fieldset>
          <WebSelect
              label="Move section to stage"
              value={stage.key}
              onChange={(target) => {
                edit((d) => {
                  const source = d.definition.stages.find(
                    (s) => s.key === stage.key,
                  )!;
                  const destination = d.definition.stages.find(
                    (s) => s.key === target,
                  )!;
                  if (destination.sections.length >= 32) return;
                  destination.sections.push(
                    source.sections.splice(
                      source.sections.findIndex((s) => s.key === section.key),
                      1,
                    )[0],
                  );
                });
                select({ stage: target, section: section.key });
              }}
              options={draft.definition.stages.filter((s) => s.key === stage.key || s.sections.length < 32).map((s) => ({ value: s.key, label: s.label }))}
              searchable
            />
          <div className="studio-inspector-actions">
            <button
              type="button"
              disabled={stage.sections.length >= 32}
              onClick={() => {
                const copy = structuredClone(section);
                copy.key = uid("section");
                copy.label = section.label.slice(0, 113) + " (copy)";
                copy.fields = copy.fields.map((f) => ({
                  ...f,
                  key: uid("field"),
                }));
                edit((d) =>
                  d.definition.stages
                    .find((s) => s.key === stage.key)!
                    .sections.push(copy),
                );
                select({ stage: stage.key, section: copy.key });
              }}
            >
              Duplicate section
            </button>
            <button
              type="button"
              className="studio-danger"
              onClick={() => {
                if (
                  window.confirm(
                    `Remove “${section.label}” and its fields from this draft?`,
                  )
                ) {
                  edit((d) => {
                    const s = d.definition.stages.find(
                      (s) => s.key === stage.key,
                    )!;
                    s.sections = s.sections.filter(
                      (x) => x.key !== section.key,
                    );
                  });
                  select({ stage: stage.key });
                }
              }}
            >
              Remove section
            </button>
          </div>
        </>
      )}
      {!section && (
        <p className="studio-info">
          The nine journey stages preserve continuity across patient records.
          Rename their titles and add the sections your facility needs. Empty
          stages do not appear in employee forms.
        </p>
      )}
    </aside>
  );
}
