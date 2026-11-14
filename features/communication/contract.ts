import { z } from "zod";
const id = z.string().uuid();
export const colleague = z.object({
  membership_id: id,
  display_name: z.string(),
  email: z.string(),
  profession: z.string(),
});
export const conversation = z.object({
  id,
  kind: z.enum(["direct", "group"]),
  title: z.string().nullable(),
  encounter_id: id.nullable(),
  last_sequence: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  role: z.enum(["owner", "member"]),
  visible_from_sequence: z.number(),
  last_read_sequence: z.number(),
  unread_count: z.number().optional(),
});
export const conversationPage = z.object({
  items: z.array(conversation),
  offset: z.number(),
  limit: z.number(),
  scanned: z.number(),
});
export const participant = z.object({
  membership_id: id,
  display_name: z.string(),
  role: z.enum(["owner", "member"]),
  active: z.boolean(),
  membership_status: z.string(),
  last_read_sequence: z.number(),
});
export const message = z.object({
  id,
  conversation_id: id,
  sequence: z.number().int(),
  client_id: id,
  sender_id: id,
  sender_name: z.string(),
  revision: z.number(),
  body: z.string().nullable(),
  redacted: z.boolean(),
  created_at: z.string(),
  revised_at: z.string(),
});
export const historyPage = z.object({
  items: z.array(message),
  next_before_sequence: z.number().nullable(),
  last_sequence: z.number(),
  visible_from_sequence: z.number(),
});
export const revision = z.object({
  revision: z.number(),
  kind: z.string(),
  actor_id: id,
  created_at: z.string(),
  content_digest: z.string(),
});
export const ticket = z.object({
  ticket: z.string().min(32).max(256),
  websocket_url: z.string().url(),
  protocol: z.literal("ccu360.events.v1"),
  heartbeat_seconds: z.number(),
});
export const eventBatch = z.object({
  items: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        kind: z.string(),
        conversation_id: id,
        message_id: id.nullable(),
        created_at: z.string(),
      }),
    )
    .max(100),
  cursor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  has_more: z.boolean(),
  resync_required: z.boolean(),
});
export type Conversation = z.infer<typeof conversation>;
export type Message = z.infer<typeof message>;
export type Participant = z.infer<typeof participant>;
export type EventBatch = z.infer<typeof eventBatch>;
export function safeSocketUrl(raw: string, browserOrigin: string) {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/v1/communication/realtime"
  )
    throw new Error("Invalid realtime endpoint");
  const local = ["localhost", "127.0.0.1"].includes(
    new URL(browserOrigin).hostname,
  );
  if (
    !(
      url.origin === "wss://api.ccu360.health" ||
      (local &&
        url.protocol === "ws:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("Unapproved realtime endpoint");
  return url.href;
}
