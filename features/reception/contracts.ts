import { z } from "zod";
export const patientProfile = z.object({
  id: z.string(),
  identifier: z.string(),
  ip_number: z.string(),
  ccu360_number: z.string().regex(/^[0-9]{6}$/),
  display_name: z.string(),
  date_of_birth: z.string().nullable(),
  sex: z.enum(["female", "male", "intersex", "unknown"]),
  phone: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  legacy_ip_review_required: z.boolean(),
});
export type PatientProfile = z.infer<typeof patientProfile>;
export const journeySummary = z.object({
  id: z.string(),
  name: z.string(),
  template_version: z.number(),
  status: z.string(),
  started_at: z.string(),
  can_open: z.boolean(),
});
export const visit = z.object({
  id: z.string(),
  patient_id: z.string(),
  arrival_source: z.enum(["walk_in", "referral"]),
  registration_type: z.enum(["new", "returning"]),
  arrived_at: z.string(),
  recorded_at: z.string(),
  referring_facility: z.string().nullable(),
  referral_reference: z.string().nullable(),
  intake_note: z.string().nullable(),
  patient_snapshot: z.object({
    display_name: z.string(),
    ip_number: z.string(),
    ccu360_number: z.string(),
  }),
  cancellation: z
    .object({
      reason: z.string(),
      recorded_at: z.string(),
      recorded_by: z.string(),
    })
    .nullable()
    .default(null),
  status: z.enum(["waiting_form", "active", "closed", "cancelled"]),
  journeys: z.array(journeySummary),
});
export type Visit = z.infer<typeof visit>;
export const visitResult = z.object({ visit, patient: patientProfile });
export const profileResult = z.object({
  patient: patientProfile,
  ip_history: z.array(z.string()),
  visit_count: z.number(),
  journey_count: z.number(),
});
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
  });
export const receptionAccess = z.object({
  can_register: z.boolean(),
  can_start_journey: z.boolean(),
});
export const publishedForm = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  can_initiate: z.boolean(),
});
export const demographicRevision = z.object({
  id: z.string(),
  version: z.number(),
  data: z.object({
    display_name: z.string(),
    ip_number: z.string(),
    ccu360_number: z.string(),
    date_of_birth: z.string().nullable(),
    phone: z.string().nullable(),
    sex: z.string(),
  }),
  reason: z.string(),
  recorded_at: z.string(),
  actor_id: z.string(),
  record_hash: z.string(),
});
export type PatientFilter = {
  timezone?: string;
  query: string;
  search_by: "any" | "name" | "ip_number" | "ccu360_number";
  sex?: string;
  registered_from?: string;
  registered_to?: string;
  offset: number;
  limit: number;
};
export type QueueFilter = PatientFilter & {
  arrival_source?: string;
  registration_type?: string;
  status?: string;
  arrived_from?: string;
  arrived_to?: string;
};
export const emptyFilter: PatientFilter = {
  query: "",
  search_by: "any",
  offset: 0,
  limit: 20,
};
export const visitLabels = {
  waiting_form: "Awaiting journey form",
  active: "Journey active",
  closed: "Journey closed",
  cancelled: "Arrival cancelled",
};
