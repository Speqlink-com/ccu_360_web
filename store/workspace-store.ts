import { createStore } from "zustand/vanilla";
import { defaultWorkspaceAccent } from "@/lib/workspace-appearance";

export type WorkspaceUI = {
  collapsed: boolean;
  mobileOpen: boolean;
  unit: "All units" | "ICU" | "HDU";
  accent: string;
  fontScale: number;
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
  setUnit: (value: WorkspaceUI["unit"]) => void;
  setAccent: (value: string) => void;
  setFontScale: (value: number) => void;
};
export const createWorkspaceStore = () =>
  createStore<WorkspaceUI>((set) => ({
    collapsed: false,
    mobileOpen: false,
    unit: "All units",
    accent: defaultWorkspaceAccent,
    fontScale: 100,
    setCollapsed: (collapsed) => set({ collapsed }),
    setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    setUnit: (unit) => set({ unit }),
    setAccent: (accent) => set({ accent }),
    setFontScale: (fontScale) => set({ fontScale }),
  }));
