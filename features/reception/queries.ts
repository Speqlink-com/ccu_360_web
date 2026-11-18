"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useIdentity } from "@/features/identity/queries";
import {
  pageOf,
  patientProfile,
  visit,
  type PatientFilter,
  type QueueFilter,
} from "./contracts";
function useScopedPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  enabled: boolean,
  interval: number | false = false,
) {
  const identity = useIdentity().data;
  const result = useQuery({
    queryKey: [
      "live",
      identity?.organization_id,
      identity?.id,
      "reception",
      path,
      body,
    ],
    enabled: enabled && !!identity,
    queryFn: ({ signal }) =>
      apiRequest("/api/v1/journey/reception/" + path, schema, {
        method: "POST",
        body,
        signal,
      }),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: interval,
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
export function usePatientSearch(filter: PatientFilter, enabled = true) {
  return useScopedPost(
    "patients/search",
    filter,
    pageOf(patientProfile),
    enabled,
  );
}
export function useArrivals(filter: QueueFilter, enabled = true) {
  return useScopedPost(
    "arrivals/search",
    filter,
    pageOf(z.object({ visit, patient: patientProfile })),
    enabled,
    30_000,
  );
}
export function useReceptionMutation<T>(
  schema: z.ZodType<T>,
  onSuccess?: (value: T) => void,
) {
  const identity = useIdentity().data;
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      body,
      method = "POST",
    }: {
      path: string;
      body: unknown;
      method?: "POST" | "PATCH";
    }) =>
      apiRequest("/api/v1/journey/reception/" + path, schema, { method, body }),
    onSuccess: async (result) => {
      await client.invalidateQueries({
        queryKey: ["live", identity?.organization_id],
      });
      onSuccess?.(result);
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.outcomeUnknown)
      )
        await client.invalidateQueries({
          queryKey: ["live", identity?.organization_id],
        });
    },
  });
}
