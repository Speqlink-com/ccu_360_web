import type { z } from "zod";
export async function demoRequest<T>(
  resource: string,
  schema: z.ZodType<T>,
  options?: {
    method?: "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  },
) {
  const response = await fetch(`/api/demo/${resource}`, {
    method: options?.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: options?.signal,
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server response could not be verified.");
  }
  if (!response.ok) {
    const error = body as { message?: unknown };
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "The request could not be completed.",
    );
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new Error("The server response could not be verified.");
  return result.data;
}
