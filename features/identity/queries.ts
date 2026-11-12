"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import { identitySession } from "@/lib/api/identity-contract";
export const identityKey = ["identity", "session"] as const;
export function useIdentity() {
  const result = useQuery({
    queryKey: identityKey,
    queryFn: ({ signal }) =>
      apiRequest("/api/v1/auth/me", identitySession, { signal }),
    staleTime: 15_000,
    gcTime: 0,
    retry: false,
  });
  return {
    ...result,
    data:
      result.error instanceof ApiError &&
      [401, 403].includes(result.error.status)
        ? undefined
        : result.data,
  };
}
export function useLiveQuery<T>(
  scope: string | null,
  path: string,
  schema: z.ZodType<T>,
  enabled = true,
) {
  const identity = useIdentity().data;
  const result = useQuery({
    queryKey: ["live", scope, identity?.id, path],
    queryFn: ({ signal }) => apiRequest("/api/v1/" + path, schema, { signal }),
    enabled: enabled && !!identity,
    staleTime: 15_000,
    gcTime: 60_000,
  });
  return {
    ...result,
    data:
      result.error instanceof ApiError &&
      [401, 403].includes(result.error.status)
        ? undefined
        : result.data,
  };
}
export function useLiveMutation<T>(
  scope: string | null,
  path: string,
  schema: z.ZodType<T>,
  method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest("/api/v1/" + path, schema, { method, body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["live", scope] });
    },
    onError: async (error) => {
      if ("status" in error && error.status === 409)
        await client.invalidateQueries({ queryKey: ["live", scope] });
    },
  });
}
export async function finishSignOut(client: ReturnType<typeof useQueryClient>) {
  await client.cancelQueries();
  client.clear();
  notifyIdentityChange("logout");
  replaceIdentityLocation("/");
}
