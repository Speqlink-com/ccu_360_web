import { createStore } from "zustand/vanilla";
import type { Definition } from "@/features/live/journey-contract";
import { syncPaper } from "./model";
export type Draft = { name: string; brandId: string; definition: Definition };
export type Selection = { stage: string; section?: string; field?: string };
export function createStudioStore(initial: Draft) {
  return createStore<{
    locked: boolean;
    lock: (locked: boolean) => void;
    draft: Draft;
    saved: string;
    past: Draft[];
    future: Draft[];
    selection: Selection;
    edit: (fn: (draft: Draft) => void, sync?: boolean) => void;
    select: (value: Selection) => void;
    undo: () => void;
    redo: () => void;
    accept: (draft: Draft) => void;
    markSaved: (submitted: Draft) => void;
  }>((set) => ({
    locked: false,
    lock: (locked) => set({ locked }),
    draft: structuredClone(initial),
    saved: JSON.stringify(initial),
    past: [],
    future: [],
    selection: {
      stage: initial.definition.stages[0].key,
      section: initial.definition.stages[0].sections[0]?.key,
    },
    edit: (fn, sync = true) =>
      set((state) => {
        if (state.locked) return state;
        const next = structuredClone(state.draft);
        fn(next);
        if (JSON.stringify(next) === JSON.stringify(state.draft)) return state;
        if (sync && next.definition.document)
          next.definition.document = syncPaper(next.definition, next.name);
        return {
          draft: next,
          past: [...state.past.slice(-29), state.draft],
          future: [],
        };
      }),
    select: (selection) => set({ selection }),
    undo: () =>
      set((state) =>
        !state.locked && state.past.length
          ? {
              draft: state.past.at(-1)!,
              past: state.past.slice(0, -1),
              future: [state.draft, ...state.future].slice(0, 30),
            }
          : state,
      ),
    redo: () =>
      set((state) =>
        !state.locked && state.future.length
          ? {
              draft: state.future[0],
              past: [...state.past, state.draft].slice(-30),
              future: state.future.slice(1),
            }
          : state,
      ),
    accept: (draft) =>
      set({
        draft: structuredClone(draft),
        saved: JSON.stringify(draft),
        past: [],
        future: [],
      }),
    markSaved: (submitted) => set({ saved: JSON.stringify(submitted) }),
  }));
}
export type StudioStore = ReturnType<typeof createStudioStore>;
