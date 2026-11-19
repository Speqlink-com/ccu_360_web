"use client";
import { buttonClasses } from "@/lib/presentation";
import Link from "next/link";
import { useIdentity, useLiveQuery } from "@/features/identity/queries";
import { FacilityPicker } from "@/components/auth/identity-boundary";
import { provider, pageOf } from "@/lib/api/identity-contract";
import { Heading, Panel, QueryState } from "./shared";
import dynamic from "next/dynamic";
const FacilitiesPage = dynamic(() =>
  import("./administration").then((module) => module.FacilitiesPage),
);
const AdministratorsPage = dynamic(() =>
  import("./administration").then((module) => module.AdministratorsPage),
);
const EmployeesPage = dynamic(() =>
  import("./administration").then((module) => module.EmployeesPage),
);
const AuditPage = dynamic(() =>
  import("./administration").then((module) => module.AuditPage),
);
const SecurityPage = dynamic(() =>
  import("./security-page").then((module) => module.SecurityPage),
);
const WorkforcePage = dynamic(() =>
  import("./workforce-page").then((module) => module.WorkforcePage),
);
const TemplatesPage = dynamic(() =>
  import("./templates-page").then((module) => module.TemplatesPage),
);
const WorkQueuePage = dynamic(() =>
  import("@/features/work-queue/page").then((m) => m.WorkQueuePage),
);
const ReceptionPage = dynamic(() =>
  import("@/features/reception/page").then((module) => module.ReceptionPage),
);
const PatientsPage = dynamic(() =>
  import("./patients-page").then((module) => module.PatientsPage),
);
const EncounterPage = dynamic(() =>
  import("./encounter-page").then((module) => module.EncounterPage),
);
const ConnectPage = dynamic(() =>
  import("@/features/communication/connect-page").then(
    (module) => module.ConnectPage,
  ),
);
const WorksiteSettingsPage = dynamic(() =>
  import("@/features/worksite/settings-page").then(
    (module) => module.WorksiteSettingsPage,
  ),
);

