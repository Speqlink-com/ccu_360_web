"use client";
import dynamic from "next/dynamic";
import {
  RepeatingTable,
  AttachmentInput,
  StructuredValue,
} from "@/features/document-studio/clinical-inputs";
const CurrentDocument = dynamic(
  () =>
    import("@/features/document-studio/current-document").then(
      (m) => m.CurrentDocument,
    ),
  { ssr: false },
);
import { buttonClasses } from "@/lib/presentation";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import {
  caseView,
  entry,
  task,
  observation,
  type Section,
} from "./journey-contract";
import { collectEntryValues } from "./entry-values";
import { useChoices, ChoiceLoader } from "./choices";
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
  stamp,
  value,
} from "./shared";
type Case = z.infer<typeof caseView>;
type Entry = z.infer<typeof entry>;
const localTime = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const displayValue = (item: {
  status: string;
  value?: unknown;
  reason?: string | null;
}) =>
  item.status === "present"
    ? typeof item.value === "boolean"
      ? item.value
        ? "Yes"
        : "No"
      : Array.isArray(item.value)
        ? item.value.join(", ")
        : String(item.value ?? "")
    : `${item.status.replaceAll("_", " ")}: ${item.reason ?? ""}`;

function ClinicalField({
  field,
  previous,
  observations,
  context,
}: {
  field: Section["fields"][number];
  previous?: Entry["values"][string];
  context: {
    encounterId: string;
    sectionKey: string;
    org: string;
    version: number;
    onVersion: (version: number) => void;
    onPending: (pending: boolean) => void;
  };
  observations: z.infer<typeof observation>[];
}) {
  const [status, setStatus] = useState(previous?.status ?? "present");
  const id = "clinical-" + field.key;
  const old = previous?.value;
  return (
    <div className="clinical-field">
      <label htmlFor={id}>
        <strong>{field.label}</strong>
        {field.required ? " · Required" : ""}
      </label>
      <label className="availability-label flex flex-wrap items-center gap-3 text-[13px] text-muted">
        Information availability
        <select
          name={field.key + "__status"}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="present">Available</option>
          <option value="unknown">Unknown</option>
          <option value="not_assessed">Not assessed</option>
          <option value="unobtainable">Unobtainable</option>
        </select>
      </label>
      {status !== "present" ? (
        <input
          id={id}
          name={field.key + "__reason"}
          required
          maxLength={500}
          defaultValue={previous?.reason ?? ""}
          placeholder="Explain why this information is unavailable"
        />
      ) : field.type === "table" ? (
        <RepeatingTable field={field} old={old} />
      ) : field.type === "attachment" ? (
        <AttachmentInput field={field} old={old} {...context} />
      ) : field.type === "observation_refs" ? (
        <select
          id={id}
          multiple
          name={field.key}
          defaultValue={Array.isArray(old) ? old.map(String) : []}
          required={field.required}
        >
          {Array.isArray(old) &&
            old
              .filter((id) => !observations.some((item) => item.id === id))
              .map((id) => (
                <option key={String(id)} value={String(id)}>
                  Previously linked observation · {String(id)}
                </option>
              ))}
          {observations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {displayValue(item.value)} ·{" "}
              {stamp(item.observed_at)}
            </option>
          ))}
        </select>
      ) : field.type === "multichoice" ? (
        <select
          id={id}
          name={field.key}
          multiple
          required={field.required}
          defaultValue={Array.isArray(old) ? old.map(String) : []}
        >
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : field.type === "radio" ? (
        <fieldset id={id} className="option-grid">
          <legend className="sr-only">{field.label}</legend>
          {field.choices.map((choice) => (
            <label key={choice} className="check-label">
              <input
                type="radio"
                name={field.key}
                value={choice}
                required={field.required}
                defaultChecked={old === choice}
              />
              {choice}
            </label>
          ))}
        </fieldset>
      ) : field.type === "choice" || field.type === "boolean" ? (
        <select
          id={id}
          name={field.key}
          required={field.required}
          defaultValue={old === undefined ? "" : String(old)}
        >
          <option value="">Choose an option</option>
          {(field.type === "boolean" ? ["true", "false"] : field.choices).map(
            (choice) => (
              <option key={choice} value={choice}>
                {field.type === "boolean"
                  ? choice === "true"
                    ? "Yes"
                    : "No"
                  : choice}
              </option>
            ),
          )}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.key}
          required={field.required}
          rows={4}
          maxLength={8000}
          defaultValue={old === undefined ? "" : String(old)}
        />
      ) : (
        <input
          id={id}
          name={field.key}
          type={
            field.type === "datetime"
              ? "datetime-local"
              : field.type === "number"
                ? "number"
                : field.type === "date" || field.type === "time"
                  ? field.type
                  : field.type === "link"
                    ? "url"
                    : "text"
          }
          step={field.type === "number" ? "any" : undefined}
          maxLength={8000}
          required={field.required}
          defaultValue={
            old === undefined
              ? ""
              : field.type === "datetime"
                ? localTime(new Date(String(old)))
                : String(old)
          }
        />
      )}
    </div>
  );
}
function DocumentationForm({
  data,
  section,
  amendment,
  close,
  onSaved,
}: {
  onSaved?: () => void;
  data: Case;
  section: Section;
  amendment?: Entry;
  close?: () => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const id = data.encounter.id;
  const [version, setVersion] = useState(data.encounter.version);
  const [uploads, setUploads] = useState(0);
  const [formRevision, setFormRevision] = useState(0);
  const [kind, setKind] = useState(amendment?.kind ?? "note");
  const observations = useChoices(
    org,
    `journey/encounters/${id}/records/observations`,
    observation,
  );
  const roles = data.effective_roles.filter(
    (role) =>
      (section.write_role_ids ?? section.role_ids).includes(role.id) &&
      (role.capabilities.includes("write") ||
        (section.kind === "administrative" &&
          role.capabilities.includes("register"))),
  );
  const changed = version < data.encounter.version;
  return (
    <Panel
      title={amendment ? "Amend recorded information" : section.label}
      detail={
        section.kind === "administrative" || !section.attestation_required
          ? "Information is posted with your identity and recording time. Earlier versions are retained."
          : "Notes are saved as drafts until their author attests them. Comments are posted directly."
      }
    >
      {changed && (
        <div
          className="version-notice my-4 rounded-lg border border-[#e9d7ae] bg-amber-bg p-4"
          role="alert"
        >
          <p>
            This journey changed from version {version} to{" "}
            {data.encounter.version}. Review the latest records before saving
            your documentation.
          </p>
          <button
            className={buttonClasses.secondary}
            onClick={() => setVersion(data.encounter.version)}
          >
            I have reviewed the latest version
          </button>
        </div>
      )}
      <ActionForm
        disabled={uploads > 0}
        scope={org}
        path={`journey/encounters/${id}/${kind === "comment" ? "comments" : "entries"}`}
        label={
          amendment
            ? "Save amendment"
            : kind === "comment"
              ? "Post comment"
              : section.kind === "administrative" ||
                  !section.attestation_required
                ? "Post section information"
                : "Save draft note"
        }
        body={(form) => {
          if (changed)
            throw new Error("Review the latest journey version before saving.");
          const common = {
            section_key: section.key,
            expected_version: version,
            acting_role_id: value(form, "acting_role_id"),
            ...(amendment
              ? { supersedes_id: amendment.id, reason: value(form, "reason") }
              : {}),
          };
          if (kind === "comment")
            return { ...common, comment: value(form, "comment") };
          const reference = value(form, "evidence_reference");
          return {
            ...common,
            values: collectEntryValues(section, form),
            observed_at: new Date(value(form, "observed_at")).toISOString(),
            evidence: reference
              ? [
                  {
                    kind: "external_document",
                    reference,
                    label: value(form, "evidence_label"),
                    sha256: value(form, "evidence_hash"),
                  },
                ]
              : [],
          };
        }}
        onSuccess={(result) => {
          const parsed = z.object({ version: z.number() }).parse(result);
          setVersion(parsed.version);
          setFormRevision((value) => value + 1);
          onSaved?.();
          close?.();
        }}
      >
        {!amendment && (
          <label className="live-field">
            <span>Documentation type</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="note">
                {section.kind === "administrative"
                  ? "Intake information"
                  : section.attestation_required
                    ? "Clinical note (draft, then attest)"
                    : "Professional note"}
              </option>
              <option value="comment">Professional comment</option>
            </select>
          </label>
        )}
        <Field
          name="acting_role_id"
          label="Acting care-team role"
          defaultValue={roles.length === 1 ? roles[0].id : ""}
        >
          <option value="">Select your responsible team role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Field>
        {kind === "comment" ? (
          <Field
            name="comment"
            label="Comment"
            type="textarea"
            maxLength={8000}
            defaultValue={
              amendment ? String(amendment.values.comment?.value ?? "") : ""
            }
          />
        ) : (
          <>
            <Field
              name="observed_at"
              label="Observed at (local time)"
              type="datetime-local"
              defaultValue={localTime()}
            />
            {section.fields.map((field) => (
              <ClinicalField
                key={`${field.key}:${formRevision}`}
                field={field}
                context={{
                  encounterId: id,
                  sectionKey: section.key,
                  org,
                  version,
                  onVersion: setVersion,
                  onPending: (pending) =>
                    setUploads((value) =>
                      Math.max(0, value + (pending ? 1 : -1)),
                    ),
                }}
                previous={amendment?.values[field.key]}
                observations={
                  observations.data?.pages.flatMap((page) => page.items) ?? []
                }
              />
            ))}
            <ChoiceLoader query={observations} />
            <details>
              <summary>Attach an external evidence reference</summary>
              <Field
                name="evidence_reference"
                label="Document reference"
                required={false}
                maxLength={200}
              />
              <Field
                name="evidence_label"
                label="Evidence label"
                required={false}
                maxLength={120}
              />
              <Field
                name="evidence_hash"
                label="Document SHA-256 checksum"
                required={false}
                pattern="[a-f0-9]{64}"
                maxLength={64}
              />
              <p className="muted">
                References and checksums are author supplied; the external
                document’s contents are not independently verified.
              </p>
            </details>
          </>
        )}
        {amendment && (
          <Field
            name="reason"
            label="Amendment reason"
            minLength={3}
            maxLength={500}
          />
        )}
      </ActionForm>
      {close && (
        <button
          className="text-button border-0 bg-transparent px-0 py-2 text-left font-semibold text-teal-dark"
          onClick={close}
        >
          Cancel amendment
        </button>
      )}
    </Panel>
  );
}
function LedgerSection({
  data,
  item,
  select,
  amend,
}: {
  data: Case;
  item: Case["responsibilities"][number];
  select: (key: string) => void;
  amend: (record: Entry) => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const host = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting));
      },
      { rootMargin: "300px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const records = useLiveQuery(
    org,
    `journey/encounters/${data.encounter.id}/records/entries?section_key=${item.section.key}&current_only=1&offset=${offset}&limit=20`,
    pageOf(entry).extend({ encounter_version: z.number() }),
    visible,
    15_000,
  );
  return (
    <section
      ref={host}
      id={`ledger-${item.section.key}`}
      className="mb-5 scroll-mt-5 rounded-xl border border-border bg-white p-5"
      aria-label={`${item.section.label} ledger section`}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-[var(--document-primary)]">
            {item.section.label}
          </h4>
          <p className="mt-1 text-sm text-muted">
            {item.can_write
              ? "Your team can complete this section"
              : "Read only · completed by the responsible team"}
            {item.coverage_gap ? " · No current staff coverage" : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            {(item.section.write_role_ids ?? item.section.role_ids)
              .map(
                (id) =>
                  data.care_roles.find((r) => r.id === id)?.name ?? "Care team",
              )
              .join(" · ")}
          </p>
        </div>
        {item.can_write && data.encounter.status === "active" && (
          <button
            className={buttonClasses.secondary}
            onClick={() => select(item.section.key)}
          >
            Complete section
          </button>
        )}
      </header>
      <dl className="grid gap-4 rounded-lg bg-[#f6f9fa] p-4 sm:grid-cols-2">
        {item.section.fields.map((field) => (
          <div key={field.key}>
            <dt className="text-sm font-semibold">
              {field.label}
              {field.required ? " *" : ""}
            </dt>
            <dd className="mt-1 text-sm text-muted">
              {!records.data
                ? "Review recorded information below"
                : records.data.items.some(
                      (record) => field.key in record.values,
                    )
                  ? "Recorded below"
                  : "Awaiting documentation"}
            </dd>
          </div>
        ))}
      </dl>
      {visible && <QueryState query={records} />}{" "}
      {records.data?.items.map((record) => (
        <EntryCard
          key={record.id}
          data={{
            ...data,
            encounter: {
              ...data.encounter,
              version: Math.max(
                data.encounter.version,
                records.data?.encounter_version ?? 0,
              ),
            },
          }}
          record={record}
          amend={() => amend(record)}
        />
      ))}
      {records.data && (
        <Pager
          offset={offset}
          count={records.data.items.length}
          change={setOffset}
        />
      )}
    </section>
  );
}
function FullLedger({
  data,
  select,
  amend,
}: {
  data: Case;
  select: (key: string) => void;
  amend: (record: Entry) => void;
}) {
  return (
    <section aria-label="Complete shared patient ledger" className="mb-6">
      <h2 className="mb-2 text-2xl text-[var(--document-primary)]">
        Complete patient ledger
      </h2>
      <p className="mb-6 text-muted">
        One shared document. Every linked care team can read the full layout.
        Contributions keep their author, team and time.
      </p>
      {data.template.definition.stages
        .filter((stage) => stage.sections.some((s) => s.enabled))
        .map((stage) => (
          <div key={stage.key} className="mb-8">
            <h3 className="mb-4 border-b-2 border-[var(--document-accent)] pb-3 text-xl text-[var(--document-primary)]">
              {stage.label}
            </h3>
            {data.responsibilities
              .filter((item) => item.stage === stage.key)
              .map((item) => (
                <LedgerSection
                  key={item.section.key}
                  data={data}
                  item={item}
                  select={select}
                  amend={amend}
                />
              ))}
          </div>
        ))}
    </section>
  );
}

