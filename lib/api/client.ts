import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
// Same-origin only. Authentication cookies and CSRF protection belong in the future BFF.
// Do not add PHI, tokens, or response bodies to logs/error reporting.
export async function apiRead<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!path.startsWith("/api/v1/") || path.includes(".."))
    throw new Error("Invalid API path");
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Your session has expired. Sign in again."
        : "The workspace could not be loaded. Please try again.",
      response.headers.get("x-request-id") ?? undefined,
    );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(502, "The workspace response could not be verified.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(502, "The workspace response could not be verified.");
  return parsed.data;
}
