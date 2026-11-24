"use client";
import { useState } from "react";
import { z } from "zod";
import { memberLabels, type MemberRole } from "@/lib/api/identity-contract";
import { Icon } from "@/components/ui/icon";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Panel, Field, ActionForm, Pager, value } from "./shared";
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
const attributeCodeCharacters = "0123456789ABCEFGHJKLMNPQRSTUVWXYZ";
function generateAttributeCode(prefix: "p" | "r", existing: Set<string>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const suffix = Array.from(bytes, (byte) =>
      attributeCodeCharacters[byte % attributeCodeCharacters.length],
    ).join("");
    const code = `ccu_${prefix}${suffix.toLowerCase()}`;
    if (!existing.has(code)) return code;
  }
  return "";
}
const displayAttributeCode = (code: string) =>
  code.toUpperCase().replace("_", "-");
function VocabularySurface({ label, title, subtitle, onOpen, children }: {
  label: string;
  title: string;
  subtitle: string;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="workforce-row-action" aria-label={`${title} ${subtitle}`} onClick={() => { onOpen?.(); setOpen(true); }}><Icon name={label.startsWith("Add") ? "plus" : "settings"} size={16} outline /> {label}</button>
    {open && <SideDrawer title={title} subtitle={subtitle} eyebrow="CCU360 / FACILITY TERMS" closeLabel={`Close ${title.toLowerCase()} form`} onClose={() => setOpen(false)}>{children}</SideDrawer>}
  </>;
}
export function VocabularyPanel({ org }: { org: string }) {
  return (
    <details className="workforce-vocabulary">
      <summary>
        <span className="workforce-vocabulary-mark"><Icon name="settings" size={18} outline /></span>
        <span className="workforce-vocabulary-title"><strong>Facility professions & responsibilities</strong><small>Configure the terms and actions your teams use</small></span>
        <span className="workforce-vocabulary-open">Configure <Icon name="down" size={16} outline /></span>
      </summary>
      <div className="workforce-vocabulary-body">
        <p>Tailor clinical terminology for this facility. Professions follow protected identity categories; responsibilities collect existing system actions.</p>
        <div className="workforce-vocabulary-grid">
          <AttributePanel org={org} kind="professions" />
          <AttributePanel org={org} kind="responsibilities" />
        </div>
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
  const [offset, setOffset] = useState(0);
  const [generatedCode, setGeneratedCode] = useState("");
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const randomizeCode = () => {
    const existing = new Set(items.map((item) => item.code.toLowerCase()));
    if (generatedCode) existing.add(generatedCode);
    setGeneratedCode(generateAttributeCode(profession ? "p" : "r", existing));
  };
  const visibleOffset = Math.min(offset, Math.max(0, Math.ceil(items.length / 5) - 1) * 5);
  const visibleItems = items.slice(visibleOffset, visibleOffset + 5);
  return (
    <Panel title={profession ? "Professions" : "Responsibilities"} icon={profession ? "profile" : "shield"}>
      <ChoiceLoader query={query} />
      <ul className="workforce-vocabulary-list">
        {visibleItems.map((item) => (
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
              <VocabularySurface label="Edit" title={profession ? "Edit profession" : "Edit responsibility"} subtitle={item.name}>
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
              </VocabularySurface>
            </li>
          ))}
      </ul>
      <div className="workforce-vocabulary-add">
      <VocabularySurface label={`Add ${profession ? "profession" : "responsibility"}`} title={profession ? "Add profession" : "Add responsibility"} subtitle="Configure this facility’s terminology." onOpen={randomizeCode}>
        <ActionForm
          scope={org}
          path={`workforce/${kind}`}
          label={profession ? "Create profession" : "Create responsibility"}
          body={(data) => ({
            name: value(data, "name"),
            code: generatedCode,
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
          <div className="workforce-code-picker">
            <span>{profession ? "Profession ID" : "Responsibility ID"}</span>
            <div>
              <output aria-live="polite">{generatedCode ? displayAttributeCode(generatedCode) : "Unavailable"}</output>
              <button type="button" className="workforce-secondary-action" onClick={randomizeCode}><Icon name="refresh" size={16} outline /> Randomize</button>
            </div>
            <small>Keep this ID or generate another before creating the {profession ? "profession" : "responsibility"}.</small>
          </div>
          {profession ? (
            <Field name="base_role" label="Protected identity category">
              {categories.map((role) => (
                <option key={role} value={role}>
                  {memberLabels[role]}
                </option>
              ))}
            </Field>
          ) : (
            <fieldset className="option-grid">
              <legend>System actions</legend>
              {Object.entries(platformActions).map(([code, label]) => (
                <label
                  key={code}
                  className="check-label"
                >
                  <input type="checkbox" name="capabilities" value={code} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </ActionForm>
      </VocabularySurface>
      </div>
      <Pager offset={visibleOffset} count={visibleItems.length} size={5} hasMore={visibleOffset + 5 < items.length} change={setOffset} />
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
    <fieldset className="workforce-choice-group mb-4 rounded-lg border border-border p-4">
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
            className="workforce-choice-label mb-2 mr-4 inline-flex items-center gap-2"
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
