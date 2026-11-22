"use client";
import { buttonClasses } from "@/lib/presentation";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/features/identity/queries";
import { ApiError, replaceIdentityLocation } from "@/lib/api/client";
import type { IdentitySession } from "@/lib/api/identity-contract";
import type { SessionView, Role } from "@/lib/domain/identity";
import { SessionProvider } from "@/providers/session-provider";
import { useServices } from "@/providers/app-provider";
import { WorkspaceShell } from "@/components/workspace/shell";
import Link from "next/link";
import { CCU360Loader } from "@/components/ui/ccu-loader";
import {
  WorksiteAccessProvider,
  WorksiteBoundary,
} from "@/features/worksite/access-provider";
import { RealtimeProvider } from "@/features/communication/realtime-provider";

function shellSession(user: IdentitySession): SessionView {
  const member = user.memberships.find(
    (item) =>
      item.organization_id === user.organization_id &&
      item.status === "active" &&
      item.provider_status === "active",
  );
  const role: Role =
    user.platform_role === "ahs_admin"
      ? "ahs_admin"
      : member?.role === "provider_admin"
        ? "facility_admin"
        : member?.role === "allied"
          ? "allied_health"
          : (member?.role ?? "doctor");
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role,
      facilityId: member?.organization_id ?? null,
      unit: "All units",
      status: "Active",
      joinedAt: "",
    },
    facility: member
      ? {
          id: member.organization_id,
          name: member.provider_name,
          code: "",
          city: "Facility workspace",
          type: "Hospital",
          status: "Active",
          contactEmail: user.email,
          adminEmail: "",
          adminName: "",
          beds: { ICU: 0, HDU: 0 },
          createdAt: "",
        }
      : null,
  };
}
export { FacilityPicker } from "./facility-picker";
export function IdentityBoundary({ children }: { children: ReactNode }) {
  const query = useIdentity();
  const client = useQueryClient();
  const services = useServices();
  useEffect(() => {
    const leave = () => {
      void client.cancelQueries();
      client.clear();
      services.identity.getState().reset();
      services.communication.getState().reset();
      services.ui.setState({ unit: "All units", mobileOpen: false });
      replaceIdentityLocation("/auth/signin");
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("ccu360-identity")
        : null;
    const change = (event: MessageEvent) => {
      if (["logout", "tenant", "login"].includes(event.data)) {
        void client.cancelQueries();
        client.clear();
        replaceIdentityLocation(event.data === "logout" ? "/auth/signin" : "/dashboard");
      }
    };
    channel?.addEventListener("message", change);
    window.addEventListener("ccu360-session-expired", leave);
    return () => {
      channel?.close();
      window.removeEventListener("ccu360-session-expired", leave);
    };
  }, [client, services]);
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      client.clear();
      replaceIdentityLocation("/auth/signin");
    }
  }, [query.error, client]);
  if (query.isPending) return <CCU360Loader variant="page" />;
  if (!query.data)
    return (
      <div className="identity-loading flex min-h-[80vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <h1>We couldn’t verify your session.</h1>
        <p role="alert">{query.error?.message}</p>
        <button className={buttonClasses.primary} onClick={() => query.refetch()}>
          Try again
        </button>
        <Link href="/auth/signin">Back to sign in</Link>
      </div>
    );
  return (
    <SessionProvider session={shellSession(query.data)}>
      <WorksiteAccessProvider>
        <RealtimeProvider>
          <WorkspaceShell>
            <WorksiteBoundary>{children}</WorksiteBoundary>
          </WorkspaceShell>
        </RealtimeProvider>
      </WorksiteAccessProvider>
    </SessionProvider>
  );
}
