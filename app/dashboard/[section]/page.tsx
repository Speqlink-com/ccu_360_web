import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspacePage } from "@/features/workspace/workspace-page";
import {
  AdministrationPage,
  type AdminSection,
} from "@/features/administration/administration-page";
import { currentDemoSession } from "@/lib/server/demo";
import { allowedSection } from "@/lib/navigation";
const clinicalSections = [
  "patients",
  "actions",
  "connect",
  "handover",
] as const;
const adminSections = [
  "facilities",
  "employees",
  "team",
  "units",
  "access",
] as const;
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (![...clinicalSections, ...adminSections].includes(section as never))
    notFound();
  const session = await currentDemoSession();
  if (session && !allowedSection(session.user.role, section))
    return (
      <div className="access-denied">
        <p className="eyebrow">ROLE-BASED WORKSPACE</p>
        <h1>This area belongs to another role.</h1>
        <p>
          Your account has access to the workspace and responsibilities assigned
          to it.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to my workspace
        </Link>
      </div>
    );
  if (adminSections.includes(section as never))
    return <AdministrationPage section={section as AdminSection} />;
  return (
    <WorkspacePage section={section as (typeof clinicalSections)[number]} />
  );
}
