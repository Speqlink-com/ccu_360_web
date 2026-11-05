import { z } from "zod";
import { demoRoute, demoBody, requireDemoUser } from "@/lib/server/demo";
import { DemoError } from "@/lib/demo/control-plane";
import { actionStatusSchema } from "@/lib/domain/workspace";
export const runtime = "nodejs";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  return demoRoute(request, async (db) => {
    const user = await requireDemoUser();
    const { resource } = await context.params;
    if (resource === "directory") return db.directory(user);
    if (resource === "workspace") return db.workspace(user);
    throw new DemoError(404, "Not found.");
  });
}
export async function POST(request: Request, context: Context) {
  return demoRoute(request, async (db) => {
    const user = await requireDemoUser();
    const { resource } = await context.params;
    const body = await demoBody(request);
    if (resource === "facilities") return db.onboard(user, body);
    if (resource === "employees") return db.addEmployee(user, body);
    if (resource === "patients") return db.admit(user, body);
    if (resource === "transitions") {
      const data = z
        .object({
          id: z.string(),
          next: actionStatusSchema,
          version: z.number().int().positive(),
        })
        .parse(body);
      return db.transition(user, data.id, data.next, data.version);
    }
    throw new DemoError(404, "Not found.");
  });
}
export async function PATCH(request: Request, context: Context) {
  return demoRoute(request, async (db) => {
    const user = await requireDemoUser();
    const { resource } = await context.params;
    if (resource === "facilities") {
      const body = z
        .object({
          id: z.string(),
          status: z.enum(["Active", "Onboarding", "Suspended"]),
        })
        .parse(await demoBody(request));
      return db.updateFacility(user, body.id, body.status);
    }
    if (resource === "employees") {
      const body = z
        .object({ id: z.string(), status: z.enum(["Active", "Suspended"]) })
        .parse(await demoBody(request));
      return db.updateEmployee(user, body.id, body.status);
    }
    throw new DemoError(404, "Not found.");
  });
}
