"use client";
import Link from "next/link";
import type { PatientProfile, Visit } from "./contracts";
import { visitLabels } from "./contracts";
import { buttonClasses } from "@/lib/presentation";
import { stamp } from "@/features/live/shared";
export function PatientIdentity({ patient }: { patient: PatientProfile }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div>
        <h2 className="text-2xl font-semibold text-navy">
          {patient.display_name}
        </h2>
        <p className="mt-2 text-sm text-muted">
          DOB {patient.date_of_birth ?? "Not recorded"} ·{" "}
          {patient.sex === "unknown" ? "Sex not recorded" : patient.sex}{" "}
          {patient.phone ? ` · ${patient.phone}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-teal/25 bg-mint px-4 py-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-teal-dark">
            CCU360 number
          </span>
          <strong className="mt-1 block font-mono text-xl tracking-wider text-navy">
            {patient.ccu360_number}
          </strong>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Facility IP number
          </span>
          <strong className="mt-1 block text-lg text-navy">
            {patient.ip_number}
          </strong>
        </div>
      </div>
    </div>
  );
}
export function ReceptionPager({
  offset,
  total,
  count,
  size = 20,
  change,
}: {
  offset: number;
  total: number;
  count: number;
  size?: number;
  change: (value: number) => void;
}) {
  return (
    <div className="reception-pager mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted">
        {total
          ? `${offset + 1}–${Math.min(offset + count, total)} of ${total}`
          : "No matching records"}
      </p>
      <div className="flex gap-2">
        <button
          className={buttonClasses.secondary}
          disabled={!offset}
          onClick={() => change(Math.max(0, offset - size))}
        >
          Previous
        </button>
        <button
          className={buttonClasses.secondary}
          disabled={offset + count >= total}
          onClick={() => change(offset + size)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function JourneyLinks({ visit }: { visit: Visit }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {visit.journeys.map((journey) =>
        journey.can_open ? (
          <Link
            key={journey.id}
            className={buttonClasses.secondary}
            href={`/dashboard/patients/${journey.id}`}
          >
            {journey.name} · v{journey.template_version} · Open ledger
          </Link>
        ) : (
          <p
            key={journey.id}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
          >
            {journey.name} · v{journey.template_version} · Ledger requires
            current team coverage
          </p>
        ),
      )}
    </div>
  );
}
export function VisitCard({
  visit,
  children,
}: {
  visit: Visit;
  children?: React.ReactNode;
}) {
  return (
    <article className="mb-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <strong>
            {visit.arrival_source === "referral" ? "Referral" : "Walk-in"} ·{" "}
            {visit.registration_type === "new"
              ? "First recorded visit"
              : "Returning patient"}
          </strong>
          <p className="mt-1 text-sm text-muted">
            Arrived {stamp(visit.arrived_at)}
          </p>
        </div>
        <span className="self-start rounded-md bg-[#edf4f5] px-3 py-2 text-sm font-medium text-navy">
          {visitLabels[visit.status]}
        </span>
      </div>
      {visit.referring_facility && (
        <p className="mt-3 text-sm">
          From {visit.referring_facility}
          {visit.referral_reference ? ` · ${visit.referral_reference}` : ""}
        </p>
      )}
      {visit.intake_note && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
          {visit.intake_note}
        </p>
      )}
      {visit.cancellation && (
        <p className="mt-3 rounded-lg border border-border p-3 text-sm text-muted">
          Cancelled {stamp(visit.cancellation.recorded_at)} ·{" "}
          {visit.cancellation.reason}
        </p>
      )}
      <JourneyLinks visit={visit} />
      {children}
    </article>
  );
}
export const localTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
