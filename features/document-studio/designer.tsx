"use client";
import { useEffect, useRef, useState } from "react";
import type { Designer } from "@pdfme/ui";
import type { Definition } from "@/features/live/journey-contract";
import { buttonClasses } from "@/lib/presentation";
import { Notice } from "@/features/live/shared";
import { createPaper, fromDefinition, storedLayout } from "./layout";
import { runtime } from "./pdf-runtime";

export function DocumentDesigner({
  definition,
  title,
  onApply,
  onPending,
}: {
  definition: Definition;
  title: string;
  onApply: (value: NonNullable<Definition["document"]>) => void;
  onPending: (value: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    editor = useRef<Designer>(null);
  const [error, setError] = useState<Error | null>(null),
    [ready, setReady] = useState(false),
    [changed, setChanged] = useState(false);
  const initial = useRef({ definition, title });
  const pendingCallback = useRef(onPending);
  useEffect(() => {
    pendingCallback.current = onPending;
  }, [onPending]);
  useEffect(() => {
    let gone = false;
    runtime()
      .then(({ Designer, font, plugins }) => {
        if (gone || !host.current) return;
        editor.current = new Designer({
          domContainer: host.current,
          template: fromDefinition(
            initial.current.definition,
            initial.current.title,
          ),
          plugins,
          options: {
            font,
            theme: { token: { colorPrimary: "#17665f" } },
            sidebarOpen: true,
            zoomLevel: 0.8,
          },
        });
        editor.current.onChangeTemplate(() => {
          setChanged(true);
          pendingCallback.current(true);
        });
        setReady(true);
      })
      .catch(setError);
    return () => {
      gone = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, []);
  return (
    <section
      className="my-6 overflow-hidden rounded-xl border border-border bg-slate-50"
      aria-label="Document design studio"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white p-5">
        <div>
          <h3 className="text-xl font-semibold">Document design studio</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Arrange your fields on A4 pages. Add headings, lines and diagrams.
            Keep the linked field names unchanged; patient details fill
            automatically. Table columns and section permissions are configured
            in Sections & fields.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready}
            className={buttonClasses.secondary}
            onClick={() => {
              if (
                window.confirm(
                  "Replace this layout with pages generated from the current sections and fields?",
                )
              ) {
                editor.current?.updateTemplate(createPaper(definition, title));
                setChanged(true);
                pendingCallback.current(true);
              }
            }}
          >
            Rebuild from fields
          </button>
          <button
            type="button"
            disabled={!ready}
            className={buttonClasses.primary}
            onClick={() => {
              try {
                if (editor.current) {
                  onApply(storedLayout(editor.current.getTemplate()));
                  setChanged(false);
                  pendingCallback.current(false);
                  setError(null);
                }
              } catch (e) {
                setError(e as Error);
              }
            }}
          >
            Apply page layout
          </button>
        </div>
      </header>
      <div className="p-3">
        <Notice error={error} />
        {!ready && !error && (
          <p role="status">Loading the document designer…</p>
        )}
        {changed && (
          <p role="status" className="mb-2 text-sm text-amber-800">
            Canvas changes need to be applied, then saved with the draft.
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <div ref={host} style={{ height: 780, minWidth: 960 }} />
      </div>
      <p className="border-t border-border bg-white p-4 text-sm text-muted">
        Use a desktop screen for page design. All clinical fields must appear
        once in the layout. Decorative elements use names starting with
        display_. New fields need “Rebuild from fields”, or an element with
        their linked field name.
      </p>
    </section>
  );
}
