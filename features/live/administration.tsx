"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { useToast } from "@/components/ui/feedback";
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

const facilityPageSize = 7;
const administratorPageSize = 7;
const employeePageSize = 7;
const auditPageSize = 7;

export function FacilitiesPage() {
  const user = useIdentity().data!;
  const [offset, setOffset] = useState(0);
  const [onboarding, setOnboarding] = useState(false);
  const toast = useToast();
  const query = useLiveQuery(
    user.id,
    `identity/providers?offset=${offset}&limit=${facilityPageSize + 1}`,
    pageOf(provider),
  );
  return (
    <>
      <div className="workspace-directory-page">
        <Heading
          eyebrow=""
          title="Facilities"
          detail="Manage the provider network and the administrators responsible for each workspace."
          actions={
            <button
              type="button"
              className={`${buttonClasses.primary} facilities-onboard-trigger`}
              onClick={() => setOnboarding(true)}
            >
              <Icon name="facilities" size={19} outline />
              Onboard facility
            </button>
          }
        />
        <Panel
          title="Facility network"
          scroll
          detail="Suspending a facility revokes its active sessions and clinical access."
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
                {query.data?.items.slice(0, facilityPageSize).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>Added {stamp(item.created_at)}</small>
                    </td>
                    <td>
                      <span className="facility-code">{item.code}</span>
                    </td>
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
                        <Icon
                          name={item.status === "active" ? "suspend" : "reactivate"}
                          size={17}
                          outline
                        />
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
            count={Math.min(query.data?.items.length ?? 0, facilityPageSize)}
            size={facilityPageSize}
            hasMore={query.data ? query.data.items.length > facilityPageSize : undefined}
            change={setOffset}
          />
        </Panel>
      </div>
      {onboarding && (
        <SideDrawer
          title="Onboard a facility"
          subtitle="Create a workspace and invite its first administrator."
          onClose={() => setOnboarding(false)}
        >
          <p className="facility-drawer-note">
            Each facility gets its own workspace. An invitation is emailed to
            its administrator.
          </p>
          <ActionForm
            scope={user.id}
            path="identity/providers"
            label="Create facility & send invitation"
            onSuccess={() => {
              toast?.(
                "Facility created. The administrator’s invitation is queued for delivery.",
              );
              setOnboarding(false);
            }}
            body={(data) => ({
              name: value(data, "name"),
              code: value(data, "code").toUpperCase(),
              admin_name: value(data, "admin_name"),
              admin_email: value(data, "admin_email"),
            })}
          >
            <p className="facility-form-section">Facility details</p>
            <Field
              name="name"
              label="Facility name"
              minLength={2}
              placeholder="e.g. Central Hospital"
              autoFocus
            />
            <Field
              name="code"
              label="Unique facility code"
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}"
              maxLength={40}
              placeholder="e.g. CENTRAL"
            />
            <p className="facility-form-section">First administrator</p>
            <Field
              name="admin_name"
              label="Full name"
              minLength={2}
              maxLength={120}
              placeholder="Administrator’s name"
              autoComplete="name"
            />
            <Field
              name="admin_email"
              label="Work email"
              type="email"
              maxLength={320}
              placeholder="admin@facility.org"
              autoComplete="email"
            />
          </ActionForm>
        </SideDrawer>
      )}
    </>
  );
}
export function AdministratorsPage() {
  const user = useIdentity().data!;
  const [offset, setOffset] = useState(0);
  const [inviting, setInviting] = useState(false);
  const toast = useToast();
  const query = useLiveQuery(
    user.id,
    `identity/users?offset=${offset}&limit=${administratorPageSize + 1}`,
    pageOf(directoryUser),
  );
  return (
    <>
      <div className="workspace-directory-page">
        <Heading
          eyebrow=""
          title="AHS administrators & accounts"
          detail="Platform administrators onboard providers and govern access. Facility employees remain separate identities."
          actions={
            <button
              type="button"
              className={`${buttonClasses.primary} facilities-onboard-trigger`}
              onClick={() => setInviting(true)}
            >
              <Icon name="addUser" size={19} outline />
              Invite administrator
            </button>
          }
        />
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
                {query.data?.items.slice(0, administratorPageSize).map((item) => (
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
                              <Icon name="close" size={17} outline />
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
                              <Icon
                                name={item.status === "active" ? "suspend" : "reactivate"}
                                size={17}
                                outline
                              />
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
          {query.data && !query.data.items.length && (
            <p className="live-empty py-6 text-muted">
              No accounts yet. Invite an administrator to get started.
            </p>
          )}
          <Pager
            offset={offset}
            count={Math.min(query.data?.items.length ?? 0, administratorPageSize)}
            size={administratorPageSize}
            hasMore={query.data ? query.data.items.length > administratorPageSize : undefined}
            change={setOffset}
          />
        </Panel>
      </div>
      {inviting && (
        <SideDrawer
          title="Invite an AHS administrator"
          subtitle="Send a secure invitation to a new platform administrator."
          eyebrow="CCU360 / ACCOUNTS"
          closeLabel="Close administrator invitation form"
          onClose={() => setInviting(false)}
        >
          <p className="facility-drawer-note">
            Each administrator accepts an email invitation and enrolls their own authenticator.
          </p>
          <ActionForm
            scope={user.id}
            path="identity/ahs/invitations"
            label="Send administrator invitation"
            successMessage="Administrator invitation queued."
            onSuccess={() => {
              toast?.("Administrator invitation queued.");
              setInviting(false);
            }}
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
              placeholder="Administrator’s name"
              autoComplete="name"
            />
            <Field
              name="email"
              label="Work email"
              type="email"
              maxLength={320}
              placeholder="admin@ayothealth.org"
              autoComplete="email"
            />
          </ActionForm>
        </SideDrawer>
      )}
    </>
  );
}
export function EmployeesPage() {
  const user = useIdentity().data!;
  const org = user.organization_id!;
  const [offset, setOffset] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<z.infer<typeof employee> | null>(null);
  const toast = useToast();
  const query = useLiveQuery(
    org,
    `identity/providers/${org}/members?offset=${offset}&limit=${employeePageSize + 1}`,
    pageOf(employee),
  );
  return (
    <>
      <div className="workspace-directory-page employees-page">
        <Heading
          eyebrow=""
          title="Employees"
          detail="Invite your facility’s administrators and care teams. Department assignments define which parts of a patient journey they can handle."
          actions={
            <>
              <Link
                className={`${buttonClasses.secondary} employee-teams-link`}
                href="/dashboard/workforce"
              >
                <Icon name="team" size={18} outline />
                Care teams
              </Link>
              <button
                type="button"
                className={`${buttonClasses.primary} facilities-onboard-trigger`}
                onClick={() => setInviting(true)}
              >
                <Icon name="addUser" size={19} outline />
                Invite employee
              </button>
            </>
          }
        />
        <Panel
          title="Facility members"
          scroll
          detail="Changing membership access signs this person out on every device."
        >
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
                {query.data?.items.slice(0, employeePageSize).map((item) => (
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
                      {item.status === "invited" ? (
                        <ActionButton
                          scope={org}
                          path={`identity/providers/${org}/invitations/${item.id}`}
                          method="DELETE"
                          confirm="Cancel this invitation?"
                          successMessage="Employee invitation revoked."
                        >
                          <Icon name="close" size={17} outline />
                          Revoke invitation
                        </ActionButton>
                      ) : item.status === "revoked" ? (
                        <span className="employee-access-none">No access</span>
                      ) : (
                        <button
                          type="button"
                          className={`${buttonClasses.secondary} employee-manage-button`}
                          onClick={() => setEditing(item)}
                        >
                          <Icon name="settings" size={17} outline />
                          Manage access
                        </button>
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
            count={Math.min(query.data?.items.length ?? 0, employeePageSize)}
            size={employeePageSize}
            hasMore={query.data ? query.data.items.length > employeePageSize : undefined}
            change={setOffset}
          />
        </Panel>
      </div>
      {inviting && (
        <SideDrawer
          title="Invite an employee"
          subtitle="Give a team member access to this facility workspace."
          eyebrow="CCU360 / EMPLOYEES"
          closeLabel="Close employee invitation form"
          onClose={() => setInviting(false)}
        >
          <p className="facility-drawer-note">
            Invitations are delivered by email. Facility administrators must enable MFA.
          </p>
          <ActionForm
            scope={org}
            path={`identity/providers/${org}/invitations`}
            label="Send employee invitation"
            successMessage="Employee invitation queued. After acceptance, assign a department care-team role."
            onSuccess={() => {
              toast?.("Employee invitation queued.");
              setInviting(false);
            }}
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
              placeholder="Employee’s full name"
              autoComplete="name"
            />
            <Field
              name="email"
              label="Work email"
              type="email"
              maxLength={320}
              placeholder="employee@facility.org"
              autoComplete="email"
            />
            <Field name="role" label="Profession" defaultValue="doctor">
              {memberRole.options.map((role) => (
                <option key={role} value={role}>
                  {memberLabels[role]}
                </option>
              ))}
            </Field>
          </ActionForm>
        </SideDrawer>
      )}
      {editing && (
        <SideDrawer
          title="Manage employee access"
          subtitle={editing.display_name}
          eyebrow="CCU360 / EMPLOYEES"
          closeLabel="Close employee access form"
          onClose={() => setEditing(null)}
        >
          <p className="facility-drawer-note">
            Changing access signs this person out on every device.
          </p>
          <ActionForm
            scope={org}
            path={`identity/providers/${org}/members/${editing.id}`}
            method="PATCH"
            label="Update access"
            reset={false}
            onSuccess={() => {
              toast?.("Employee access updated.");
              setEditing(null);
            }}
            body={(data) => ({
              role: value(data, "role"),
              status: value(data, "status"),
            })}
          >
            <Field name="role" label="Profession" defaultValue={editing.role}>
              {memberRole.options.map((role) => (
                <option key={role} value={role}>
                  {memberLabels[role]}
                </option>
              ))}
            </Field>
            <Field
              name="status"
              label="Membership status"
              defaultValue={editing.status}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Field>
          </ActionForm>
        </SideDrawer>
      )}
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
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const query = useLiveQuery(
    scope,
    `${platform ? "identity/audit" : "journey/access-audit"}?offset=${offset}&limit=${auditPageSize + 1}`,
    pageOf(auditRow),
  );
  const delivery = useLiveQuery(
    scope,
    `identity/email-deliveries?offset=${deliveryOffset}&limit=${auditPageSize + 1}`,
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
  const refreshing = query.isFetching || (platform && delivery.isFetching);
  return (
    <div className="workspace-directory-page audit-page">
      <Heading
        eyebrow=""
        title="Audit & accountability"
        detail="Recorded account and access events. Times shown in East Africa Time."
        actions={
          <button
            type="button"
            className={`${buttonClasses.primary} facilities-onboard-trigger`}
            disabled={refreshing}
            aria-busy={refreshing}
            onClick={() => {
              void query.refetch();
              if (platform) void delivery.refetch();
            }}
          >
            <ButtonHeartbeat loading={refreshing}>
              <Icon name="refresh" size={18} outline />
              Refresh records
            </ButtonHeartbeat>
          </button>
        }
      />
      <Panel
        title="Access history"
        detail="Each entry records an access event, its outcome and a request reference."
      >
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
              {query.data?.items.slice(0, auditPageSize).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="audit-event">
                      {item.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </strong>
                  </td>
                  <td>{stamp(item.created_at ?? item.recorded_at)}</td>
                  <td><Status value={item.outcome ?? "recorded"} /></td>
                  <td>
                    <small className="audit-reference" title={item.request_id ?? item.id}>
                      {item.request_id ?? item.id}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data && !query.data.items.length && (
          <p className="live-empty py-6 text-muted">No access events have been recorded yet.</p>
        )}
        <Pager
          offset={offset}
          count={Math.min(query.data?.items.length ?? 0, auditPageSize)}
          size={auditPageSize}
          hasMore={query.data ? query.data.items.length > auditPageSize : undefined}
          change={setOffset}
        />
      </Panel>
      {platform && (
        <Panel
          title="Invitation & email delivery"
          detail="Recent delivery status. Message bodies and credentials are never exposed here."
        >
          <QueryState query={delivery} />
          <div className="live-table-wrap w-full overflow-x-auto">
            <table className="live-table">
              <thead>
                <tr>
                  <th>Queued</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {delivery.data?.items.slice(0, auditPageSize).map((item) => (
                  <tr key={item.id}>
                    <td><strong>{stamp(item.created_at)}</strong></td>
                    <td><Status value={item.status} /></td>
                    <td>{item.attempts}</td>
                    <td>
                      <small className="audit-reference" title={item.id}>{item.id}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {delivery.data && !delivery.data.items.length && (
            <p className="live-empty py-6 text-muted">No emails have been queued yet.</p>
          )}
          <Pager
            offset={deliveryOffset}
            count={Math.min(delivery.data?.items.length ?? 0, auditPageSize)}
            size={auditPageSize}
            hasMore={delivery.data ? delivery.data.items.length > auditPageSize : undefined}
            change={setDeliveryOffset}
          />
        </Panel>
      )}
    </div>
  );
}
