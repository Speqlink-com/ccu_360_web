import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SessionProvider } from "@/providers/session-provider";
import { currentDemoSession } from "@/lib/server/demo";
import { isDemo } from "@/lib/config";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentDemoSession();
  if (isDemo && !session) redirect("/");
  return (
    <SessionProvider session={session}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </SessionProvider>
  );
}
