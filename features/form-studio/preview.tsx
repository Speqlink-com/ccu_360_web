"use client";
import { useEffect, useRef, useState } from "react";
import type { Viewer } from "@pdfme/ui";
import type { Template } from "@pdfme/common";
import type { Definition } from "@/features/live/journey-contract";
import { runtime } from "@/features/document-studio/pdf-runtime";
import { documentInputs } from "@/features/document-studio/prepare-document";
import { Notice } from "@/features/live/shared";
import { FieldPreview } from "./field-preview";
import { allFields } from "./model";
import { brandedPaper, downloadBytes, type Branding } from "./branding";
import { buttonClasses } from "@/lib/presentation";
export function FormPreview({
  definition,
  title,
  branding,
  pdfOnly = false,
}: {
  definition: Definition;
  title: string;
  branding?: Branding;
  pdfOnly?: boolean;
}) {
  const [mode, setMode] = useState(pdfOnly ? "pdf" : "interactive"),
    [message, setMessage] = useState("");
  return (
    <section className="studio-preview" aria-label="Form preview">
      <div className="studio-preview-toolbar">
        <div>
          <h2>Test the experience</h2>
          <p>Preview only. Sample responses are never saved or sent.</p>
        </div>
        <div className="studio-segmented">
          <button
            type="button"
            aria-pressed={mode === "interactive"}
            onClick={() => setMode("interactive")}
          >
            Interactive form
          </button>
          <button
            type="button"
            aria-pressed={mode === "pdf"}
            onClick={() => setMode("pdf")}
          >
            PDF document
          </button>
        </div>
      </div>
      {mode === "pdf" ? (
        <PdfPreview definition={definition} title={title} branding={branding} />
      ) : (
        <form
          className="studio-preview-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            for (const { section, field } of allFields(definition)) {
              if (!field.required) continue;
              const name = `${section.key}__${field.key}`;
              if (field.type === "multichoice" && !data.getAll(name).length) {
                setMessage(
                  `Choose at least one answer for ${field.label}. Nothing was saved.`,
                );
                return;
              }
              if (field.type === "table") {
                let rows: unknown;
                try {
                  rows = JSON.parse(String(data.get(name) ?? "[]"));
                } catch {
                  rows = [];
                }
                if (!Array.isArray(rows) || !rows.length) {
                  setMessage(
                    `Add at least one row to ${field.label}. Nothing was saved.`,
                  );
                  return;
                }
              }
            }
            setMessage("Sample form checked. Nothing was saved or submitted.");
          }}
        >
          <div className="studio-preview-paper-meta">
            <span>CCU360 / DIGITAL CLINICAL FORM</span>
            <span>SAMPLE DOCUMENT · NO PATIENT DATA</span>
          </div>
          <header>
            <p className="studio-kicker">FORM PREVIEW · SAMPLE DATA ONLY</p>
            <h2>{branding?.title ?? title}</h2>
            <p>{title}</p>
          </header>
          <div className="studio-patient-strip">
            <div>
              <small>Patient identity</small>
              <strong>Linked from reception</strong>
            </div>
            <div>
              <small>CCU360 number</small>
              <strong>••••••</strong>
            </div>
          </div>
          {definition.stages
            .filter((st) => st.sections.some((s) => s.enabled))
            .map((stage) => (
              <div key={stage.key}>
                <h3>{stage.label}</h3>
                {stage.sections
                  .filter((s) => s.enabled)
                  .map((section) => (
                    <section key={section.key}>
                      <h4>{section.label}</h4>
                      <div className="studio-preview-fields">
                        {section.fields.map((field) => (
                          <div
                            className={`live-field ${["textarea", "table", "attachment"].includes(field.type) ? "studio-wide" : ""}`}
                            key={field.key}
                          >
                            <label
                              htmlFor={`sample_${section.key}__${field.key}`}
                            >
                              {field.label}
                              {field.required ? " *" : ""}
                            </label>
                            <div>
                              <FieldPreview
                                field={{
                                  ...field,
                                  key: section.key + "__" + field.key,
                                }}
                                interactive
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {section.attestation_required && (
                        <p className="studio-signoff">
                          Employee sign-off is requested in the authenticated
                          patient journey.
                        </p>
                      )}
                    </section>
                  ))}
              </div>
            ))}
          <button type="submit" className={buttonClasses.secondary}>
            Check sample answers
          </button>
          {message && <p role="status">{message}</p>}
          <footer className="studio-preview-paper-footer">CCU360 · Sample entries stay in this browser and are never saved</footer>
        </form>
      )}
    </section>
  );
}
function PdfPreview({
  definition,
  title,
  branding,
}: {
  definition: Definition;
  title: string;
  branding?: Branding;
}) {
  const host = useRef<HTMLDivElement>(null),
    viewer = useRef<Viewer>(null),
    template = useRef<Template>(null);
  const [error, setError] = useState<Error | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let gone = false;
    Promise.all([runtime(), brandedPaper(definition, title, branding)])
      .then(([rt, paper]) => {
        if (gone || !host.current) return;
        const fields = new Map(
          allFields(definition).map((f) => [f.name, f.field]),
        );
        for (const schema of paper.schemas.flat())
          if (schema.type === "text") {
            schema.readOnly = false;
            if (fields.has(schema.name))
              schema.content = `[${fields.get(schema.name)!.label}]`;
            else if (schema.name.startsWith("patient_"))
              schema.content =
                (
                  {
                    patient_name: "Patient: linked record",
                    patient_ccu360: "CCU360: ••••••",
                    patient_ip: "IP: facility identifier",
                    patient_dob: "DOB: linked record",
                  } as Record<string, string>
                )[schema.name] ?? "Linked patient detail";
          }
        if (typeof paper.basePdf === "object" && "width" in paper.basePdf)
          paper.basePdf.staticSchema = [
            {
              name: "display_template_preview",
              type: "text",
              position: { x: 15, y: paper.basePdf.height - 7 },
              width: paper.basePdf.width - 30,
              height: 4,
              fontName: "Inter",
              fontSize: 7,
              readOnly: false,
              content:
                "FORM TEMPLATE PREVIEW · Not a patient record · No clinical attestation",
            },
          ];
        template.current = paper;
        viewer.current = new rt.Viewer({
          domContainer: host.current,
          template: paper,
          inputs: documentInputs(paper),
          plugins: rt.plugins,
          options: { font: rt.font, zoomLevel: 0.8 },
        });
        setReady(true);
      })
      .catch((e) => {
        if (!gone) setError(e);
      });
    return () => {
      gone = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, [definition, title, branding]);
  return (
    <>
      <div className="studio-pdf-toolbar">
        <span>
          Blank template · {definition.document?.schemas.length ?? "Automatic"}{" "}
          pages
        </span>
        <button
          type="button"
          className={buttonClasses.secondary}
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rt = await runtime(),
                paper = template.current!;
              downloadBytes(
                await rt.generate({
                  template: paper,
                  inputs: documentInputs(paper),
                  plugins: rt.plugins,
                  options: { font: rt.font },
                }),
                "CCU360-form-preview.pdf",
              );
            } catch (e) {
              setError(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparing PDF…" : "Download preview PDF"}
        </button>
      </div>
      <Notice error={error} />
      {!ready && !error && <p role="status">Preparing document preview…</p>}
      <div className="studio-pdf-viewport">
        <div ref={host} style={{ height: 760, minWidth: 650 }} />
      </div>
    </>
  );
}
