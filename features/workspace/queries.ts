"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/providers/session-provider";
import { isDemo } from "@/lib/config";
import { isClinicalRole } from "@/lib/domain/identity";
import {
  actionSchema,
  workspaceSchema,
  type ActionStatus,
} from "@/lib/domain/workspace";
import { demoRequest } from "@/lib/api/demo-client";
export function useWorkspace() {
  const session = useSession();
  return useQuery({
    queryKey: ["workspace", session?.user.facilityId, session?.user.id],
    queryFn: ({ signal }) =>
      demoRequest("workspace", workspaceSchema, { signal }),
    enabled: isDemo && isClinicalRole(session?.user.role),
  });
}
export function useTransitionAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      next,
      version,
    }: {
      id: string;
      next: ActionStatus;
      version: number;
    }) =>
      demoRequest("transitions", actionSchema, {
        method: "POST",
        body: { id, next, version },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["workspace"] });
      client.invalidateQueries({ queryKey: ["directory"] });
    },
  });
}
