"use client";
import { z } from "zod";
import { memberLabels, type MemberRole } from "@/lib/api/identity-contract";
import { Panel, Field, ActionForm, value } from "./shared";
import { useChoices, ChoiceLoader } from "./choices";
export const workforceAttribute = z.object({
  id: z.string(),
  kind: z.string(),
  code: z.string(),
  name: z.string(),
  base_role: z.string().nullable(),
  capabilities: z.array(z.string()),
  active: z.boolean(),
  version: z.number(),
});
export const platformActions: Record<string, string> = {
  register: "Register patients",
  admit: "Start journeys",
  read: "Read covered journeys",
  write: "Document assigned sections",
  attest: "Attest professional notes",
  observe: "Record observations",
  verify: "Verify observations",
  tasks: "Manage actions",
  care_manage: "Manage care coverage",
  close: "Close journeys",
  correct: "Amend records",
  export: "Export ledger",
};
const categories = [
  "doctor",
  "nurse",
  "allied",
  "receptionist",
  "auditor",
] as const;
export function VocabularyPanel({ org }: { org: string }) {
  return (
    <details className="mb-6 rounded-xl border border-border bg-surface p-5">
      <summary className="text-lg font-semibold">
        Facility professions & responsibilities
      </summary>
      <p className="my-4 text-muted">
        Extend the facility’s terminology. Each profession uses a protected
        identity category; responsibilities combine existing system actions.
        Neither grants administration rights.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AttributePanel org={org} kind="professions" />
        <AttributePanel org={org} kind="responsibilities" />
      </div>
    </details>
  );
}
function AttributePanel({
  org,
  kind,
}: {
  org: string;
  kind: "professions" | "responsibilities";
}) {
  const query = useChoices(org, `workforce/${kind}`, workforceAttribute);
  const profession = kind === "professions";
  return (
    <Panel title={profession ? "Professions" : "Responsibilities"}>
      <ChoiceLoader query={query} />
      <ul className="divide-y divide-border">
        {query.data?.pages
          .flatMap((p) => p.items)
          .map((item) => (
            <li key={item.id} className="py-3">
              <strong>{item.name}</strong>
              <p className="text-sm text-muted">
                {profession
                  ? memberLabels[item.base_role as MemberRole]
                  : item.capabilities
                      .map((c) => platformActions[c])
                      .join(" · ")}{" "}
                · {item.active ? "Active" : "Archived"}
              </p>
              <details className="mt-2">
                <summary>Edit / archive</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/${kind}/${item.id}`}
                  method="PATCH"
                  label="Save vocabulary item"
                  body={(data) => ({
                    name: value(data, "name"),
                    active: value(data, "active") === "true",
                    expected_version: item.version,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="name"
                    label="Display name"
                    defaultValue={item.name}
                    minLength={2}
                    maxLength={120}
                  />
                  <Field
                    name="active"
                    label="Availability"
                    defaultValue={String(item.active)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Archived</option>
                  </Field>
                  <Field
                    name="reason"
                    label="Change reason"
                    minLength={3}
                    maxLength={500}
                  />
                  <p className="mb-3 text-sm text-muted">
                    Underlying permissions cannot change here. Review team
                    assignments before archiving a profession.
                  </p>
                </ActionForm>
              </details>
            </li>
          ))}
      </ul>
      <details className="mt-5">
        <summary>Add {profession ? "profession" : "responsibility"}</summary>
        <ActionForm
          scope={org}
          path={`workforce/${kind}`}
          label={profession ? "Create profession" : "Create responsibility"}
          body={(data) => ({
            name: value(data, "name"),
            code: value(data, "code"),
            base_role: profession ? value(data, "base_role") : null,
            capabilities: profession ? [] : data.getAll("capabilities"),
          })}
        >
          <Field
            name="name"
            label="Display name"
            minLength={2}
            maxLength={120}
          />
          <Field
            name="code"
            label="Unique code"
            pattern="[a-z][a-z0-9_]{1,39}"
            maxLength={40}
          />
          {profession ? (
            <Field name="base_role" label="Protected identity category">
              {categories.map((role) => (
                <option key={role} value={role}>
                  {memberLabels[role]}
                </option>
              ))}
            </Field>
          ) : (
            <fieldset>
              <legend>System actions</legend>
              {Object.entries(platformActions).map(([code, label]) => (
                <label
                  key={code}
                  className="mb-2 mr-4 inline-flex items-center gap-2"
                >
                  <input type="checkbox" name="capabilities" value={code} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </ActionForm>
      </details>
    </Panel>
  );
}
export function AttributeChoices({
  items,
  name,
  selected = [],
}: {
  items: z.infer<typeof workforceAttribute>[];
  name: "profession_ids" | "responsibility_ids";
  selected?: string[];
}) {
  return (
    <fieldset className="mb-4 rounded-lg border border-border p-4">
      <legend className="px-2 font-semibold">
        {name === "profession_ids"
          ? "Facility professions (optional)"
          : "Facility responsibilities (optional)"}
      </legend>
      <p className="mb-3 text-sm text-muted">
        {name === "profession_ids"
          ? "Select these to use facility-specific professions instead of the base categories above. Custom professions require an employee designation."
          : "Adds the actions associated with these responsibility names."}
      </p>
      {items
        .filter(
          (item) =>
            (item.active || selected.includes(item.id)) &&
            (selected.includes(item.id) ||
              (name === "profession_ids"
                ? item.code !== item.base_role
                : !platformActions[item.code])),
        )
        .map((item) => (
          <label
            key={item.id}
            className="mb-2 mr-4 inline-flex items-center gap-2"
          >
            <input
              type="checkbox"
              name={name}
              value={item.id}
              defaultChecked={selected.includes(item.id)}
              disabled={!item.active}
            />
            {item.name}
          </label>
        ))}
    </fieldset>
  );
}
