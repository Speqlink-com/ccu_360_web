"use client";
import { useState } from "react";
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
import { Icon } from "@/components/ui/icon";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { WebSelect } from "@/components/ui/web-select";

const queueSize = 7;
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
  const org = useIdentity().data!.organization_id!,
    filters = prefs();
  const [offset, setOffset] = useState(0),
    [selection, setSelection] = useState<z.infer<typeof item> | null>(null),
    [shiftOpen, setShiftOpen] = useState(false),
    [shiftReason, setShiftReason] = useState(""),
    [action, setAction] = useState("claim"),
    [role, setRole] = useState(""),
    [reason, setReason] = useState("");
  const query = useLiveQuery(
    org,
    `journey/queue?offset=${offset}&limit=${queueSize}&mine=${filters.mine}${filters.state ? `&state=${filters.state}` : ""}`,
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
  const saveShift = async () => {
    if (!current || shiftReason.trim().length < 3) return;
    try {
      await changeShift.mutateAsync({
        on_shift: !current.on_shift,
        expected_version: current.version,
        reason: shiftReason.trim(),
      });
      setShiftOpen(false);
      setShiftReason("");
    } catch {
      // Keep the drawer open with the mutation error visible.
    }
  };
  return (
    <div className="clinical-queue-page">
      <Heading
        title="Team work queue"
        eyebrow=""
        detail="One patient, one shared document. Claim your team’s section, record care, then complete or hand it over. Your colleagues keep access to the full ledger."
      />
      <section className="queue-shift-card">
        <div className="queue-shift-indicator" aria-hidden="true"><Icon name="activity" size={24} outline /></div>
        <div className="queue-shift-copy">
          <span>YOUR SHIFT</span>
          <h2>
            {current?.on_shift ? "You are on shift" : "Start your care shift"}
          </h2>
          <p>
            {current?.on_shift
              ? `Claims expire at ${stamp(current.ends_at!)}. Ending your shift makes your sections available to your team.`
              : "Starting a shift makes you available to claim work for up to 12 hours. Patient access still follows your active shared or individual roles."}
          </p>
        </div>
        <button
          className={`${buttonClasses.primary} queue-shift-button`}
          disabled={!current || changeShift.isPending}
          onClick={() => {
            changeShift.reset();
            setShiftOpen(true);
          }}
        >
          <Icon name={current?.on_shift ? "clock" : "activity"} size={17} outline />
          {current?.on_shift ? "End shift" : "Start shift"}
        </button>
      </section>
      <QueryState query={shiftQuery} />
      <Panel
        title="Patient sections"
        icon="form"
        detail="Oldest work appears first. Draft notes need attestation where required before a section can be completed."
      >
        <div className="queue-toolbar">
          <label className="queue-mine-filter">
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
          <WebSelect
            className="queue-state-filter"
            label="Status"
            value={filters.state}
            onChange={(state) => { filters.set({ state }); setOffset(0); }}
            options={[
              { value: "", label: "All sections" },
              { value: "ready", label: "Open sections" },
              { value: "completed", label: "Completed" },
            ]}
          />
          <button
            type="button"
            className="queue-tool-button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <Icon name="refresh" size={16} outline /> Refresh
          </button>
          {(filters.mine || filters.state) && (
            <button
              type="button"
              className="queue-tool-button"
              onClick={() => {
                filters.set({ mine: false, state: "" });
                setOffset(0);
              }}
            >
              Clear filters
            </button>
          )}
          <Link className="queue-tool-button queue-patients-link" href="/dashboard/patients">
            Patients <Icon name="arrow" size={15} outline />
          </Link>
        </div>
        <QueryState query={query} />
        <div className="queue-table-wrap">
          <table className="live-table queue-table">
            <thead><tr><th>Patient</th><th>Care section</th><th>Assigned team</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
          {query.data?.items.map((row) => (
            <tr key={row.id}>
              <td data-label="Patient">
                <div>
                <Link
                  className="queue-patient-link"
                  href={`/dashboard/patients/${row.encounter_id}`}
                >
                  {row.patient_name}
                </Link>
                <small>{row.patient_ccu360 ? `CCU360 ${row.patient_ccu360} · ` : ""}IP {row.patient_ip}</small>
                </div>
              </td>
              <td data-label="Care section"><div><strong>{row.section_label}</strong><small>Added {stamp(row.created_at)}</small></div></td>
              <td data-label="Assigned team">{row.roles.map((r) => r.name).join(" · ") || "No team assigned"}</td>
              <td data-label="Status">
                  <Status
                    value={
                      row.claimed_by_me
                        ? "Claimed by you"
                        : row.claim_active && row.claimed_by
                          ? `With ${row.claimed_by}`
                          : row.state
                    }
                  />
              </td>
              <td data-label="Actions">
                <div className="queue-row-actions">
                <Link
                  className="queue-open-link"
                  href={`/dashboard/patients/${row.encounter_id}`}
                  aria-label={`Open ${row.patient_name}'s document`}
                >
                  <Icon name="arrow" size={17} outline />
                </Link>
                <button
                  type="button"
                  className="queue-manage-button"
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
                  Manage
                </button>
                </div>
              </td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
        {query.data && !query.data.items.length && (
          <p className="queue-empty">No sections match your current team assignments and filters.</p>
        )}
        <div className="queue-pager">
          <span>{query.data?.items.length ? `${offset + 1}–${offset + query.data.items.length} shown` : "No sections shown"}</span>
          <div>
          <button
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - queueSize))}
          >
            Previous
          </button>
          <button
            disabled={!query.data?.has_more}
            onClick={() => setOffset(offset + queueSize)}
          >
            Next
          </button>
          </div>
        </div>
      </Panel>
      {shiftOpen && current && (
        <SideDrawer
          title={current.on_shift ? "End your shift" : "Start your shift"}
          subtitle={current.on_shift ? "Record the handover context before making your claimed sections available to the team." : "Add a short shift note before claiming work."}
          eyebrow="CCU360 / CARE SHIFT"
          closeLabel="Close shift form"
          className="queue-action-drawer"
          onClose={() => setShiftOpen(false)}
        >
          <form className="queue-action-form" onSubmit={(event) => { event.preventDefault(); void saveShift(); }}>
            <label className="live-field">
              {current.on_shift ? "Handover reason" : "Shift note"}
              <textarea required minLength={3} maxLength={500} value={shiftReason} onChange={(event) => setShiftReason(event.target.value)} placeholder={current.on_shift ? "Summarize your handover" : "e.g. Scheduled shift"} />
            </label>
            <Notice error={changeShift.error} compact />
            <div className="queue-drawer-actions">
              <button className={buttonClasses.primary} disabled={changeShift.isPending}><ButtonHeartbeat loading={changeShift.isPending}>{current.on_shift ? "End shift" : "Start shift"}</ButtonHeartbeat></button>
            </div>
          </form>
        </SideDrawer>
      )}
      {selection && (
        <SideDrawer
          title="Manage care section"
          subtitle={`${selection.patient_name} · IP ${selection.patient_ip}`}
          eyebrow="CCU360 / TEAM WORK"
          closeLabel="Close section form"
          className="queue-action-drawer"
          onClose={() => setSelection(null)}
        >
          <form
            className="queue-action-form"
            onSubmit={(e) => {
              e.preventDefault();
              void apply();
            }}
          >
            <p className="queue-section-context"><Icon name="form" size={19} outline />{selection.section_label}</p>
            <WebSelect
              label="Action"
              value={action}
              onChange={setAction}
              options={(selection.state === "completed"
                ? ["reopen"]
                : selection.claimed_by_me
                  ? ["complete", "release"]
                  : selection.claim_active
                    ? ["takeover"]
                    : ["claim"]
              ).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
            />
            <WebSelect
              label="Acting team"
              value={role}
              onChange={setRole}
              required
              searchable={selection.roles.length > 5}
              options={selection.roles.map((team) => ({ value: team.id, label: team.name }))}
            />
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
            <Notice error={mutate.error} compact />
            <div className="queue-drawer-actions">
              <button
                className={buttonClasses.primary}
                disabled={mutate.isPending}
              >
                <ButtonHeartbeat loading={mutate.isPending}>Confirm action</ButtonHeartbeat>
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
        </SideDrawer>
      )}
    </div>
  );
}
