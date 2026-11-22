import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import "./collaboration.css";
import "./workspace.css";
import { AppProvider } from "@/providers/app-provider";
import { RouteTransitionLoader } from "@/components/ui/route-transition-loader";
export const metadata: Metadata = {
  title: {
    default: "CCU360 · Connected critical care",
    template: "%s · CCU360",
  },
  description: "A shared clinical workspace for critical-care teams.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo/logo.png" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <RouteTransitionLoader />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
