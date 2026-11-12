import { NextRequest } from "next/server";
import { identityGateway } from "@/lib/server/identity-gateway";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return identityGateway(request, (await context.params).path.join("/"));
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
