import { DashboardHome } from "@/features/administration/dashboard-home";
import { LivePage } from "@/features/live/live-page";
import { isDemo } from "@/lib/config";
export default function Page() {
  return isDemo ? <DashboardHome /> : <LivePage />;
}
