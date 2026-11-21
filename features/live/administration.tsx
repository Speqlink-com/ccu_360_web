"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import {
  provider,
  directoryUser,
  employee,
  pageOf,
  memberRole,
  memberLabels,
} from "@/lib/api/identity-contract";
import {
  Heading,
  Panel,
  Field,
  ActionForm,
  ActionButton,
  QueryState,
  Status,
  Pager,
  stamp,
  value,
} from "./shared";

export function FacilitiesPage() {
  const user = useIdentity().data!;
  const [offset, setOffset] = useState(0);
  const query = useLiveQuery(
    user.id,
    `identity/providers?offset=${offset}&limit=20`,
    pageOf(provider),
  );
  return (
    <>
      <Heading
        title="Facilities"
        detail="Onboard independent providers and invite the people responsible for their administration."
      />
      <div className="live-grid live-grid-wide grid items-start gap-6 [grid-template-columns:minmax(0,1.8fr)_minmax(320px,1fr)] max-[1440px]:grid-cols-1 max-[760px]:gap-0">
        <Panel
          title="Provider network"
          scroll
          detail="Facility suspension immediately revokes selected sessions and clinical access."
        >
          <QueryState query={query} />
          <div className="live-table-wrap w-full overflow-x-auto">
            <table className="live-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>Added {stamp(item.created_at)}</small>
                    </td>
                    <td>{item.code}</td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>
                      <ActionButton
                        scope={user.id}
                        path={`identity/providers/${item.id}`}
                        method="PATCH"
                        body={{
                          status:
                            item.status === "active" ? "suspended" : "active",
                        }}
                        confirm={`${item.status === "active" ? "Suspend" : "Reactivate"} ${item.name}?`}
                        successMessage={`${item.name} ${item.status === "active" ? "suspended" : "reactivated"}.`}
                      >
                        {item.status === "active" ? "Suspend" : "Reactivate"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data && !query.data.items.length && (
            <p className="live-empty py-6 text-muted">
              No facilities yet. Onboard your first provider to start the
              network.
            </p>
          )}
          <Pager
            offset={offset}
            count={query.data?.items.length ?? 0}
            change={setOffset}
          />
        </Panel>
        <Panel
          title="Onboard a facility"
          detail="A secure invitation is emailed to the first facility administrator. No shared passwords."
        >
          <ActionForm
            scope={user.id}
            path="identity/providers"
            label="Create facility & send invitation"
            successMessage="Facility created. The administrator’s invitation is queued for delivery."
            body={(data) => ({
              name: value(data, "name"),
              code: value(data, "code").toUpperCase(),
              admin_name: value(data, "admin_name"),
              admin_email: value(data, "admin_email"),
            })}
          >
            <Field name="name" label="Facility name" minLength={2} />
            <Field
              name="code"
              label="Unique facility code"
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}"
              maxLength={40}
            />
            <Field
              name="admin_name"
              label="Administrator’s full name"
              minLength={2}
              maxLength={120}
            />
            <Field
              name="admin_email"
              label="Administrator’s email"
              type="email"
              maxLength={320}
            />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
export function AdministratorsPage() {
  const user = useIdentity().data!;
  const [offset, setOffset] = useState(0);
  const query = useLiveQuery(
    user.id,
    `identity/users?offset=${offset}&limit=20`,
    pageOf(directoryUser),
  );
  return (
    <>
      <Heading
        title="AHS administrators & accounts"
        detail="Platform administrators onboard providers and govern access. Facility employees remain separate identities."
      />
      <div className="live-grid live-grid-wide grid items-start gap-6 [grid-template-columns:minmax(0,1.8fr)_minmax(320px,1fr)] max-[1440px]:grid-cols-1 max-[760px]:gap-0">
        <Panel
          title="Account directory"
          scroll
          detail="The current administrator and the last administrator of any facility cannot be disabled."
        >
          <QueryState query={query} />
          <div className="live-table-wrap w-full overflow-x-auto">
            <table className="live-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>MFA</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.display_name}</strong>
                      <small>{item.email}</small>
                    </td>
                    <td>
                      {item.platform_role === "ahs_admin"
                        ? "AHS administrator"
                        : "Facility member"}
                    </td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>{item.mfa_enabled ? "Enabled" : "Pending"}</td>
                    <td>
                      {item.status === "invited"
                        ? item.platform_role === "ahs_admin" && (
                            <ActionButton
                              scope={user.id}
                              path={`identity/ahs/invitations/${item.id}`}
                              method="DELETE"
                              confirm="Revoke this pending invitation?"
                              successMessage="Administrator invitation revoked."
                            >
                              Revoke invitation
                            </ActionButton>
                          )
                        : item.id !== user.id && (
                            <ActionButton
                              scope={user.id}
                              path={`identity/users/${item.id}`}
                              method="PATCH"
                              body={{
                                status:
                                  item.status === "active"
                                    ? "disabled"
                                    : "active",
                              }}
                              confirm="Change this person’s global account access?"
                              successMessage={`Account ${item.status === "active" ? "disabled" : "reactivated"}.`}
                            >
                              {item.status === "active"
                                ? "Disable"
                                : "Reactivate"}
                            </ActionButton>
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            offset={offset}
            count={query.data?.items.length ?? 0}
            change={setOffset}
          />
        </Panel>
        <Panel
          title="Invite an AHS administrator"
          detail="Each administrator accepts an email invitation and enrolls their own authenticator."
        >
          <ActionForm
            scope={user.id}
            path="identity/ahs/invitations"
            label="Send administrator invitation"
            successMessage="Administrator invitation queued."
            body={(data) => ({
              display_name: value(data, "name"),
              email: value(data, "email"),
            })}
          >
            <Field
              name="name"
              label="Full name"
              minLength={2}
              maxLength={120}
            />
            <Field name="email" label="Email" type="email" maxLength={320} />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
export function EmployeesPage() {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const [offset, setOffset] = useState(0);
  const query = useLiveQuery(
    org,
    `identity/providers/${org}/members?offset=${offset}&limit=20`,
    pageOf(employee),
  );
  return (
    <>
      <Heading
        title="Employees"
        detail="Invite your facility’s administrators and care teams. Department assignments define which parts of a patient journey they can handle."
        actions={
          <Link className={buttonClasses.secondary} href="/dashboard/workforce">
            Configure care teams
          </Link>
        }
      />
      <div className="live-grid live-grid-wide grid items-start gap-6 [grid-template-columns:minmax(0,1.8fr)_minmax(320px,1fr)] max-[1440px]:grid-cols-1 max-[760px]:gap-0">
        <Panel title="Facility members" scroll>
          <QueryState query={query} />
          <div className="live-table-wrap w-full overflow-x-auto">
            <table className="live-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Profession</th>
                  <th>Status</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.display_name}</strong>
                      <small>{item.email}</small>
                    </td>
                    <td>{memberLabels[item.role]}</td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>
                      {["invited", "revoked"].includes(item.status) ? (
                        <ActionButton
                          scope={org}
                          path={`identity/providers/${org}/invitations/${item.id}`}
                          method="DELETE"
                          confirm="Cancel this invitation?"
                        >
                          Revoke invitation
                        </ActionButton>
                      ) : (
                        <details>
                          <summary>Manage access</summary>
                          <ActionForm
                            scope={org}
                            path={`identity/providers/${org}/members/${item.id}`}
                            method="PATCH"
                            label="Update access"
                            reset={false}
                            body={(data) => ({
                              role: value(data, "role"),
                              status: value(data, "status"),
                            })}
                          >
                            <Field
                              name="role"
                              label="Profession"
                              defaultValue={item.role}
                            >
                              {memberRole.options.map((role) => (
                                <option key={role} value={role}>
                                  {memberLabels[role]}
                                </option>
                              ))}
                            </Field>
                            <Field
                              name="status"
                              label="Membership status"
                              defaultValue={item.status}
                            >
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </Field>
                            <p className="muted">
                              Changing access signs this person out on every
                              device.
                            </p>
                          </ActionForm>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data && !query.data.items.length && (
            <p className="live-empty py-6 text-muted">
              Your team starts here. Invite an employee to give them their own
              account.
            </p>
          )}
          <Pager
            offset={offset}
            count={query.data?.items.length ?? 0}
            change={setOffset}
          />
        </Panel>
        <Panel
          title="Invite an employee"
          detail="Invitations are delivered by email. Facility administrators must enable MFA."
        >
          <ActionForm
            scope={org}
            path={`identity/providers/${org}/invitations`}
            label="Send employee invitation"
            successMessage="Employee invitation queued. After acceptance, assign a department care-team role."
            body={(data) => ({
              display_name: value(data, "name"),
              email: value(data, "email"),
              role: value(data, "role"),
            })}
          >
            <Field
              name="name"
              label="Full name"
              minLength={2}
              maxLength={120}
            />
            <Field name="email" label="Email" type="email" maxLength={320} />
            <Field name="role" label="Profession" defaultValue="doctor">
              {memberRole.options.map((role) => (
                <option key={role} value={role}>
                  {memberLabels[role]}
                </option>
              ))}
            </Field>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
const auditRow = z.object({
  id: z.string(),
  action: z.string(),
  outcome: z.string().optional(),
  actor_id: z.string().nullable().optional(),
  user_id: z.string().optional(),
  request_id: z.string().optional(),
  created_at: z.string().optional(),
  recorded_at: z.string().optional(),
});
export function AuditPage() {
  const user = useIdentity().data!;
  const platform = user.platform_role === "ahs_admin";
  const scope = platform ? user.id : user.organization_id;
  const [offset, setOffset] = useState(0);
  const query = useLiveQuery(
    scope,
    `${platform ? "identity/audit" : "journey/access-audit"}?offset=${offset}&limit=20`,
    pageOf(auditRow),
  );
  const delivery = useLiveQuery(
    scope,
    "identity/email-deliveries?offset=0&limit=20",
    pageOf(
      z.object({
        id: z.string(),
        status: z.string(),
        attempts: z.number(),
        created_at: z.string(),
        last_error: z.string().nullable().optional(),
      }),
    ),
    platform,
  );
  return (
    <>
      <Heading
        title="Audit & accountability"
        detail="Recorded account and access events. Times shown in East Africa Time."
      />
      <Panel title="Access history">
        <QueryState query={query} />
        <div className="live-table-wrap w-full overflow-x-auto">
          <table className="live-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Recorded</th>
                <th>Outcome</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.action.replaceAll(".", " · ").replaceAll("_", " ")}
                  </td>
                  <td>{stamp(item.created_at ?? item.recorded_at)}</td>
                  <td>{item.outcome ?? "recorded"}</td>
                  <td>
                    <small>{item.request_id ?? item.id}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          offset={offset}
          count={query.data?.items.length ?? 0}
          change={setOffset}
        />
      </Panel>
      {platform && (
        <Panel
          title="Invitation & email delivery"
          detail="Recent delivery status. Message bodies and credentials are never exposed here."
        >
          <QueryState query={delivery} />
          {delivery.data?.items.map((item) => (
            <div
              className="live-list-row flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
              key={item.id}
            >
              <span>
                {stamp(item.created_at)} · {item.attempts} attempts
              </span>
              <Status value={item.status} />
            </div>
          ))}
          {delivery.data && !delivery.data.items.length && (
            <p>No emails have been queued yet.</p>
          )}
        </Panel>
      )}
    </>
  );
}
