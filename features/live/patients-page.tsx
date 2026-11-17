"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import { buttonClasses } from "@/lib/presentation";
import { encounter, patient } from "./journey-contract";
import { useChoices, ChoiceLoader } from "./choices";
import {
  Heading,
  Panel,
  Field,
  ActionForm,
  QueryState,
  Status,
  Pager,
  stamp,
  value,
  Notice,
} from "./shared";
const accessSchema = z.object({
  can_register: z.boolean(),
  can_initiate: z.boolean(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      capabilities: z.array(z.string()),
    }),
  ),
});
const published = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  can_initiate: z.boolean(),
  role_ids: z.array(z.string()),
});
export function PatientsPage() {
  const org = useIdentity().data!.organization_id!;
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [admissionTime] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  );
  const [selected, setSelected] = useState<z.infer<typeof patient> | null>(
    null,
  );
  const [register, setRegister] = useState(false);
  const [directoryOffset, setDirectoryOffset] = useState(0);
  const [term, setTerm] = useState("");
  const access = useLiveQuery(org, "journey/access", accessSchema);
  const query = useLiveQuery(
    org,
    `journey/inbox?offset=${offset}&limit=20`,
    pageOf(
      encounter.extend({
        patient_name: z.string(),
        patient_identifier: z.string(),
      }),
    ),
  );
  const templates = useChoices(
    org,
    "journey/published-templates",
    published,
    !!access.data,
  );
  const forms = templates.data?.pages.flatMap((page) => page.items) ?? [];
  const search = useMutation({
    mutationFn: (body: { query: string; offset: number }) =>
      apiRequest("/api/v1/journey/patients/directory", pageOf(patient), {
        method: "POST",
        body: { ...body, limit: 20 },
      }),
    onSuccess: () => {
      setSelected(null);
      setRegister(false);
    },
  });
  return (
    <>
      <Heading
        title="Patients & journeys"
        detail="Find a new or returning patient, start the appropriate form and share one complete ledger across the care team."
      />
      <QueryState query={access} />
      <Panel
        title="My team’s journeys"
        detail="Current team assignments determine which full patient ledgers you can open. Multiple employees can work in the same team."
      >
        <QueryState query={query} />
        <div className="live-table-wrap overflow-x-auto">
          <table className="live-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Unit / bed</th>
                <th>Admitted</th>
                <th>Status</th>
                <th>Journey</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.patient_name}</strong>
                    <small>{item.patient_identifier}</small>
                  </td>
                  <td>
                    {item.unit} · {item.bed ?? "Unassigned"}
                  </td>
                  <td>{stamp(item.admitted_at)}</td>
                  <td>
                    <Status value={item.status} />
                  </td>
                  <td>
                    <Link
                      className={buttonClasses.secondary}
                      href={`/dashboard/patients/${item.id}`}
                    >
                      Open journey
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data && !query.data.items.length && (
          <p className="live-empty py-6 text-muted">
            No journeys yet. Your facility administrator must assign you to a
            care-team role included on a published form.
          </p>
        )}
        <Pager
          offset={offset}
          count={query.data?.items.length ?? 0}
          change={setOffset}
        />
      </Panel>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel
          title="Facility patient directory"
          detail="Search patient name or facility identifier. Patient demographics are shared across this facility; clinical ledgers follow care-team access."
        >
          <form
            className="live-form"
            onSubmit={(event) => {
              event.preventDefault();
              const query = value(new FormData(event.currentTarget), "query");
              setTerm(query);
              setDirectoryOffset(0);
              search.mutate({ query, offset: 0 });
            }}
          >
            <Field
              name="query"
              label="Patient name or identifier"
              maxLength={100}
            />
            <button
              className={buttonClasses.secondary}
              disabled={search.isPending}
            >
              {search.isPending ? "Searching…" : "Find patient"}
            </button>
          </form>
          <Notice error={search.error} />
          <ul className="divide-y divide-border">
            {search.data?.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <strong>{item.display_name}</strong>
                  <p className="text-sm text-muted">
                    {item.identifier} · DOB{" "}
                    {item.date_of_birth ?? "Not recorded"}
                  </p>
                </div>
                <button
                  className={buttonClasses.secondary}
                  onClick={() => {
                    setSelected(item);
                    setRegister(false);
                  }}
                >
                  Select patient
                </button>
              </li>
            ))}
          </ul>
          {search.isSuccess && !search.data.items.length && (
            <p role="status">No matching patient was found in this facility.</p>
          )}
          {search.data && (
            <Pager
              offset={directoryOffset}
              count={search.data.items.length}
              change={(next) => {
                setDirectoryOffset(next);
                search.mutate({ query: term, offset: next });
              }}
            />
          )}
          {access.data?.can_register && (
            <>
              <button
                className="my-5 font-semibold text-teal-dark underline"
                onClick={() => setRegister(!register)}
              >
                {register ? "Close registration" : "Register a new patient"}
              </button>
              {register && (
                <ActionForm
                  scope={org}
                  path="journey/patients"
                  label="Register patient"
                  body={(data) => ({
                    identifier: value(data, "identifier"),
                    display_name: value(data, "display_name"),
                    date_of_birth: value(data, "date_of_birth") || null,
                  })}
                  onSuccess={(result) => {
                    setSelected(patient.parse(result));
                    setRegister(false);
                  }}
                >
                  <p className="text-sm text-muted">
                    Search first to avoid creating a duplicate patient.
                    Returning patients reuse their existing identifier.
                  </p>
                  <Field
                    name="identifier"
                    label="Patient identifier / MRN"
                    maxLength={100}
                  />
                  <Field
                    name="display_name"
                    label="Patient name"
                    minLength={2}
                    maxLength={160}
                  />
                  <Field
                    name="date_of_birth"
                    label="Date of birth"
                    type="date"
                    required={false}
                  />
                </ActionForm>
              )}
            </>
          )}
        </Panel>
        <Panel
          title={
            access.data?.can_initiate
              ? "Start a patient journey"
              : "Published journey forms"
          }
          detail="Teams, section ownership and full-ledger reading are configured on the published form."
        >
          <ChoiceLoader query={templates} />
          {selected && (
            <div className="mb-5 rounded-lg border border-success-border bg-mint p-4">
              <strong>{selected.display_name}</strong>
              <p>
                {selected.identifier} ·{" "}
                {selected.date_of_birth ?? "Date of birth not recorded"}
              </p>
            </div>
          )}
          {selected &&
          access.data?.can_initiate &&
          forms.some((item) => item.can_initiate) ? (
            <ActionForm
              scope={org}
              path="journey/encounters"
              label="Open journey"
              body={(data) => ({
                patient_id: selected.id,
                template_id: value(data, "template_id"),
                unit: value(data, "unit"),
                bed: value(data, "bed") || null,
                admitted_at: new Date(value(data, "admitted_at")).toISOString(),
                role_ids: [],
              })}
              onSuccess={(result) =>
                router.push(`/dashboard/patients/${encounter.parse(result).id}`)
              }
            >
              <Field name="template_id" label="Journey form">
                <option value="">Select published form</option>
                {forms
                  .filter((item) => item.can_initiate)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · v{item.version}
                    </option>
                  ))}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="unit" label="Unit / department" maxLength={100} />
                <Field
                  name="bed"
                  label="Bed / consultation room"
                  required={false}
                  maxLength={40}
                />
              </div>
              <Field
                name="admitted_at"
                label="Admission date & time (local time)"
                type="datetime-local"
                defaultValue={admissionTime}
              />
              <p className="text-sm text-muted">
                All linked care teams receive this journey automatically. Each
                team writes only its own sections.
              </p>
            </ActionForm>
          ) : (
            <>
              <p className="mb-4 text-muted">
                {access.data?.can_initiate
                  ? "Find or register a patient, then select an available intake form."
                  : "Your linked forms appear here. Reception or an authorized intake team starts each journey."}
              </p>
              <ul className="divide-y divide-border">
                {forms.map((item) => (
                  <li className="py-4" key={item.id}>
                    <strong>{item.name}</strong>
                    <p className="text-sm text-muted">
                      Version {item.version} ·{" "}
                      {item.can_initiate
                        ? "Your team can start this form"
                        : "Your team participates"}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {templates.isSuccess && !forms.length && (
            <p className="live-empty">
              No published form includes your active team. Ask your
              administrator to link your team and select an intake team before
              publishing.
            </p>
          )}
          {access.data && !access.data.roles.length && (
            <p className="mt-4 rounded-lg border border-border p-4">
              You have no current care-team assignment. Patient registration is
              available to reception, but starting or opening a ledger requires
              an active assignment to a team on the form.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
