"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { createIdentityUI, type IdentityUI } from "@/store/identity-ui";
import {
  createCommunicationUI,
  type CommunicationUI,
} from "@/store/communication-ui";
import {
  createWorkspaceStore,
  type WorkspaceUI,
} from "@/store/workspace-store";

const ServicesContext = createContext<null | {
  ui: ReturnType<typeof createWorkspaceStore>;
  identity: ReturnType<typeof createIdentityUI>;
  communication: ReturnType<typeof createCommunicationUI>;
}>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [services] = useState(() => ({
    ui: createWorkspaceStore(),
    identity: createIdentityUI(),
    communication: createCommunicationUI(),
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
          mutations: { retry: false, gcTime: 0 },
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
export function useIdentityUI<T>(selector: (state: IdentityUI) => T) {
  return useStore(useServices().identity, selector);
}
export function useWorkspaceUI<T>(selector: (state: WorkspaceUI) => T) {
  return useStore(useServices().ui, selector);
}
export function useCommunicationUI<T>(selector: (state: CommunicationUI) => T) {
  return useStore(useServices().communication, selector);
}
