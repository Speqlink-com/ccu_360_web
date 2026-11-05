import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppProvider } from "@/providers/app-provider";
export const metadata: Metadata = {
  title: {
    default: "CCU360 · Connected critical care",
    template: "%s · CCU360",
  },
  description: "A shared clinical workspace for critical-care teams.",
  robots: { index: false, follow: false },
  icons: { icon: "/ccu360-logo.png" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
