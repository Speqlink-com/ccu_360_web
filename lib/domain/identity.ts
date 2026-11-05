import { z } from "zod";
export const roleSchema = z.enum([
  "ahs_admin",
  "facility_admin",
  "doctor",
  "nurse",
  "allied_health",
]);
export type Role = z.infer<typeof roleSchema>;
export const roleLabels: Record<Role, string> = {
  ahs_admin: "AHS administrator",
  facility_admin: "Facility administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  allied_health: "Allied health professional",
};
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  facilityId: z.string().nullable(),
  unit: z.string(),
  status: z.enum(["Active", "Suspended"]),
  joinedAt: z.string(),
});
export type User = z.infer<typeof userSchema>;
export const facilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  city: z.string(),
  type: z.enum(["Hospital", "Medical centre"]),
  status: z.enum(["Active", "Onboarding", "Suspended"]),
  contactEmail: z.string().email(),
  adminName: z.string(),
  adminEmail: z.string().email(),
  beds: z.object({
    ICU: z.number().int().nonnegative(),
    HDU: z.number().int().nonnegative(),
  }),
  createdAt: z.string(),
});
export type Facility = z.infer<typeof facilitySchema>;
export const sessionSchema = z.object({
  user: userSchema,
  facility: facilitySchema.nullable(),
});
export type SessionView = z.infer<typeof sessionSchema>;
export const activitySchema = z.object({
  id: z.string(),
  facilityId: z.string().nullable(),
  title: z.string(),
  detail: z.string(),
  actor: z.string(),
  at: z.string(),
});
export const directorySchema = z.object({
  facilities: z.array(facilitySchema),
  employees: z.array(userSchema),
  activity: z.array(activitySchema),
  summaries: z.array(
    z.object({
      facilityId: z.string(),
      patients: z.number(),
      openActions: z.number(),
    }),
  ),
});
export type Directory = z.infer<typeof directorySchema>;
export const isClinicalRole = (role?: Role) =>
  role === "doctor" || role === "nurse" || role === "allied_health";
export const canManageEmployees = (role?: Role) => role === "facility_admin";
export const canAdmit = (role?: Role) => role === "doctor" || role === "nurse";
export function canWorkAction(
  role: Role | undefined,
  ownerRole: "doctor" | "nurse" | "allied_health",
) {
  return (
    role === "doctor" ||
    (role === "nurse" && ownerRole === "nurse") ||
    (role === "allied_health" && ownerRole === "allied_health")
  );
}
export const employeeInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  role: roleSchema.exclude(["ahs_admin"]),
  unit: z.enum(["All units", "ICU", "HDU"]),
});
export const facilityInputSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    city: z.string().trim().min(2).max(80),
    type: z.enum(["Hospital", "Medical centre"]),
    contactEmail: z.string().trim().email(),
    adminName: z.string().trim().min(2).max(100),
    adminEmail: z.string().trim().email(),
    icuBeds: z.coerce.number().int().min(0).max(500),
    hduBeds: z.coerce.number().int().min(0).max(500),
  })
  .refine((v) => v.icuBeds + v.hduBeds > 0, {
    message: "Configure at least one bed.",
  });
export const admissionInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mrn: z.string().trim().min(2).max(50),
  age: z.coerce.number().int().min(0).max(130),
  sex: z.enum(["F", "M", "Unknown"]),
  unit: z.enum(["ICU", "HDU"]),
  bed: z.string().regex(/^\d{1,3}$/, "Use a numbered bed."),
});
