"use client";
import { buttonClasses, metricClasses } from "@/lib/presentation";
import Link from "next/link";
import { useState } from "react";
import { useDirectory, useUpdateAccess } from "./queries";
import { useSession } from "@/providers/session-provider";
import {
  roleLabels,
  type Directory,
  type Facility,
  type User,
} from "@/lib/domain/identity";
import { Badge, Empty } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/feedback";
import { ProvisionDialog } from "@/components/administration/provision-dialog";
export type AdminSection =
  "overview" | "facilities" | "employees" | "team" | "units" | "access";
export function AdministrationPage({ section }: { section: AdminSection }) {
  const session = useSession();
  const query = useDirectory();
  const [provision, setProvision] = useState<"facilities" | "employees" | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState<Facility | null>(null);
  if (!session)
    return (
      <Empty title="Your clinical workspace is being prepared.">
        Sign-in and the live clinical API must be connected before production
        use.
      </Empty>
    );
  if (query.isPending)
    return (
      <LoadingState label="Opening your workspace…" />
    );
  if (query.isError)
    return (
      <Empty title="We couldn’t load this workspace.">
        <button className={buttonClasses.secondary} onClick={() => query.refetch()}>
          Try again
        </button>
      </Empty>
    );
  const data = query.data,
    platform = session.user.role === "ahs_admin",
    facility = data.facilities[0],
    own = data.employees.filter((u) => u.facilityId),
    summary = data.summaries[0];
  const facilityList = data.facilities.filter(
    (f) =>
      `${f.name} ${f.city} ${f.code}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All" || f.status === filter),
  );
  const employees = data.employees.filter(
    (u) =>
      `${u.name} ${u.email} ${roleLabels[u.role]}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All" || u.status === filter),
  );
  const heading =
    section === "overview"
      ? platform
        ? "A connected system. Better coordinated care."
        : "Your facility. One connected team."
      : section === "facilities"
        ? "Facility workspaces"
        : section === "employees" || section === "team"
          ? "People behind the care."
          : section === "units"
            ? "A place for every patient."
            : "Clear roles. Accountable access.";
  const subtitle =
    section === "overview"
      ? platform
        ? "Welcome back, Comphortine. Here’s the picture across your CCU360 network."
        : `Manage ${facility?.name ?? "your facility"}, support your employees and keep your units ready.`
      : section === "facilities"
        ? "Onboard providers, appoint administrators and manage workspace access."
        : section === "employees"
          ? "Manage the people and permissions within your facility."
          : section === "team"
            ? "Your facility’s care team and assigned units."
            : section === "units"
              ? "Configured units, bed capacity and current encounter counts."
              : "AHS manages the platform. Facilities manage their teams. Clinicians manage care.";
  return (
    <>
      <div className="page-heading admin-heading mb-[26px] flex items-center justify-between gap-5.5 max-[1000px]:items-start max-[760px]:flex-wrap max-[760px]:gap-4 max-[700px]:mb-5">
        <div>
          <p className="eyebrow mb-[9px]">
            {platform
              ? "AYOT HEALTH SOLUTIONS / PLATFORM"
              : `${facility?.name ?? "FACILITY"} / ${section === "overview" ? "OVERVIEW" : section.toUpperCase()}`}
          </p>
          <h1 className="text-[30px] leading-[1.25] tracking-[-1px] max-[1000px]:text-[27px]">{heading}</h1>
          <p className="muted mt-[9px] max-w-[800px] text-sm leading-[1.7] max-[760px]:max-w-none max-[760px]:text-[13px]">{subtitle}</p>
        </div>
        {platform && (section === "overview" || section === "facilities") ? (
          <button
            className={buttonClasses.primary}
            onClick={() => setProvision("facilities")}
          >
            <Icon name="plus" />
            Onboard facility
          </button>
        ) : session.user.role === "facility_admin" &&
          (section === "overview" || section === "employees") ? (
          <button
            className={buttonClasses.primary}
            onClick={() => setProvision("employees")}
          >
            <Icon name="addUser" size={22} />
            Add employee
          </button>
        ) : null}
      </div>
      {section === "overview" && (
        <>
          <div className={`enterprise-hero relative mb-6 flex items-center justify-between overflow-hidden border px-8 py-[30px] max-[1000px]:p-[25px] max-[760px]:p-6 ${platform ? "platform-hero min-h-[170px] rounded-[4px] border-teal-dark bg-teal-dark text-white" : "min-h-[202px] rounded-[13px] border-[#dcebe8] bg-[#e8f4ef] text-[#143e46] max-[760px]:min-h-[215px]"}`}>
            <div>
              <span className={`hero-label text-[10px] font-semibold tracking-[2px] ${platform ? "text-[#7cc8ba]" : "text-[#388077]"}`}>
                {platform ? "CCU360 NETWORK" : "FACILITY WORKSPACE"}
              </span>
              <h2 className="mt-[9px] mb-2 text-[28px] leading-[1.3] font-[550] tracking-[-.7px] max-[1250px]:text-[25px]">
                {platform
                  ? "One platform. Every facility in focus."
                  : facility?.name}
              </h2>
              <p className={`max-w-[620px] text-sm leading-[1.7] max-[760px]:text-[13px] ${platform ? "text-[#b4cbd7]" : "text-[#587a76]"}`}>
                {platform
                  ? "Independent workspaces, accountable administrators and connected care teams."
                  : `${facility?.city} · ${facility?.type} · ICU & HDU care coordination`}
              </p>
              <span className={`hero-foot mt-5 flex items-center gap-2 text-xs max-[760px]:items-start max-[760px]:text-[11px] ${platform ? "text-[#98c6c7]" : "text-[#518478]"}`}>
                <Icon name="shield" size={18} />
                {platform
                  ? "Facility data remains within each care workspace"
                  : "Your employees and patient records stay within your facility"}
              </span>
            </div>
            {!platform && <div className="hero-emblem relative mr-[45px] grid h-[115px] w-[190px] shrink-0 place-items-center max-[1250px]:mr-2.5 max-[1250px]:w-[145px] max-[1000px]:hidden">
              <span className="relative z-[1] text-[37px] font-[650] italic tracking-[-2px]">
                CCU<span className={platform ? "text-[#62cbb7]" : "text-[#119c91]"}>360</span>
              </span>
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-orbit orbit-three" />
            </div>}
          </div>
          <div className="metrics admin-metrics mb-7 grid grid-cols-4 gap-4.5 max-[1250px]:grid-cols-2 max-[760px]:mb-[23px] max-[760px]:gap-3">
            <AdminMetric
              compact={platform}
              label={platform ? "Facility workspaces" : "Team members"}
              value={platform ? data.facilities.length : own.length}
              detail={
                platform
                  ? "Independent provider workspaces"
                  : "Across administration and clinical care"
              }
              icon={platform ? "facilities" : "profile"}
            />
            <AdminMetric
              compact={platform}
              label={platform ? "Active facilities" : "Configured beds"}
              value={
                platform
                  ? data.facilities.filter((f) => f.status === "Active").length
                  : (facility?.beds.ICU ?? 0) + (facility?.beds.HDU ?? 0)
              }
              detail={
                platform
                  ? "Enabled for their care teams"
                  : `${facility?.beds.ICU ?? 0} ICU · ${facility?.beds.HDU ?? 0} HDU`
              }
              icon="shield"
            />
            <AdminMetric
              compact={platform}
              label={platform ? "Facility employees" : "Active encounters"}
              value={platform ? own.length : (summary?.patients ?? 0)}
              detail={
                platform
                  ? "Managed by facility administrators"
                  : "Facility aggregate · no patient details"
              }
              icon={platform ? "addUser" : "patients"}
            />
            <AdminMetric
              compact={platform}
              label={platform ? "Facilities onboarding" : "Clinical roles"}
              value={
                platform
                  ? data.facilities.filter((f) => f.status === "Onboarding")
                      .length
                  : new Set(
                      own
                        .filter((u) =>
                          ["doctor", "nurse", "allied_health"].includes(u.role),
                        )
                        .map((u) => u.role),
                    ).size
              }
              detail={
                platform
                  ? "Being prepared for their first shift"
                  : "Doctors, nurses and allied health"
              }
              icon="growth"
            />
          </div>
        </>
      )}
      {(section === "facilities" || (section === "overview" && platform)) && (
        <section className="panel admin-table-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Your facility network{" "}
                <span className="count">{data.facilities.length}</span>
              </h2>
              <p>Each facility owns its employees and clinical workspace.</p>
            </div>
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Search facilities or city"
            />
          </div>
          <Filters
            value={filter}
            onChange={setFilter}
            values={["All", "Active", "Onboarding", "Suspended"]}
            label="Facility status"
          />
          <div className="table-scroll">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Administrator</th>
                  <th>Capacity</th>
                  <th>Team</th>
                  <th>Workspace status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {facilityList.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <button
                        className="facility-name-cell flex items-center gap-3.5 border-0 bg-transparent p-0 text-left"
                        onClick={() => setDetail(f)}
                      >
                        <span className="facility-monogram grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[11px] border border-[#dbe9ea] bg-[#eaf3f4] text-xs font-semibold tracking-[.5px] text-[#457c84]">{f.code}</span>
                        <span>
                          <strong>{f.name}</strong>
                          <small>
                            {f.city} · {f.type}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <strong>{f.adminName}</strong>
                      <small>{f.adminEmail}</small>
                    </td>
                    <td>
                      <strong>{f.beds.ICU + f.beds.HDU} beds</strong>
                      <small>
                        {f.beds.ICU} ICU / {f.beds.HDU} HDU
                      </small>
                    </td>
                    <td>
                      <span className="team-count flex items-center gap-[9px] text-xs text-[#5d7282]">
                        <Icon name="profile" size={22} />
                        {
                          data.employees.filter((u) => u.facilityId === f.id)
                            .length
                        }{" "}
                        employees
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          f.status === "Active"
                            ? "teal"
                            : f.status === "Suspended"
                              ? "red"
                              : "amber"
                        }
                      >
                        {f.status}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Manage ${f.name}`}
                        onClick={() => setDetail(f)}
                      >
                        <Icon name="right" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!facilityList.length && (
              <Empty title="No facilities match this view." />
            )}
          </div>
        </section>
      )}
      {(section === "employees" || section === "team") && (
        <EmployeeTable
          employees={employees}
          current={session.user}
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
        />
      )}
      {section === "overview" && !platform && (
        <div className="facility-main-grid grid gap-6 [grid-template-columns:1.45fr_1fr] max-[1250px]:grid-cols-1">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Your people, connected</h2>
                <p>The right responsibility for each member of your team.</p>
              </div>
              <Link href="/dashboard/employees" className="text-link">
                Manage employees <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="team-role-grid grid grid-cols-4 gap-2.5 px-6 py-[26px] max-[1000px]:gap-[17px] max-[760px]:grid-cols-2 max-[760px]:gap-[25px] max-[760px]:px-5 max-[760px]:py-[25px]">
              {(
                ["doctor", "nurse", "allied_health", "facility_admin"] as const
              ).map((role) => (
                <div key={role}>
                  <span className={`role-mark grid h-[43px] w-[43px] place-items-center rounded-[11px] role-${role}`}>
                    <Icon
                      name={role === "facility_admin" ? "shield" : "profile"}
                      size={26}
                    />
                  </span>
                  <strong>{own.filter((u) => u.role === role).length}</strong>
                  <span>
                    {roleLabels[role]}
                    {role === "doctor" || role === "nurse" ? "s" : ""}
                  </span>
                  <small>
                    {role === "facility_admin"
                      ? "People & access"
                      : role === "doctor"
                        ? "Clinical review & care"
                        : role === "nurse"
                          ? "Bedside care & actions"
                          : "Multidisciplinary care"}
                  </small>
                </div>
              ))}
            </div>
            <div className="panel-bottom-note flex items-center gap-[9px] border-t border-[#eaf0f1] px-6 py-4 text-xs leading-[1.7] text-[#6a8390] max-[760px]:px-5 max-[760px]:text-[11px]">
              <Icon name="shield" size={17} />
              Employee access is assigned and managed by your facility.
            </div>
          </section>
          <UnitCards facility={facility} data={data} compact />
        </div>
      )}
      {section === "units" && <UnitCards facility={facility} data={data} />}
      {section === "access" && <AccessRoles platform={platform} />}
      {section === "overview" && (
        <div className="admin-bottom-grid mt-[26px] grid gap-6 [grid-template-columns:1.45fr_1fr] max-[1250px]:[grid-template-columns:1.2fr_1fr] max-[1000px]:grid-cols-1 max-[760px]:gap-5">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Workspace activity</h2>
                <p>Administrative changes with a named owner.</p>
              </div>
              <span className="live-indicator inline-flex items-center gap-1.5 text-[11px] text-[#719084]">
                <i />
                Sample & demo activity
              </span>
            </div>
            <div className="activity-list px-6 py-[5px] max-[760px]:px-5">
              {data.activity.slice(0, 5).map((a) => (
                <article key={a.id}>
                  <span className="activity-dot mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full bg-[#63a89b] shadow-[0_0_0_4px_#edf6f2]" />
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.detail}</p>
                    <small>
                      {a.actor} ·{" "}
                      {new Date(a.at).toLocaleString("en-GB", {
                        timeZone: "Africa/Nairobi",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      EAT
                    </small>
                  </div>
                </article>
              ))}
              {!data.activity.length && (
                <Empty title="Your workspace activity will appear here." />
              )}
            </div>
          </section>
          <section className="panel responsibility-panel flex flex-col items-start bg-[#fbfdfc] p-[30px] max-[760px]:p-[25px]">
            <span className="eyebrow">BUILT AROUND RESPONSIBILITY</span>
            <h2>
              {platform
                ? "You connect the facilities. They lead their teams."
                : "You lead the team. They deliver the care."}
            </h2>
            <p>
              {platform
                ? "AHS creates each facility workspace and appoints its administrator. The facility takes ownership of its people, units and day-to-day access."
                : "Add doctors, nurses and allied health professionals. Give each person a role and unit, with access scoped to your facility."}
            </p>
            <Link href="/dashboard/access" className="text-link">
              Explore roles & access <Icon name="arrow" />
            </Link>
            <div className="responsibility-flow mt-auto flex items-center gap-3 pt-[27px] text-[#708b8d] max-[1250px]:gap-[7px] max-[760px]:gap-2.5">
              <span>AHS</span>
              <Icon name="right" size={15} />
              <span>Facility</span>
              <Icon name="right" size={15} />
              <span>Care team</span>
            </div>
          </section>
        </div>
      )}
      {provision && (
        <ProvisionDialog kind={provision} onClose={() => setProvision(null)} />
      )}
      {detail && (
        <FacilityDetail
          facility={data.facilities.find((f) => f.id === detail.id) ?? detail}
          count={
            data.employees.filter((u) => u.facilityId === detail.id).length
          }
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-field">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function Filters({
  value,
  onChange,
  values,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  values: string[];
  label: string;
}) {
  return (
    <div className="table-toolbar">
      <div className="tabs" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            className={value === v ? "selected" : ""}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
          >
            {v === "All"
              ? "All " +
                (label === "Facility status" ? "facilities" : "employees")
              : v}
          </button>
        ))}
      </div>
      <span className="small muted">Facility-scoped access</span>
    </div>
  );
}
export function AdminMetric({
  label,
  value,
  detail,
  icon,
  compact = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: IconName;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "metric border border-border border-t-[3px] border-t-teal-dark bg-surface px-5 py-5" : metricClasses.card}>
      <div className={metricClasses.heading}>
        <span>{label}</span>
        <span className={`metric-art grid h-[42px] w-[42px] place-items-center bg-[#eff7f5] max-[760px]:h-8 max-[760px]:w-8 max-[760px]:shrink-0 ${compact ? "rounded-[4px]" : "rounded-[10px]"}`}>
          <Icon name={icon} size={32} />
        </span>
      </div>
      <strong className={compact ? "mt-3 mb-1 block text-[32px] leading-[1.1] font-semibold tracking-[-1px] text-navy tabular-nums" : metricClasses.value}>{String(value).padStart(2, "0")}</strong>
      <small className={`${metricClasses.detail} text-[#6a7f8f]`}>{detail}</small>
    </article>
  );
}
function EmployeeTable({
  employees,
  current,
  search,
  onSearch,
  filter,
  onFilter,
}: {
  employees: User[];
  current: User;
  search: string;
  onSearch: (v: string) => void;
  filter: string;
  onFilter: (v: string) => void;
}) {
  const update = useUpdateAccess();
  const [target, setTarget] = useState<User | null>(null);
  const canManage = current.role === "facility_admin";
  return (
    <>
      <section className="panel admin-table-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {canManage ? "Employee directory" : "Care team directory"}{" "}
              <span className="count">{employees.length}</span>
            </h2>
            <p>
              {canManage
                ? "Roles, units and active access for your facility."
                : "Find the people contributing to your facility’s care."}
            </p>
          </div>
          <Search
            value={search}
            onChange={onSearch}
            placeholder="Search name, email or role"
          />
        </div>
        <Filters
          value={filter}
          onChange={onFilter}
          values={["All", "Active", "Suspended"]}
          label="Employee status"
        />
        <div className="table-scroll">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Role</th>
                <th>Assigned unit</th>
                <th>Status</th>
                <th>Access</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {employees.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="patient-cell">
                      <span className="employee-avatar grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#eff2f7] text-[13px] font-[550] text-[#55728a]">
                        {u.name
                          .replace("Dr. ", "")
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>
                          {u.name}
                          {u.id === current.id && (
                            <span className="you-tag ml-[7px] inline-block rounded-sm bg-[#edf5ef] px-1.5 py-px text-[10px] text-[#567d73]">You</span>
                          )}
                        </strong>
                        <small>{u.email}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`role-pill inline-block rounded-[5px] px-[9px] py-[5px] text-xs leading-[inherit] role-${u.role}`}>
                      {roleLabels[u.role]}
                    </span>
                  </td>
                  <td>{u.unit}</td>
                  <td>
                    <Badge tone={u.status === "Active" ? "teal" : "red"}>
                      {u.status}
                    </Badge>
                  </td>
                  <td>
                    <span className="scope-label flex items-center gap-[7px] text-xs text-[#6c8190]">
                      <Icon name="shield" size={16} />
                      This facility
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <button
                        className={buttonClasses.secondarySmall}
                        disabled={u.id === current.id}
                        onClick={() => setTarget(u)}
                      >
                        {u.status === "Active"
                          ? "Suspend access"
                          : "Restore access"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!employees.length && (
            <Empty title="No team members match this view." />
          )}
        </div>
      </section>
      {target && (
        <Dialog
          title={
            target.status === "Active"
              ? "Suspend employee access?"
              : "Restore employee access?"
          }
          subtitle={target.name}
          onClose={() => setTarget(null)}
        >
          <div className="dialog-body px-7 py-[26px] max-[760px]:p-[22px]">
            <p>
              {target.status === "Active"
                ? "This employee will be unable to use the facility workspace. Their authored history remains attributed to them."
                : "This employee will regain access under their existing role and unit."}
            </p>
            {update.isError && (
              <p className="inline-error" role="alert">
                {update.error.message}
              </p>
            )}
            <div className="dialog-actions mt-6 flex items-center justify-end gap-3 border-t border-border pt-[25px] max-[760px]:flex-wrap max-[760px]:gap-2.5">
              <button
                className={buttonClasses.secondary}
                onClick={() => setTarget(null)}
              >
                Cancel
              </button>
              <button
                className={buttonClasses.primary}
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    {
                      kind: "employees",
                      id: target.id,
                      status:
                        target.status === "Active" ? "Suspended" : "Active",
                    },
                    { onSuccess: () => setTarget(null) },
                  )
                }
              >
                Confirm{" "}
                {target.status === "Active" ? "suspension" : "restoration"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
function FacilityDetail({
  facility: f,
  count,
  onClose,
}: {
  facility: Facility;
  count: number;
  onClose: () => void;
}) {
  const mutation = useUpdateAccess();
  const [status, setStatus] = useState(f.status);
  return (
    <Dialog
      title={f.name}
      subtitle={`${f.city} · ${f.type} · Facility workspace`}
      onClose={onClose}
    >
      <div className="dialog-body px-7 py-[26px] max-[760px]:p-[22px]">
        <div className="facility-detail-header flex items-center justify-between">
          <span className="facility-monogram grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[11px] border border-[#dbe9ea] bg-[#eaf3f4] text-xs font-semibold tracking-[.5px] text-[#457c84]">{f.code}</span>
          <Badge
            tone={
              f.status === "Active"
                ? "teal"
                : f.status === "Suspended"
                  ? "red"
                  : "amber"
            }
          >
            {f.status}
          </Badge>
        </div>
        <dl className="detail-list my-[25px] grid grid-cols-2 gap-[18px] max-[760px]:grid-cols-1 max-[760px]:gap-[7px]">
          <dt>Facility administrator</dt>
          <dd>
            {f.adminName}
            <small>{f.adminEmail}</small>
          </dd>
          <dt>Configured capacity</dt>
          <dd>
            {f.beds.ICU} ICU / {f.beds.HDU} HDU beds
          </dd>
          <dt>Facility employees</dt>
          <dd>{count} accounts</dd>
          <dt>Contact email</dt>
          <dd>{f.contactEmail}</dd>
        </dl>
        <label className="form-label">
          Workspace access
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Facility["status"])}
          >
            <option>Onboarding</option>
            <option>Active</option>
            <option>Suspended</option>
          </select>
        </label>
        <p className="small muted">
          Suspension blocks facility users from signing in. Existing records and
          authored history are retained.
        </p>
        {mutation.isError && (
          <p className="inline-error" role="alert">
            {mutation.error.message}
          </p>
        )}
        <div className="dialog-actions mt-6 flex items-center justify-end gap-3 border-t border-border pt-[25px] max-[760px]:flex-wrap max-[760px]:gap-2.5">
          <button className={buttonClasses.secondary} onClick={onClose}>
            Close
          </button>
          <button
            className={buttonClasses.primary}
            disabled={mutation.isPending || status === f.status}
            onClick={() =>
              mutation.mutate(
                { kind: "facilities", id: f.id, status },
                { onSuccess: onClose },
              )
            }
          >
            Save workspace access
          </button>
        </div>
      </div>
    </Dialog>
  );
}
function UnitCards({
  facility,
  data,
  compact = false,
}: {
  facility: Facility | undefined;
  data: Directory;
  compact?: boolean;
}) {
  return (
    <section
      className={`panel unit-capacity-panel ${compact ? "compact-units" : ""}`}
    >
      <div className="panel-heading">
        <div>
          <h2>Units & bed capacity</h2>
          <p>Configured for this facility.</p>
        </div>
        <Icon name="bed" size={22} />
      </div>
      <div className="unit-capacity-grid grid grid-cols-2">
        {(["ICU", "HDU"] as const).map((unit) => (
          <article key={unit}>
            <div className="flex-between flex items-center justify-between gap-3">
              <span className="unit-name text-base font-semibold text-[#2c5367]">{unit}</span>
              <span className="unit-mark text-[#79a098]">
                <Icon name="bed" size={24} />
              </span>
            </div>
            <strong>
              {facility?.beds[unit] ?? 0}
              <span>beds</span>
            </strong>
            <p>
              {unit === "ICU" ? "Intensive care unit" : "High dependency unit"}
            </p>
            <div className="capacity-rule mt-5 mb-3.5 h-[5px] rounded-[10px] bg-[#dbebe6]" />
            <small>Capacity assigned by AHS during onboarding</small>
          </article>
        ))}
      </div>
      {!compact && (
        <div className="panel-bottom-note flex items-center gap-[9px] border-t border-[#eaf0f1] px-6 py-4 text-xs leading-[1.7] text-[#6a8390] max-[760px]:px-5 max-[760px]:text-[11px]">
          {data.summaries[0]?.patients ?? 0} active encounters across this
          facility. Detailed clinical views require a clinical team account.
        </div>
      )}
    </section>
  );
}
function AccessRoles({ platform }: { platform: boolean }) {
  const rows = [
    ["Onboard or suspend a facility", true, false, false, false, false],
    ["Manage facility employees", false, true, false, false, false],
    ["View patient clinical records", false, false, true, true, true],
    ["Create an admission", false, false, true, true, false],
    ["Update assigned care actions", false, false, true, true, true],
  ];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>CCU360 responsibility model</h2>
          <p>
            {platform
              ? "Platform oversight does not grant patient-record access."
              : "Every facility role is bound to the signed-in facility."}
          </p>
        </div>
        <Badge tone="teal">Demo policy</Badge>
      </div>
      <div className="table-scroll">
        <table className="enterprise-table role-matrix">
          <thead>
            <tr>
              <th>Responsibility</th>
              {Object.values(roleLabels).map((r) => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...allowed]) => (
              <tr key={String(label)}>
                <td>{label}</td>
                {allowed.map((yes, i) => (
                  <td key={i}>
                    {yes ? (
                      <span className="permission-yes inline-grid h-[29px] w-[29px] place-items-center rounded-full bg-[#eaf6f0] text-[#00836e]">
                        <Icon name="actions" size={18} />
                        <span className="sr-only">Allowed</span>
                      </span>
                    ) : (
                      <span className="muted" aria-label="Not allowed">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-bottom-note flex items-center gap-[9px] border-t border-[#eaf0f1] px-6 py-4 text-xs leading-[1.7] text-[#6a8390] max-[760px]:px-5 max-[760px]:text-[11px]">
        <Icon name="shield" size={18} />
        Nurses update nursing-owned actions; allied health staff update
        allied-owned actions. Doctors can coordinate all encounter actions.
        Production permissions require institution approval.
      </div>
    </section>
  );
}
