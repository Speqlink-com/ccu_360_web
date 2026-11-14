"use client";
import { useState } from "react";
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
}: {
  field: Section["fields"][number];
  previous?: Entry["values"][string];
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
      <label className="availability-label">
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
}: {
  data: Case;
  section: Section;
  amendment?: Entry;
  close?: () => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const id = data.encounter.id;
  const [version, setVersion] = useState(data.encounter.version);
  const [kind, setKind] = useState(amendment?.kind ?? "note");
  const observations = useChoices(
    org,
    `journey/encounters/${id}/records/observations`,
    observation,
  );
  const roles = data.effective_roles.filter(
    (role) =>
      section.role_ids.includes(role.id) && role.capabilities.includes("write"),
  );
  const changed = version !== data.encounter.version;
  return (
    <Panel
      title={amendment ? "Amend recorded information" : section.label}
      detail="Entries retain their original author. Notes are saved as drafts until the author attests them; comments are posted directly."
    >
      {changed && (
        <div className="version-notice" role="alert">
          <p>
            This journey changed from version {version} to{" "}
            {data.encounter.version}. Review the latest records before saving
            your documentation.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => setVersion(data.encounter.version)}
          >
            I have reviewed the latest version
          </button>
        </div>
      )}
      <ActionForm
        scope={org}
        path={`journey/encounters/${id}/${kind === "comment" ? "comments" : "entries"}`}
        label={
          amendment
            ? "Save amendment"
            : kind === "comment"
              ? "Post comment"
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
              <option value="note">Clinical note (draft, then attest)</option>
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
                key={field.key}
                field={field}
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
        <button className="text-button" onClick={close}>
          Cancel amendment
        </button>
      )}
    </Panel>
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
  const responsibility = data.responsibilities.find(
    (item) => item.section.key === record.section_key,
  );
  const roles = data.effective_roles.filter(
    (role) =>
      responsibility?.section.role_ids.includes(role.id) &&
      role.capabilities.includes("attest"),
  );
  return (
    <article className="record-card">
      <header>
        <div>
          <strong>{responsibility?.section.label ?? record.section_key}</strong>
          <p>
            {record.author.display_name} ·{" "}
            {record.author.team_role_name ?? "Care team"} ·{" "}
            {stamp(record.recorded_at)}
          </p>
        </div>
        <Status value={record.status} />
      </header>
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
            <dd>{displayValue(item)}</dd>
          </div>
        ))}
      </dl>
      <small>
        Revision {record.revision} · {record.kind}
        {record.reason ? ` · Amendment: ${record.reason}` : ""}
      </small>
      {responsibility?.can_write && (mine || record.status !== "draft") && (
        <button className="text-button" onClick={amend}>
          Create an attributed amendment
        </button>
      )}
      {mine &&
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
      {record.status === "attested" &&
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
  const detail = useLiveQuery(org, `journey/encounters/${id}`, caseView);
  const entries = useLiveQuery(
    org,
    `journey/encounters/${id}/records/entries?offset=${offset}&limit=20`,
    pageOf(entry),
    tab === "documentation",
  );
  const tasks = useLiveQuery(
    org,
    `journey/encounters/${id}/records/tasks?offset=${offset}&limit=20`,
    pageOf(task),
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
    data.responsibilities.find((item) => item.can_write);
  const isActive = data.encounter.status === "active";
  return (
    <>
      <Heading
        title={data.patient.display_name}
        detail={`${data.patient.identifier} · ${data.encounter.unit} · Bed ${data.encounter.bed ?? "unassigned"} · Admitted ${stamp(data.encounter.admitted_at)}`}
        actions={
          <>
            <Status value={data.encounter.status} />
            <Link className="btn btn-secondary" href={`/dashboard/connect?encounter=${id}`}>
              Discuss with care team
            </Link>
            <button
              className="btn btn-secondary"
              onClick={() => detail.refetch()}
            >
              Refresh journey
            </button>
            <Link className="btn btn-secondary" href="/dashboard/patients">
              Back to journeys
            </Link>
          </>
        }
      />
      <Notice error={detail.error} />
      <div className="journey-version">
        Ledger version {data.encounter.version} · Form {data.template.name} v
        {data.template.version} · Times in East Africa Time
      </div>
      <div
        className="live-tabs"
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
            key={key}
            onClick={() => {
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
          <div className="stage-pipeline">
            {data.template.definition.stages.map((stage) => (
              <div key={stage.key}>
                <strong>{stage.label}</strong>
                {data.responsibilities
                  .filter((item) => item.stage === stage.key)
                  .map((item) => (
                    <button
                      key={item.section.key}
                      className={
                        responsibility?.section.key === item.section.key
                          ? "selected"
                          : ""
                      }
                      onClick={() => {
                        setSectionKey(item.section.key);
                        setAmendment(undefined);
                      }}
                    >
                      {item.section.identity_roles.join(" / ")}
                      {item.can_write ? " · Your team" : ""}
                      {item.coverage_gap ? " · Coverage gap" : ""}
                    </button>
                  ))}
              </div>
            ))}
          </div>
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
              close={() => setAmendment(undefined)}
            />
          ) : responsibility?.can_write && isActive ? (
            <DocumentationForm
              key={responsibility.section.key}
              data={data}
              section={responsibility.section}
            />
          ) : (
            <Panel title="Section access">
              <p>
                {responsibility?.section.label ?? "Journey documentation"} is
                available for reading. Only the assigned professional team can
                document in this section.
              </p>
            </Panel>
          )}
          <Panel
            title="Recorded notes & comments"
            detail="Original records and later revisions are retained. Attestation is a separate, password-confirmed action."
          >
            <QueryState query={entries} />
            {entries.data?.items.map((record) => (
              <EntryCard
                key={record.id}
                record={record}
                data={data}
                amend={() => {
                  setAmendment(record);
                  setSectionKey(record.section_key);
                }}
              />
            ))}
            {entries.data && !entries.data.items.length && (
              <p>No documentation has been recorded yet.</p>
            )}
            <Pager
              offset={offset}
              count={entries.data?.items.length ?? 0}
              change={setOffset}
            />
          </Panel>
        </>
      )}
      {tab === "actions" && (
        <>
          <Panel title="Team-owned actions">
            <QueryState query={tasks} />
            {tasks.data?.items.map((item) => (
              <article className="record-card" key={item.id}>
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
                        expected_version: data.encounter.version,
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
                  expected_version: data.encounter.version,
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
              <article className="record-card" key={item.id}>
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
            <p className="hash-value">
              Ledger head: {data.encounter.head_hash}
            </p>
            <button
              className="btn btn-secondary"
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
              <div className="live-list-row" key={item.id}>
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
    </>
  );
}
