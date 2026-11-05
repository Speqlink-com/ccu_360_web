"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { SessionView } from "@/lib/domain/identity";
const SessionContext = createContext<SessionView | null>(null);
export function SessionProvider({
  session,
  children,
}: {
  session: SessionView | null;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  return useContext(SessionContext);
}
