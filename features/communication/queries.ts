"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useMemo } from "react";
import { useIdentity } from "@/features/identity/queries";
import { useFacilityAccess } from "@/features/worksite/access-provider";
import { apiRequest, ApiError } from "@/lib/api/client";
import { historyPage } from "./contract";
export function useCommunicationScope() {
  const user = useIdentity().data!;
  const key = useMemo(
    () => ["communication", user.organization_id, user.id] as const,
    [user.organization_id, user.id],
  );
  return {
    user,
    member: user.memberships.find(
      (item) => item.organization_id === user.organization_id,
    ),
    key,
  };
}
export function useCommunicationQuery<T>(
  resource: string,
  schema: z.ZodType<T>,
  enabled = true,
) {
  const { user, key } = useCommunicationScope();
  const access = useFacilityAccess();
  const result = useQuery({
    queryKey: [...key, resource],
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/communication/${resource}`, schema, { signal }),
    enabled:
      enabled && !!user.organization_id && access.allowed && access.foreground,
    staleTime: 5_000,
    gcTime: 0,
    refetchInterval: 15_000,
    retry: false,
  });
  return {
    ...result,
    data:
      result.error instanceof ApiError &&
      [401, 403, 404].includes(result.error.status)
        ? undefined
        : result.data,
  };
}
export function useHistory(id: string) {
  const { key } = useCommunicationScope();
  const access = useFacilityAccess();
  const result = useInfiniteQuery({
    queryKey: [...key, `conversations/${id}/messages`],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ signal, pageParam }) =>
      apiRequest(
        `/api/v1/communication/conversations/${id}/messages?limit=50${pageParam ? `&before_sequence=${pageParam}` : ""}`,
        historyPage,
        { signal },
      ),
    getNextPageParam: (last) => last.next_before_sequence ?? undefined,
    enabled: access.allowed && access.foreground,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15_000,
    // Keep a bounded history window; users can reopen the conversation to return to its latest messages.
    maxPages: 10,
    retry: false,
  });
  return {
    ...result,
    data:
      result.error instanceof ApiError &&
      [401, 403, 404].includes(result.error.status)
        ? undefined
        : result.data,
  };
}
