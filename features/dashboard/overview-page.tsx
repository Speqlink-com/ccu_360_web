"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { Icon, type IconName } from "@/components/ui/icon";
import { CCU360Loader } from "@/components/ui/ccu-loader";
import { FacilityPicker } from "@/components/auth/identity-boundary";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { usePatientSearch } from "@/features/reception/queries";
import { emptyFilter } from "@/features/reception/contracts";
import {
  employee,
  provider,
  pageOf,
  memberLabels,
} from "@/lib/api/identity-contract";
import { teamRole } from "@/features/live/journey-contract";
import { Heading, Pager, QueryState, Status } from "@/features/live/shared";

const previewSize = 12;
const peoplePageSize = 5;
const clinicalPageSize = 5;
const formPreview = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  status: z.string(),
  active: z.boolean().default(true),
});
const journeyPreview = z.object({
  id: z.string(),
  patient_name: z.string(),
  patient_identifier: z.string(),
  patient_ccu360_number: z.string().nullable().optional(),
  status: z.string(),
  unit: z.string(),
});
const careAccess = z.object({
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      capabilities: z.array(z.string()),
    }),
  ),
});

function Metric({
  label,
  value,
  detail,
  icon,
  href,
  tone = "paper",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconName;
  href: string;
  tone?: "navy" | "teal" | "paper";
}) {
  return (
    <Link href={href} className={`dashboard-metric dashboard-metric-${tone}`}>
      <div className="dashboard-metric-top">
        <span>{label}</span>
        <span className="dashboard-icon-tile">
          <Icon name={icon} size={28} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="dashboard-metric-bottom">
        <span>{detail}</span>
        <Icon name="arrow" size={17} />
      </div>
    </Link>
  );
}
function Collection({
  title,
  subtitle,
  icon,
  href,
  children,
  footer,
  pagination,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  href: string;
  children: ReactNode;
  footer: string;
  pagination?: ReactNode;
}) {
  return (
    <section className="dashboard-panel">
      <header className="dashboard-panel-header">
        <div className="dashboard-panel-title">
          <span className="dashboard-icon-tile">
            <Icon name={icon} size={27} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
        <Link href={href} className="dashboard-view-link">
          View all <Icon name="arrow" size={16} />
        </Link>
      </header>
      <div
        className="dashboard-panel-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${title} preview`}
      >
        {children}
      </div>
      {pagination && <div className="dashboard-collection-pager">{pagination}</div>}
      <footer className="dashboard-panel-footer">
        <span>{footer}</span>
        <span className="dashboard-source-dot" aria-hidden="true" />
      </footer>
    </section>
  );
}
function EmptyPreview({
  icon,
  title,
  href,
  action,
}: {
  icon: IconName;
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="dashboard-empty">
      <Icon name={icon} size={48} />
      <strong>{title}</strong>
      <Link href={href}>
        {action} <Icon name="arrow" size={16} />
      </Link>
    </div>
  );
}
function Shortcut({
  href,
  title,
  icon,
  caption,
}: {
  href: string;
  title: string;
  icon: IconName;
  caption: string;
}) {
  return (
    <Link href={href} className="dashboard-shortcut">
      <span className="dashboard-icon-tile">
        <Icon name={icon} size={30} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{caption}</small>
      </span>
      <Icon name="arrow" size={18} />
    </Link>
  );
}

