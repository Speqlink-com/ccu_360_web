"use client";
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
const PatientsPage = dynamic(() =>
  import("./patients-page").then((module) => module.PatientsPage),
);
const EncounterPage = dynamic(() =>
  import("./encounter-page").then((module) => module.EncounterPage),
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
      <div className="live-shortcuts">
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
            className="live-shortcut"
            key={path}
            href={`/dashboard/${path}`}
          >
            <h3>{title}</h3>
            <p>{detail}</p>
            <span>Open workspace →</span>
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
  if (section === "home" && !encounterId) return <Home />;
  if (member.role === "provider_admin") {
    if (encounterId) return <Denied />;
    if (section === "employees") return <EmployeesPage />;
    if (section === "workforce") return <WorkforcePage />;
    if (section === "templates") return <TemplatesPage />;
    if (section === "audit") return <AuditPage />;
    return <Denied />;
  }
  if (encounterId)
    return member.role === "receptionist" ? (
      <Denied />
    ) : (
      <EncounterPage id={encounterId} />
    );
  if (section === "patients") return <PatientsPage />;
  return <Denied />;
}
function Denied() {
  return (
    <div className="access-denied">
      <h1>This area requires a different role.</h1>
      <p>
        Your account keeps the access assigned by your facility or AHS
        administrator.
      </p>
      <Link className="btn btn-primary" href="/dashboard">
        Return to my workspace
      </Link>
    </div>
  );
}
