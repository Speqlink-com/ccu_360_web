import { createStore } from "zustand/vanilla";
export type IdentityUI = {
  pendingOrganization: string | null;
  switching: boolean;
  selectOrganization: (id: string | null) => void;
  setSwitching: (value: boolean) => void;
  reset: () => void;
};
export const createIdentityUI = () =>
  createStore<IdentityUI>((set) => ({
    pendingOrganization: null,
    switching: false,
    selectOrganization: (pendingOrganization) => set({ pendingOrganization }),
    setSwitching: (switching) => set({ switching }),
    reset: () => set({ pendingOrganization: null, switching: false }),
  }));