export function OverviewPage() {
  const user = useIdentity().data!;
  const [dayPart, setDayPart] = useState<string | null>(null);
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [journeyOffset, setJourneyOffset] = useState(0);
  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setDayPart(
        hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
      );
    };
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const nameParts = user.display_name
    .trim()
    .replace(/^(?:(?:Eng(?:ineer)?|Dr|Mr|Mrs|Ms|Prof)\.{0,2}\s+)+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const firstName = nameParts[0] ?? "there";
  const member = user.memberships.find(
    (m) => m.organization_id === user.organization_id,
  );
  const platform = user.platform_role === "ahs_admin";
  const admin = !platform && member?.role === "provider_admin";
  const clinical = !platform && !admin;
  const scope = user.organization_id ?? user.id;
  const facilities = useLiveQuery(
    user.id,
    `identity/providers?offset=0&limit=${previewSize}`,
    pageOf(provider),
    platform,
    30_000,
  );
  const people = useLiveQuery(
    scope,
    `identity/providers/${user.organization_id}/members?offset=0&limit=${previewSize}`,
    pageOf(employee),
    admin,
    30_000,
  );
  const peoplePreview = useLiveQuery(
    scope,
    `identity/providers/${user.organization_id}/members?offset=${peopleOffset}&limit=${peoplePageSize + 1}`,
    pageOf(employee),
    admin,
    30_000,
  );
  const teams = useLiveQuery(
    scope,
    "workforce/roles?offset=0&limit=20",
    pageOf(teamRole),
    admin,
    30_000,
  );
  const forms = useLiveQuery(
    scope,
    `journey/config/templates?offset=0&limit=${previewSize}`,
    pageOf(formPreview),
    admin,
    false,
  );
  const access = useLiveQuery(
    scope,
    "journey/access",
    careAccess,
    clinical,
    30_000,
  );
  const journeys = useLiveQuery(
    scope,
    `journey/inbox?offset=0&limit=${previewSize}`,
    pageOf(journeyPreview),
    clinical,
    30_000,
  );
  const journeyList = useLiveQuery(
    scope,
    `journey/inbox?offset=${journeyOffset}&limit=${clinicalPageSize + 1}`,
    pageOf(journeyPreview),
    clinical,
    30_000,
  );
  const patients = usePatientSearch({ ...emptyFilter, limit: 1 }, clinical);
  const activeQueries = platform
    ? [facilities]
    : admin
      ? [people, teams, forms]
      : [access, journeys, patients];
  const refreshing =
    activeQueries.some((q) => q.isFetching) ||
    (admin && peoplePreview.isFetching) ||
    (clinical && journeyList.isFetching);
  const name = member?.provider_name ?? "Your facility";
  const security = user.mfa_enabled ? "Enabled" : "Set up";
  const shown = (data: { items: unknown[] } | undefined) =>
    data ? data.items.length : "—";
  const previewCaption = (
    data: { items: unknown[] } | undefined,
    limit = previewSize,
  ) =>
    data
      ? `${Math.min(data.items.length, limit)} shown · Directory preview`
      : "Directory preview";
  if (activeQueries.some((query) => query.isPending))
    return <CCU360Loader variant="dashboard" />;
  return (
    <div className={`dashboard-overview platform-overview ${admin ? "facility-admin-overview" : ""} ${clinical ? "clinical-overview" : ""}`}>
      <Heading
        eyebrow=""
        title={`${dayPart ?? "Welcome"}, ${nameParts.at(-1) ?? firstName}!`}
        detail=""
        actions={
          !platform ? (
            <span className="facility-workspace-label">
              {name}
            </span>
          ) : undefined
        }
      />
      <section className="platform-quickbar" aria-label="Quick actions">
          <nav
            className="platform-quickbar-panel"
            aria-label={platform ? "Platform shortcuts" : admin ? "Facility shortcuts" : "Care shortcuts"}
          >
            <Link
              href={platform ? "/dashboard/facilities" : admin ? "/dashboard/employees" : "/dashboard/patients"}
              className="platform-quickbar-action"
            >
              <span className="platform-quickbar-icon">
                <span className="platform-quickbar-outline">
                  <Icon name={platform ? "facilities" : admin ? "addUser" : "bed"} size={18} outline />
                </span>
                <span className="platform-quickbar-artwork">
                  <Icon name={platform ? "facilities" : admin ? "addUser" : "bed"} size={22} />
                </span>
              </span>
              <span>{platform ? "Facilities" : admin ? "Employees" : member?.role === "receptionist" ? "Reception" : "Patients"}</span>
            </Link>
            <Link
              href={platform ? "/dashboard/administrators" : admin ? "/dashboard/workforce" : "/dashboard/queue"}
              className="platform-quickbar-action"
            >
              <span className="platform-quickbar-icon">
                <span className="platform-quickbar-outline">
                  <Icon name={platform ? "addUser" : "team"} size={18} outline />
                </span>
                <span className="platform-quickbar-artwork">
                  <Icon name={platform ? "addUser" : "team"} size={22} />
                </span>
              </span>
              <span>{platform ? "Users" : admin ? "Teams" : "Work queue"}</span>
            </Link>
            <button
              type="button"
              className="platform-quickbar-action"
              disabled={refreshing}
              onClick={() => {
                for (const query of activeQueries) void query.refetch();
                if (admin) void peoplePreview.refetch();
                if (clinical) void journeyList.refetch();
              }}
            >
              <span className={`platform-quickbar-icon platform-quickbar-icon-refresh ${refreshing ? "platform-refreshing" : ""}`}>
                <span className="platform-quickbar-artwork">
                  <Icon name="refresh" size={26} />
                </span>
              </span>
              <span>{refreshing ? "Refreshing" : "Refresh"}</span>
            </button>
          </nav>
        </section>
      <section className="dashboard-metrics" aria-label="Workspace snapshot">
        {platform ? (
          <>
            <Metric
              href="/dashboard/facilities"
              icon="facilities"
              label="Facilities sampled"
              value={shown(facilities.data)}
              detail={`Up to ${previewSize} directory records`}
              tone="navy"
            />
            <Metric
              href="/dashboard/facilities"
              icon="bed"
              label="Active sampled"
              value={
                facilities.data
                  ? facilities.data.items.filter((f) => f.status === "active")
                      .length
                  : "—"
              }
              detail="Within directory sample"
              tone="teal"
            />
            <Metric
              href="/dashboard/facilities"
              icon="location"
              label="Suspended sampled"
              value={
                facilities.data
                  ? facilities.data.items.filter(
                      (f) => f.status === "suspended",
                    ).length
                  : "—"
              }
              detail="Within directory sample"
            />
          </>
        ) : admin ? (
          <>
            <Metric
              href="/dashboard/employees"
              icon="team"
              label="Employees shown"
              value={shown(people.data)}
              detail={`Up to ${previewSize} directory records`}
              tone="navy"
            />
            <Metric
              href="/dashboard/workforce"
              icon="profile"
              label="Care teams shown"
              value={shown(teams.data)}
              detail="Up to 20 shared roles"
              tone="teal"
            />
            <Metric
              href="/dashboard/templates"
              icon="form"
              label="Form versions shown"
              value={shown(forms.data)}
              detail={`Latest ${previewSize} versions`}
            />
          </>
        ) : (
          <>
            <Metric
              href="/dashboard/patients"
              icon="bed"
              label="Facility patients"
              value={patients.data?.total ?? "—"}
              detail="Patient registry"
              tone="navy"
            />
            <Metric
              href="/dashboard/patients"
              icon="form"
              label="Recent journeys"
              value={shown(journeys.data)}
              detail={`Latest ${previewSize} linked journeys`}
              tone="teal"
            />
            <Metric
              href="/dashboard/queue"
              icon="team"
              label="My care teams"
              value={access.data?.roles.length ?? "—"}
              detail="Current role access"
            />
          </>
        )}
        <Metric
          href="/dashboard/security"
          icon="shield"
          label={platform ? "Two-step protection" : "Two-step verification"}
          value={security}
          detail="My account & security"
        />
      </section>
      <div className="dashboard-collections">
        {platform ? (
          <Collection
            title="Facility network"
            subtitle="Provider directory"
            icon="facilities"
            href="/dashboard/facilities"
            footer={previewCaption(facilities.data, 5)}
          >
            <QueryState query={facilities} />
            {facilities.data?.items.slice(0, 5).map((f) => (
              <div className="dashboard-list-row" key={f.id}>
                <span className="dashboard-row-icon">
                  <Icon name="facilities" size={28} />
                </span>
                <div className="dashboard-row-copy">
                  <strong>{f.name}</strong>
                  <span>{f.code}</span>
                </div>
                <Status value={f.status} />
              </div>
            ))}
            {facilities.data && !facilities.data.items.length && (
              <EmptyPreview
                icon="facilities"
                title="Your network starts here"
                href="/dashboard/facilities"
                action="Onboard a facility"
              />
            )}
          </Collection>
        ) : admin ? (
          <Collection
            title="Your people"
            subtitle="Employee directory"
            icon="team"
            href="/dashboard/employees"
            footer="Facility employee directory"
            pagination={
              peoplePreview.data &&
              (peopleOffset > 0 || peoplePreview.data.items.length > peoplePageSize) ? (
                <Pager
                  offset={peopleOffset}
                  count={Math.min(peoplePreview.data.items.length, peoplePageSize)}
                  size={peoplePageSize}
                  hasMore={peoplePreview.data.items.length > peoplePageSize}
                  change={setPeopleOffset}
                />
              ) : undefined
            }
          >
            <QueryState query={peoplePreview} />
            {peoplePreview.data?.items.slice(0, peoplePageSize).map((p) => (
              <div className="dashboard-list-row" key={p.id}>
                <span className="dashboard-person-avatar" aria-hidden="true">
                  {p.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="dashboard-row-copy">
                  <strong>{p.display_name}</strong>
                  <span>{memberLabels[p.role]}</span>
                </div>
                <Status value={p.status} />
              </div>
            ))}
            {peoplePreview.data && !peoplePreview.data.items.length && (
              peopleOffset > 0 ? (
                <div className="dashboard-empty">
                  <strong>No employees on this page.</strong>
                </div>
              ) : (
                <EmptyPreview
                  icon="addUser"
                  title="Build your care team"
                  href="/dashboard/employees"
                  action="Invite an employee"
                />
              )
            )}
          </Collection>
        ) : (
          <Collection
            title="Recent patient journeys"
            subtitle="Your linked care records"
            icon="bed"
            href="/dashboard/patients"
            footer={journeyList.data ? `${journeyList.data.items.slice(0, clinicalPageSize).length} shown · Linked journeys` : "Linked journeys"}
            pagination={
              journeyList.data &&
              (journeyOffset > 0 || journeyList.data.items.length > clinicalPageSize) ? (
                <Pager
                  offset={journeyOffset}
                  count={Math.min(journeyList.data.items.length, clinicalPageSize)}
                  size={clinicalPageSize}
                  hasMore={journeyList.data.items.length > clinicalPageSize}
                  change={setJourneyOffset}
                />
              ) : undefined
            }
          >
            <QueryState query={journeyList} />
            {journeyList.data?.items.slice(0, clinicalPageSize).map((j) => (
              <Link
                className="dashboard-list-row dashboard-record-link"
                key={j.id}
                href={`/dashboard/patients/${j.id}`}
              >
                <span className="dashboard-row-icon">
                  <Icon name="form" size={27} />
                </span>
                <div className="dashboard-row-copy">
                  <strong>{j.patient_name}</strong>
                  <span>
                    {j.patient_ccu360_number
                      ? `CCU360 ${j.patient_ccu360_number} · `
                      : ""}
                    IP {j.patient_identifier}
                  </span>
                </div>
                <Status value={j.status} />
                <Icon name="arrow" size={16} />
              </Link>
            ))}
            {journeyList.data && !journeyList.data.items.length && (
              <EmptyPreview
                icon="form"
                title={journeyOffset > 0 ? "No journeys on this page" : "No linked journeys yet"}
                href="/dashboard/patients"
                action="Open patient directory"
              />
            )}
            {patients.error && <QueryState query={patients} />}
          </Collection>
        )}
        {admin ? (
          <section className="dashboard-panel dashboard-action-panel">
            <header className="dashboard-panel-header">
              <div className="dashboard-panel-title">
                <span className="dashboard-icon-tile">
                  <Icon name="shield" size={28} />
                </span>
                <div>
                  <h2>Facility controls</h2>
                  <p>{name} · Administration</p>
                </div>
              </div>
            </header>
            <div className="dashboard-action-list">
              <Shortcut
                href="/dashboard/employees"
                title="Employees"
                icon="addUser"
                caption="Invitations & access"
              />
              <Shortcut
                href="/dashboard/workforce"
                title="Departments & teams"
                icon="team"
                caption="Care roles & responsibilities"
              />
              <Shortcut
                href="/dashboard/templates"
                title="Form Studio"
                icon="form"
                caption="Versions & branding"
              />
              <Shortcut
                href="/dashboard/worksite"
                title="Facility access"
                icon="location"
                caption="Sites & trusted networks"
              />
            </div>
            {(forms.error || teams.error) && (
              <div className="dashboard-control-errors">
                {forms.error && <QueryState query={forms} />}
                {teams.error && <QueryState query={teams} />}
              </div>
            )}
          </section>
        ) : platform ? (
          <section className="dashboard-panel dashboard-action-panel">
            <header className="dashboard-panel-header">
              <div className="dashboard-panel-title">
                <span className="dashboard-icon-tile">
                  <Icon name="shield" size={28} />
                </span>
                <div>
                  <h2>Platform controls</h2>
                  <p>Administration & governance</p>
                </div>
              </div>
            </header>
            <div className="dashboard-action-list">
              <Shortcut
                href="/dashboard/facilities"
                title="Facility directory"
                icon="facilities"
                caption="Providers & onboarding"
              />
              <Shortcut
                href="/dashboard/administrators"
                title="AHS administrators"
                icon="addUser"
                caption="Platform accounts"
              />
              <Shortcut
                href="/dashboard/audit"
                title="Audit & delivery"
                icon="shield"
                caption="Access records & email"
              />
              <Shortcut
                href="/dashboard/security"
                title="Account security"
                icon="settings"
                caption="Password & verification"
              />
            </div>
          </section>
        ) : (
          <section className="dashboard-panel dashboard-action-panel">
            <header className="dashboard-panel-header">
              <div className="dashboard-panel-title">
                <span className="dashboard-icon-tile"><Icon name="team" size={28} /></span>
                <div>
                  <h2>Care workspace</h2>
                  <p>{member ? memberLabels[member.role] : "Facility care"} · {name}</p>
                </div>
              </div>
            </header>
            <div className="dashboard-action-list">
              <Shortcut href="/dashboard/patients" title={member?.role === "receptionist" ? "Reception" : "Patient directory"} icon="bed" caption="Search & patient history" />
              <Shortcut href="/dashboard/queue" title="Team work queue" icon="team" caption="Claims & shift handover" />
              <Shortcut href="/dashboard/connect" title="Connect 360" icon="connect" caption="Team communication" />
              <Shortcut href="/dashboard/security" title="Account security" icon="shield" caption="Password & verification" />
            </div>
          </section>
        )}
      </div>
      {!platform &&
        user.memberships.filter(
          (m) => m.status === "active" && m.provider_status === "active",
        ).length > 1 && (
          <section className="dashboard-panel dashboard-facility-switch">
            <h2>Switch facility</h2>
            <FacilityPicker user={user} />
          </section>
        )}
    </div>
  );
}
