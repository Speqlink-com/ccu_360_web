"use client";
import type { CSSProperties } from "react";
import { z } from "zod";
import { brand, type Definition } from "./journey-contract";

export function TemplatePreview({
  definition,
  branding,
  stageKey,
}: {
  definition: Definition;
  branding?: z.infer<typeof brand>;
  stageKey: string;
}) {
  const stage =
    definition.stages.find((item) => item.key === stageKey) ??
    definition.stages[0];
  return (
    <div
      aria-label="Journey form preview"
      className="overflow-hidden rounded-xl border border-border bg-[#f2f6f8]"
      style={
        {
          "--document-primary": branding?.primary_color ?? "#092744",
          "--document-accent": branding?.accent_color ?? "#008f89",
        } as CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-4 border-b-4 border-[var(--document-accent)] bg-white p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            Facility document preview
          </p>
          <h3 className="mt-2 text-xl text-[var(--document-primary)]">
            {branding?.title ?? "Your facility"}
          </h3>
          <p className="text-sm text-muted">CCU360 · Clinical journey ledger</p>
        </div>
        {branding?.logo_id && (
          // eslint-disable-next-line @next/next/no-img-element -- Authenticated tenant asset; do not expose to the public image optimizer.
          <img
            alt="Facility logo preview"
            className="max-h-16 max-w-32 object-contain"
            src={`/api/v1/journey/config/logos/${branding.logo_id}`}
          />
        )}
      </div>
      <div className="p-6">
        <p className="mb-4 rounded-lg border border-border bg-white p-3 text-sm text-muted">
          Illustrative preview · No patient information or attestation is saved
          here.
        </p>
        <h3 className="text-2xl text-[var(--document-primary)]">
          Patient Journey Record
        </h3>
        <div className="my-5 grid grid-cols-2 gap-4 rounded-lg border border-border bg-white p-4 text-sm">
          <div>
            <small className="block text-muted">
              Patient / facility identifier
            </small>
            Sample Patient · SAMPLE-001
          </div>
          <div>
            <small className="block text-muted">
              Encounter / care location
            </small>
            Illustrative encounter · ICU / Bed 04
          </div>
        </div>
        <h4 className="mb-4 text-xl text-[var(--document-primary)]">
          {stage.label}
        </h4>
        {stage.sections
          .filter((section) => section.enabled)
          .map((section) => (
            <section
              key={section.key}
              className="mb-4 rounded-lg border border-border bg-white p-5"
            >
              <h5 className="mb-1 font-semibold text-[var(--document-primary)]">
                {section.label}
              </h5>
              <p className="mb-4 text-xs text-muted">
                {section.identity_roles.join(" · ")} · Authenticated team
                contributions
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <p className="mb-2 text-sm font-medium">
                      {field.label}
                      {field.required ? " *" : ""}
                    </p>
                    <div className="min-h-11 rounded-md border border-border bg-[#f8fafb] p-3 text-sm text-muted">
                      {field.type === "observation_refs"
                        ? "Link an original observation"
                        : field.choices.length
                          ? field.choices.join(" / ")
                          : field.type === "boolean"
                            ? "Yes / No"
                            : ((
                                {
                                  text: "Enter information",
                                  textarea: "Enter information",
                                  number: "Enter a number",
                                  date: "Select a date",
                                  time: "Select a time",
                                  datetime: "Select a date and time",
                                } as Record<string, string>
                              )[field.type] ?? "Enter information")}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-border pt-3 text-xs text-muted">
                Accountability · Actual employee, professional role, recording
                time and authenticated attestation appear on the saved record.
              </p>
            </section>
          ))}
        {!stage.sections.some((section) => section.enabled) && (
          <p className="rounded-lg bg-white p-5">
            No enabled section. Enable a section and assign an eligible
            care-team role before publishing.
          </p>
        )}
      </div>
    </div>
  );
}
