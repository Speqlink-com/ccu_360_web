"use client";
import { buttonClasses } from "@/lib/presentation";
import Link from "next/link";
import { useIdentity } from "@/features/identity/queries";
import { FacilityPicker } from "@/components/auth/identity-boundary";
import dynamic from "next/dynamic";
import { OverviewPage } from "@/features/dashboard/overview-page";
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
    if (section === "home" && !encounterId) return <OverviewPage />;
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
  if (section === "home" && !encounterId) return <OverviewPage />;
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
