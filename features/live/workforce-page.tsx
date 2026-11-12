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
  read: "Read assigned journeys",
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
        availability: z.string(),
        version: z.number(),
      }),
    ),
  );
  const deptChoices = useChoices(org, "workforce/departments", department);
  const roleChoices = useChoices(org, "workforce/roles", teamRole);
  const people = useChoices(org, `identity/providers/${org}/members`, employee);
  const allRoles = roleChoices.data?.pages.flatMap((page) => page.items) ?? [];
  const allPeople = people.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      <Heading
        title="Departments & care teams"
        detail="Responsibility belongs to a team role. Named employees work through dated assignments, so shifts and staff changes retain a clear audit trail."
      />
      <div className="live-grid">
        <Panel title="Departments">
          <QueryState query={departments} />
          {departments.data?.items.map((item) => (
            <div className="live-list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.code} ·{" "}
                  <Status value={item.active ? "active" : "suspended"} />
                </small>
              </div>
              <details>
                <summary>Change status</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/departments/${item.id}`}
                  method="PATCH"
                  label={
                    item.active
                      ? "Deactivate department"
                      : "Reactivate department"
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
          detail="Choose compatible professions and explicit responsibilities. Reception staff cannot receive clinical reading or signing permissions."
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
              capabilities: data.getAll("capabilities"),
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
      <Panel title="Shared team roles">
        <QueryState query={roles} />
        {roles.data?.items.map((role) => (
          <div className="live-list-row" key={role.id}>
            <div>
              <strong>{role.name}</strong>
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
              <summary>Manage role</summary>
              <ActionForm
                scope={org}
                path={`workforce/roles/${role.id}`}
                method="PATCH"
                label={role.active ? "Deactivate role" : "Reactivate role"}
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
      <div className="live-grid">
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
            <div className="live-list-row" key={item.id}>
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
                <summary>Change assignment</summary>
                <ActionForm
                  scope={org}
                  path={`workforce/assignments/${item.id}`}
                  method="PATCH"
                  label={
                    item.active ? "End assignment access" : "Restore assignment"
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
          <div className="live-list-row" key={item.membership_id}>
            <div>
              <strong>{item.display_name}</strong>
              <small>{item.email}</small>
              <Status value={item.availability} />
            </div>
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
