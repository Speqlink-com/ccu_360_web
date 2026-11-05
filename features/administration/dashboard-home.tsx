"use client";
import { useSession } from "@/providers/session-provider";
import { AdministrationPage } from "./administration-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";
export function DashboardHome() {
  const session = useSession();
  return session?.user.role === "ahs_admin" ||
    session?.user.role === "facility_admin" ? (
    <AdministrationPage section="overview" />
  ) : (
    <WorkspacePage section="overview" />
  );
}
