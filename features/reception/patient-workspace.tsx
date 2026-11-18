"use client";
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { Panel, QueryState, stamp } from "@/features/live/shared";
import { buttonClasses } from "@/lib/presentation";
import {
  profileResult,
  pageOf,
  visit,
  visitResult,
  journeySummary,
  demographicRevision,
} from "./contracts";
import { PatientForm } from "./patient-form";
import { ArrivalForm, ArrivalActions, SavedArrival } from "./intake-forms";
import { PatientIdentity, ReceptionPager, VisitCard } from "./shared";
export function PatientWorkspace({
  patientId,
  canStart,
  onClose,
  onSelect,
}: {
  patientId: string;
  canStart: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const org = useIdentity().data!.organization_id!;
  const client = useQueryClient();
  const [tab, setTab] = useState("intake"),
    [offset, setOffset] = useState(0),
    [editing, setEditing] = useState(false);
  const [recorded, setRecorded] = useState<z.infer<typeof visitResult> | null>(
    null,
  );
  const detail = useLiveQuery(
    org,
    `journey/reception/patients/${patientId}`,
    profileResult,
  );
  const history = useLiveQuery(
    org,
    `journey/reception/patients/${patientId}/visits?offset=${offset}&limit=20`,
    pageOf(visit),
    tab === "history",
    30_000,
  );
  const journeys = useLiveQuery(
    org,
    `journey/reception/patients/${patientId}/journeys?offset=${offset}&limit=20`,
    pageOf(journeySummary),
    tab === "journeys",
  );
  const revisions = useLiveQuery(
    org,
    `journey/reception/patients/${patientId}/revisions?offset=${offset}&limit=20`,
    pageOf(demographicRevision),
    tab === "changes",
  );
  const patient = detail.data?.patient;
  return (
    <section aria-label="Selected patient workspace" className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-dark">
          PATIENT PROFILE / RECEPTION
        </p>
        <button className={buttonClasses.secondary} onClick={onClose}>
          Back to directory
        </button>
      </div>
      <Panel title="Patient profile">
        <QueryState query={detail} />
        {patient && (
          <>
            <PatientIdentity patient={patient} />
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted">
              <span>
                {detail.data!.visit_count} recorded arrival
                {detail.data!.visit_count === 1 ? "" : "s"}
              </span>
              <span>
                {detail.data!.journey_count} clinical journey
                {detail.data!.journey_count === 1 ? "" : "s"}
              </span>
              <span>Profile revision {patient.version}</span>
              <button
                className="ml-auto font-semibold text-teal-dark underline"
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Close correction" : "Correct patient details"}
              </button>
            </div>
            {patient.legacy_ip_review_required && (
              <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                This legacy IP number has a conflicting case variant. Verify the
                correct patient and assign a distinct IP number using a profile
                correction.
              </p>
            )}
            {editing && (
              <div className="mt-5 border-t border-border pt-5">
                <PatientForm
                  key={patient.id}
                  existing={patient}
                  onSaved={() => setEditing(false)}
                  onCancel={() => setEditing(false)}
                  onSelect={onSelect}
                />
              </div>
            )}
          </>
        )}
      </Panel>
      {patient && !editing && (
        <>
          <nav
            className="mb-5 flex flex-wrap gap-2"
            aria-label="Patient profile areas"
          >
            {[
              ["intake", "Start visit"],
              ["history", "Arrival history"],
              ["journeys", "Clinical journey history"],
              ["changes", "Profile changes"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold ${key === tab ? "border-teal bg-mint text-teal-dark" : "border-border bg-surface text-muted"}`}
                aria-pressed={key === tab}
                onClick={() => {
                  setTab(key);
                  setOffset(0);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "intake" && (
            <Panel
              title="Record patient arrival"
              detail="Use this existing profile for every visit. Walk-in and referral describe arrival, not clinical admission."
            >
              {recorded ? (
                <SavedArrival
                  result={recorded}
                  canStart={canStart}
                  onNew={() => {
                    setRecorded(null);
                    setTab("history");
                    setOffset(0);
                  }}
                />
              ) : (
                <ArrivalForm
                  key={patient.version}
                  patient={patient}
                  canStart={canStart}
                  onSaved={setRecorded}
                />
              )}
            </Panel>
          )}
          {tab === "history" && (
            <Panel
              title="Arrival history"
              detail="Walk-ins, referrals and repeat visits in this facility. Previous intake details keep the profile version used at the time."
            >
              <QueryState query={history} />
              {history.data?.items.map((item) => (
                <VisitCard key={item.id} visit={item}>
                  <ArrivalActions
                    key={item.journeys.length + item.status}
                    visit={item}
                    canStart={canStart}
                    onChanged={() => {
                      void client.invalidateQueries({
                        queryKey: ["live", org],
                      });
                    }}
                  />
                </VisitCard>
              ))}
              {history.data && (
                <ReceptionPager
                  offset={offset}
                  total={history.data.total}
                  count={history.data.items.length}
                  change={setOffset}
                />
              )}
            </Panel>
          )}
          {tab === "journeys" && (
            <Panel
              title="Clinical journey history"
              detail="Includes earlier journeys created before the reception module. Clinical notes remain accessible through current care-team coverage."
            >
              <QueryState query={journeys} />
              {journeys.data?.items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
                >
                  <div>
                    <strong>
                      {item.name} · v{item.template_version}
                    </strong>
                    <p className="text-sm text-muted">
                      Started {stamp(item.started_at)} · {item.status}
                    </p>
                  </div>
                  {item.can_open ? (
                    <Link
                      href={`/dashboard/patients/${item.id}`}
                      className={buttonClasses.secondary}
                    >
                      Open ledger
                    </Link>
                  ) : (
                    <span className="text-sm text-muted">
                      Current care-team coverage required
                    </span>
                  )}
                </article>
              ))}
              {journeys.data && (
                <ReceptionPager
                  offset={offset}
                  total={journeys.data.total}
                  count={journeys.data.items.length}
                  change={setOffset}
                />
              )}
            </Panel>
          )}
          {tab === "changes" && (
            <Panel
              title="Profile change history"
              detail="Every correction is attributed and retained. Earlier clinical documents keep their original patient snapshot."
            >
              <QueryState query={revisions} />
              {revisions.data?.items.map((item) => (
                <article key={item.id} className="border-b border-border py-5">
                  <strong>
                    Revision {item.version} · {stamp(item.recorded_at)}
                  </strong>
                  <p className="mt-2 text-sm">{item.reason}</p>
                  <p className="mt-2 text-sm text-muted">
                    {item.data.display_name} · IP {item.data.ip_number} · CCU360{" "}
                    {item.data.ccu360_number}
                  </p>
                  <p className="text-sm text-muted">
                    DOB {item.data.date_of_birth ?? "Not recorded"} ·{" "}
                    {item.data.sex} · Telephone{" "}
                    {item.data.phone ?? "Not recorded"}
                  </p>
                  <details className="mt-3 text-xs text-muted">
                    <summary>Audit details</summary>
                    <p className="mt-2 break-all">
                      Actor {item.actor_id}
                      <br />
                      Integrity hash {item.record_hash}
                    </p>
                  </details>
                </article>
              ))}
              {revisions.data && (
                <ReceptionPager
                  offset={offset}
                  total={revisions.data.total}
                  count={revisions.data.items.length}
                  change={setOffset}
                />
              )}
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
