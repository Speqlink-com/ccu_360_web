import { z } from "zod";
export const site = z.object({
  id: z.string().uuid(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radius_meters: z.number(),
  active: z.boolean(),
  version: z.number(),
});
export const network = z.object({
  id: z.string().uuid(),
  name: z.string(),
  cidr: z.string(),
  active: z.boolean(),
  version: z.number(),
});
export const policy = z.object({
  enabled: z.boolean(),
  grant_seconds: z.number(),
  max_accuracy_meters: z.number(),
  version: z.number(),
});
export const observation = z.object({
  source: z.string(),
  verification: z.string().optional(),
  reason: z.string().optional(),
  support_reference: z.string().nullable().optional(),
  trusted_network: z
    .object({ id: z.string().uuid(), name: z.string() })
    .nullable(),
});
export const worksiteStatus = z.object({
  exempt: z.boolean(),
  required: z.boolean(),
  allowed: z.boolean(),
  expires_at: z.string().nullable().optional(),
  policy_version: z.number().optional(),
  sites: z.array(site).optional(),
  network: observation.optional(),
});
export const challenge = z.object({
  challenge_token: z.string(),
  expires_at: z.string(),
});
export const grant = z.object({
  allowed: z.boolean(),
  expires_at: z.string(),
  site_id: z.string().uuid(),
  policy_version: z.number(),
  network: observation,
});
export type WorksiteStatus = z.infer<typeof worksiteStatus>;
export type Site = z.infer<typeof site>;
export type NetworkObservation = z.infer<typeof observation>;
export function connectionNotice(network?: NetworkObservation) {
  if (
    network?.source === "unverified_gateway" ||
    network?.verification === "unverified"
  )
    return "Connection recognition is temporarily unavailable. You can still verify your location using any internet connection.";
  if (network?.trusted_network)
    return `Registered connection: ${network.trusted_network.name}. Location verification is still required.`;
  return null;
}
export function hasLocationAccess(
  status: WorksiteStatus | undefined,
  now: number,
) {
  if (!status) return false;
  if (status.exempt || !status.required) return status.allowed;
  return (
    status.allowed && !!status.expires_at && Date.parse(status.expires_at) > now
  );
}
