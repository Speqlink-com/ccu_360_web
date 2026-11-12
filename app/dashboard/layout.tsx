import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SessionProvider } from "@/providers/session-provider";
import { currentDemoSession } from "@/lib/server/demo";
import { isDemo } from "@/lib/config";
import { cookies } from "next/headers";
import { authCookieNames } from "@/lib/server/auth-cookies";
import { IdentityBoundary } from "@/components/auth/identity-boundary";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDemo) {
    const jar = await cookies();
    const names = authCookieNames();
    if (!jar.has(names.access) && !jar.has(names.refresh)) redirect("/");
    return <IdentityBoundary>{children}</IdentityBoundary>;
  }
  const session = await currentDemoSession();
  if (isDemo && !session) redirect("/");
  return (
    <SessionProvider session={session}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </SessionProvider>
  );
}