function EntryCard({
  record,
  data,
  amend,
}: {
  record: Entry;
  data: Case;
  amend: () => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const mine = record.author.user_id === data.current_actor.user_id;
  const actionable = record.is_current && data.encounter.status === "active";
  const responsibility = data.responsibilities.find(
    (item) => item.section.key === record.section_key,
  );
  const roles = data.effective_roles.filter(
    (role) =>
      (
        responsibility?.section.write_role_ids ??
        responsibility?.section.role_ids ??
        []
      ).includes(role.id) && role.capabilities.includes("attest"),
  );
  return (
    <article className="record-card my-4 rounded-[10px] border border-border border-l-[3px] border-l-teal p-5">
      <header>
        <div>
          <strong>{responsibility?.section.label ?? record.section_key}</strong>
          <p>
            {record.author.display_name} ·{" "}
            {record.author.team_role_name ?? "Care team"} ·{" "}
            {stamp(record.recorded_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Status value={record.status} />
          {!record.is_current && <Status value="historical" />}
        </div>
      </header>
      {!record.is_current && (
        <p className="my-3 rounded-lg border border-border bg-[#f7fafb] p-3 text-sm text-muted">
          Retained revision {record.revision} · Latest revision{" "}
          {record.latest_revision}. This version remains part of the audit
          history.
        </p>
      )}
      <dl>
        {Object.entries(record.values).map(([key, item]) => (
          <div key={key}>
            <dt>
              {key === "comment"
                ? "Comment"
                : (responsibility?.section.fields.find(
                    (field) => field.key === key,
                  )?.label ?? key)}
            </dt>
            <dd>
              {item.status === "present" &&
              responsibility?.section.fields.some(
                (f) =>
                  f.key === key &&
                  ["table", "attachment", "link"].includes(f.type),
              ) ? (
                <StructuredValue
                  field={
                    responsibility.section.fields.find((f) => f.key === key)!
                  }
                  value={item.value}
                  encounterId={data.encounter.id}
                />
              ) : (
                displayValue(item)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <small>
        Revision {record.revision} · {record.kind}
        {record.reason ? ` · Amendment: ${record.reason}` : ""}
      </small>
      {actionable &&
        responsibility?.can_write &&
        (mine ||
          (record.status !== "draft" &&
            data.effective_roles.some(
              (role) =>
                (
                  responsibility.section.write_role_ids ??
                  responsibility.section.role_ids
                ).includes(role.id) && role.capabilities.includes("correct"),
            ))) && (
          <button
            className="text-button border-0 bg-transparent px-0 py-2 text-left font-semibold text-teal-dark"
            onClick={amend}
          >
            Create an attributed amendment
          </button>
        )}
      {actionable &&
        !mine &&
        record.status === "draft" &&
        responsibility?.can_write && (
          <details className="mt-4">
            <summary>Take over this draft for my shift</summary>
            <ActionForm
              scope={org}
              path={`journey/encounters/${data.encounter.id}/entries/${record.id}/takeover`}
              label="Take over draft"
              body={(form) => ({
                expected_version: data.encounter.version,
                acting_role_id: value(form, "acting_role_id"),
                reason: value(form, "reason"),
              })}
            >
              <p className="mb-3 text-sm text-muted">
                Creates a new revision in your name. The previous author and
                their work remain in the history. Review the contents before
                attesting.
              </p>
              <Field name="acting_role_id" label="Acting care-team role">
                {data.effective_roles
                  .filter(
                    (r) =>
                      (
                        responsibility.section.write_role_ids ??
                        responsibility.section.role_ids
                      ).includes(r.id) && r.capabilities.includes("write"),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Field>
              <Field
                name="reason"
                label="Shift / takeover reason"
                minLength={3}
                maxLength={500}
              />
            </ActionForm>
          </details>
        )}
      {actionable &&
        mine &&
        record.status === "draft" &&
        record.kind === "note" &&
        responsibility?.can_attest && (
          <details>
            <summary>Attest this draft</summary>
            <ActionForm
              scope={org}
              path={`journey/encounters/${data.encounter.id}/entries/${record.id}/attest`}
              label="Attest clinical note"
              body={(form) => ({
                expected_version: data.encounter.version,
                password: form.get("password"),
                attestation: true,
                acting_role_id: value(form, "acting_role_id"),
              })}
            >
              <p>
                Confirm that you reviewed this note and take responsibility for
                its contents.
              </p>
              <Field
                name="acting_role_id"
                label="Acting team role"
                defaultValue={roles.length === 1 ? roles[0].id : ""}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Field>
              <Field
                name="password"
                label="Re-enter your password"
                type="password"
                maxLength={128}
              />
              <label className="check-label">
                <input type="checkbox" required />I have reviewed and attest
                this clinical note.
              </label>
            </ActionForm>
          </details>
        )}
      {actionable &&
        record.status === "attested" &&
        data.effective_roles.some((role) =>
          role.capabilities.includes("attest"),
        ) &&
        data.template.definition.stages
          .find((stage) => stage.key === "handover")
          ?.sections.some((section) => section.key === record.section_key) &&
        !mine && (
          <details>
            <summary>Acknowledge received handover</summary>
            <ActionForm
              scope={org}
              path={`journey/encounters/${data.encounter.id}/handover-acknowledgements`}
              label="Acknowledge handover"
              body={(form) => ({
                expected_version: data.encounter.version,
                entry_id: record.id,
                receiving_role_id: value(form, "receiving_role_id"),
                password: form.get("password"),
                attestation: true,
              })}
            >
              <Field name="receiving_role_id" label="Receiving team role">
                <option value="">Select your receiving role</option>
                {data.effective_roles
                  .filter((role) => role.capabilities.includes("attest"))
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </Field>
              <Field
                name="password"
                label="Re-enter your password"
                type="password"
              />
              <label className="check-label">
                <input type="checkbox" required />I have reviewed and received
                this handover.
              </label>
            </ActionForm>
          </details>
        )}
    </article>
  );
}
export function EncounterPage({ id }: { id: string }) {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const [tab, setTab] = useState("documentation");
  const [sectionKey, setSectionKey] = useState("");
  const [offset, setOffset] = useState(0);
  const [amendment, setAmendment] = useState<Entry | undefined>();
  const [unsaved, setUnsaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  const detail = useLiveQuery(
    org,
    `journey/encounters/${id}`,
    caseView,
    true,
    15_000,
  );
  const entries = useLiveQuery(
    org,
    `journey/encounters/${id}/records/entries?offset=${offset}&limit=20`,
    pageOf(entry).extend({ encounter_version: z.number() }),
    tab === "documentation" && showHistory,
    15_000,
  );
  const tasks = useLiveQuery(
    org,
    `journey/encounters/${id}/records/tasks?offset=${offset}&limit=20`,
    pageOf(task).extend({ encounter_version: z.number() }),
    tab === "actions",
  );
  const observations = useLiveQuery(
    org,
    `journey/encounters/${id}/records/observations?offset=${offset}&limit=20`,
    pageOf(observation),
    tab === "observations",
  );
  const timeline = useLiveQuery(
    org,
    `journey/encounters/${id}/records/timeline?offset=${offset}&limit=20`,
    pageOf(
      z.object({
        id: z.string(),
        sequence: z.number(),
        event_hash: z.string(),
        envelope: z.object({
          action: z.string(),
          recorded_at: z.string().optional(),
          actor: z
            .object({ display_name: z.string().optional() })
            .loose()
            .optional(),
        }),
      }),
    ),
    tab === "evidence",
  );
  const integrity = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/journey/encounters/${id}/evidence/verify`,
        z.object({
          valid: z.boolean(),
          event_count: z.number(),
          version: z.number(),
        }),
      ),
  });
  const data = detail.data;
  if (!data)
    return (
      <>
        <Heading
          title="Patient journey"
          detail="Verifying your facility and care-team permissions."
        />
        <QueryState query={detail} />
      </>
    );
  const roles = data.effective_roles;
  const can = (capability: string) =>
    roles.some((role) => role.capabilities.includes(capability));
  const responsibility =
    data.responsibilities.find((item) => item.section.key === sectionKey) ??
    data.responsibilities.find((item) => item.can_write) ??
    data.responsibilities[0];
  const isActive = data.encounter.status === "active";
  const actionVersion = Math.max(
    data.encounter.version,
    tasks.data?.encounter_version ?? 0,
  );
  const activeStage =
    data.template.definition.stages.find((stage) =>
      stage.sections.some(
        (section) => section.key === responsibility?.section.key,
      ),
    ) ?? data.template.definition.stages[0];
  const selectSection = (key: string) => {
    if (
      unsaved &&
      !window.confirm("Discard unsaved documentation before changing sections?")
    )
      return;
    setUnsaved(false);
    setSectionKey(key);
    setAmendment(undefined);
  };
  return (
    <div
      className="journey-document"
      style={
        {
          "--document-primary": data.brand?.primary_color ?? "#092744",
          "--document-accent": data.brand?.accent_color ?? "#008f89",
        } as CSSProperties
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border border-b-4 border-b-[var(--document-accent)] bg-white p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            CCU360 · Clinical journey ledger
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--document-primary)]">
            {data.brand?.title ?? "Patient Journey Record"}
          </p>
          <p className="mt-1 text-sm text-muted">
            One encounter. Shared clinical state. Accountable care at every
            stage.
          </p>
        </div>
        {data.brand?.logo_id && (
          // eslint-disable-next-line @next/next/no-img-element -- Authenticated tenant asset; do not expose to the public image optimizer.
          <img
            alt="Facility logo"
            className="max-h-20 max-w-44 object-contain"
            src={`/api/v1/journey/config/logos/${data.brand.logo_id}`}
          />
        )}
      </div>
      <CurrentDocument encounterId={id} org={org} />
      <Heading
        eyebrow="PATIENT JOURNEY RECORD"
        title={data.patient.display_name}
        detail={`${data.patient.ccu360_number ? `CCU360 ${data.patient.ccu360_number} · ` : ""}IP ${data.patient.ip_number ?? data.patient.identifier} · ${data.encounter.unit}${data.encounter.bed ? ` · Bed ${data.encounter.bed}` : ""} · Started ${stamp(data.encounter.admitted_at)}`}
        actions={
          <>
            <Status value={data.encounter.status} />
            <Link
              className={buttonClasses.secondary}
              href={`/dashboard/connect?encounter=${id}`}
            >
              Discuss with care team
            </Link>
            <button
              className={buttonClasses.secondary}
              onClick={() => detail.refetch()}
            >
              Refresh journey
            </button>
            <Link
              className={buttonClasses.secondary}
              href="/dashboard/patients"
            >
              Back to journeys
            </Link>
          </>
        }
      />
      <Notice error={detail.error} />
      <div className="journey-version text-[13px] text-muted">
        Ledger version {data.encounter.version} · Form {data.template.name} v
        {data.template.version} · Times in East Africa Time
      </div>
      <div
        className="my-5 flex gap-2 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Patient journey areas"
      >
        {[
          ["documentation", "Journey ledger"],
          ["observations", "Shared observations"],
          ["actions", "Team actions"],
          ["evidence", "Audit & evidence"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className="border-0 border-b-[3px] border-transparent bg-transparent px-[18px] py-3.5 font-semibold whitespace-nowrap text-muted aria-selected:border-teal aria-selected:text-teal-dark"
            key={key}
            onClick={() => {
              if (
                unsaved &&
                !window.confirm(
                  "Discard unsaved documentation before changing journey areas?",
                )
              )
                return;
              setUnsaved(false);
              setTab(key);
              setOffset(0);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "documentation" && (
        <>
          <div className="mb-6 rounded-xl border border-border bg-[#f1f8f7] p-4 text-sm text-muted">
            <strong className="text-[var(--document-primary)]">
              Source-aware record.
            </strong>{" "}
            Observations retain their original author and time. Each team
            documents its own findings, decisions and actions.{" "}
            <button
              className="font-semibold text-teal-dark underline"
              onClick={() => {
                setTab("observations");
                setOffset(0);
              }}
            >
              View shared observations
            </button>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav
              aria-label="Patient journey stages"
              className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-surface p-3 lg:sticky lg:top-5 lg:flex-col"
            >
              <p className="hidden px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted lg:block">
                Journey stages
              </p>
              {data.template.definition.stages.map((stage, index) => {
                const sections = data.responsibilities.filter(
                  (item) => item.stage === stage.key,
                );
                const target =
                  sections.find((item) => item.can_write) ?? sections[0];
                return (
                  <button
                    key={stage.key}
                    disabled={!target}
                    aria-current={
                      activeStage.key === stage.key ? "step" : undefined
                    }
                    className={`shrink-0 rounded-lg border p-3 text-left text-sm ${activeStage.key === stage.key ? "border-[var(--document-accent)] bg-[#eef7f5] text-[var(--document-primary)]" : "border-transparent text-muted"}`}
                    onClick={() => target && selectSection(target.section.key)}
                  >
                    <span className="mr-2 font-mono text-xs">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>{stage.label}</strong>
                    <small className="mt-1 block lg:ml-6">
                      {sections.some((item) => item.can_write)
                        ? "Your care team contributes"
                        : "Shared documentation"}
                    </small>
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0">
              <div className="mb-5 rounded-xl border border-border bg-surface p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">
                  Stage documentation
                </p>
                <h2 className="mt-2 text-2xl text-[var(--document-primary)]">
                  {activeStage.label}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.responsibilities
                    .filter((item) => item.stage === activeStage.key)
                    .map((item) => (
                      <button
                        key={item.section.key}
                        className={`rounded-lg border px-3 py-2 text-sm ${responsibility?.section.key === item.section.key ? "border-teal bg-mint text-teal-dark" : "border-border"}`}
                        onClick={() => selectSection(item.section.key)}
                      >
                        {item.section.label}
                        {item.can_write ? " · Your team" : ""}
                        {item.coverage_gap ? " · Coverage gap" : ""}
                      </button>
                    ))}
                </div>
              </div>
              <div id="journey-editor" onChangeCapture={() => setUnsaved(true)}>
                {amendment ? (
                  <DocumentationForm
                    key={amendment.id}
                    data={data}
                    section={
                      data.responsibilities.find(
                        (item) => item.section.key === amendment.section_key,
                      )!.section
                    }
                    amendment={amendment}
                    close={() => {
                      setAmendment(undefined);
                      setUnsaved(false);
                    }}
                    onSaved={() => setUnsaved(false)}
                  />
                ) : responsibility?.can_write && isActive ? (
                  <DocumentationForm
                    key={responsibility.section.key}
                    data={data}
                    section={responsibility.section}
                    onSaved={() => setUnsaved(false)}
                  />
                ) : (
                  <Panel title="Section access">
                    <p>
                      {responsibility?.section.label ?? "Journey documentation"}{" "}
                      is available for reading. Only the assigned professional
                      team can document in this section.
                    </p>
                  </Panel>
                )}
              </div>
              <FullLedger
                data={data}
                select={(key) => {
                  selectSection(key);
                  document
                    .getElementById("journey-editor")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                amend={(record) => {
                  if (
                    unsaved &&
                    !window.confirm("Discard unsaved documentation?")
                  )
                    return;
                  setUnsaved(false);
                  setAmendment(record);
                  setSectionKey(record.section_key);
                  document
                    .getElementById("journey-editor")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              />
              <Panel
                title="Recorded notes & comments"
                detail="Shared notes and comments from every stage, with original authors and revisions retained. Attestation is a separate, password-confirmed action."
              >
                <button
                  className={buttonClasses.secondary}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory
                    ? "Hide revision history"
                    : "Show complete revision history"}
                </button>
                {showHistory && (
                  <>
                    <QueryState query={entries} />
                    {entries.data?.items.map((record) => (
                      <EntryCard
                        key={record.id}
                        record={record}
                        data={{
                          ...data,
                          encounter: {
                            ...data.encounter,
                            version: Math.max(
                              data.encounter.version,
                              entries.data?.encounter_version ?? 0,
                            ),
                          },
                        }}
                        amend={() => {
                          setAmendment(record);
                          setSectionKey(record.section_key);
                        }}
                      />
                    ))}
                    <Pager
                      offset={offset}
                      count={entries.data?.items.length ?? 0}
                      change={setOffset}
                    />
                  </>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
      {tab === "actions" && (
        <>
          <Panel title="Team-owned actions">
            <QueryState query={tasks} />
            {tasks.data?.items.map((item) => (
              <article
                className="record-card my-4 rounded-[10px] border border-border border-l-[3px] border-l-teal p-5"
                key={item.id}
              >
                <header>
                  <strong>{item.title}</strong>
                  <Status value={item.status} />
                </header>
                <p>
                  Owner:{" "}
                  {data.care_roles.find(
                    (role) => role.id === item.owner_role_id,
                  )?.name ?? item.owner_role_id}{" "}
                  · Due {stamp(item.due_at)}
                </p>
                {can("tasks") &&
                  !["completed", "cancelled"].includes(item.status) && (
                    <ActionForm
                      scope={org}
                      path={`journey/encounters/${id}/tasks/${item.id}/transitions`}
                      label="Record action update"
                      body={(form) => ({
                        expected_version: actionVersion,
                        status: value(form, "status"),
                        reason: value(form, "reason"),
                      })}
                    >
                      <Field name="status" label="Next status">
                        <option value="">Choose status</option>
                        {(item.status === "unable"
                          ? ["in_progress", "cancelled"]
                          : item.status === "in_progress"
                            ? ["completed", "unable", "cancelled"]
                            : [
                                "in_progress",
                                "completed",
                                "unable",
                                "cancelled",
                              ]
                        ).map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </Field>
                      <Field
                        name="reason"
                        label="Update / reason"
                        minLength={3}
                        maxLength={500}
                      />
                    </ActionForm>
                  )}
              </article>
            ))}
            <Pager
              offset={offset}
              count={tasks.data?.items.length ?? 0}
              change={setOffset}
            />
          </Panel>
          {can("tasks") && isActive && (
            <Panel title="Create a team action">
              <ActionForm
                scope={org}
                path={`journey/encounters/${id}/tasks`}
                label="Create action"
                body={(form) => ({
                  expected_version: actionVersion,
                  owner_role_id: value(form, "owner_role_id"),
                  title: value(form, "title"),
                  due_at: value(form, "due_at")
                    ? new Date(value(form, "due_at")).toISOString()
                    : null,
                })}
              >
                <Field
                  name="title"
                  label="Action"
                  minLength={3}
                  maxLength={300}
                />
                <Field name="owner_role_id" label="Responsible team">
                  <option value="">Choose team</option>
                  {data.care_roles
                    .filter(
                      (role) =>
                        role.active && role.capabilities.includes("tasks"),
                    )
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </Field>
                <Field
                  name="due_at"
                  label="Due at (local time)"
                  type="datetime-local"
                  required={false}
                />
              </ActionForm>
            </Panel>
          )}
        </>
      )}
      {tab === "observations" && (
        <>
          <Panel
            title="Shared observations"
            detail="A referenced observation retains the original measured value and recording time. Verification does not infer clinical freshness."
          >
            <QueryState query={observations} />
            {observations.data?.items.map((item) => (
              <article
                className="record-card my-4 rounded-[10px] border border-border border-l-[3px] border-l-teal p-5"
                key={item.id}
              >
                <strong>
                  {item.code}: {displayValue(item.value)} {item.unit ?? ""}
                </strong>
                <p>Observed {stamp(item.observed_at)}</p>
                {can("verify") && (
                  <details>
                    <summary>Verify or dispute</summary>
                    <ActionForm
                      scope={org}
                      path={`journey/encounters/${id}/observations/verify`}
                      label="Record verification"
                      body={(form) => ({
                        expected_version: data.encounter.version,
                        observation_id: item.id,
                        decision: value(form, "decision"),
                        reason: value(form, "reason"),
                        acting_role_id: value(form, "acting_role_id"),
                      })}
                    >
                      <Field name="decision" label="Decision">
                        <option value="verified">Verified</option>
                        <option value="disputed">Disputed</option>
                      </Field>
                      <Field name="acting_role_id" label="Acting team role">
                        <option value="">Choose role</option>
                        {roles
                          .filter((role) =>
                            role.capabilities.includes("verify"),
                          )
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                      </Field>
                      <Field
                        name="reason"
                        label="Reason / evidence"
                        minLength={3}
                        maxLength={500}
                      />
                    </ActionForm>
                  </details>
                )}
              </article>
            ))}
            <Pager
              offset={offset}
              count={observations.data?.items.length ?? 0}
              change={setOffset}
            />
          </Panel>
          {can("observe") && isActive && (
            <Panel title="Record an observation">
              <ActionForm
                scope={org}
                path={`journey/encounters/${id}/observations`}
                label="Record observation"
                body={(form) => {
                  const kind = value(form, "kind");
                  const raw = value(form, "value");
                  const numeric = Number(raw);
                  if (kind === "number" && !Number.isFinite(numeric))
                    throw new Error("Use a finite observation value.");
                  return {
                    expected_version: data.encounter.version,
                    code: value(form, "code"),
                    unit: value(form, "unit") || null,
                    value: {
                      status: "present",
                      value: kind === "number" ? numeric : raw,
                    },
                    observed_at: new Date(
                      value(form, "observed_at"),
                    ).toISOString(),
                    acting_role_id: value(form, "acting_role_id"),
                    source_reference: value(form, "source_reference") || null,
                  };
                }}
              >
                <Field
                  name="code"
                  label="Observation name / code"
                  maxLength={100}
                />
                <Field name="kind" label="Value type">
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </Field>
                <Field name="value" label="Measured value" />
                <Field
                  name="unit"
                  label="Unit"
                  maxLength={50}
                  required={false}
                />
                <Field
                  name="observed_at"
                  label="Observed at (local time)"
                  type="datetime-local"
                  defaultValue={localTime()}
                />
                <Field name="acting_role_id" label="Acting team role">
                  <option value="">Choose role</option>
                  {roles
                    .filter((role) => role.capabilities.includes("observe"))
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </Field>
                <Field
                  name="source_reference"
                  label="Source reference"
                  maxLength={200}
                  required={false}
                />
              </ActionForm>
            </Panel>
          )}
        </>
      )}
      {tab === "evidence" && (
        <>
          <Panel
            title="Ledger integrity"
            detail="Server integrity seals preserve recorded authorship and change history; they are not independent notarization or personal qualified signatures."
          >
            <p className="hash-value wrap-anywhere font-mono text-xs">
              Ledger head: {data.encounter.head_hash}
            </p>
            <button
              className={buttonClasses.secondary}
              disabled={integrity.isPending}
              onClick={() => integrity.mutate()}
            >
              {integrity.isPending ? "Verifying…" : "Verify ledger integrity"}
            </button>
            <Notice error={integrity.error} />
            {integrity.data && (
              <p role="status">
                {integrity.data.valid
                  ? "Integrity verified"
                  : "Integrity verification failed"}{" "}
                · {integrity.data.event_count} events · version{" "}
                {integrity.data.version}
              </p>
            )}
            {can("export") && (
              <ActionButton
                scope={org}
                path={`journey/encounters/${id}/outputs`}
                body={{ expected_version: data.encounter.version }}
                onSuccess={(result) => {
                  const output = z
                    .object({ output_id: z.string() })
                    .parse(result);
                  window.location.assign(
                    new URL(
                      `/api/v1/journey/encounters/${id}/outputs/${output.output_id}`,
                      window.location.origin,
                    ).href,
                  );
                }}
              >
                Generate & download branded ledger
              </ActionButton>
            )}
          </Panel>
          <Panel title="Accountability timeline">
            <QueryState query={timeline} />
            {timeline.data?.items.map((item) => (
              <div
                className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
                key={item.id}
              >
                <strong>
                  #{item.sequence} ·{" "}
                  {item.envelope.action.replaceAll(".", " · ")}
                </strong>
                <small>
                  {item.envelope.actor?.display_name ?? "Recorded actor"}
                </small>
              </div>
            ))}
            <Pager
              offset={offset}
              count={timeline.data?.items.length ?? 0}
              change={setOffset}
            />
          </Panel>
          {can("close") && isActive && (
            <Panel
              title="Close this journey"
              detail="Clinical closure requires all outstanding tasks to be resolved. New documentation is then restricted; attributed amendments remain possible."
            >
              <ActionForm
                scope={org}
                path={`journey/encounters/${id}/close`}
                label="Close journey"
                body={(form) => ({
                  expected_version: data.encounter.version,
                  reason: value(form, "reason"),
                })}
              >
                <Field
                  name="reason"
                  label="Closure reason"
                  minLength={3}
                  maxLength={500}
                />
              </ActionForm>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
