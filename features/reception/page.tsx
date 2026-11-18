"use client";
import { useState } from "react";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import {
  Heading,
  Panel,
  Field,
  QueryState,
  value,
  stamp,
} from "@/features/live/shared";
import { buttonClasses } from "@/lib/presentation";
import {
  receptionAccess,
  visitLabels,
  emptyFilter,
  type PatientFilter,
  type QueueFilter,
} from "./contracts";
import { usePatientSearch, useArrivals } from "./queries";
import { PatientForm } from "./patient-form";
import { PatientWorkspace } from "./patient-workspace";
import { ReceptionPager } from "./shared";
export function ReceptionPage() {
  const org = useIdentity().data!.organization_id!;
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [area, setArea] = useState("directory"),
    [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<PatientFilter>(emptyFilter),
    [queueFilter, setQueueFilter] = useState<QueueFilter>(emptyFilter);
  const access = useLiveQuery(org, "journey/reception/access", receptionAccess);
  const patients = usePatientSearch(
    { ...filter, timezone: timeZone },
    !!access.data && area === "directory" && !selected && !creating,
  );
  const arrivals = useArrivals(
    { ...queueFilter, timezone: timeZone },
    !!access.data && area === "arrivals" && !selected && !creating,
  );
  const select = (id: string) => {
    setCreating(false);
    setSelected(id);
  };
  return (
    <>
      <Heading
        title="Reception & patient registry"
        detail="One patient profile. Every visit connected. Find the patient, record how they arrived and start their care journey."
      />
      <QueryState query={access} />
      {access.data && (
        <>
          {!selected && !creating && (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <nav
                  aria-label="Reception workspace"
                  className="flex flex-wrap gap-2"
                >
                  {[
                    ["directory", "Patient directory"],
                    ["arrivals", "Arrival queue"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={`rounded-lg border px-5 py-3 font-semibold ${area === key ? "border-teal bg-mint text-teal-dark" : "border-border bg-surface text-muted"}`}
                      aria-pressed={key === area}
                      onClick={() => setArea(key)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <button
                  className={buttonClasses.primary}
                  onClick={() => setCreating(true)}
                >
                  Register a new patient
                </button>
              </div>
              <div className="mb-6 grid gap-3 md:grid-cols-3">
                {[
                  [
                    "01",
                    "Find the patient",
                    "Search names, IP numbers and CCU360 numbers before registration.",
                  ],
                  [
                    "02",
                    "Record the arrival",
                    "A walk-in or referral can be a new or returning patient.",
                  ],
                  [
                    "03",
                    "Start the journey",
                    "Use an approved form. Clinical disposition stays with the clinician.",
                  ],
                ].map(([number, title, detail]) => (
                  <div
                    key={number}
                    className="rounded-xl border border-border bg-surface p-5"
                  >
                    <p className="text-xs font-bold tracking-widest text-teal-dark">
                      {number}
                    </p>
                    <h2 className="mt-2 font-semibold text-navy">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
              {area === "directory" && (
                <Panel
                  title="Facility patient directory"
                  detail="Patient information stays inside this facility. CCU360 numbers are globally unique; IP numbers belong to the facility."
                >
                  <form
                    className="mb-5 rounded-xl border border-border bg-[#f6f9fa] p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      setFilter({
                        query: value(data, "query"),
                        search_by: value(
                          data,
                          "search_by",
                        ) as PatientFilter["search_by"],
                        sex: value(data, "sex") || undefined,
                        registered_from:
                          value(data, "registered_from") || undefined,
                        registered_to:
                          value(data, "registered_to") || undefined,
                        offset: 0,
                        limit: 20,
                      });
                    }}
                  >
                    <div className="grid gap-x-4 md:grid-cols-[220px_minmax(0,1fr)]">
                      <Field
                        name="search_by"
                        label="Search by"
                        defaultValue="any"
                      >
                        <option value="any">Name or patient number</option>
                        <option value="name">Patient name</option>
                        <option value="ip_number">Facility IP number</option>
                        <option value="ccu360_number">
                          CCU360 number · exact six digits
                        </option>
                      </Field>
                      <Field
                        name="query"
                        label="Search patient name, IP or CCU360 number"
                        required={false}
                        maxLength={100}
                      />
                    </div>
                    <details className="mb-4">
                      <summary className="cursor-pointer text-sm font-semibold text-teal-dark">
                        Filter patient records
                      </summary>
                      <div className="mt-4 grid gap-x-4 sm:grid-cols-3">
                        <Field name="sex" label="Sex" required={false}>
                          <option value="">Any</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="intersex">Intersex</option>
                          <option value="unknown">Not recorded</option>
                        </Field>
                        <Field
                          name="registered_from"
                          label="Registered from"
                          type="date"
                          required={false}
                        />
                        <Field
                          name="registered_to"
                          label="Registered to"
                          type="date"
                          required={false}
                        />
                      </div>
                    </details>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={buttonClasses.secondary}
                        disabled={patients.isFetching}
                      >
                        {patients.isFetching ? "Searching…" : "Search patients"}
                      </button>
                      <button
                        type="reset"
                        className="px-3 text-sm font-semibold text-muted"
                        onClick={() => setFilter(emptyFilter)}
                      >
                        Clear filters
                      </button>
                    </div>
                  </form>
                  <QueryState query={patients} />
                  <div className="overflow-x-auto">
                    <table className="live-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>CCU360 number</th>
                          <th>IP number</th>
                          <th>Date of birth / telephone</th>
                          <th>Profile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.data?.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.display_name}</strong>
                              <small>
                                {item.sex === "unknown"
                                  ? "Sex not recorded"
                                  : item.sex}
                              </small>
                            </td>
                            <td>
                              <span className="font-mono font-semibold tracking-wide text-teal-dark">
                                {item.ccu360_number}
                              </span>
                            </td>
                            <td>{item.ip_number}</td>
                            <td>
                              {item.date_of_birth ?? "DOB not recorded"}
                              <small>
                                {item.phone ?? "Telephone not recorded"}
                              </small>
                            </td>
                            <td>
                              <button
                                className={buttonClasses.secondary}
                                onClick={() => select(item.id)}
                              >
                                Open patient
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {patients.data && !patients.data.items.length && (
                    <div className="py-8 text-center text-muted">
                      <p>No patient matches these details.</p>
                      <p className="mt-2 text-sm">
                        Check another name or number before registering a new
                        patient.
                      </p>
                    </div>
                  )}
                  {patients.data && (
                    <ReceptionPager
                      offset={filter.offset}
                      total={patients.data.total}
                      count={patients.data.items.length}
                      change={(offset) =>
                        setFilter((old) => ({ ...old, offset }))
                      }
                    />
                  )}
                </Panel>
              )}
              {area === "arrivals" && (
                <Panel
                  title="Reception arrival queue"
                  detail="Track arrivals and forms without assigning inpatient or outpatient status. The queue refreshes while open."
                >
                  <form
                    className="mb-5 rounded-xl border border-border bg-[#f6f9fa] p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      setQueueFilter({
                        ...emptyFilter,
                        query: value(data, "query"),
                        arrival_source:
                          value(data, "arrival_source") || undefined,
                        registration_type:
                          value(data, "registration_type") || undefined,
                        status: value(data, "status") || undefined,
                        arrived_from: value(data, "arrived_from") || undefined,
                        arrived_to: value(data, "arrived_to") || undefined,
                      });
                    }}
                  >
                    <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field
                        name="query"
                        label="Patient name or number"
                        required={false}
                        maxLength={100}
                      />
                      <Field
                        name="arrival_source"
                        label="Arrival source"
                        required={false}
                      >
                        <option value="">All arrivals</option>
                        <option value="walk_in">Walk-in</option>
                        <option value="referral">Referral</option>
                      </Field>
                      <Field
                        name="registration_type"
                        label="Visit history"
                        required={false}
                      >
                        <option value="">New and returning</option>
                        <option value="new">First recorded visit</option>
                        <option value="returning">Returning patient</option>
                      </Field>
                      <Field
                        name="status"
                        label="Journey progress"
                        required={false}
                      >
                        <option value="">Any progress</option>
                        {Object.entries(visitLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Field>
                      <Field
                        name="arrived_from"
                        label="Arrivals from"
                        type="date"
                        required={false}
                      />
                      <Field
                        name="arrived_to"
                        label="Arrivals to"
                        type="date"
                        required={false}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button className={buttonClasses.secondary}>
                        Filter arrivals
                      </button>
                      <button
                        type="reset"
                        className="px-3 text-sm font-semibold text-muted"
                        onClick={() => setQueueFilter(emptyFilter)}
                      >
                        Clear filters
                      </button>
                    </div>
                  </form>
                  <QueryState query={arrivals} />
                  <div className="overflow-x-auto">
                    <table className="live-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Arrival</th>
                          <th>Visit</th>
                          <th>Progress</th>
                          <th>Profile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arrivals.data?.items.map(({ visit, patient }) => (
                          <tr key={visit.id}>
                            <td>
                              <strong>{patient.display_name}</strong>
                              <small>
                                CCU360 {patient.ccu360_number} · IP{" "}
                                {patient.ip_number}
                              </small>
                            </td>
                            <td>
                              {stamp(visit.arrived_at)}
                              <small>
                                {visit.arrival_source === "referral"
                                  ? `Referral · ${visit.referring_facility}`
                                  : "Walk-in"}
                              </small>
                            </td>
                            <td>
                              {visit.registration_type === "new"
                                ? "First recorded visit"
                                : "Returning"}
                            </td>
                            <td>
                              {visitLabels[visit.status]}
                              <small>
                                {visit.journeys.length} form
                                {visit.journeys.length === 1 ? "" : "s"}
                              </small>
                            </td>
                            <td>
                              <button
                                className={buttonClasses.secondary}
                                onClick={() => select(patient.id)}
                              >
                                Open patient
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {arrivals.data && !arrivals.data.items.length && (
                    <p className="py-7 text-center text-muted">
                      No arrivals match these filters.
                    </p>
                  )}
                  {arrivals.data && (
                    <ReceptionPager
                      offset={queueFilter.offset}
                      total={arrivals.data.total}
                      count={arrivals.data.items.length}
                      change={(offset) =>
                        setQueueFilter((old) => ({ ...old, offset }))
                      }
                    />
                  )}
                </Panel>
              )}
            </>
          )}
          {creating && (
            <Panel
              title="Register patient"
              detail="Create one demographic profile. The server assigns the patient’s six-digit CCU360 number."
            >
              <PatientForm
                onSaved={(patient) => select(patient.id)}
                onCancel={() => setCreating(false)}
                onSelect={select}
              />
            </Panel>
          )}
          {selected && (
            <PatientWorkspace
              key={`${org}:${selected}`}
              patientId={selected}
              canStart={access.data.can_start_journey}
              onClose={() => setSelected(null)}
              onSelect={select}
            />
          )}
        </>
      )}
    </>
  );
}
