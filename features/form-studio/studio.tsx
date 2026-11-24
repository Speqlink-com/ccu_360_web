"use client";
import "./studio.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useStore } from "zustand";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import {
  brand,
  formTemplate,
  teamRole,
  type Definition,
} from "@/features/live/journey-contract";
import { Notice } from "@/features/live/shared";
import { WebSelect } from "@/components/ui/web-select";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { buttonClasses } from "@/lib/presentation";
import {
  storedLayout,
  fromDefinition,
} from "@/features/document-studio/layout";
import { createStudioStore } from "./store";
import { allFields, paperIssues } from "./model";
import { draftIssues } from "./validation";
import { brandedPaper } from "./branding";
import { FormCanvas } from "./canvas";
import { Inspector } from "./inspector";
import { TeamAccess } from "./access";
const DocumentDesigner = dynamic(
  () =>
    import("@/features/document-studio/designer").then(
      (m) => m.DocumentDesigner,
    ),
  { ssr: false },
);
const FormPreview = dynamic(
  () => import("./preview").then((m) => m.FormPreview),
  { ssr: false },
);
type Template = z.infer<typeof formTemplate>;
type Mode = "build" | "pages" | "access" | "preview" | "publish";
const modes: [Mode, string, string][] = [
  ["build", "Build form", "01"],
  ["pages", "PDF pages", "02"],
  ["access", "Teams & permissions", "03"],
  ["preview", "Preview & test", "04"],
  ["publish", "Review & publish", "05"],
];
export function FormStudio({
  org,
  initial,
  brands,
  roles,
  roleLoader,
  brandingLoader,
  onClose,
}: {
  org: string;
  initial: Template;
  baseline: Definition;
  brands: z.infer<typeof brand>[];
  roles: z.infer<typeof teamRole>[];
  roleLoader?: ReactNode;
  brandingLoader?: ReactNode;
  onClose: () => void;
}) {
  const [store] = useState(() =>
    createStudioStore({
      name: initial.name,
      brandId: initial.brand_id,
      definition: initial.definition,
    }),
  );
  const state = useStore(store),
    { draft, edit } = state;
  const [mode, setMode] = useState<Mode>("build"),
    [reason, setReason] = useState(""),
    [revision, setRevision] = useState(initial.revision),
    [canvasPending, setCanvasPending] = useState(false),
    [canvasEpoch, setCanvasEpoch] = useState(0),
    [validated, setValidated] = useState<number | null>(null),
    [status, setStatus] = useState("");
  const publishDialog = useRef<HTMLDialogElement>(null),
    client = useQueryClient(),
    dirty = JSON.stringify(draft) !== state.saved;
  const branding = brands.find((b) => b.id === draft.brandId),
    sections = draft.definition.stages.flatMap((s) =>
      s.sections.filter((s) => s.enabled),
    ),
    issues = draftIssues(draft.definition);
  const locateError = (error: Error) => {
    if (error instanceof ApiError) {
      const path = error.issues[0]?.path ?? [],
        i = path.indexOf("stages"),
        st =
          typeof path[i + 1] === "number"
            ? draft.definition.stages[path[i + 1] as number]
            : undefined;
      const si = path.indexOf("sections"),
        section =
          st && typeof path[si + 1] === "number"
            ? st.sections[path[si + 1] as number]
            : undefined;
      const fi = path.indexOf("fields"),
        field =
          section && typeof path[fi + 1] === "number"
            ? section.fields[path[fi + 1] as number]
            : undefined;
      if (st) {
        store
          .getState()
          .select({ stage: st.key, section: section?.key, field: field?.key });
        setMode("build");
      }
    }
  };
  const save = useMutation({
    mutationFn: async () => {
      if (canvasPending)
        throw new Error("Apply the page layout before saving the draft.");
      if (draft.name.trim().length < 2 || draft.name.length > 120)
        throw new Error("Enter a form name between two and 120 characters.");
      if (reason.trim().length < 3)
        throw new Error(
          "Add a change reason of at least three characters before saving.",
        );
      if (issues.length) throw new Error(issues.join("\n"));
      store.getState().lock(true);
      const submitted = structuredClone(draft);
      if (!submitted.definition.document)
        submitted.definition.document = storedLayout(
          await brandedPaper(submitted.definition, submitted.name, branding),
        );
      const layoutIssues = paperIssues(
        fromDefinition(submitted.definition, submitted.name),
        submitted.definition,
      );
      if (layoutIssues.length) throw new Error(layoutIssues.join("\n"));
      const body = {
        name: submitted.name,
        brand_id: submitted.brandId,
        definition: submitted.definition,
        expected_version: revision,
        reason: reason.trim(),
      };
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 600000)
        throw new Error(
          "This form exceeds the document size limit. Reduce embedded image sizes or remove repeated decorative images before saving.",
        );
      return apiRequest(
        `/api/v1/journey/config/templates/${initial.id}`,
        formTemplate,
        { method: "PUT", body },
      );
    },
    onSuccess: async (saved) => {
      store.getState().accept({
        name: saved.name,
        brandId: saved.brand_id,
        definition: saved.definition,
      });
      setRevision(saved.revision);
      setReason("");
      setValidated(null);
      setStatus(
        "Draft saved. Review the preview, then validate for publication.",
      );
      await client.invalidateQueries({ queryKey: ["live", org] });
    },
    onError: locateError,
    onSettled: () => store.getState().lock(false),
  });
  const reload = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/journey/config/templates/${initial.id}`,
        formTemplate,
      ),
    onSuccess: (saved) => {
      store.getState().accept({
        name: saved.name,
        brandId: saved.brand_id,
        definition: saved.definition,
      });
      setRevision(saved.revision);
      setReason("");
      setValidated(null);
      setCanvasPending(false);
      setCanvasEpoch((n) => n + 1);
      setStatus("Latest saved draft loaded.");
    },
  });
  const validate = useMutation({
    mutationFn: async () => {
      const result = await apiRequest(
        `/api/v1/journey/config/templates/${initial.id}/validate`,
        z.object({ valid: z.literal(true), revision: z.number() }),
        { method: "POST", body: {} },
      );
      if (result.revision !== revision)
        throw new Error(
          "This draft changed in another session. Reload it and review the current version.",
        );
      return result;
    },
    onSuccess: (result) => {
      setValidated(result.revision);
      setStatus(
        "Saved revision validated. Review the publication summary before approving.",
      );
    },
    onError: locateError,
  });
  const publish = useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/v1/journey/config/templates/${initial.id}/publish`,
        formTemplate,
        {
          method: "POST",
          body: { approved: true, expected_version: revision },
        },
      ),
    onSuccess: async () => {
      publishDialog.current?.close();
      await client.invalidateQueries({ queryKey: ["live", org] });
      onClose();
    },
  });
  const busy =
    save.isPending ||
    reload.isPending ||
    validate.isPending ||
    publish.isPending;
  useEffect(() => {
    if (!dirty && !canvasPending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        link &&
        link.origin === location.origin &&
        link.pathname !== location.pathname &&
        !window.confirm("Leave Form Studio and discard unsaved changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, canvasPending]);
  const changeMode = (next: Mode) => {
    if (next === mode) return;
    if (
      canvasPending &&
      !window.confirm(
        "Discard unapplied PDF canvas changes? Apply page layout first to keep them.",
      )
    )
      return;
    setCanvasPending(false);
    setMode(next);
    setStatus("");
  };
  const close = () => {
    if (
      (!dirty && !canvasPending) ||
      window.confirm("Discard unsaved form changes?")
    )
      onClose();
  };
  const previewKey = JSON.stringify([
    draft.name,
    draft.brandId,
    draft.definition,
  ]);
  const publicationReady = !dirty && !canvasPending && validated === revision;
  return (
    <section
      aria-label="Journey form editor"
      className="form-studio"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (!busy && !canvasPending) save.mutate();
        }
      }}
    >
      <header className="studio-header">
        <div>
          <p className="studio-kicker">
            CCU360 FORM STUDIO <span>Draft v{initial.version}</span>
          </p>
          <h2>{draft.name}</h2>
          <p>
            Revision {revision} · {sections.length} sections ·{" "}
            {allFields(draft.definition).length} fields
          </p>
        </div>
        <div className="studio-toolbar-actions">
          <span
            className={`studio-save-state ${dirty || canvasPending ? "is-dirty" : ""}`}
          >
            {busy
              ? "Working…"
              : canvasPending
                ? "Unapplied canvas changes"
                : dirty
                  ? "Unsaved changes"
                  : "Saved draft"}
          </span>
          <button
            type="button"
            aria-label="Undo form change"
            disabled={busy || canvasPending || !state.past.length}
            onClick={() => {
              state.undo();
              setCanvasEpoch((n) => n + 1);
            }}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            aria-label="Redo form change"
            disabled={busy || canvasPending || !state.future.length}
            onClick={() => {
              state.redo();
              setCanvasEpoch((n) => n + 1);
            }}
          >
            ↷ Redo
          </button>
          <button
            type="button"
            className={buttonClasses.primary}
            disabled={
              busy || canvasPending || (!dirty && !!draft.definition.document)
            }
            onClick={() => save.mutate()}
          >
            <ButtonHeartbeat loading={save.isPending}>Save draft</ButtonHeartbeat>
          </button>
          <button
            type="button"
            className={buttonClasses.secondary}
            disabled={busy}
            onClick={close}
          >
            Close editor
          </button>
        </div>
      </header>
      <nav className="studio-tabs" aria-label="Form Studio workspace">
        {modes.map(([key, label, number]) => (
          <button
            type="button"
            key={key}
            aria-current={mode === key ? "step" : undefined}
            disabled={busy}
            onClick={() => changeMode(key)}
          >
            <span>{number}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="studio-save-bar">
        <label>
          Change reason
          <input
            name="reason"
            aria-label="Change reason"
            placeholder="What changed in this version?"
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <span>Drafts stay private until approved and published.</span>
      </div>
      <div className="studio-feedback">
        <Notice error={save.error} />
        <Notice error={reload.error} />
        <Notice error={validate.error} />
        {status && (
          <p role="status" className="studio-success">
            {status}
          </p>
        )}
      </div>
      {draft.definition.design_version === 1 ? (
        <div className="studio-settings">
          <h3>Enable flexible editing for this draft</h3>
          <p>
            This older form uses predefined fields. Upgrade the draft to design
            sections freely. Existing published versions and patient journeys
            keep their original records.
          </p>
          <button
            type="button"
            className={buttonClasses.primary}
            onClick={() =>
              edit((d) => {
                d.definition.design_version = 2;
                d.definition.access_role_ids = [
                  ...new Set(
                    d.definition.stages.flatMap((s) =>
                      s.sections.flatMap((s) => s.role_ids),
                    ),
                  ),
                ];
              })
            }
          >
            Enable flexible editing
          </button>
        </div>
      ) : (
        <fieldset disabled={busy} className="studio-workspace">
          {mode === "build" && (
            <div className="studio-builder">
              <FormCanvas store={store} branding={branding} />
              <Inspector store={store} roles={roles} />
            </div>
          )}
          {mode === "pages" && (
            <DocumentDesigner
              key={canvasEpoch}
              definition={draft.definition}
              title={draft.name}
              branding={branding}
              onPending={setCanvasPending}
              onApply={(document) => {
                edit((d) => {
                  d.definition.document = document;
                }, false);
                setStatus(
                  "Page layout applied. Add a change reason and save the draft.",
                );
              }}
            />
          )}
          {mode === "access" && (
            <>
              <TeamAccess store={store} roles={roles} />
              {roleLoader}
            </>
          )}
          {mode === "preview" && (
            <FormPreview
              key={previewKey}
              definition={draft.definition}
              title={draft.name}
              branding={branding}
            />
          )}
          {mode === "publish" && (
            <section
              className="studio-settings"
              aria-label="Review and publish"
            >
              <p className="studio-kicker">DOCUMENT CONTROL</p>
              <h2>Review. Approve. Make it available.</h2>
              <p>
                Publication locks this version for new patient journeys.
                Employees receive the same shared document, with writing
                restricted to their assigned teams. Existing journeys retain
                their pinned form version.
              </p>
              <div className="studio-settings-grid">
                <label className="live-field">
                  Form name
                  <input
                    value={draft.name}
                    minLength={2}
                    maxLength={120}
                    onChange={(e) =>
                      edit((d) => {
                        d.name = e.target.value;
                      }, false)
                    }
                  />
                </label>
                <WebSelect
                    label="Facility branding"
                    value={draft.brandId}
                    onChange={(value) =>
                      edit((d) => {
                        d.brandId = value;
                      }, false)
                    }
                    options={brands
                      .filter((b) => b.active || b.id === draft.brandId)
                      .map((b) => ({ value: b.id, label: `${b.title} · v${b.version}${b.active ? "" : " · Archived"}` }))}
                    searchable={brands.length > 6}
                  />
              </div>
              {brandingLoader}
              <p className="studio-helper">
                After changing branding or the form name, use “Refresh facility
                header” in PDF pages to update the document’s generated header,
                then apply and save the layout.
              </p>
              <div className="studio-publication-summary">
                <div>
                  <small>Sections</small>
                  <strong>{sections.length}</strong>
                </div>
                <div>
                  <small>Clinical fields</small>
                  <strong>{allFields(draft.definition).length}</strong>
                </div>
                <div>
                  <small>Intake teams</small>
                  <strong>{draft.definition.intake_role_ids.length}</strong>
                </div>
                <div>
                  <small>PDF pages</small>
                  <strong>
                    {draft.definition.document?.schemas.length ?? "Automatic"}
                  </strong>
                </div>
              </div>
              <ol className="studio-review-checklist">
                <li>
                  <strong>Facility identity</strong>
                  <span>
                    {branding?.title ?? "Choose branding"} · Branding v
                    {branding?.version ?? "—"}
                    {!branding?.active ? " · Active branding required" : ""}
                  </span>
                </li>
                <li>
                  <strong>Intake responsibility</strong>
                  <span>
                    {draft.definition.intake_role_ids
                      .map(
                        (id) =>
                          roles.find((r) => r.id === id)?.name ??
                          "Unavailable team",
                      )
                      .join(", ") ||
                      "Choose who starts the journey in Teams & permissions."}
                  </span>
                </li>
                <li>
                  <strong>Writing responsibility</strong>
                  <span>
                    {
                      sections.filter(
                        (s) => (s.write_role_ids ?? s.role_ids).length,
                      ).length
                    }{" "}
                    of {sections.length} sections have writing teams. The server
                    checks role, department and attestation compatibility.
                  </span>
                </li>
                <li>
                  <strong>Saved revision</strong>
                  <span>
                    {dirty || canvasPending
                      ? "Save all changes before validating."
                      : `Revision ${revision} is saved.`}
                  </span>
                </li>
              </ol>
              {issues.length > 0 && (
                <div className="studio-layout-issues">
                  <strong>Fields to review</strong>
                  <ul>
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="studio-review-actions">
                <button
                  type="button"
                  className={buttonClasses.secondary}
                  disabled={dirty || canvasPending || busy}
                  onClick={() => validate.mutate()}
                >
                  <ButtonHeartbeat loading={validate.isPending}>Validate for publication</ButtonHeartbeat>
                </button>
                <button
                  type="button"
                  className={buttonClasses.primary}
                  disabled={!publicationReady || busy}
                  onClick={() => {
                    publishDialog.current?.querySelector("form")?.reset();
                    publish.reset();
                    publishDialog.current?.showModal();
                  }}
                >
                  Approve & publish
                </button>
                <button
                  type="button"
                  className={buttonClasses.secondary}
                  disabled={busy}
                  onClick={() => {
                    if (
                      (!dirty && !canvasPending) ||
                      window.confirm(
                        "Discard unsaved changes and load the latest saved draft?",
                      )
                    )
                      reload.mutate();
                  }}
                >
                  <ButtonHeartbeat loading={reload.isPending}>Reload saved draft</ButtonHeartbeat>
                </button>
              </div>
              {publicationReady && (
                <p className="studio-success">
                  This saved revision passed server validation and is ready for
                  approval.
                </p>
              )}
            </section>
          )}
        </fieldset>
      )}
      <dialog
        ref={publishDialog}
        className="studio-publish-dialog"
        aria-labelledby="publish-title"
        onCancel={(e) => {
          if (publish.isPending) e.preventDefault();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (publicationReady) publish.mutate();
          }}
        >
          <p className="studio-kicker">PUBLISH VERSION {initial.version}</p>
          <h2 id="publish-title">Make this form available to your teams?</h2>
          <p>
            <strong>{draft.name}</strong> will be used for new journeys at{" "}
            {branding?.title ?? "your facility"}. This published version becomes
            immutable. Clone it to make future changes.
          </p>
          <p>
            Patient records already in progress will keep their original form.
          </p>
          <label className="studio-check">
            <input type="checkbox" required />I have reviewed the fields, PDF
            layout and team permissions.
          </label>
          <Notice error={publish.error} />
          <div className="studio-review-actions">
            <button
              type="button"
              className={buttonClasses.secondary}
              disabled={publish.isPending}
              onClick={() => publishDialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={buttonClasses.primary}
              disabled={publish.isPending}
            >
              <ButtonHeartbeat loading={publish.isPending}>Publish approved version</ButtonHeartbeat>
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
