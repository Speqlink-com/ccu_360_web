import { z } from "zod";

export const observationSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  unit: z.string(),
  source: z.string(),
  observedAt: z.string().datetime(),
  state: z.enum(["verified", "unverified", "stale", "missing", "conflict"]),
});
export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  mrn: z.string(),
  age: z.number(),
  sex: z.string(),
  bed: z.string(),
  unit: z.enum(["ICU", "HDU"]),
  day: z.number(),
  concern: z.string(),
  support: z.string(),
  review: z.enum(["Due", "In progress", "Complete"]),
  observations: z.array(observationSchema),
});
export const actionStatusSchema = z.enum(["open", "in_progress", "completed"]);
export type ActionStatus = z.infer<typeof actionStatusSchema>;
export const actionSchema = z.object({
  id: z.string(),
  encounterId: z.string(),
  title: z.string(),
  owner: z.string(),
  ownerRole: z.enum(["doctor", "nurse", "allied_health"]),
  due: z.string(),
  overdue: z.boolean(),
  status: actionStatusSchema,
  source: z.string(),
  version: z.number().int().positive(),
  history: z.array(
    z.object({
      status: actionStatusSchema,
      actor: z.string(),
      at: z.string().datetime(),
    }),
  ),
});
export const consultationSchema = z.object({
  id: z.string(),
  encounterId: z.string(),
  service: z.string(),
  question: z.string(),
  requester: z.string(),
  status: z.enum(["Sent", "Acknowledged", "Accepted", "Reviewed"]),
  time: z.string(),
  eta: z.string(),
});
export const workspaceSchema = z.object({
  patients: z.array(patientSchema),
  actions: z.array(actionSchema),
  consultations: z.array(consultationSchema),
  capacity: z.object({ ICU: z.number(), HDU: z.number() }),
});
export type Patient = z.infer<typeof patientSchema>;
export type ClinicalAction = z.infer<typeof actionSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export const transitions: Record<ActionStatus, readonly ActionStatus[]> = {
  open: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

export function transitionAction(
  action: ClinicalAction,
  next: ActionStatus,
  expectedVersion: number,
  actor: string,
  at: string,
): ClinicalAction {
  if (action.version !== expectedVersion)
    throw new Error(
      "This action changed. Refresh the workspace before trying again.",
    );
  if (!transitions[action.status].includes(next))
    throw new Error("This action transition is not permitted.");
  return actionSchema.parse({
    ...action,
    status: next,
    version: action.version + 1,
    history: [...action.history, { status: next, actor, at }],
  });
}
