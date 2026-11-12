import { z } from "zod";

export const memberRole = z.enum([
  "provider_admin",
  "doctor",
  "nurse",
  "allied",
  "receptionist",
  "auditor",
]);
export type MemberRole = z.infer<typeof memberRole>;
export const memberLabels: Record<MemberRole, string> = {
  provider_admin: "Facility administrator",
  doctor: "Doctor / clinician",
  nurse: "Nurse",
  allied: "Allied health",
  receptionist: "Reception / registration",
  auditor: "Clinical auditor",
};
export const membership = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  provider_name: z.string(),
  role: memberRole,
  status: z.string(),
  provider_status: z.string(),
});
export const identitySession = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  platform_role: z.enum(["user", "ahs_admin"]),
  status: z.enum(["invited", "active", "disabled"]),
  email_verified: z.boolean(),
  mfa_enabled: z.boolean(),
  memberships: z.array(membership),
  session_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  mfa_verified: z.boolean(),
});
export type IdentitySession = z.infer<typeof identitySession>;
export const provider = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  status: z.enum(["active", "suspended"]),
  created_at: z.string(),
});
export const directoryUser = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  email: z.string().email(),
  status: z.enum(["invited", "active", "disabled"]),
  platform_role: z.enum(["user", "ahs_admin"]),
  mfa_enabled: z.boolean(),
});
export const employee = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  email: z.string().email(),
  role: memberRole,
  status: z.enum(["invited", "active", "suspended", "revoked"]),
  user_status: z.string(),
});
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    offset: z.number().optional(),
    limit: z.number().optional(),
  });
export const message = z.object({ message: z.string() });
export const loginResult = z.discriminatedUnion("step", [
  z.object({ step: z.literal("authenticated") }),
  z.object({ step: z.literal("verify") }),
  z.object({ step: z.literal("enroll") }),
]);
export type LoginStep = z.infer<typeof loginResult>["step"];
export const sessionTokens = z.object({
  access_token: z.string().min(20).max(4096),
  refresh_token: z.string().min(32).max(256),
  expires_in: z.number().int().min(1).max(900),
});
