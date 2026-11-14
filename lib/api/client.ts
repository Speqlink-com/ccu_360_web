import { z } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const descriptions: Record<string, string> = {
  worksite_location_required:
    "Verify your location at the facility to continue.",
  outside_facility_geofence:
    "Your location is outside the facility boundary. Move inside and try again.",
  more_accurate_location_required:
    "A more accurate location is needed. Enable precise location and try again.",
  fresh_location_required:
    "That location reading is too old. Please check again.",
  location_challenge_invalid_or_expired:
    "The location check expired. Please try again.",
  worksite_configuration_changed:
    "Your facility’s access settings changed. Reload them and try again.",
  cannot_remove_last_enabled_geofence:
    "Add another active site or disable enforcement before deactivating this site.",
  specific_public_facility_network_required:
    "Enter a specific public WAN range, such as your facility’s public IP followed by /32.",
  invalid_network_forwarding_proof:
    "The connection could not be verified. Contact your administrator.",
  active_authorized_participants_required:
    "Choose active colleagues who are authorized for this discussion.",
  conversation_not_found: "This conversation is no longer available to you.",
  message_revision_changed:
    "The message changed. Review its latest version before trying again.",
  message_edit_not_permitted:
    "You can only edit your own messages within the editing window.",
  last_conversation_owner_required:
    "Promote another active owner before removing the last owner.",
  active_conversation_owner_exists:
    "This group still has an active owner. Ask them to manage the group.",
  websocket_origin_not_allowed:
    "Realtime messaging is unavailable on this web address. Use your approved facility portal.",
  invalid_credentials:
    "The email or password is incorrect, or this account is unavailable.",
  invalid_mfa_code:
    "That code could not be verified. Use a fresh authenticator code or an unused recovery code.",
  invalid_or_expired_token:
    "This link is invalid or has expired. Request a new invitation or recovery email.",
  password_too_common:
    "Choose a less common password with at least 12 characters.",
  password_contains_email_name:
    "Choose a password that does not contain your email name.",
  password_recently_used: "Choose a password you have not used recently.",
  password_must_be_12_to_128_characters:
    "Use a password between 12 and 128 characters.",
  invalid_current_password: "Your current password is incorrect.",
  provider_code_exists: "That facility code is already in use.",
  membership_exists: "This person already belongs to the facility.",
  use_a_separate_ahs_administrator_account:
    "Use a separate email for an AHS administrator account.",
  ahs_account_cannot_be_a_clinical_member:
    "AHS administrators need a separate account for clinical work.",
  cannot_remove_last_provider_administrator:
    "Add another active facility administrator before removing the last one.",
  cannot_disable_last_provider_administrator:
    "This person is the facility’s last active administrator.",
  cannot_disable_last_ahs_administrator:
    "The platform must retain an active AHS administrator.",
  cannot_change_own_account_status:
    "Ask another AHS administrator to change your account status.",
  invitation_must_be_accepted:
    "This invitation must be accepted before access can be changed.",
  current_admitting_or_reading_team_role_required:
    "Your facility administrator needs to assign you to an active care team.",
  current_team_role_required:
    "Your facility administrator needs to assign you to an active care team.",
  mfa_enrollment_expired: "MFA setup expired. Sign in again to restart.",
  ledger_version_conflict:
    "Another team member updated this journey. Refresh it and review the latest information before saving again.",
  encounter_version_conflict:
    "The journey changed. Review the latest information and try again.",
  field_value_type_or_option_invalid:
    "Check the field values and selected options.",
  required_field_or_explicit_unavailable_reason_missing:
    "Complete required fields or record why the information is unavailable.",
  section_responsibility_required: "This section belongs to another care team.",
  service_unavailable:
    "The service is temporarily unavailable. Please try again.",
  same_origin_required: "Reload this page before continuing.",
};
let rotation: Promise<void> | null = null;
// Identity boundaries require a document reload to discard the previous RSC tree and all in-memory stores.
export function replaceIdentityLocation(destination: "/" | "/dashboard") {
  window.location.replace(new URL(destination, window.location.origin).href);
}
export function notifyIdentityChange(kind: "logout" | "tenant" | "login") {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("ccu360-identity");
    channel.postMessage(kind);
    channel.close();
  }
}
async function rotate() {
  const perform = async () => {
    const current = await fetch("/api/v1/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (current.ok) return;
    if (current.status !== 401)
      throw new ApiError(
        current.status,
        "Your session could not be verified. Please retry.",
      );
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) {
      if (response.status === 401) {
        notifyIdentityChange("logout");
        window.dispatchEvent(new Event("ccu360-session-expired"));
      }
      throw new ApiError(
        response.status,
        "Your session has expired. Sign in again.",
      );
    }
    window.dispatchEvent(new Event("ccu360-session-rotated"));
  };
  if (!rotation)
    rotation = (
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks
            .request("ccu360-refresh", perform)
            .then(() => undefined)
        : perform()
    ).finally(() => {
      rotation = null;
    });
  return rotation;
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
    authenticated?: boolean;
  } = {},
): Promise<T> {
  if (!path.startsWith("/api/v1/") || path.includes("..") || path.includes("#"))
    throw new Error("Invalid API path");
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? {
            "Content-Type":
              options.body instanceof Blob
                ? "application/octet-stream"
                : "application/json",
          }
        : {}),
    },
    body:
      options.body !== undefined
        ? options.body instanceof Blob
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
  };
  let response = await fetch(path, init);
  if (response.status === 401 && options.authenticated !== false) {
    await rotate();
    if (options.signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    response = await fetch(path, init);
  }
  if (!response.ok) {
    let error: { error?: string; requestId?: string } = {};
    try {
      error = await response.json();
    } catch {
      /* Never log responses. */
    }
    if (
      error.error === "worksite_location_required" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("ccu360-location-required"));
    throw new ApiError(
      response.status,
      response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : (descriptions[error.error ?? ""] ??
          (response.status === 401
            ? "Your session has expired. Sign in again."
            : response.status === 403
              ? "Your current role does not permit this action. Contact your facility administrator."
              : response.status === 409
                ? "The record changed or conflicts with existing data. Refresh and review before trying again."
                : response.status === 422
                  ? "Check the required fields and password policy, then try again."
                  : response.status >= 500
                    ? "The service is temporarily unavailable. Please try again."
                    : "The request could not be completed.")),
      error.requestId,
      error.error,
    );
  }
  const body: unknown = response.status === 204 ? null : await response.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(502, "The server response could not be verified.");
  return parsed.data;
}
export const apiRead = <T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) => apiRequest(path, schema, { signal });
