"use client";
import { useState } from "react";
import { z } from "zod";
import { Icon } from "@/components/ui/icon";
import { SideDrawer } from "@/components/ui/side-drawer";
import { useToast } from "@/components/ui/feedback";
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
import { SearchSelect } from "./search-select";
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
const workforcePageSize = 5;
const departmentCodeCharacters = "0123456789ABCEFGHJKLMNPQRSTUVWXYZ";
const departmentDisplayCode = (code: string) =>
  /^ccu_d[0-9abcefghjklmnpqrstuvwxyz]{4}$/i.test(code)
    ? code.toUpperCase().replace("_", "-")
    : code;
function generateDepartmentCode(existing: Set<string>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const suffix = Array.from(bytes, (byte) =>
      departmentCodeCharacters[byte % departmentCodeCharacters.length],
    ).join("");
    const code = `ccu_d${suffix.toLowerCase()}`;
    if (!existing.has(code)) return code;
  }
  return "";
}
function EditSurface({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="workforce-row-action" aria-label={`${label} for ${subtitle}`} onClick={() => setOpen(true)}>
        <Icon name="settings" size={16} outline />
        {label}
      </button>
      {open && (
        <SideDrawer title={label} subtitle={subtitle} eyebrow="CCU360 / CARE TEAMS" closeLabel={`Close ${label.toLowerCase()}`} onClose={() => setOpen(false)}>
          {children}
        </SideDrawer>
      )}
    </>
  );
}
export function WorkforcePage() {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const [roleOffset, setRoleOffset] = useState(0);
  const [assignmentOffset, setAssignmentOffset] = useState(0);
  const [departmentOffset, setDepartmentOffset] = useState(0);
  const [staffOffset, setStaffOffset] = useState(0);
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [departmentCode, setDepartmentCode] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const toast = useToast();
  const departments = useLiveQuery(
    org,
    `workforce/departments?offset=${departmentOffset}&limit=${workforcePageSize + 1}`,
    pageOf(department),
  );
  const roles = useLiveQuery(
    org,
    `workforce/roles?offset=${roleOffset}&limit=${workforcePageSize + 1}`,
    pageOf(teamRole),
  );
  const assignments = useLiveQuery(
    org,
    `workforce/assignments?offset=${assignmentOffset}&limit=${workforcePageSize + 1}`,
    pageOf(assignment),
  );
  const staff = useLiveQuery(
    org,
    `workforce/staff?offset=${staffOffset}&limit=${workforcePageSize + 1}`,
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
  const allDepartments = deptChoices.data?.pages.flatMap((page) => page.items) ?? [];
  const randomizeDepartmentCode = () => {
    const existing = new Set(allDepartments.map((item) => item.code.toLowerCase()));
    if (departmentCode) existing.add(departmentCode);
    setDepartmentCode(generateDepartmentCode(existing));
  };
  return (
    <div className="workforce-page workspace-directory-page">
      <Heading
        eyebrow=""
        title="Departments & care teams"
        detail="Responsibility belongs to a shared team role. Enroll matching professions once or assign employees individually; each person’s work retains its own audit trail."
        actions={<>
          <button type="button" className="workforce-secondary-action" onClick={() => { randomizeDepartmentCode(); setCreatingDepartment(true); }}><Icon name="facilities" size={18} outline /> New department</button>
          <button type="button" className="workforce-secondary-action" onClick={() => setCreatingAssignment(true)}><Icon name="addUser" size={18} outline /> Assign employee</button>
          <button type="button" className="workforce-primary-action" onClick={() => setCreatingRole(true)}><Icon name="plus" size={18} outline /> Create care-team role</button>
        </>}
      />
      <div className="workforce-intro" aria-label="How care teams are organized">
        <div><span>01 / STRUCTURE</span><strong>Departments</strong><p>Where clinical work belongs</p></div>
        <div><span>02 / RESPONSIBILITY</span><strong>Care-team roles</strong><p>What each team can do</p></div>
        <div><span>03 / COVERAGE</span><strong>Assignments</strong><p>Who is on the team, and when</p></div>
        <div><span>04 / READINESS</span><strong>Availability</strong><p>Who can provide care today</p></div>
      </div>
      <ChoiceLoader query={professions} />
      <ChoiceLoader query={responsibilities} />
      <div className="workforce-grid workforce-top-grid">
        <Panel title="Departments" icon="facilities" detail="Departments group care teams. Archiving one removes employee access through it while retaining the history.">
          <QueryState query={departments} />
          {departments.data?.items.slice(0, workforcePageSize).map((item) => (
            <div
              className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                <small>
                  {departmentDisplayCode(item.code)} ·{" "}
                  <Status value={item.active ? "active" : "suspended"} />
                </small>
              </div>
              <EditSurface label="Edit department" subtitle={item.name}>
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
                    code: item.code,
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
                  <p className="workforce-code-note">Department ID <strong>{departmentDisplayCode(item.code)}</strong></p>
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
              </EditSurface>
            </div>
          ))}
          {departments.data && !departments.data.items.length && <p className="workforce-empty">Create a department to give care teams a home.</p>}
          <Pager
            offset={departmentOffset}
            count={Math.min(departments.data?.items.length ?? 0, workforcePageSize)}
            size={workforcePageSize}
            hasMore={departments.data ? departments.data.items.length > workforcePageSize : undefined}
            change={setDepartmentOffset}
          />
        </Panel>
        <Panel title="Shared team roles" icon="team" detail="Shared roles include matching professions automatically. Individual roles use dated assignments." scroll>
          <QueryState query={roles} />
          {roles.data?.items.slice(0, workforcePageSize).map((role) => (
            <div className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4" key={role.id}>
              <div><strong>{role.name}</strong><p className="text-sm text-teal-dark">{role.membership_mode === "profession" ? "Applies to all matching employees" : "Uses individual dated assignments"}</p><p>{role.identity_roles.map((item) => memberLabels[item as MemberRole]).join(" · ")}</p><small>{role.capabilities.map((item) => capabilityLabels[item as keyof typeof capabilityLabels]).join(" · ")}</small></div>
              <Status value={role.active ? "active" : "suspended"} />
              <EditSurface label="Edit role" subtitle={role.name}>
                <ActionForm key={`${role.id}:${role.version}`} scope={org} path={`workforce/roles/${role.id}`} method="PATCH" label="Save care-team role" reset={false} body={(data) => ({ active: role.active, expected_version: role.version, name: value(data, "name"), code: value(data, "code"), capabilities: data.getAll("capabilities"), profession_ids: data.getAll("profession_ids"), responsibility_ids: data.getAll("responsibility_ids"), reason: value(data, "reason"), membership_mode: value(data, "membership_mode") })}>
                  <Field name="membership_mode" label="Role membership" defaultValue={role.membership_mode}><option value="profession">All matching employees (shared profession role)</option><option value="individual">Individually assigned employees only</option></Field>
                  <p className="mb-4 text-sm text-muted">Changing this applies immediately to matching employees and existing patient journeys using this role. Individual assignment history remains intact.</p>
                  <Field name="name" label="Team role name" defaultValue={role.name} minLength={2} maxLength={120} />
                  <Field name="code" label="Role code" defaultValue={role.code} pattern="[a-z][a-z0-9_]{1,39}" maxLength={40} />
                  <AttributeChoices items={allProfessions} name="profession_ids" selected={role.profession_ids} />
                  <AttributeChoices items={allResponsibilities} name="responsibility_ids" selected={role.responsibility_ids} />
                  <fieldset className="option-grid"><legend>Responsibilities</legend>{capabilities.map((capability) => <label className="check-label" key={capability}><input type="checkbox" name="capabilities" value={capability} defaultChecked={role.capabilities.includes(capability)} />{capabilityLabels[capability]}</label>)}</fieldset>
                  <Field name="reason" label="Change reason" minLength={3} maxLength={500} />
                </ActionForm>
                <p className="mt-5 text-sm text-muted">Archive unused roles to preserve their assignments and documentation history.</p>
                <ActionForm scope={org} path={`workforce/roles/${role.id}`} method="PATCH" label={role.active ? "Archive role" : "Restore role"} body={(data) => ({ active: !role.active, expected_version: role.version, reason: value(data, "reason") })}><Field name="reason" label="Reason" minLength={3} maxLength={500} /></ActionForm>
              </EditSurface>
            </div>
          ))}
          {roles.data && !roles.data.items.length && <p className="workforce-empty">Create a care-team role to define shared responsibilities.</p>}
          <Pager offset={roleOffset} count={Math.min(roles.data?.items.length ?? 0, workforcePageSize)} size={workforcePageSize} hasMore={roles.data ? roles.data.items.length > workforcePageSize : undefined} change={setRoleOffset} />
        </Panel>
      </div>
      {creatingDepartment && <SideDrawer title="New department" subtitle="Create a home for a care team." eyebrow="CCU360 / DEPARTMENTS" closeLabel="Close department form" onClose={() => setCreatingDepartment(false)}>
            <ActionForm
              scope={org}
              path="workforce/departments"
              label="Create department"
              onSuccess={() => { toast?.("Department created."); setCreatingDepartment(false); }}
              disabled={!departmentCode}
              body={(data) => ({
                name: value(data, "name"),
                code: departmentCode,
              })}
            >
              <Field
                name="name"
                label="Department name"
                minLength={2}
                maxLength={120}
              />
              <div className="workforce-code-picker">
                <span>Department ID</span>
                <div>
                  <output aria-live="polite">{departmentCode ? departmentDisplayCode(departmentCode) : "Unavailable"}</output>
                  <button type="button" className="workforce-secondary-action" onClick={randomizeDepartmentCode}><Icon name="refresh" size={16} outline /> Randomize</button>
                </div>
                <small>Keep this ID or generate another before creating the department.</small>
              </div>
            </ActionForm>
      </SideDrawer>}
      {creatingRole && <SideDrawer title="Create a care-team role" subtitle="Define a shared responsibility for matching employees or an individual care team." eyebrow="CCU360 / CARE TEAMS" closeLabel="Close care-team form" onClose={() => setCreatingRole(false)}>
          <ActionForm
            scope={org}
            path="workforce/roles"
            label="Create team role"
            onSuccess={() => { toast?.("Care-team role created."); setCreatingRole(false); }}
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
            <SearchSelect
              name="department_id"
              label="Department"
              placeholder="Search departments"
              options={(deptChoices.data?.pages.flatMap((page) => page.items) ?? [])
                .filter((item) => item.active)
                .map((item) => ({ value: item.id, label: item.name, detail: departmentDisplayCode(item.code) }))}
            />
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
      </SideDrawer>}
      {creatingAssignment && <SideDrawer title="Assign an employee" subtitle="Choose a care-team role and the dates of individual coverage." eyebrow="CCU360 / COVERAGE" closeLabel="Close assignment form" onClose={() => setCreatingAssignment(false)}>
          <p className="facility-drawer-note">Use local date and time. Leave the end blank for ongoing coverage.</p>
          <ActionForm
            scope={org}
            path="workforce/assignments"
            label="Create assignment"
            onSuccess={() => { toast?.("Employee assigned to care team."); setCreatingAssignment(false); }}
            body={(data) => ({
              membership_id: value(data, "membership_id"),
              role_id: value(data, "role_id"),
              starts_at: new Date(value(data, "starts_at")).toISOString(),
              ends_at: value(data, "ends_at")
                ? new Date(value(data, "ends_at")).toISOString()
                : null,
            })}
          >
            <SearchSelect
              name="membership_id"
              label="Employee"
              placeholder="Search active employees"
              options={allPeople
                .filter((item) => item.status === "active" && item.role !== "provider_admin")
                .map((item) => ({ value: item.id, label: item.display_name, detail: memberLabels[item.role] }))}
            />
            <ChoiceLoader query={people} />
            <SearchSelect
              name="role_id"
              label="Care-team role"
              placeholder="Search care-team roles"
              options={allRoles
                .filter((item) => item.active)
                .map((item) => ({ value: item.id, label: item.name, detail: item.code }))}
            />
            <ChoiceLoader query={roleChoices} />
            <Field name="starts_at" label="Starts at" type="datetime-local" />
            <Field
              name="ends_at"
              label="Ends at"
              type="datetime-local"
              required={false}
            />
          </ActionForm>
      </SideDrawer>}
      <div className="workforce-grid workforce-bottom-grid">
        <Panel title="Dated assignments" icon="clock" detail="Individual assignments have a start date and optional end date. Shared profession eligibility is separate.">
          <QueryState query={assignments} />
          {assignments.data?.items.slice(0, workforcePageSize).map((item) => (
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
              <EditSurface label="Edit assignment" subtitle="Adjust this person’s coverage window.">
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
              </EditSurface>
            </div>
          ))}
          {assignments.data && !assignments.data.items.length && <p className="workforce-empty">No individual assignments yet. Shared roles may still cover matching professions.</p>}
          <Pager
            offset={assignmentOffset}
            count={Math.min(assignments.data?.items.length ?? 0, workforcePageSize)}
            size={workforcePageSize}
            hasMore={assignments.data ? assignments.data.items.length > workforcePageSize : undefined}
            change={setAssignmentOffset}
          />
        </Panel>
      <Panel
        title="Staff availability"
        icon="profile"
        detail="Absence or retirement removes effective coverage immediately. Existing notes retain the original author and duty evidence."
      >
        <QueryState query={staff} />
        {staff.data?.items.slice(0, workforcePageSize).map((item) => (
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
              <EditSurface label="Profession & team" subtitle={item.display_name}>
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
                  <SearchSelect
                    name="profession_id"
                    label="Facility profession"
                    placeholder="Search professions"
                    defaultValue={item.profession_id ?? ""}
                    options={allProfessions
                      .filter((p) => p.active && p.base_role === item.role)
                      .map((p) => ({ value: p.id, label: p.name, detail: p.code }))}
                  />
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
                  <SearchSelect
                    name="role_id"
                    label="Compatible care-team role"
                    placeholder="Search compatible roles"
                    options={allRoles
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
                      .map((r) => ({ value: r.id, label: r.name, detail: r.code }))}
                  />
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
              </EditSurface>
            )}
            <EditSurface label="Availability" subtitle={item.display_name}>
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
            </EditSurface>
          </div>
        ))}
        {staff.data && !staff.data.items.length && <p className="workforce-empty">Employees appear here after they join the facility.</p>}
        <Pager
          offset={staffOffset}
          count={Math.min(staff.data?.items.length ?? 0, workforcePageSize)}
          size={workforcePageSize}
          hasMore={staff.data ? staff.data.items.length > workforcePageSize : undefined}
          change={setStaffOffset}
        />
      </Panel>
      </div>
      <VocabularyPanel org={org} />
    </div>
  );
}
