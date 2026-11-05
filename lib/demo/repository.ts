import { seed } from "./seed";
import {
  transitionAction,
  type ActionStatus,
  type Workspace,
} from "../domain/workspace";

// Scoped to a browser-side provider. No server singleton or browser persistence of clinical data.
export function createDemoRepository() {
  let workspace: Workspace = structuredClone(seed);
  return {
    read: () => structuredClone(workspace),
    transition: (id: string, next: ActionStatus, version: number) => {
      const action = workspace.actions.find((a) => a.id === id);
      if (!action) throw new Error("Action not found.");
      const updated = transitionAction(
        action,
        next,
        version,
        "Demo clinician",
        new Date().toISOString(),
      );
      workspace = {
        ...workspace,
        actions: workspace.actions.map((a) => (a.id === id ? updated : a)),
      };
      return structuredClone(updated);
    },
  };
}
