"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import {
  createWorkspaceStore,
  type WorkspaceUI,
} from "@/store/workspace-store";

const ServicesContext = createContext<null | {
  ui: ReturnType<typeof createWorkspaceStore>;
}>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [services] = useState(() => ({
    ui: createWorkspaceStore(),
  }));
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: false,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
}
export function useServices() {
  const value = useContext(ServicesContext);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
export function useWorkspaceUI<T>(selector: (state: WorkspaceUI) => T) {
  return useStore(useServices().ui, selector);
}
