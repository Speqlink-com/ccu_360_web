"use client";
import { buttonClasses } from "@/lib/presentation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "./queries";
import { ActionList, DataBoundary } from "./workspace-page";
import { Badge, Empty } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { isDemo } from "@/lib/config";

export function PatientPage({ id }: { id: string }) {
  const query = useWorkspace();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(
    searchParams.get("view") === "handover"
      ? "Handover preparation"
      : "Clinical state",
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const note = notes[tab] ?? "";
  const setNote = (value: string) =>
    setNotes((current) => ({ ...current, [tab]: value }));
  const [saved, setSaved] = useState(false);
  if (!isDemo) return <DataBoundary>{null}</DataBoundary>;
  if (query.isPending) return <p role="status">Loading encounter…</p>;
  if (query.isError)
    return (
      <Empty title="Encounter could not be loaded.">
        <button onClick={() => query.refetch()}>Try again</button>
      </Empty>
    );
  const patient = query.data.patients.find((p) => p.id === id);
  if (!patient)
    return (
      <Empty title="Encounter not found.">
        <Link href="/dashboard/patients">Back to patients</Link>
      </Empty>
    );
  const actions = query.data.actions.filter((a) => a.encounterId === id);
  return (
    <>
      <Link className="back-link mb-5.5 inline-flex items-center gap-[7px] text-[13px] text-muted" href="/dashboard/patients">
        <Icon name="left" size={15} />
        Patient list
      </Link>
      <div className="patient-heading sticky top-0 z-20 mb-[23px] flex items-center gap-[17px] bg-background py-3 max-[700px]:flex-wrap max-[700px]:gap-3">
        <span className="patient-avatar large-avatar h-[62px] w-[62px] rounded-[13px] text-xl">{patient.initials}</span>
        <div>
          <p className="eyebrow">PATIENT 360 · SYNTHETIC ENCOUNTER</p>
          <h1>{patient.name}</h1>
          <p className="muted">
            {patient.mrn} · {patient.age} years · {patient.sex}{" "}
            <span className="identity-divider mx-2.5 text-[#c4ced4] max-[700px]:mx-1">|</span> {patient.unit} / Bed{" "}
            {patient.bed} · Day {patient.day}
          </p>
        </div>
        <Badge tone="amber">
          {patient.review === "Due" ? "Review due" : patient.review}
        </Badge>
      </div>
      <div className="identity-note">
        <Icon name="shield" size={16} />
        Patient identity and encounter stay visible throughout the workflow. All
        values here are synthetic.
      </div>
      <div className="patient-tabs tabs mb-5.5 gap-[26px] overflow-x-auto whitespace-nowrap border-b border-border">
        {[
          "Clinical state",
          "Actions",
          "Round preparation",
          "Handover preparation",
        ].map((t) => (
          <button
            className={t === tab ? "selected" : ""}
            key={t}
            onClick={() => {
              setTab(t);
              setSaved(false);
            }}
            aria-pressed={t === tab}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Actions" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Encounter actions</h2>
              <p>Ownership and complete transition history</p>
            </div>
          </div>
          <ActionList patients={[patient]} actions={actions} />
        </section>
      ) : (
        <>
          <div className="clinical-focus mb-5.5 flex justify-between gap-6 rounded-[10px] bg-navy p-[26px] text-white max-[1000px]:flex-col">
            <div>
              <p className="eyebrow">CURRENT DOCUMENTED FOCUS</p>
              <h2>{patient.concern}</h2>
              <p>{patient.support}</p>
            </div>
            <div>
              <p className="eyebrow">SOURCE CONTEXT</p>
              <p>Sample shift · 05 Nov 2026, 09:00 EAT</p>
              <small>Manual observations · No device feed connected</small>
            </div>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {tab === "Clinical state"
                    ? "Source-linked observations"
                    : "Shared state for preparation"}
                </h2>
                <p>
                  Referenced from the same record across clinical, round and
                  handover views.
                </p>
              </div>
              <Badge>Manual entry</Badge>
            </div>
            <div className="observation-grid grid grid-cols-2 max-[700px]:grid-cols-1">
              {patient.observations.map((o) => (
                <article className="observation border-r border-b border-border p-[25px] max-[700px]:border-r-0" key={o.id}>
                  <div className="flex-between flex items-center justify-between gap-3">
                    <span>{o.label}</span>
                    <Badge
                      tone={
                        o.state === "verified"
                          ? "teal"
                          : o.state === "conflict"
                            ? "red"
                            : o.state === "stale" || o.state === "unverified"
                              ? "amber"
                              : "neutral"
                      }
                    >
                      {o.state}
                    </Badge>
                  </div>
                  <strong>
                    {o.state === "conflict" ? "—" : o.value}
                    <small>{o.unit}</small>
                  </strong>
                  <p>{o.source}</p>
                  <small className="muted">
                    {o.state === "missing"
                      ? "No observation available"
                      : `${new Date(o.observedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })} EAT · 05 Nov 2026`}
                  </small>
                  <details>
                    <summary>View provenance</summary>
                    <p>Source ID: {o.id}</p>
                    {o.state === "conflict" && (
                      <p>
                        Reported source value: {o.value} {o.unit} · Requires
                        reconciliation
                      </p>
                    )}
                    <p>Encounter: {patient.mrn}</p>
                    <p>
                      {o.state === "conflict"
                        ? "Conflicting source values require clinician reconciliation. No value has been selected automatically."
                        : o.state === "stale"
                          ? "Marked stale in this synthetic fixture. Institutional recency policies are not configured."
                          : "Original source is retained. This view does not create another observation."}
                    </p>
                  </details>
                </article>
              ))}
            </div>
          </section>
          {tab !== "Clinical state" && (
            <section className="panel preparation mt-5.5">
              <div className="panel-heading">
                <div>
                  <h2>{tab}</h2>
                  <p>Source facts stay separate from your draft commentary.</p>
                </div>
                <Badge tone="amber">Not finalized</Badge>
              </div>
              <div className="preparation-body p-5.5">
                <h3>Outstanding actions</h3>
                {actions
                  .filter((a) => a.status !== "completed")
                  .map((a) => (
                    <p key={a.id}>
                      {a.title}{" "}
                      <span className="muted">
                        · {a.owner} · Due {a.due}
                      </span>
                    </p>
                  ))}
                <label htmlFor="commentary">
                  {tab === "Round preparation"
                    ? "Interpretation and priorities"
                    : "Handover context"}
                </label>
                <textarea
                  id="commentary"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Add demo commentary. Do not enter real patient information."
                  maxLength={4000}
                  rows={5}
                />
                <div className="flex-between flex items-center justify-between gap-3">
                  <span className="small muted">
                    Draft stays on this screen and clears when you leave.
                  </span>
                  <button
                    disabled={!note.trim()}
                    className={buttonClasses.primarySmall}
                    onClick={() => setSaved(true)}
                  >
                    Review draft <Icon name="right" size={14} />
                  </button>
                </div>
                {saved && (
                  <div className="draft-review mt-5 rounded-[7px] border border-[#d8e9e4] bg-[#f4faf7] p-4.5" role="status">
                    <h3>Demo clinician commentary · Draft preview</h3>
                    <p>{note}</p>
                    <small>
                      Not saved to a clinical record. Finalization and
                      attestation are unavailable in this phase.
                    </small>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
