import { z } from "zod";
import { withRequestDeadline } from "./deadline";
import { ApiError, describeProblem, safeValidationIssues } from "./errors";
export { ApiError } from "./errors";
let rotation: Promise<void> | null = null;
// Identity boundaries require a document reload to discard the previous RSC tree and all in-memory stores.
export function replaceIdentityLocation(destination: "/auth/signin" | "/dashboard") {
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
    const current = await withRequestDeadline((signal) =>
      fetch("/api/v1/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      }),
    );
    if (current.ok) return;
    if (current.status !== 401)
      throw new ApiError(
        current.status,
        "Your session could not be verified. Please retry.",
      );
    const response = await withRequestDeadline((signal) =>
      fetch("/api/v1/auth/refresh", {
        signal,
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    if (!response.ok) {
      if (response.status === 401) {
        notifyIdentityChange("logout");
        window.dispatchEvent(new Event("ccu360-session-expired"));
      }
      throw new ApiError(
        response.status,
        response.status === 401
          ? "Your session has expired. Sign in again."
          : "Your session could not be refreshed. Wait a moment and try again.",
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
  // These POST endpoints only search data; a transport failure cannot have saved a change.
  const readOnly =
    init.method === "GET" ||
    (init.method === "POST" &&
      new Set([
        "/api/v1/journey/reception/patients/search",
        "/api/v1/journey/reception/patients/duplicates",
        "/api/v1/journey/reception/arrivals/search",
        "/api/v1/journey/patients/search",
        "/api/v1/journey/patients/directory",
      ]).has(path));
  return withRequestDeadline(async (signal) => {
    const checkCancellation = () => {
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      if (signal.aborted && signal.reason?.name === "TimeoutError")
        throw new ApiError(
          504,
          "The server took too long to respond. Try loading the record again.",
          undefined,
          "request_timeout",
          [],
          undefined,
          !readOnly,
          path,
        );
    };
    const send = async () => {
      try {
        return await fetch(path, {
          ...init,
          signal,
        });
      } catch (error) {
        if (
          options.signal?.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError" &&
            signal.reason?.name !== "TimeoutError")
        )
          throw error;
        const timedOut =
          (signal.aborted && signal.reason?.name === "TimeoutError") ||
          (error instanceof DOMException && error.name === "TimeoutError");
        throw new ApiError(
          timedOut ? 504 : 0,
          timedOut
            ? "The server took too long to respond. Try loading the record again."
            : "We could not reach CCU360. Check your internet connection and try loading the record again.",
          undefined,
          timedOut ? "request_timeout" : "network_error",
          [],
          undefined,
          !readOnly,
          path,
        );
      }
    };
    let response = await send();
    if (response.status === 401 && options.authenticated !== false) {
      try {
        await rotate();
      } catch (error) {
        if (options.signal?.aborted)
          throw new DOMException("Aborted", "AbortError");
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          0,
          "Your session could not be checked because the connection was interrupted. Check your connection and try again.",
          undefined,
          "network_error",
        );
      }
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      response = await send();
    }
    if (!response.ok) {
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        checkCancellation();
        /* Raw server bodies are never displayed or logged. */
      }
      const problem = z
        .object({
          error: z
            .string()
            .regex(/^[a-z][a-z0-9_]{0,100}$/)
            .optional(),
          requestId: z
            .string()
            .regex(/^[a-zA-Z0-9-]{1,64}$/)
            .optional(),
          issues: z.unknown().optional(),
        })
        .safeParse(raw);
      const data = problem.success ? problem.data : {};
      const issues = safeValidationIssues(data.issues);
      const retry = response.headers.get("retry-after");
      const retryAfter =
        retry && /^\d{1,6}$/.test(retry)
          ? Math.min(Number(retry), 86400)
          : undefined;
      if (
        data.error === "worksite_location_required" &&
        typeof window !== "undefined"
      )
        window.dispatchEvent(new Event("ccu360-location-required"));
      throw new ApiError(
        response.status,
        describeProblem(response.status, data.error, issues, retryAfter),
        data.requestId,
        data.error,
        issues,
        retryAfter,
        response.status >= 500 && !readOnly,
        path,
      );
    }
    let body: unknown;
    try {
      body = response.status === 204 ? null : await response.json();
    } catch {
      checkCancellation();
      throw new ApiError(
        502,
        "The server response could not be verified.",
        undefined,
        "invalid_response",
        [],
        undefined,
        !readOnly,
        path,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        502,
        "The server response could not be verified.",
        undefined,
        "invalid_response",
        [],
        undefined,
        !readOnly,
        path,
      );
    return parsed.data;
  }, options.signal);
}
export const apiRead = <T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) => apiRequest(path, schema, { signal });
