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
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { WebSelect } from "@/components/ui/web-select";

const listSize = 7;
const initialFilter = { ...emptyFilter, limit: listSize };
export function ReceptionPage() {
  const org = useIdentity().data!.organization_id!;
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [area, setArea] = useState("directory"),
    [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<PatientFilter>(initialFilter),
    [queueFilter, setQueueFilter] = useState<QueueFilter>(initialFilter);
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
    <div className="clinical-patients-page">
      <Heading
        title={
          access.data?.can_register
            ? "Reception & patient registry"
            : "Facility patients & journeys"
        }
        detail={
          access.data?.can_register
            ? "One patient profile. Every visit connected. Find the patient, record how they arrived and start their care journey."
            : "Browse your facility’s patients, search names or patient numbers, and open the shared journey documents your roles can access."
        }
      />
      <QueryState query={access} />
      {access.data && (
        <>
          {!selected && !creating && (
            <>
              <div className="patient-page-actions mb-6 flex flex-wrap items-center justify-between gap-4">
                <nav
                  aria-label="Reception workspace"
                  className="patient-page-tabs flex flex-wrap gap-2"
                >
                  {[
                    ["directory", "Patient directory"],
                    ["arrivals", "Arrival queue"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={`patient-page-tab ${area === key ? "is-active" : ""}`}
                      aria-pressed={key === area}
                      onClick={() => setArea(key)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                {access.data.can_register && (
                  <button
                    className={`${buttonClasses.primary} patient-register-button`}
                    onClick={() => setCreating(true)}
                  >
                    <Icon name="addUser" size={17} outline /> Register patient
                  </button>
                )}
              </div>
              <nav className="patient-workflow" aria-label="Patient workflow">
                <span>
                  <b>01</b> Find patient
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  <b>02</b>{" "}
                  {access.data.can_register ? "Record arrival" : "Open profile"}
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  <b>03</b>{" "}
                  {access.data.can_register ? "Start journey" : "Open ledger"}
                </span>
              </nav>
              {area === "directory" && (
                <Panel
                  title="Facility patient directory"
                  icon="bed"
                  detail="Patient information stays inside this facility. CCU360 numbers are globally unique; IP numbers belong to the facility."
                >
                  <form
                    className="patient-filter-form mb-5 rounded-xl border border-border bg-[#f6f9fa] p-5"
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
                        limit: listSize,
                      });
                    }}
                  >
                    <div className="grid gap-x-4 md:grid-cols-[220px_minmax(0,1fr)]">
                      <WebSelect name="search_by" label="Search by" defaultValue="any" options={[
                        { value: "any", label: "Name or patient number" },
                        { value: "name", label: "Patient name" },
                        { value: "ip_number", label: "Facility IP number" },
                        { value: "ccu360_number", label: "CCU360 number · exact six digits" },
                      ]} />
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
                        <WebSelect name="sex" label="Sex" options={[
                          { value: "", label: "Any" },
                          { value: "female", label: "Female" },
                          { value: "male", label: "Male" },
                          { value: "intersex", label: "Intersex" },
                          { value: "unknown", label: "Not recorded" },
                        ]} />
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
                        className={buttonClasses.primary}
                        disabled={patients.isFetching}
                      >
                        <ButtonHeartbeat loading={patients.isFetching}>Search patients</ButtonHeartbeat>
                      </button>
                      <button
                        type="reset"
                        className="px-3 text-sm font-semibold text-muted"
                        onClick={() => setFilter(initialFilter)}
                      >
                        Clear filters
                      </button>
                    </div>
                  </form>
                  <QueryState query={patients} />
                  <div className="patient-table-wrap overflow-x-auto">
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
                            <td data-label="Patient">
                              <div>
                              <strong>{item.display_name}</strong>
                              <small>
                                {item.sex === "unknown"
                                  ? "Sex not recorded"
                                  : item.sex}
                              </small>
                              </div>
                            </td>
                            <td data-label="CCU360 number">
                              <span className="font-mono font-semibold tracking-wide text-teal-dark">
                                {item.ccu360_number}
                              </span>
                            </td>
                            <td data-label="IP number">{item.ip_number}</td>
                            <td data-label="Date of birth / telephone">
                              <div>
                              {item.date_of_birth ?? "DOB not recorded"}
                              <small>
                                {item.phone ?? "Telephone not recorded"}
                              </small>
                              </div>
                            </td>
                            <td data-label="Profile">
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
                      size={listSize}
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
                  icon="clock"
                  detail="Track arrivals and forms without assigning inpatient or outpatient status. The queue refreshes while open."
                >
                  <form
                    className="patient-filter-form mb-5 rounded-xl border border-border bg-[#f6f9fa] p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      setQueueFilter({
                        ...initialFilter,
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
                      <WebSelect name="arrival_source" label="Arrival source" options={[
                        { value: "", label: "All arrivals" },
                        { value: "walk_in", label: "Walk-in" },
                        { value: "referral", label: "Referral" },
                      ]} />
                      <WebSelect name="registration_type" label="Visit history" options={[
                        { value: "", label: "New and returning" },
                        { value: "new", label: "First recorded visit" },
                        { value: "returning", label: "Returning patient" },
                      ]} />
                      <WebSelect name="status" label="Journey progress" options={[
                        { value: "", label: "Any progress" },
                        ...Object.entries(visitLabels).map(([value, label]) => ({ value, label })),
                      ]} />
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
                      <button className={buttonClasses.primary} disabled={arrivals.isFetching}>
                        <ButtonHeartbeat loading={arrivals.isFetching}>Filter arrivals</ButtonHeartbeat>
                      </button>
                      <button
                        type="reset"
                        className="px-3 text-sm font-semibold text-muted"
                        onClick={() => setQueueFilter(initialFilter)}
                      >
                        Clear filters
                      </button>
                    </div>
                  </form>
                  <QueryState query={arrivals} />
                  <div className="patient-table-wrap overflow-x-auto">
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
                            <td data-label="Patient">
                              <div>
                              <strong>{patient.display_name}</strong>
                              <small>
                                CCU360 {patient.ccu360_number} · IP{" "}
                                {patient.ip_number}
                              </small>
                              </div>
                            </td>
                            <td data-label="Arrival">
                              <div>
                              {stamp(visit.arrived_at)}
                              <small>
                                {visit.arrival_source === "referral"
                                  ? `Referral · ${visit.referring_facility}`
                                  : "Walk-in"}
                              </small>
                              </div>
                            </td>
                            <td data-label="Visit">
                              {visit.registration_type === "new"
                                ? "First recorded visit"
                                : "Returning"}
                            </td>
                            <td data-label="Progress">
                              <div>
                              {visitLabels[visit.status]}
                              <small>
                                {visit.journeys.length} form
                                {visit.journeys.length === 1 ? "" : "s"}
                              </small>
                              </div>
                            </td>
                            <td data-label="Profile">
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
                      size={listSize}
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
              icon="addUser"
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
              canRegister={access.data.can_register}
              onClose={() => setSelected(null)}
              onSelect={select}
            />
          )}
        </>
      )}
    </div>
  );
}
