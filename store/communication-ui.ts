import { createStore } from "zustand/vanilla";
export type ConnectionState =
  | "offline"
  | "connecting"
  | "live"
  | "reconnecting"
  | "polling"
  | "paused";
export type CommunicationUI = {
  selected: string | null;
  connection: ConnectionState;
  scope: string | null;
  cursor: number;
  bindScope: (scope: string) => void;
  setCursor: (cursor: number) => void;
  select: (id: string | null) => void;
  setConnection: (state: ConnectionState) => void;
  reset: () => void;
};
// Deliberately transient. No middleware persists discussions, drafts or tokens.
export const createCommunicationUI = () =>
  createStore<CommunicationUI>((set, get) => ({
    selected: null,
    connection: "offline",
    scope: null,
    cursor: 0,
    bindScope: (scope) => {
      if (get().scope !== scope)
        set({ scope, cursor: 0, selected: null, connection: "offline" });
    },
    setCursor: (cursor) => set({ cursor }),
    select: (selected) => set({ selected }),
    setConnection: (connection) => set({ connection }),
    reset: () =>
      set({ selected: null, connection: "offline", scope: null, cursor: 0 }),
  }));
