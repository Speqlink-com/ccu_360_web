"use client";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace, useTransitionAction } from "./queries";
import { useWorkspaceUI } from "@/providers/app-provider";
import { Badge, Empty } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { isDemo } from "@/lib/config";
import { useSession } from "@/providers/session-provider";
import { canWorkAction, canAdmit } from "@/lib/domain/identity";
import { AdmissionDialog } from "@/components/workspace/admission-dialog";
import type {
  Workspace,
  Patient,
  ClinicalAction,
} from "@/lib/domain/workspace";

type Section = "overview" | "patients" | "actions" | "connect" | "handover";
const titles: Record<Section, [string, string]> = {
  overview: [
    "The unit, at a glance.",
    "A shared view of your patients, priorities and care team.",
  ],
  patients: [
    "Your patients.",
    "One longitudinal view for every critical-care encounter.",
  ],
  actions: [
    "Keep care moving.",
    "Shared actions, clear ownership and a visible history.",
  ],
  connect: [
    "The right team, connected.",
    "Follow each consultation from request to review.",
  ],
  handover: [
    "Carry the picture forward.",
    "Prepare from shared patient state and unresolved actions.",
  ],
};
export function DataBoundary({ children }: { children: React.ReactNode }) {
  if (!isDemo)
    return (
      <Empty title="Your clinical workspace is being prepared.">
        Institution authentication and the clinical API must be connected before
        patient data is available. <Link href="/">Return to sign in</Link>
      </Empty>
    );
  return children;
}
export function WorkspacePage({ section }: { section: Section }) {
  const query = useWorkspace();
  const session = useSession();
  const [admitting, setAdmitting] = useState(false);
  const unit = useWorkspaceUI((s) => s.unit);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All patients");
  if (!isDemo) return <DataBoundary>{null}</DataBoundary>;
  if (query.isPending)
    return (
      <div className="loading-state" role="status">
        Loading your workspace…
      </div>
    );
  if (query.isError)
    return (
      <Empty title="The workspace could not be loaded.">
        <button className="btn btn-secondary" onClick={() => query.refetch()}>
          Try again
        </button>
      </Empty>
    );
  const data = query.data;
  const patients = data.patients.filter(
    (p) => unit === "All units" || p.unit === unit,
  );
  const ids = new Set(patients.map((p) => p.id));
  const actions = data.actions.filter((a) => ids.has(a.encounterId));
  const consults = data.consultations.filter((c) => ids.has(c.encounterId));
  const open = actions.filter((a) => a.status !== "completed");
  const overdue = open.filter((a) => a.overdue);
  const visible = patients.filter(
    (p) =>
      `${p.name} ${p.mrn} ${p.bed}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter !== "Review due" || p.review === "Due"),
  );
  return (
    <>
      {admitting && <AdmissionDialog onClose={() => setAdmitting(false)} />}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {section === "overview"
              ? "CLINICAL OVERVIEW"
              : `${section.toUpperCase()} 360`}
          </p>
          <h1>{titles[section][0]}</h1>
          <p className="muted">{titles[section][1]}</p>
        </div>
        {canAdmit(session?.user.role) &&
          (section === "overview" || section === "patients") && (
            <button
              className="btn btn-primary"
              onClick={() => setAdmitting(true)}
            >
              <Icon name="plus" />
              New admission
            </button>
          )}
      </div>
      {section === "overview" && (
        <>
          <div className="shift-summary">
            <div>
              <span className="shift-icon">
                <Icon name="activity" size={22} />
              </span>
              <div>
                <strong>A clear start to the next conversation.</strong>
                <p>
                  {patients.length} patients across{" "}
                  {unit === "All units" ? "your critical-care units" : unit}.{" "}
                  {patients.filter((p) => p.review === "Due").length} reviews
                  ready for your team.
                </p>
              </div>
            </div>
            <Link className="text-link" href="/dashboard/patients">
              Open patient list <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="metrics">
            <Metric
              label="Patients in the unit"
              value={patients.length}
              detail={`${unit === "All units" ? data.capacity.ICU + data.capacity.HDU : data.capacity[unit]} configured beds`}
              icon="patients"
            />
            <Metric
              label="Reviews due"
              value={patients.filter((p) => p.review === "Due").length}
              detail="Awaiting a documented review"
              icon="rounds"
            />
            <Metric
              label="Open actions"
              value={open.length}
              detail={`${overdue.length} overdue in this sample shift`}
              icon="actions"
              amber={overdue.length > 0}
            />
            <Metric
              label="Active consultations"
              value={consults.length}
              detail={`${consults.filter((c) => c.status === "Sent").length} awaiting acknowledgement`}
              icon="connect"
            />
          </div>
        </>
      )}
      {(section === "overview" || section === "patients") && (
        <section className="panel patient-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {section === "overview"
                  ? "Patients in your care"
                  : "Patient list"}{" "}
                <span className="count">{patients.length}</span>
              </h2>
              <p>Current encounters · {unit.toLowerCase()}</p>
            </div>
            <div className="search-field">
              <Icon name="search" size={16} />
              <input
                aria-label="Search patients"
                placeholder="Search name, demo ID or bed"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-toolbar">
            <div className="tabs" aria-label="Patient filter">
              {["All patients", "Review due"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={filter === t ? "selected" : ""}
                  aria-pressed={filter === t}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="small muted">{visible.length} encounters</span>
          </div>
          <PatientTable patients={visible} actions={actions} />
        </section>
      )}
      {section === "overview" && (
        <div className="overview-lower">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>What needs follow-through</h2>
                <p>Assigned work for the sample shift</p>
              </div>
              <Link className="text-link" href="/dashboard/actions">
                All actions <Icon name="arrow" size={14} />
              </Link>
            </div>
            <div className="compact-actions">
              {open.slice(0, 3).map((a) => (
                <Link
                  className="compact-action"
                  key={a.id}
                  href={`/dashboard/patients/${a.encounterId}`}
                >
                  <span
                    className={`action-marker ${a.overdue ? "marker-amber" : ""}`}
                  >
                    <Icon name="clock" size={15} />
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>
                      {patients.find((p) => p.id === a.encounterId)?.name} ·{" "}
                      {a.owner}
                    </small>
                  </span>
                  <span className={a.overdue ? "due-overdue" : "muted"}>
                    {a.due}
                  </span>
                </Link>
              ))}
              {open.length === 0 && (
                <Empty title="No open actions in this view." />
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Connect 360</h2>
                <p>Consultation follow-up</p>
              </div>
              <Badge tone="teal">Pilot</Badge>
            </div>
            <div className="connect-preview">
              {consults.slice(0, 2).map((c) => (
                <div key={c.id}>
                  <span className="service-initial">
                    {c.service.slice(0, 2)}
                  </span>
                  <span>
                    <strong>{c.service}</strong>
                    <small>
                      {patients.find((p) => p.id === c.encounterId)?.name} ·{" "}
                      {c.time}
                    </small>
                  </span>
                  <Badge tone={c.status === "Sent" ? "amber" : "teal"}>
                    {c.status}
                  </Badge>
                </div>
              ))}
              <Link href="/dashboard/connect" className="text-link">
                View consultations <Icon name="arrow" size={15} />
              </Link>
            </div>
          </section>
        </div>
      )}
      {section === "actions" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Multidisciplinary action list</h2>
              <p>
                {open.length} open · {actions.length - open.length} completed
              </p>
            </div>
            <Badge tone="amber">{overdue.length} overdue</Badge>
          </div>
          <ActionList actions={actions} patients={patients} />
        </section>
      )}
      {section === "connect" && (
        <>
          <div className="info-strip">
            <Icon name="connect" />
            <p>
              Sample consultation tracking for Surgery, Nephrology and
              Nutrition. No requests or notifications are sent from this
              preview.
            </p>
          </div>
          <div className="consultation-grid">
            {consults.map((c) => (
              <article className="panel consultation-card" key={c.id}>
                <div className="flex-between">
                  <span className="service-initial">
                    {c.service.slice(0, 2)}
                  </span>
                  <Badge tone={c.status === "Sent" ? "amber" : "teal"}>
                    {c.status}
                  </Badge>
                </div>
                <h2>{c.service}</h2>
                <Link
                  className="text-link"
                  href={`/dashboard/patients/${c.encounterId}`}
                >
                  {patients.find((p) => p.id === c.encounterId)?.name}{" "}
                  <Icon name="arrow" size={14} />
                </Link>
                <p>{c.question}</p>
                <div className="consult-stages">
                  {["Sent", "Acknowledged", "Accepted", "Reviewed"].map(
                    (s, i) => (
                      <span
                        key={s}
                        className={
                          i <=
                          [
                            "Sent",
                            "Acknowledged",
                            "Accepted",
                            "Reviewed",
                          ].indexOf(c.status)
                            ? "stage-done"
                            : ""
                        }
                      >
                        <i />
                        {s}
                      </span>
                    ),
                  )}
                </div>
                <div className="consult-footer">
                  <Icon name="clock" size={15} />
                  {c.eta}
                </div>
                <small className="muted">
                  Requested by {c.requester} · {c.time}
                </small>
              </article>
            ))}
          </div>
        </>
      )}
      {section === "handover" && (
        <>
          <div className="info-strip">
            <Icon name="handover" />
            <p>
              Source-linked preparation only. Finalization and acknowledgement
              will be available after institution authentication and backend
              integration.
            </p>
          </div>
          <div className="handover-list">
            {patients.map((p) => (
              <article key={p.id} className="panel handover-card">
                <div>
                  <span className="eyebrow">
                    {p.unit} · BED {p.bed}
                  </span>
                  <h2>{p.name}</h2>
                  <p>{p.concern}</p>
                  <span className="small muted">
                    {p.support} · Day {p.day}
                  </span>
                </div>
                <div>
                  <strong>
                    {
                      actions.filter(
                        (a) =>
                          a.encounterId === p.id && a.status !== "completed",
                      ).length
                    }{" "}
                    open actions
                  </strong>
                  <p className="small muted">
                    Source observations and owner history retained.
                  </p>
                  <Link
                    href={`/dashboard/patients/${p.id}?view=handover`}
                    className="text-link"
                  >
                    Prepare handover <Icon name="arrow" size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
  amber = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  amber?: boolean;
}) {
  return (
    <div className={`metric ${amber ? "metric-amber" : ""}`}>
      <div>
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function PatientTable({
  patients,
  actions,
}: {
  patients: Patient[];
  actions: ClinicalAction[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">
          Synthetic patient encounters in the selected unit
        </caption>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Location</th>
            <th>Current focus</th>
            <th>Review</th>
            <th>Open actions</th>
            <th>
              <span className="sr-only">Open encounter</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id}>
              <td>
                <Link
                  href={`/dashboard/patients/${p.id}`}
                  className="patient-cell"
                >
                  <span
                    className={`patient-avatar ${p.unit === "HDU" ? "avatar-blue" : ""}`}
                  >
                    {p.initials}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.mrn} · {p.age}y · {p.sex}
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <strong className="table-normal">
                  {p.unit} <span className="muted">/ {p.bed}</span>
                </strong>
                <small>Day {p.day}</small>
              </td>
              <td>
                <strong className="table-normal">{p.concern}</strong>
                <small>{p.support}</small>
              </td>
              <td>
                <Badge
                  tone={
                    p.review === "Due"
                      ? "amber"
                      : p.review === "Complete"
                        ? "teal"
                        : "blue"
                  }
                >
                  {p.review === "Due" ? "Review due" : p.review}
                </Badge>
              </td>
              <td>
                <span className="action-count">
                  {
                    actions.filter(
                      (a) => a.encounterId === p.id && a.status !== "completed",
                    ).length
                  }
                </span>
              </td>
              <td>
                <Link
                  className="icon-button"
                  href={`/dashboard/patients/${p.id}`}
                  aria-label={`Open ${p.name} encounter`}
                >
                  <Icon name="right" size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {patients.length === 0 && (
        <Empty title="No patients match this view.">
          Try another search or unit.
        </Empty>
      )}
    </div>
  );
}
export function ActionList({
  actions,
  patients,
}: Pick<Workspace, "actions" | "patients">) {
  const mutation = useTransitionAction();
  const session = useSession();
  return (
    <div className="full-actions">
      {mutation.isError && (
        <p role="alert" className="inline-error">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="inline-success" role="status">
          Demo action updated. Previous states remain in the history.
        </p>
      )}
      {actions.map((a) => (
        <article key={a.id} className="full-action">
          <span
            className={`action-marker ${a.status === "completed" ? "marker-teal" : a.overdue ? "marker-amber" : ""}`}
          >
            <Icon name={a.status === "completed" ? "actions" : "clock"} />
          </span>
          <div className="action-body">
            <Link
              href={`/dashboard/patients/${a.encounterId}`}
              className="action-title"
            >
              {a.title}
            </Link>
            <p>
              {patients.find((p) => p.id === a.encounterId)?.name} · {a.owner}
            </p>
            <small>
              {a.source} · Version {a.version}
            </small>
            <details>
              <summary>Transition history ({a.history.length})</summary>
              {a.history.map((h, i) => (
                <p key={i} className="small">
                  {h.status.replace("_", " ")} · {h.actor} ·{" "}
                  {new Date(h.at).toLocaleString("en-GB", {
                    timeZone: "Africa/Nairobi",
                  })}{" "}
                  EAT
                </p>
              ))}
            </details>
          </div>
          <div className="action-controls">
            <Badge
              tone={
                a.status === "completed"
                  ? "teal"
                  : a.overdue
                    ? "amber"
                    : "neutral"
              }
            >
              {a.status === "completed"
                ? "Completed"
                : a.overdue
                  ? `Overdue · ${a.due}`
                  : `Due ${a.due}`}
            </Badge>
            {a.status !== "completed" &&
              canWorkAction(session?.user.role, a.ownerRole) && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      id: a.id,
                      next: a.status === "open" ? "in_progress" : "completed",
                      version: a.version,
                    })
                  }
                >
                  {a.status === "open" ? "Start action" : "Mark complete"}
                  <Icon name="right" size={14} />
                </button>
              )}
          </div>
        </article>
      ))}
      {actions.length === 0 && <Empty title="No actions in this view." />}
    </div>
  );
}
