"use client";
import { useEffect, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useIdentity } from "@/features/identity/queries";
import {
  apiRequest,
  ApiError,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import type { IdentitySession } from "@/lib/api/identity-contract";
import type { SessionView, Role } from "@/lib/domain/identity";
import { SessionProvider } from "@/providers/session-provider";
import { useServices, useIdentityUI } from "@/providers/app-provider";
import { WorkspaceShell } from "@/components/workspace/shell";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";

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
export function FacilityPicker({ user }: { user: IdentitySession }) {
  const selected = useIdentityUI((state) => state.pendingOrganization);
  const select = useIdentityUI((state) => state.selectOrganization);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(
        "/api/v1/auth/switch-organization",
        z.object({ organization_id: z.string().uuid() }),
        { method: "POST", body: { organization_id: id } },
      ),
    onSuccess: async () => {
      await client.cancelQueries();
      client.clear();
      notifyIdentityChange("tenant");
      replaceIdentityLocation("/dashboard");
    },
  });
  const available = user.memberships.filter(
    (item) => item.status === "active" && item.provider_status === "active",
  );
  return (
    <div className="facility-picker">
      <h1>Choose your facility</h1>
      <p>Each facility has an independent workspace and access policy.</p>
      <label htmlFor="facility-select">Facility</label>
      <select
        id="facility-select"
        value={selected ?? ""}
        onChange={(event) => select(event.target.value)}
      >
        <option value="">Select a facility</option>
        {available.map((item) => (
          <option value={item.organization_id} key={item.id}>
            {item.provider_name} · {item.role.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {!available.length && (
        <p role="status">
          No active facility access is available. Contact your administrator.
        </p>
      )}
      {mutation.error && (
        <p className="inline-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={!selected || mutation.isPending}
        onClick={() => selected && mutation.mutate(selected)}
      >
        {mutation.isPending ? "Opening…" : "Open facility workspace"}
      </button>
      <Link href="/dashboard/security">Manage your account</Link>
    </div>
  );
}
export function IdentityBoundary({ children }: { children: ReactNode }) {
  const query = useIdentity();
  const client = useQueryClient();
  const services = useServices();
  useEffect(() => {
    const leave = () => {
      void client.cancelQueries();
      client.clear();
      services.identity.getState().reset();
      services.ui.setState({ unit: "All units", mobileOpen: false });
      replaceIdentityLocation("/");
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("ccu360-identity")
        : null;
    const change = (event: MessageEvent) => {
      if (["logout", "tenant", "login"].includes(event.data)) {
        void client.cancelQueries();
        client.clear();
        replaceIdentityLocation(event.data === "logout" ? "/" : "/dashboard");
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
      replaceIdentityLocation("/");
    }
  }, [query.error, client]);
  if (query.isPending)
    return (
      <div className="identity-loading" role="status">
        <Brand />
        <h1>Opening your secure workspace…</h1>
      </div>
    );
  if (!query.data)
    return (
      <div className="identity-loading">
        <h1>We couldn’t verify your session.</h1>
        <p role="alert">{query.error?.message}</p>
        <button className="btn btn-primary" onClick={() => query.refetch()}>
          Try again
        </button>
        <Link href="/">Back to sign in</Link>
      </div>
    );
  return (
    <SessionProvider session={shellSession(query.data)}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </SessionProvider>
  );
}
