"use client";
import { useEffect, useRef, useState } from "react";
import type { Designer } from "@pdfme/ui";
import type { Schema } from "@pdfme/common";
import type { Definition } from "@/features/live/journey-contract";
import { buttonClasses } from "@/lib/presentation";
import { Notice } from "@/features/live/shared";
import { storedLayout, fromDefinition } from "./layout";
import { runtime } from "./pdf-runtime";
import {
  allFields,
  normalizeDecorations,
  paperIssues,
  patientBindings,
  syncPaper,
  uid,
} from "@/features/form-studio/model";
import {
  brandedPaper,
  logoData,
  type Branding,
} from "@/features/form-studio/branding";
export function DocumentDesigner({
  definition,
  title,
  branding,
  onApply,
  onPending,
}: {
  definition: Definition;
  title: string;
  branding?: Branding;
  onApply: (value: NonNullable<Definition["document"]>) => void;
  onPending: (value: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    editor = useRef<Designer>(null),
    normalizing = useRef(false);
  const [error, setError] = useState<Error | null>(null),
    [ready, setReady] = useState(false),
    [changed, setChanged] = useState(false),
    [issues, setIssues] = useState<string[]>([]),
    [attempt, setAttempt] = useState(0);
  const initial = useRef({ definition, title, branding }),
    pending = useRef(onPending);
  useEffect(() => {
    pending.current = onPending;
  }, [onPending]);
  useEffect(() => {
    let gone = false;
    Promise.all([
      runtime(),
      brandedPaper(
        initial.current.definition,
        initial.current.title,
        initial.current.branding,
      ),
    ])
      .then(([rt, template]) => {
        if (gone || !host.current) return;
        editor.current = new rt.Designer({
          domContainer: host.current,
          template,
          plugins: rt.plugins,
          options: {
            font: rt.font,
            theme: { token: { colorPrimary: "#17665f" } },
            sidebarOpen: true,
            zoomLevel: 0.8,
          },
        });
        editor.current.onChangeTemplate(() => {
          if (normalizing.current || !editor.current) return;
          const raw = editor.current.getTemplate(),
            next = normalizeDecorations(raw, initial.current.definition);
          if (JSON.stringify(raw) !== JSON.stringify(next)) {
            normalizing.current = true;
            editor.current.updateTemplate(next);
            normalizing.current = false;
          }
          setIssues(paperIssues(next, initial.current.definition));
          setChanged(true);
          pending.current(true);
        });
        setIssues(paperIssues(template, initial.current.definition));
        setReady(true);
      })
      .catch((e) => {
        if (!gone) setError(e);
      });
    return () => {
      gone = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, [attempt]);
  const update = (elements: Schema[]) => {
    if (!editor.current) return;
    const template = editor.current.getTemplate();
    template.schemas[0].push(...elements);
    editor.current.updateTemplate(template);
    setChanged(true);
    pending.current(true);
    setIssues(paperIssues(template, definition));
  };
  return (
    <section
      className="studio-pdf-designer"
      aria-label="Document design studio"
    >
      <header className="studio-pdf-toolbar">
        <div>
          <h3>Design the digital document</h3>
          <p>
            Drag and resize elements. Use the right-hand panel for typography,
            colours, borders and alignment.
          </p>
        </div>
        <div className="studio-toolbar-actions">
          <button
            type="button"
            disabled={!ready}
            className={buttonClasses.secondary}
            onClick={() => {
              if (!editor.current) return;
              const paper = storedLayout(editor.current.getTemplate());
              const next = syncPaper({ ...definition, document: paper }, title);
              editor.current.updateTemplate(
                fromDefinition({ ...definition, document: next }, title),
              );
              setIssues(paperIssues(editor.current.getTemplate(), definition));
              setChanged(true);
              pending.current(true);
            }}
          >
            Sync linked fields
          </button>
          <button
            type="button"
            disabled={!ready || issues.length > 0}
            className={buttonClasses.primary}
            onClick={() => {
              try {
                if (editor.current) {
                  const template = normalizeDecorations(
                      editor.current.getTemplate(),
                      definition,
                    ),
                    errors = paperIssues(template, definition);
                  if (errors.length) {
                    setIssues(errors);
                    return;
                  }
                  onApply(storedLayout(template));
                  setChanged(false);
                  pending.current(false);
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
      <div className="studio-document-tools">
        <strong>Add to first page</strong>
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            update([
              {
                name: uid("display"),
                type: "text",
                content: "Section heading",
                position: { x: 15, y: 60 },
                width: 150,
                height: 10,
                fontName: "Inter",
                fontSize: 14,
                fontColor: branding?.primary_color ?? "#153b4c",
                readOnly: true,
              },
            ])
          }
        >
          + Heading / text
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            update([
              {
                name: uid("display"),
                type: "line",
                position: { x: 15, y: 75 },
                width: 180,
                height: 0.5,
                color: branding?.accent_color ?? "#17665f",
                readOnly: true,
              },
            ])
          }
        >
          + Divider
        </button>
        <button
          type="button"
          disabled={!ready || !branding?.logo_id}
          onClick={async () => {
            try {
              const data = await logoData(branding);
              if (data)
                update([
                  {
                    name: uid("display"),
                    type: "image",
                    content: data,
                    position: { x: 165, y: 12 },
                    width: 30,
                    height: 20,
                    objectFit: "contain",
                    readOnly: true,
                  },
                ]);
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          + Facility logo
        </button>
        <button
          type="button"
          disabled={!ready || !branding}
          onClick={async () => {
            try {
              if (!editor.current) return;
              const next = await brandedPaper(
                {
                  ...definition,
                  document: storedLayout(editor.current.getTemplate()),
                },
                title,
                branding,
                true,
              );
              editor.current?.updateTemplate(next);
              setChanged(true);
              pending.current(true);
              setIssues(paperIssues(next, definition));
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          Refresh facility header
        </button>
        <details>
          <summary>Patient identity fields</summary>
          <div className="studio-binding-menu">
            {patientBindings.map(([name, label]) => (
              <button
                type="button"
                key={name}
                disabled={!ready}
                onClick={() => {
                  if (
                    editor.current
                      ?.getTemplate()
                      .schemas.flat()
                      .some((s) => s.name === name)
                  ) {
                    setError(
                      new Error(
                        `${label} is already linked in this document. Select and reposition that element.`,
                      ),
                    );
                    return;
                  }
                  update([
                    {
                      name,
                      type: "text",
                      content: label,
                      position: { x: 15, y: 44 },
                      width: 95,
                      height: 8,
                      fontName: "Inter",
                      fontSize: 10,
                      readOnly: true,
                    },
                  ]);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
        <span>{allFields(definition).length} linked clinical fields</span>
      </div>
      <Notice error={error} />
      {error && !ready && (
        <button
          type="button"
          className={buttonClasses.secondary}
          onClick={() => {
            setError(null);
            setAttempt(attempt + 1);
          }}
        >
          Retry loading designer
        </button>
      )}
      {!ready && !error && (
        <p role="status" className="studio-info">
          Loading the document designer…
        </p>
      )}
      {issues.length > 0 && (
        <div role="alert" className="studio-layout-issues">
          <strong>Review the page layout</strong>
          <ul>
            {issues.slice(0, 12).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {issues.length > 12 && (
            <p>
              And {issues.length - 12} more. Sync linked fields to restore
              missing bindings.
            </p>
          )}
        </div>
      )}
      {changed && (
        <p role="status" className="studio-canvas-pending">
          Canvas changes need to be applied, then saved with the draft.
        </p>
      )}
      <div className="studio-pdf-viewport">
        <div ref={host} style={{ height: 820, minWidth: 1000 }} />
      </div>
      <footer className="studio-pdf-help">
        <strong>Connected to your clinical form</strong>
        <p>
          Field names link the page to patient data. Keep each clinical field
          once. New text, shapes and embedded images are decorative. If you add
          or remove clinical fields in Build form, their page bindings are
          synchronized automatically. Use the native page controls to add,
          duplicate or reorder pages; keep the A4 size. PNG/JPEG images are
          supported; executable templates and remote images are blocked by the
          backend.
        </p>
      </footer>
    </section>
  );
}
