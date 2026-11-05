import "server-only";
import { cookies } from "next/headers";
import { createControlPlane, DemoError } from "@/lib/demo/control-plane";
import { isDemo } from "@/lib/config";
import { z } from "zod";
import { demoSigningKey } from "./demo-signing-key";
const globalDemo = globalThis as typeof globalThis & {
  __ccu360TenantDemoV3?: ReturnType<typeof createControlPlane>;
};
export function demoDatabase() {
  return (globalDemo.__ccu360TenantDemoV3 ??= createControlPlane({
    signingKey: demoSigningKey(),
  }));
}
export const sessionCookie = "ccu360_demo_session";
export async function currentDemoSession() {
  if (!isDemo) return null;
  return demoDatabase().session((await cookies()).get(sessionCookie)?.value);
}
export const demoJson = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
  });
export async function demoRoute(
  request: Request,
  action: (
    db: ReturnType<typeof createControlPlane>,
  ) => unknown | Promise<unknown>,
) {
  try {
    if (!isDemo) throw new DemoError(404, "Not found.");
    if (request.method !== "GET") {
      // Next may normalize request.url to localhost. Verify the browser origin
      // against the actual HTTP Host, never an untrusted forwarded-host header.
      const origin = request.headers.get("origin");
      const url = new URL(request.url);
      const expectedOrigin = new URL(
        `${url.protocol}//${request.headers.get("host") ?? url.host}`,
      ).origin;
      if (!origin || origin !== expectedOrigin)
        throw new DemoError(403, "The request origin could not be verified.");
    }
    return demoJson(await action(demoDatabase()));
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "DemoError" &&
      "status" in error &&
      typeof error.status === "number" &&
      [400, 401, 403, 404, 409, 413, 422, 429].includes(error.status)
    )
      return demoJson({ message: error.message }, error.status);
    if (error instanceof z.ZodError)
      return demoJson(
        { message: error.issues[0]?.message ?? "Check the form values." },
        422,
      );
    return demoJson({ message: "The request could not be completed." }, 500);
  }
}
export async function demoBody(request: Request) {
  const text = await request.text();
  if (text.length > 16384)
    throw new DemoError(413, "The request is too large.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DemoError(400, "Invalid request.");
  }
}
export async function requireDemoUser() {
  const session = await currentDemoSession();
  if (!session)
    throw new DemoError(401, "Your session has expired. Sign in again.");
  return session.user;
}
