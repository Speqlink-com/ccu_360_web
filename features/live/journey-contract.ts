import { z } from "zod";
export const fieldDefinition = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum([
    "text",
    "textarea",
    "number",
    "boolean",
    "choice",
    "datetime",
    "observation_refs",
  ]),
  required: z.boolean(),
  choices: z.array(z.string()),
});
export const sectionDefinition = z.object({
  key: z.string(),
  label: z.string(),
  identity_roles: z.array(z.string()),
  role_ids: z.array(z.string()),
  enabled: z.boolean(),
  fields: z.array(fieldDefinition),
});
export const definition = z.object({
  stages: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      sections: z.array(sectionDefinition),
    }),
  ),
});
export type Definition = z.infer<typeof definition>;
export type Section = z.infer<typeof sectionDefinition>;
export const department = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  active: z.boolean(),
  version: z.number(),
});
export const teamRole = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  department_id: z.string(),
  identity_roles: z.array(z.string()),
  capabilities: z.array(z.string()),
  active: z.boolean(),
  version: z.number(),
});
export const assignment = z.object({
  id: z.string(),
  membership_id: z.string(),
  role_id: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  active: z.boolean(),
  version: z.number(),
});
export const brand = z.object({
  id: z.string(),
  title: z.string(),
  primary_color: z.string(),
  accent_color: z.string(),
  version: z.number(),
  logo_id: z.string().nullable(),
});
export const formTemplate = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  status: z.string(),
  brand_id: z.string(),
  definition,
});
export const encounter = z.object({
  id: z.string(),
  patient_id: z.string(),
  unit: z.string(),
  bed: z.string().nullable(),
  admitted_at: z.string(),
  status: z.string(),
  version: z.number(),
  head_hash: z.string(),
});
export const patient = z.object({
  id: z.string(),
  identifier: z.string(),
  display_name: z.string(),
  date_of_birth: z.string().nullable(),
});
export const caseView = z.object({
  encounter,
  patient,
  template: formTemplate,
  responsibilities: z.array(
    z.object({
      stage: z.string(),
      section: sectionDefinition,
      can_write: z.boolean(),
      can_attest: z.boolean(),
      my_team_responsibility: z.boolean(),
      coverage_gap: z.boolean(),
    }),
  ),
  care_roles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        capabilities: z.array(z.string()),
        active: z.boolean(),
      }),
    )
    .default([]),
  effective_roles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        capabilities: z.array(z.string()),
      }),
    )
    .default([]),
  current_actor: z.object({
    user_id: z.string(),
    profession: z.string(),
    duty: z.record(
      z.string(),
      z.array(z.object({ role_id: z.string().optional() }).loose()),
    ),
  }),
});
export const entry = z.object({
  id: z.string(),
  logical_id: z.string(),
  revision: z.number(),
  section_key: z.string(),
  kind: z.string(),
  status: z.string(),
  values: z.record(
    z.string(),
    z.object({
      status: z.string(),
      value: z.unknown().optional(),
      reason: z.string().nullable().optional(),
    }),
  ),
  author: z.object({
    display_name: z.string(),
    user_id: z.string(),
    team_role_name: z.string().nullable().optional(),
  }),
  recorded_at: z.string(),
  reason: z.string().nullable().optional(),
});
export const task = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  owner_role_id: z.string(),
  due_at: z.string().nullable(),
});
export const observation = z.object({
  id: z.string(),
  code: z.string(),
  value: z.object({
    status: z.string(),
    value: z.unknown().optional(),
    reason: z.string().nullable().optional(),
  }),
  unit: z.string().nullable(),
  observed_at: z.string(),
});
