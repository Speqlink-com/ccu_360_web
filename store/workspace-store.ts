import { createStore } from "zustand/vanilla";

export type WorkspaceUI = {
  collapsed: boolean;
  mobileOpen: boolean;
  unit: "All units" | "ICU" | "HDU";
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
  setUnit: (value: WorkspaceUI["unit"]) => void;
};
export const createWorkspaceStore = () =>
  createStore<WorkspaceUI>((set) => ({
    collapsed: false,
    mobileOpen: false,
    unit: "All units",
    setCollapsed: (collapsed) => set({ collapsed }),
    setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    setUnit: (unit) => set({ unit }),
  }));
