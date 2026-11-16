"use client";
import { RequestError } from "@/components/ui/request-error";
import { buttonClasses } from "@/lib/presentation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Link from "next/link";
import {
  apiRequest,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import type { IdentitySession } from "@/lib/api/identity-contract";
import { useIdentityUI } from "@/providers/app-provider";

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
    <div className="facility-picker mx-auto my-6 flex max-w-[640px] flex-col gap-4.5 rounded-[14px] border border-border bg-surface p-8 max-[760px]:p-6">
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
      <RequestError error={mutation.error} />
      <button
        className={buttonClasses.primary}
        disabled={!selected || mutation.isPending}
        onClick={() => selected && mutation.mutate(selected)}
      >
        {mutation.isPending ? "Opening…" : "Open facility workspace"}
      </button>
      <Link href="/dashboard/security">Manage your account</Link>
    </div>
  );
}
