"use client";
import { useState } from "react";
import { z } from "zod";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import {
  pageOf,
  employee,
  memberLabels,
  type MemberRole,
} from "@/lib/api/identity-contract";
import { department, teamRole, assignment } from "./journey-contract";
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
} from "./shared";
import { useChoices, ChoiceLoader } from "./choices";
import {
  VocabularyPanel,
  AttributeChoices,
  workforceAttribute,
} from "./workforce-vocabulary";
const localInputTime = (stamp: string) => {
  const date = new Date(stamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const capabilities = [
  "register",
  "admit",
  "read",
  "write",
  "attest",
  "observe",
  "verify",
  "tasks",
  "care_manage",
  "close",
  "correct",
  "export",
] as const;
const capabilityLabels = {
  register: "Register patients",
  admit: "Open journeys",
  read: "Read linked journeys",
  write: "Document & comment",
  attest: "Attest notes",
  observe: "Record observations",
  verify: "Verify observations",
  tasks: "Manage actions",
  care_manage: "Manage care coverage",
  close: "Close journeys",
  correct: "Amend records",
  export: "Export ledger",
};
export function WorkforcePage() {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const [roleOffset, setRoleOffset] = useState(0);
  const [assignmentOffset, setAssignmentOffset] = useState(0);
  const [departmentOffset, setDepartmentOffset] = useState(0);
  const [staffOffset, setStaffOffset] = useState(0);
  const departments = useLiveQuery(
    org,
    `workforce/departments?offset=${departmentOffset}&limit=20`,
    pageOf(department),
  );
  const roles = useLiveQuery(
    org,
    `workforce/roles?offset=${roleOffset}&limit=20`,
    pageOf(teamRole),
  );
  const assignments = useLiveQuery(
    org,
    `workforce/assignments?offset=${assignmentOffset}&limit=20`,
    pageOf(assignment),
  );
  const staff = useLiveQuery(
    org,
    `workforce/staff?offset=${staffOffset}&limit=20`,
    pageOf(
      z.object({
        membership_id: z.string(),
        display_name: z.string(),
        email: z.string(),
        role: z.string(),
        profession_id: z.string().nullable(),
        profession_name: z.string().nullable(),
        designation_version: z.number(),
        availability: z.string(),
        version: z.number(),
      }),
    ),
  );
  const deptChoices = useChoices(org, "workforce/departments", department);
  const roleChoices = useChoices(org, "workforce/roles", teamRole);
  const people = useChoices(org, `identity/providers/${org}/members`, employee);
  const professions = useChoices(
    org,
    "workforce/professions",
    workforceAttribute,
  );
  const responsibilities = useChoices(
    org,
    "workforce/responsibilities",
    workforceAttribute,
  );
  const allProfessions = professions.data?.pages.flatMap((p) => p.items) ?? [];
  const allResponsibilities =
    responsibilities.data?.pages.flatMap((p) => p.items) ?? [];
  const allRoles = roleChoices.data?.pages.flatMap((page) => page.items) ?? [];
  const allPeople = people.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      <Heading
        title="Departments & care teams"
        detail="Responsibility belongs to a shared team role. Enroll matching professions once or assign employees individually; each person’s work retains its own audit trail."
      />
      <VocabularyPanel org={org} />
      <ChoiceLoader query={professions} />
      <ChoiceLoader query={responsibilities} />
      <details className="workforce-membership-guide">
        <summary>Shared role membership</summary>
        <p>
          Configure a shared role for all employees with its compatible
          profession. New matching employees inherit that role automatically.
          Use individual dated assignments for restricted teams or
          department-specific coverage. Reception roles need Register patients
          and inclusion as an intake team on the published form.
        </p>
      </details>
      <div className="live-grid grid grid-cols-2 items-start gap-6 max-[760px]:grid-cols-1 max-[760px]:gap-0">
        <Panel title="Departments">
          <QueryState query={departments} />
          {departments.data?.items.map((item) => (
            <div
              className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.code} ·{" "}
                  <Status value={item.active ? "active" : "suspended"} />
                </small>
              </div>
              <details>
                <summary>Edit department</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/departments/${item.id}`}
                  method="PATCH"
                  label="Save department"
                  reset={false}
                  body={(data) => ({
                    active: item.active,
                    expected_version: item.version,
                    name: value(data, "name"),
                    code: value(data, "code"),
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="name"
                    label="Department name"
                    defaultValue={item.name}
                    minLength={2}
                    maxLength={120}
                  />
                  <Field
                    name="code"
                    label="Department code"
                    defaultValue={item.code}
                    pattern="[a-z][a-z0-9_]{1,39}"
                    maxLength={40}
                  />
                  <Field
                    name="reason"
                    label="Change reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
                <p className="mt-5 text-sm text-muted">
                  Archiving removes employee access through this department. Its
                  history is retained.
                </p>
                <ActionForm
                  scope={org}
                  path={`workforce/departments/${item.id}`}
                  method="PATCH"
                  label={
                    item.active ? "Archive department" : "Restore department"
                  }
                  body={(data) => ({
                    active: !item.active,
                    expected_version: item.version,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="reason"
                    label="Reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
              </details>
            </div>
          ))}
          <Pager
            offset={departmentOffset}
            count={departments.data?.items.length ?? 0}
            change={setDepartmentOffset}
          />
          <details>
            <summary>Add a department</summary>
            <ActionForm
              scope={org}
              path="workforce/departments"
              label="Create department"
              body={(data) => ({
                name: value(data, "name"),
                code: value(data, "code"),
              })}
            >
              <Field
                name="name"
                label="Department name"
                minLength={2}
                maxLength={120}
              />
              <Field
                name="code"
                label="Code (lowercase, numbers, underscores)"
                pattern="[a-z][a-z0-9_]{1,39}"
                maxLength={40}
              />
            </ActionForm>
          </details>
        </Panel>
        <Panel
          title="Create a care-team role"
          detail="Create a shared responsibility once for all matching employees, or use individual dated assignments for a restricted care team."
        >
          <ActionForm
            scope={org}
            path="workforce/roles"
            label="Create team role"
            body={(data) => ({
              department_id: value(data, "department_id"),
              name: value(data, "name"),
              code: value(data, "code"),
              identity_roles: data.getAll("identity_roles"),
              profession_ids: data.getAll("profession_ids"),
              responsibility_ids: data.getAll("responsibility_ids"),
              capabilities: data.getAll("capabilities"),
              membership_mode: value(data, "membership_mode"),
            })}
          >
            <Field name="department_id" label="Department">
              <option value="">Select department</option>
              {deptChoices.data?.pages
                .flatMap((page) => page.items)
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Field>
            <ChoiceLoader query={deptChoices} />
            <Field
              name="name"
              label="Team role name"
              minLength={2}
              maxLength={120}
            />
            <Field
              name="code"
              label="Role code"
              pattern="[a-z][a-z0-9_]{1,39}"
              maxLength={40}
            />
            <Field
              name="membership_mode"
              label="Role membership"
              defaultValue="profession"
            >
              <option value="profession">
                All matching employees (shared profession role)
              </option>
              <option value="individual">
                Individually assigned employees only
              </option>
            </Field>
            <p className="mb-4 text-sm text-muted">
              Shared roles respect employee availability, active departments and
              any selected facility profession. A pharmacist role can target the
              facility’s Pharmacist profession without including other
              allied-health employees.
            </p>
            <fieldset className="option-grid">
              <legend>Compatible professions</legend>
              {(
                [
                  "doctor",
                  "nurse",
                  "allied",
                  "receptionist",
                  "auditor",
                ] as MemberRole[]
              ).map((role) => (
                <label className="check-label" key={role}>
                  <input type="checkbox" name="identity_roles" value={role} />
                  {memberLabels[role]}
                </label>
              ))}
            </fieldset>
            <AttributeChoices items={allProfessions} name="profession_ids" />
            <AttributeChoices
              items={allResponsibilities}
              name="responsibility_ids"
            />
            <fieldset className="option-grid">
              <legend>Responsibilities</legend>
              {capabilities.map((capability) => (
                <label className="check-label" key={capability}>
                  <input
                    type="checkbox"
                    name="capabilities"
                    value={capability}
                  />
                  {capabilityLabels[capability]}
                </label>
              ))}
            </fieldset>
          </ActionForm>
        </Panel>
      </div>
      <Panel title="Shared team roles" scroll>
        <QueryState query={roles} />
        {roles.data?.items.map((role) => (
          <div
            className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
            key={role.id}
          >
            <div>
              <strong>{role.name}</strong>
              <p className="text-sm text-teal-dark">
                {role.membership_mode === "profession"
                  ? "Applies to all matching employees"
                  : "Uses individual dated assignments"}
              </p>
              <p>
                {role.identity_roles
                  .map((item) => memberLabels[item as MemberRole])
                  .join(" · ")}
              </p>
              <small>
                {role.capabilities
                  .map(
                    (item) =>
                      capabilityLabels[item as keyof typeof capabilityLabels],
                  )
                  .join(" · ")}
              </small>
            </div>
            <Status value={role.active ? "active" : "suspended"} />
            <details>
              <summary>Edit care-team role</summary>
              <ActionForm
                key={`${role.id}:${role.version}`}
                scope={org}
                path={`workforce/roles/${role.id}`}
                method="PATCH"
                label="Save care-team role"
                reset={false}
                body={(data) => ({
                  active: role.active,
                  expected_version: role.version,
                  name: value(data, "name"),
                  code: value(data, "code"),
                  capabilities: data.getAll("capabilities"),
                  profession_ids: data.getAll("profession_ids"),
                  responsibility_ids: data.getAll("responsibility_ids"),
                  reason: value(data, "reason"),
                  membership_mode: value(data, "membership_mode"),
                })}
              >
                <Field
                  name="membership_mode"
                  label="Role membership"
                  defaultValue={role.membership_mode}
                >
                  <option value="profession">
                    All matching employees (shared profession role)
                  </option>
                  <option value="individual">
                    Individually assigned employees only
                  </option>
                </Field>
                <p className="mb-4 text-sm text-muted">
                  Changing this applies immediately to matching employees and
                  existing patient journeys using this role. Individual
                  assignment history remains intact.
                </p>
                <Field
                  name="name"
                  label="Team role name"
                  defaultValue={role.name}
                  minLength={2}
                  maxLength={120}
                />
                <Field
                  name="code"
                  label="Role code"
                  defaultValue={role.code}
                  pattern="[a-z][a-z0-9_]{1,39}"
                  maxLength={40}
                />
                <AttributeChoices
                  items={allProfessions}
                  name="profession_ids"
                  selected={role.profession_ids}
                />
                <AttributeChoices
                  items={allResponsibilities}
                  name="responsibility_ids"
                  selected={role.responsibility_ids}
                />
                <fieldset className="option-grid">
                  <legend>Responsibilities</legend>
                  {capabilities.map((capability) => (
                    <label className="check-label" key={capability}>
                      <input
                        type="checkbox"
                        name="capabilities"
                        value={capability}
                        defaultChecked={role.capabilities.includes(capability)}
                      />
                      {capabilityLabels[capability]}
                    </label>
                  ))}
                </fieldset>
                <Field
                  name="reason"
                  label="Change reason"
                  minLength={3}
                  maxLength={500}
                />
              </ActionForm>
              <p className="mt-5 text-sm text-muted">
                Archive unused roles to preserve their assignments and
                documentation history.
              </p>
              <ActionForm
                scope={org}
                path={`workforce/roles/${role.id}`}
                method="PATCH"
                label={role.active ? "Archive role" : "Restore role"}
                body={(data) => ({
                  active: !role.active,
                  expected_version: role.version,
                  reason: value(data, "reason"),
                })}
              >
                <Field
                  name="reason"
                  label="Reason"
                  minLength={3}
                  maxLength={500}
                />
              </ActionForm>
            </details>
          </div>
        ))}
        <Pager
          offset={roleOffset}
          count={roles.data?.items.length ?? 0}
          change={setRoleOffset}
        />
      </Panel>
      <div className="live-grid grid grid-cols-2 items-start gap-6 max-[760px]:grid-cols-1 max-[760px]:gap-0">
        <Panel
          title="Assign an employee"
          detail="Use local date/time; timestamps are stored with a time zone. Leave the end blank for an ongoing assignment."
        >
          <ActionForm
            scope={org}
            path="workforce/assignments"
            label="Create assignment"
            body={(data) => ({
              membership_id: value(data, "membership_id"),
              role_id: value(data, "role_id"),
              starts_at: new Date(value(data, "starts_at")).toISOString(),
              ends_at: value(data, "ends_at")
                ? new Date(value(data, "ends_at")).toISOString()
                : null,
            })}
          >
            <Field name="membership_id" label="Employee">
              <option value="">Select active employee</option>
              {allPeople
                .filter(
                  (item) =>
                    item.status === "active" && item.role !== "provider_admin",
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.display_name} · {memberLabels[item.role]}
                  </option>
                ))}
            </Field>
            <ChoiceLoader query={people} />
            <Field name="role_id" label="Care-team role">
              <option value="">Select compatible role</option>
              {allRoles
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Field>
            <ChoiceLoader query={roleChoices} />
            <Field name="starts_at" label="Starts at" type="datetime-local" />
            <Field
              name="ends_at"
              label="Ends at"
              type="datetime-local"
              required={false}
            />
          </ActionForm>
        </Panel>
        <Panel title="Dated assignments">
          <QueryState query={assignments} />
          {assignments.data?.items.map((item) => (
            <div
              className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
              key={item.id}
            >
              <div>
                <strong>
                  {allPeople.find((person) => person.id === item.membership_id)
                    ?.display_name ?? "Employee " + item.membership_id}
                </strong>
                <p>
                  {allRoles.find((role) => role.id === item.role_id)?.name ??
                    "Role " + item.role_id}
                </p>
                <small>
                  {stamp(item.starts_at)} –{" "}
                  {item.ends_at ? stamp(item.ends_at) : "ongoing"} ·{" "}
                  <Status value={item.active ? "active" : "suspended"} />
                </small>
              </div>
              <details>
                <summary>Edit assignment</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/assignments/${item.id}`}
                  method="PATCH"
                  label="Save assignment dates"
                  reset={false}
                  body={(data) => ({
                    active: item.active,
                    expected_version: item.version,
                    starts_at: new Date(value(data, "starts_at")).toISOString(),
                    ends_at: value(data, "ends_at")
                      ? new Date(value(data, "ends_at")).toISOString()
                      : null,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="starts_at"
                    label="Starts at"
                    type="datetime-local"
                    defaultValue={localInputTime(item.starts_at)}
                  />
                  <Field
                    name="ends_at"
                    label="Ends at"
                    type="datetime-local"
                    required={false}
                    defaultValue={
                      item.ends_at ? localInputTime(item.ends_at) : ""
                    }
                  />
                  <Field
                    name="reason"
                    label="Change reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
                <p className="mt-5 text-sm text-muted">
                  Individual teams use dated assignments for transfers. Ending
                  an assignment does not remove profession-wide eligibility;
                  update availability or the shared role when access must end.
                </p>
                <ActionForm
                  scope={org}
                  path={`workforce/assignments/${item.id}`}
                  method="PATCH"
                  label={
                    item.active
                      ? "End individual assignment"
                      : "Restore assignment"
                  }
                  body={(data) => ({
                    active: !item.active,
                    expected_version: item.version,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="reason"
                    label="Reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
              </details>
            </div>
          ))}
          <Pager
            offset={assignmentOffset}
            count={assignments.data?.items.length ?? 0}
            change={setAssignmentOffset}
          />
        </Panel>
      </div>
      <Panel
        title="Staff availability"
        detail="Absence or retirement removes effective coverage immediately. Existing notes retain the original author and duty evidence."
      >
        <QueryState query={staff} />
        {staff.data?.items.map((item) => (
          <div
            className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
            key={item.membership_id}
          >
            <div>
              <strong>{item.display_name}</strong>
              <small>{item.email}</small>
              <p className="text-sm text-muted">
                {item.profession_name ?? memberLabels[item.role as MemberRole]}
              </p>
              <Status value={item.availability} />
            </div>
            {item.role !== "provider_admin" && (
              <details>
                <summary>Profession & team assignment</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/staff/${item.membership_id}/profession`}
                  method="PUT"
                  label="Set employee profession"
                  body={(data) => ({
                    profession_id: value(data, "profession_id"),
                    expected_version: item.designation_version,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="profession_id"
                    label="Facility profession"
                    defaultValue={item.profession_id ?? ""}
                  >
                    <option value="">Select profession</option>
                    {allProfessions
                      .filter((p) => p.active && p.base_role === item.role)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </Field>
                  <Field
                    name="reason"
                    label="Designation reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
                <ActionForm
                  scope={org}
                  path="workforce/assignments"
                  label="Assign employee to team"
                  body={(data) => ({
                    membership_id: item.membership_id,
                    role_id: value(data, "role_id"),
                    starts_at: new Date(value(data, "starts_at")).toISOString(),
                    ends_at: value(data, "ends_at")
                      ? new Date(value(data, "ends_at")).toISOString()
                      : null,
                  })}
                >
                  <Field name="role_id" label="Compatible care-team role">
                    <option value="">Select shared team</option>
                    {allRoles
                      .filter(
                        (r) =>
                          r.active &&
                          r.identity_roles.includes(item.role) &&
                          (!r.profession_ids.length ||
                            (item.profession_id
                              ? r.profession_ids.includes(item.profession_id)
                              : allProfessions.some(
                                  (p) =>
                                    p.code === item.role &&
                                    r.profession_ids.includes(p.id),
                                ))),
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </Field>
                  <Field
                    name="starts_at"
                    label="Assignment starts"
                    type="datetime-local"
                    defaultValue={localInputTime(new Date().toISOString())}
                  />
                  <Field
                    name="ends_at"
                    label="Assignment ends (optional)"
                    type="datetime-local"
                    required={false}
                  />
                </ActionForm>
              </details>
            )}
            <details>
              <summary>Update availability</summary>
              <ActionForm
                scope={org}
                path={`workforce/staff/${item.membership_id}/availability`}
                method="PUT"
                label="Update availability"
                body={(data) => ({
                  availability: value(data, "availability"),
                  expected_version: item.version,
                  reason: value(data, "reason"),
                })}
              >
                <Field
                  name="availability"
                  label="Availability"
                  defaultValue={item.availability}
                >
                  <option value="available">Available</option>
                  <option value="absent">Absent</option>
                  <option value="retired">Retired</option>
                </Field>
                <Field
                  name="reason"
                  label="Reason"
                  minLength={3}
                  maxLength={500}
                />
              </ActionForm>
            </details>
          </div>
        ))}
        <Pager
          offset={staffOffset}
          count={staff.data?.items.length ?? 0}
          change={setStaffOffset}
        />
      </Panel>
    </>
  );
}
