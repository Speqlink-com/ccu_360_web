"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { create } from "zustand";
import { z } from "zod";
import {
  useIdentity,
  useLiveQuery,
  useLiveMutation,
} from "@/features/identity/queries";
import {
  Heading,
  Panel,
  Notice,
  QueryState,
  Status,
  stamp,
} from "@/features/live/shared";
import { buttonClasses } from "@/lib/presentation";
const prefs = create<{
  mine: boolean;
  state: string;
  set: (v: { mine?: boolean; state?: string }) => void;
}>((set) => ({ mine: false, state: "", set: (v) => set(v) }));
const shift = z.object({
  on_shift: z.boolean(),
  version: z.number(),
  ends_at: z.string().nullable(),
});
const item = z.object({
  id: z.string(),
  encounter_id: z.string(),
  section_key: z.string(),
  section_label: z.string(),
  patient_name: z.string(),
  patient_ip: z.string(),
  patient_ccu360: z.string().nullable().optional(),
  claimed_by: z.string().nullable().optional(),
  state: z.string(),
  version: z.number(),
  claim_active: z.boolean(),
  claimed_by_me: z.boolean(),
  created_at: z.string(),
  roles: z.array(
    z.object({ id: z.string(), name: z.string(), department_id: z.string() }),
  ),
});
const queue = z.object({
  items: z.array(item),
  has_more: z.boolean(),
  offset: z.number(),
  limit: z.number(),
  shift,
});
export function WorkQueuePage() {
  const dialog = useRef<HTMLDialogElement>(null);
  const org = useIdentity().data!.organization_id!,
    filters = prefs();
  const [offset, setOffset] = useState(0),
    [selection, setSelection] = useState<z.infer<typeof item> | null>(null),
    [action, setAction] = useState("claim"),
    [role, setRole] = useState(""),
    [reason, setReason] = useState("");
  const query = useLiveQuery(
    org,
    `journey/queue?offset=${offset}&limit=30&mine=${filters.mine}${filters.state ? `&state=${filters.state}` : ""}`,
    queue,
    true,
    15_000,
  );
  const shiftQuery = useLiveQuery(org, "journey/shift", shift, true, 30_000);
  const changeShift = useLiveMutation(org, "journey/shift", shift, "PUT");
  const mutate = useLiveMutation(
    org,
    `journey/encounters/${selection?.encounter_id ?? ""}/sections/${selection?.section_key ?? ""}/work`,
    z.object({ encounter_version: z.number() }),
  );
  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal();
  }, [selection]);
  const current = shiftQuery.data ?? query.data?.shift;
  const apply = async () => {
    if (!selection) return;
    try {
      await mutate.mutateAsync({
        action,
        acting_role_id: role || undefined,
        expected_version: selection.version,
        reason,
      });
      setSelection(null);
      setReason("");
    } catch {
      /* Visible problem and refreshed queue preserve context. */
    }
  };
  return (
    <>
      <Heading
        title="Team work queue"
        eyebrow="CCU360 / SHARED CARE"
        detail="One patient, one shared document. Claim your team’s section, record care, then complete or hand it over. Your colleagues keep access to the full ledger."
      />
      <section className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border border-l-4 border-l-teal bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold">
            {current?.on_shift ? "You are on shift" : "Start your care shift"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {current?.on_shift
              ? `Claims expire at ${stamp(current.ends_at!)}. Ending your shift makes your sections available to your team.`
              : "Starting a shift makes you available to claim work for up to 12 hours. Patient access still follows your active shared or individual roles."}
          </p>
        </div>
        <button
          className={buttonClasses.primary}
          disabled={!current || changeShift.isPending}
          onClick={() => {
            const reason = window.prompt(
              current?.on_shift
                ? "Shift end / handover reason"
                : "Shift start note",
              "Scheduled shift",
            );
            if (reason && reason.trim().length >= 3)
              changeShift.mutate({
                on_shift: !current?.on_shift,
                expected_version: current?.version,
                reason,
              });
          }}
        >
          {current?.on_shift ? "End shift" : "Start shift"}
        </button>
      </section>
      <Notice error={changeShift.error} />
      <QueryState query={shiftQuery} />
      <Panel
        title="Patient sections"
        detail="Oldest work appears first. Draft notes need attestation where required before a section can be completed."
      >
        <div className="mb-5 flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.mine}
              onChange={(e) => {
                filters.set({ mine: e.target.checked });
                setOffset(0);
              }}
            />
            My claimed work
          </label>
          <label className="flex items-center gap-2">
            Status
            <select
              value={filters.state}
              onChange={(e) => {
                filters.set({ state: e.target.value });
                setOffset(0);
              }}
            >
              <option value="">All sections</option>
              <option value="ready">Open sections</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <button
            className={buttonClasses.secondary}
            onClick={() => query.refetch()}
          >
            Refresh queue
          </button>
          {(filters.mine || filters.state) && (
            <button
              type="button"
              className={buttonClasses.secondary}
              onClick={() => {
                filters.set({ mine: false, state: "" });
                setOffset(0);
              }}
            >
              Show all team work
            </button>
          )}
          <Link className={buttonClasses.secondary} href="/dashboard/patients">
            Browse facility patients
          </Link>
        </div>
        <QueryState query={query} />
        <div className="space-y-3">
          {query.data?.items.map((row) => (
            <article
              key={row.id}
              className="grid gap-4 rounded-lg border border-border p-5 lg:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <Link
                  className="text-lg font-semibold text-navy hover:underline"
                  href={`/dashboard/patients/${row.encounter_id}`}
                >
                  {row.patient_name}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {row.patient_ccu360 ? `CCU360 ${row.patient_ccu360} · ` : ""}
                  IP {row.patient_ip} · Added {stamp(row.created_at)}
                </p>
              </div>
              <div>
                <h3 className="font-semibold">{row.section_label}</h3>
                <p className="mt-1 text-sm text-muted">
                  {row.roles.map((r) => r.name).join(" · ")}
                </p>
                <div className="mt-2">
                  <Status
                    value={
                      row.claimed_by_me
                        ? "Claimed by you"
                        : row.claim_active && row.claimed_by
                          ? `With ${row.claimed_by}`
                          : row.state
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className={buttonClasses.secondary}
                  href={`/dashboard/patients/${row.encounter_id}`}
                >
                  Open document
                </Link>
                <button
                  className={buttonClasses.primary}
                  onClick={() => {
                    setSelection(row);
                    setAction(
                      row.state === "completed"
                        ? "reopen"
                        : row.claimed_by_me
                          ? "complete"
                          : row.claim_active
                            ? "takeover"
                            : "claim",
                    );
                    setRole(row.roles[0]?.id ?? "");
                    setReason("");
                    mutate.reset();
                  }}
                >
                  Manage section
                </button>
              </div>
            </article>
          ))}
          {query.data && !query.data.items.length && (
            <p className="py-8 text-muted">
              No sections match your current team assignments and filters.
            </p>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button
            disabled={!offset}
            className={buttonClasses.secondary}
            onClick={() => setOffset(Math.max(0, offset - 30))}
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {offset / 30 + 1}</span>
          <button
            disabled={!query.data?.has_more}
            className={buttonClasses.secondary}
            onClick={() => setOffset(offset + 30)}
          >
            Next
          </button>
        </div>
      </Panel>
      {selection && (
        <dialog
          ref={dialog}
          onCancel={() => setSelection(null)}
          aria-labelledby="work-action-title"
          className="m-auto max-h-[90dvh] w-[min(92vw,576px)] overflow-auto rounded-xl bg-white p-0 backdrop:bg-navy/50"
        >
          <form
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void apply();
            }}
          >
            <h2 id="work-action-title" className="text-xl font-semibold">
              {selection.section_label}
            </h2>
            <p className="my-3 text-muted">
              {selection.patient_name} · IP {selection.patient_ip}
            </p>
            <label className="live-field">
              Action
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                {(selection.state === "completed"
                  ? ["reopen"]
                  : selection.claimed_by_me
                    ? ["complete", "release"]
                    : selection.claim_active
                      ? ["takeover"]
                      : ["claim"]
                ).map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="live-field">
              Acting team
              <select
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {selection.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="live-field">
              Reason / handover context
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Notice error={mutate.error} />
            <div className="mt-5 flex gap-3">
              <button
                className={buttonClasses.primary}
                disabled={mutate.isPending}
              >
                {mutate.isPending ? "Saving…" : "Confirm action"}
              </button>
              <button
                type="button"
                className={buttonClasses.secondary}
                onClick={() => setSelection(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
