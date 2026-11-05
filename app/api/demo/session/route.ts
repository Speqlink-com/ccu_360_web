import { cookies } from "next/headers";
import { z } from "zod";
import {
  demoRoute,
  demoBody,
  currentDemoSession,
  sessionCookie,
} from "@/lib/server/demo";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return demoRoute(request, () => currentDemoSession());
}
export async function POST(request: Request) {
  return demoRoute(request, async (db) => {
    const body = z
      .object({
        email: z.string().email().max(160),
        password: z.string().min(1).max(128),
      })
      .parse(await demoBody(request));
    const result = db.login(body.email, body.password);
    (await cookies()).set(sessionCookie, result.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return result.session;
  });
}
export async function DELETE(request: Request) {
  return demoRoute(request, async (db) => {
    const jar = await cookies();
    db.logout(jar.get(sessionCookie)?.value);
    jar.delete(sessionCookie);
    return { ok: true };
  });
}
