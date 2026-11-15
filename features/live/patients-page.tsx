"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import { encounter, patient, teamRole } from "./journey-contract";
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
export function PatientsPage() {
  const router = useRouter();
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const membership = user.memberships.find(
    (member) => member.organization_id === org,
  )!;
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<z.infer<typeof patient> | null>(
    null,
  );
  const [register, setRegister] = useState(false);
  const reception = membership.role === "receptionist";
  const auditor = membership.role === "auditor";
  const query = useLiveQuery(
    org,
    `journey/inbox?offset=${offset}&limit=20`,
    pageOf(
      encounter.extend({
        patient_name: z.string().optional(),
        patient_identifier: z.string().optional(),
      }),
    ),
    !reception,
  );
  const templates = useChoices(
    org,
    "journey/published-templates",
    z.object({ id: z.string(), name: z.string(), version: z.number() }),
    !reception,
  );
  const roles = useChoices(org, "journey/team-options", teamRole, !reception);
  const search = useMutation({
    mutationFn: (identifier: string) =>
      apiRequest(
        "/api/v1/journey/patients/search",
        z.object({ patient: patient.nullable() }),
        { method: "POST", body: { identifier } },
      ),
    onSuccess: (data) => {
      setSelected(data.patient);
      setRegister(!data.patient);
    },
  });
  return (
    <>
      <Heading
        title={reception ? "Patient registration" : "Patient journeys"}
        detail={
          reception
            ? "Register and locate facility patients. Clinical records require a care-team assignment."
            : "Only journeys covered by your active team assignments appear here. Every change keeps its author, time and responsibility."
        }
      />
      {!reception && (
        <Panel title="My team’s journeys">
          <QueryState query={query} />
          <div className="live-table-wrap w-full overflow-x-auto">
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
                      <strong>{item.patient_name ?? "Patient journey"}</strong>
                      <small>
                        {item.patient_identifier ?? item.patient_id}
                      </small>
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
              No journeys are assigned to your current care teams. Ask your
              facility administrator to confirm your assignment and coverage.
            </p>
          )}
          <Pager
            offset={offset}
            count={query.data?.items.length ?? 0}
            change={setOffset}
          />
        </Panel>
      )}
      {!auditor && (
        <div className="live-grid grid grid-cols-2 items-start gap-6 max-[760px]:grid-cols-1 max-[760px]:gap-0">
          <Panel
            title="Find or register a patient"
            detail="Use the exact facility patient identifier. Searches stay out of browser URLs."
          >
            <form
              className="live-form"
              onSubmit={(event) => {
                event.preventDefault();
                setSelected(null);
                search.mutate(
                  value(new FormData(event.currentTarget), "identifier"),
                );
              }}
            >
              <Field
                name="identifier"
                label="Patient identifier / MRN"
                maxLength={100}
              />
              <button className={buttonClasses.secondary} disabled={search.isPending}>
                {search.isPending ? "Searching…" : "Find patient"}
              </button>
            </form>
            <Notice error={search.error} />
            {search.isSuccess && !search.data.patient && (
              <p role="status">
                No matching patient was found in this facility.
              </p>
            )}
            {selected && (
              <div className="patient-selection my-5 rounded-[10px] border border-success-border bg-mint p-4">
                <strong>{selected.display_name}</strong>
                <p>
                  {selected.identifier} ·{" "}
                  {selected.date_of_birth ?? "Date of birth not recorded"}
                </p>
              </div>
            )}
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
                  const parsed = patient.parse(result);
                  setSelected(parsed);
                  setRegister(false);
                }}
              >
                <Field
                  name="identifier"
                  label="Patient identifier / MRN"
                  maxLength={100}
                />
                <Field name="display_name" label="Patient name" minLength={2} />
                <Field
                  name="date_of_birth"
                  label="Date of birth"
                  type="date"
                  required={false}
                />
              </ActionForm>
            )}
            <button
              type="button"
              className="text-button border-0 bg-transparent px-0 py-2 text-left font-semibold text-teal-dark"
              onClick={() => setRegister(!register)}
            >
              {register ? "Close registration" : "Register a new patient"}
            </button>
          </Panel>
          {!reception && (
            <Panel
              title="Open a patient journey"
              detail="Select a registered patient, published form and covering care-team roles. You must hold an admitting role in the selected team."
            >
              {selected ? (
                <ActionForm
                  scope={org}
                  path="journey/encounters"
                  label="Open journey"
                  body={(data) => ({
                    patient_id: selected.id,
                    template_id: value(data, "template_id"),
                    unit: value(data, "unit"),
                    bed: value(data, "bed") || null,
                    admitted_at: new Date(
                      value(data, "admitted_at"),
                    ).toISOString(),
                    role_ids: data.getAll("role_ids"),
                  })}
                  onSuccess={(result) => {
                    const item = encounter.parse(result);
                    router.push(`/dashboard/patients/${item.id}`);
                  }}
                >
                  <p>
                    <strong>{selected.display_name}</strong> ·{" "}
                    {selected.identifier}
                  </p>
                  <Field name="template_id" label="Journey form">
                    <option value="">Select published form</option>
                    {templates.data?.pages
                      .flatMap((page) => page.items)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · v{item.version}
                        </option>
                      ))}
                  </Field>
                  <ChoiceLoader query={templates} />
                  <div className="live-form-grid grid grid-cols-2 gap-4 max-[760px]:grid-cols-1 max-[760px]:gap-0">
                    <Field name="unit" label="Unit" maxLength={100} />
                    <Field
                      name="bed"
                      label="Bed"
                      maxLength={40}
                      required={false}
                    />
                  </div>
                  <Field
                    name="admitted_at"
                    label="Admission date & time (local time)"
                    type="datetime-local"
                  />
                  <fieldset className="option-grid">
                    <legend>Covering care teams</legend>
                    {roles.data?.pages
                      .flatMap((page) => page.items)
                      .filter(
                        (role) =>
                          role.active && role.capabilities.includes("read"),
                      )
                      .map((role) => (
                        <label className="check-label" key={role.id}>
                          <input
                            type="checkbox"
                            name="role_ids"
                            value={role.id}
                          />
                          {role.name}
                        </label>
                      ))}
                  </fieldset>
                  <ChoiceLoader query={roles} />
                </ActionForm>
              ) : (
                <p className="live-empty py-6 text-muted">
                  Find or register the patient first.
                </p>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
