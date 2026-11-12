import { Suspense } from "react";
import { currentDemoSession } from "@/lib/server/demo";
import { isClinicalRole } from "@/lib/domain/identity";
import { redirect } from "next/navigation";
import { PatientPage } from "@/features/workspace/patient-page";
import { isDemo } from "@/lib/config";
import { LivePage } from "@/features/live/live-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDemo) return <LivePage encounterId={id} />;
  const session = await currentDemoSession();
  if (session && !isClinicalRole(session.user.role)) redirect("/dashboard");
  return (
    <Suspense fallback={<p role="status">Opening patient…</p>}>
      <PatientPage id={id} />
    </Suspense>
  );
}
