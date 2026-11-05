"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  directorySchema,
  facilitySchema,
  userSchema,
  type Facility,
  type User,
} from "@/lib/domain/identity";
import { demoRequest } from "@/lib/api/demo-client";
import { useSession } from "@/providers/session-provider";
const provisionSchema = z.object({
  user: userSchema,
  temporaryPassword: z.string(),
});
export function useDirectory() {
  const session = useSession();
  return useQuery({
    queryKey: ["directory", session?.user.facilityId, session?.user.id],
    queryFn: ({ signal }) =>
      demoRequest("directory", directorySchema, { signal }),
    enabled: !!session,
  });
}
export function useProvision(kind: "facilities" | "employees") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      demoRequest(
        kind,
        kind === "facilities"
          ? provisionSchema.extend({ facility: facilitySchema })
          : provisionSchema,
        { method: "POST", body },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["directory"] }),
  });
}
export function useUpdateAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { kind: "facilities"; id: string; status: Facility["status"] }
        | { kind: "employees"; id: string; status: User["status"] },
    ): Promise<Facility | User> =>
      input.kind === "facilities"
        ? demoRequest("facilities", facilitySchema, {
            method: "PATCH",
            body: input,
          })
        : demoRequest("employees", userSchema, {
            method: "PATCH",
            body: input,
          }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["directory"] }),
  });
}