function Home() {
  const user = useIdentity().data!;
  const ahs = user.platform_role === "ahs_admin";
  const member = user.memberships.find(
    (item) => item.organization_id === user.organization_id,
  );
  const admin = member?.role === "provider_admin";
  const providers = useLiveQuery(
    user.id,
    "identity/providers?offset=0&limit=20",
    pageOf(provider),
    ahs,
  );
  if (ahs)
    return (
      <>
        <Heading
          eyebrow="AYOT HEALTH SOLUTIONS / PLATFORM"
          title={`Welcome, ${user.display_name.split(" ")[0]}.`}
          detail="Your platform workspace for facility onboarding, accountable administration and network access."
        />
        <section
          className="mb-7 grid overflow-hidden border border-teal-dark bg-teal-dark text-white lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,.75fr)]"
          aria-label="Platform overview"
        >
          <div className="px-7 py-8 sm:px-9">
            <p className="text-[11px] font-semibold tracking-[.14em] text-white/75">
              AHS PLATFORM
            </p>
            <h2 className="mt-4 max-w-[620px] text-[clamp(26px,2.5vw,36px)] leading-[1.18] font-semibold tracking-[-.035em] text-white">
              One platform. Every facility in focus.
            </h2>
            <p className="mt-4 max-w-[650px] text-sm leading-6 text-white/85">
              Independent workspaces, accountable administrators and connected
              care teams.
            </p>
          </div>
          <div className="flex flex-col justify-between border-t border-white/25 bg-navy px-7 py-7 lg:border-t-0 lg:border-l">
            <span className="h-[3px] w-8 bg-teal" aria-hidden="true" />
            <p className="mt-6 text-sm leading-6 text-white/85">
              Facility data remains within each care workspace.
            </p>
          </div>
        </section>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)]">
          <section
            aria-labelledby="platform-actions"
            className="border border-border bg-surface"
          >
            <div className="border-b border-border px-6 py-5">
              <h2
                id="platform-actions"
                className="text-[19px] font-semibold text-navy"
              >
                Platform workspaces
              </h2>
              <p className="mt-1 text-sm text-muted">
                The next step is always one clear action away.
              </p>
            </div>
            {(
              [
                [
                  "01",
                  "facilities",
                  "Onboard facilities",
                  "Create providers and invite their first administrators.",
                ],
                [
                  "02",
                  "administrators",
                  "Manage AHS accounts",
                  "Give each platform administrator their own secure identity.",
                ],
                [
                  "03",
                  "audit",
                  "Review accountability",
                  "Inspect access events and email delivery status.",
                ],
              ] as const
            ).map(([number, path, title, detail]) => (
              <Link
                key={path}
                href={`/dashboard/${path}`}
                className="group grid grid-cols-[34px_minmax(0,1fr)_20px] items-center gap-4 border-b border-border px-6 py-5 last:border-b-0 hover:bg-mint/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-dark"
              >
                <span className="self-start pt-0.5 text-xs font-semibold tabular-nums text-teal-dark">
                  {number}
                </span>
                <span className="min-w-0">
                  <strong className="block text-[15px] font-semibold text-navy">
                    {title}
                  </strong>
                  <span className="mt-1 block text-sm leading-5 text-muted">
                    {detail}
                  </span>
                </span>
                <span
                  className="text-lg text-teal-dark transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            ))}
          </section>
          <section
            aria-labelledby="platform-network"
            className="border border-border bg-surface px-6 py-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[.12em] text-teal-dark">
                  NETWORK
                </p>
                <h2
                  id="platform-network"
                  className="mt-2 text-[19px] font-semibold text-navy"
                >
                  Your facility network
                </h2>
              </div>
            </div>
            <QueryState query={providers} />
            {providers.data && (
              <p className="text-sm leading-6 text-muted">
                {providers.data.items.length
                  ? `${providers.data.items.length} facilities on the first directory page. Open Facilities to browse and manage the full network.`
                  : "No facilities have been onboarded yet. Start by creating your first facility."}
              </p>
            )}
            <Link
              href="/dashboard/facilities"
              className="mt-5 inline-flex min-h-10 items-center border-b border-teal-dark text-sm font-semibold text-teal-dark hover:text-navy focus-visible:outline-2 focus-visible:outline-teal-dark"
            >
              Open facility directory{" "}
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </Link>
          </section>
        </div>
      </>
    );
  return (
    <>
      <Heading
        title={`Welcome, ${user.display_name.split(" ")[0]}.`}
        detail={
          ahs
            ? "Your platform workspace for facility onboarding, accountable administration and network access."
            : `${member?.provider_name ?? "Your facility"} · An independent workspace for your people and their responsibilities.`
        }
      />
      <div className="live-welcome">
        <div>
          <p className="eyebrow">{ahs ? "AHS PLATFORM" : "YOUR FACILITY"}</p>
          <h2>
            {ahs
              ? "Build a connected care network."
              : admin
                ? "Put the right people around every patient."
                : "Continue the patient’s story."}
          </h2>
          <p>
            {ahs
              ? "Onboard a facility, invite its administrator, and keep each provider’s team and patient information separate."
              : admin
                ? "Invite employees, define department roles, assign coverage, and publish your facility’s journey form."
                : "Your active care-team assignments determine the journeys you can read and the sections you can document."}
          </p>
        </div>
        <div className="live-welcome-mark">
          360<span>Connected care</span>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {(ahs
          ? [
              [
                "facilities",
                "Onboard facilities",
                "Create providers and invite their first administrators.",
              ],
              [
                "administrators",
                "Manage AHS accounts",
                "Give each platform administrator their own secure identity.",
              ],
              [
                "audit",
                "Review accountability",
                "Inspect access events and email delivery status.",
              ],
            ]
          : admin
            ? [
                [
                  "employees",
                  "Invite your employees",
                  "Individual accounts for administrators, clinicians, nurses and support teams.",
                ],
                [
                  "workforce",
                  "Organize care teams",
                  "Department roles and dated assignments keep shifts and absences covered.",
                ],
                [
                  "templates",
                  "Prepare journey forms",
                  "Add your logo, professional responsibilities and custom fields.",
                ],
              ]
            : [
                [
                  "patients",
                  "Open patient journeys",
                  "Find your team’s assigned journeys and record your part of care.",
                ],
                [
                  "security",
                  "Manage your account",
                  "Review your profile, password and active sessions.",
                ],
              ]
        ).map(([path, title, detail]) => (
          <Link
            className="block rounded-xl border border-border bg-surface p-6 hover:border-teal"
            key={path}
            href={`/dashboard/${path}`}
          >
            <h3 className="mb-3 text-[19px] text-navy">{title}</h3>
            <p className="mb-5 min-h-[60px] text-muted">{detail}</p>
            <span className="text-[13px] font-semibold text-teal-dark">
              Open workspace →
            </span>
          </Link>
        ))}
      </div>
      {ahs && (
        <Panel title="Your facility network">
          <QueryState query={providers} />
          {providers.data && (
            <p>
              {providers.data.items.length
                ? `${providers.data.items.length} facilities on the first directory page. Open Facilities to browse and manage the full network.`
                : "No facilities have been onboarded yet. Start by creating your first facility."}
            </p>
          )}
        </Panel>
      )}
      {!ahs &&
        user.memberships.filter(
          (item) =>
            item.status === "active" && item.provider_status === "active",
        ).length > 1 && (
          <Panel title="Work at another facility">
            <FacilityPicker user={user} />
          </Panel>
        )}
    </>
  );
}
export function LivePage({
  section = "home",
  encounterId,
}: {
  section?: string;
  encounterId?: string;
}) {
  const user = useIdentity().data;
  if (!user) return null;
  if (section === "security") return <SecurityPage />;
  if (user.platform_role === "ahs_admin") {
    if (encounterId) return <Denied />;
    if (section === "home" && !encounterId) return <Home />;
    if (section === "facilities") return <FacilitiesPage />;
    if (section === "administrators") return <AdministratorsPage />;
    if (section === "audit") return <AuditPage />;
    return <Denied />;
  }
  const member = user.memberships.find(
    (item) =>
      item.organization_id === user.organization_id &&
      item.status === "active" &&
      item.provider_status === "active",
  );
  if (!member) return <FacilityPicker user={user} />;
  if (section === "connect") return <ConnectPage />;
  if (section === "home" && !encounterId) return <Home />;
  if (member.role === "provider_admin") {
    if (encounterId) return <Denied />;
    if (section === "employees") return <EmployeesPage />;
    if (section === "workforce") return <WorkforcePage />;
    if (section === "templates") return <TemplatesPage />;
    if (section === "audit") return <AuditPage />;
    if (section === "worksite") return <WorksiteSettingsPage />;
    return <Denied />;
  }
  if (encounterId) return <EncounterPage id={encounterId} />;
  if (
    (section === "patients" || section === "reception") &&
    member.role === "receptionist"
  )
    return <ReceptionPage />;
  if (section === "patients") return <PatientsPage />;
  if (section === "queue") return <WorkQueuePage />;
  return <Denied />;
}
function Denied() {
  return (
    <div className="access-denied px-5 py-[60px]">
      <h1>This area requires a different role.</h1>
      <p>
        Your account keeps the access assigned by your facility or AHS
        administrator.
      </p>
      <Link className={buttonClasses.primary} href="/dashboard">
        Return to my workspace
      </Link>
    </div>
  );
}
