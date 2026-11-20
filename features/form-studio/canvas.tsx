"use client";
/* eslint-disable @next/next/no-img-element -- Tenant logos use authenticated routes and must not enter the public image optimizer. */
import { useState } from "react";
import { useStore } from "zustand";
import type { StudioStore } from "./store";
import {
  fieldTypes,
  newField,
  newSection,
  uid,
  moveField,
  type FormField,
} from "./model";
import { FieldPreview } from "./field-preview";
import type { brand } from "@/features/live/journey-contract";
import type { z } from "zod";
const dragKey = "application/x-ccu360-form-component";
export function FormCanvas({
  store,
  branding,
}: {
  store: StudioStore;
  branding?: z.infer<typeof brand>;
}) {
  const state = useStore(store),
    { draft, selection, edit, select } = state;
  const [search, setSearch] = useState("");
  const stage =
    draft.definition.stages.find((s) => s.key === selection.stage) ??
    draft.definition.stages[0];
  const selectedSection = stage.sections.find(
    (s) => s.key === selection.section,
  );
  const addField = (
    type: FormField["type"],
    sectionKey = selectedSection?.key,
    beforeKey?: string,
  ) => {
    const field = newField(type),
      section = sectionKey ? undefined : newSection();
    if (section) section.fields = [field];
    edit((d) => {
      const target = d.definition.stages.find((s) => s.key === stage.key)!;
      if (section) target.sections.push(section);
      else {
        const section = target.sections.find((s) => s.key === sectionKey)!;
        const before = beforeKey
          ? section.fields.findIndex((f) => f.key === beforeKey)
          : -1;
        section.fields.splice(
          before < 0 ? section.fields.length : before,
          0,
          field,
        );
      }
    });
    select({
      stage: stage.key,
      section: section?.key ?? sectionKey,
      field: field.key,
    });
  };
  const drop = (
    event: React.DragEvent,
    sectionKey: string,
    beforeKey?: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const data = JSON.parse(event.dataTransfer.getData(dragKey));
      const target = stage.sections.find((s) => s.key === sectionKey);
      if (
        data.type &&
        fieldTypes.some(([t]) => t === data.type) &&
        target &&
        target.fields.length < 30
      )
        addField(data.type, sectionKey, beforeKey);
      else if (
        typeof data.field === "string" &&
        typeof data.section === "string"
      ) {
        let moved: string | undefined;
        edit((d) => {
          moved = moveField(
            d.definition,
            stage.key,
            data.section,
            sectionKey,
            data.field,
            beforeKey,
          );
        });
        if (moved)
          select({ stage: stage.key, section: sectionKey, field: moved });
      }
    } catch {
      /* External drags cannot change a template. */
    }
  };
  const addSection = () => {
    const section = newSection();
    edit((d) =>
      d.definition.stages
        .find((s) => s.key === stage.key)!
        .sections.push(section),
    );
    select({ stage: stage.key, section: section.key });
  };
  const move = (sectionKey: string, fieldKey: string, delta: number) =>
    edit((d) => {
      const fields = d.definition.stages
        .find((s) => s.key === stage.key)!
        .sections.find((s) => s.key === sectionKey)!.fields;
      const i = fields.findIndex((f) => f.key === fieldKey);
      const j = i + delta;
      if (j >= 0 && j < fields.length)
        [fields[i], fields[j]] = [fields[j], fields[i]];
    });
  return (
    <div className="studio-build-grid">
      <aside className="studio-palette" aria-label="Component library">
        <p className="studio-kicker">COMPONENTS</p>
        <h3>Build your form</h3>
        <p className="studio-helper">Click to add, or drag into a section.</p>
        <input
          aria-label="Search components"
          placeholder="Search components…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="studio-palette-list">
          {fieldTypes
            .filter(([, label]) =>
              label.toLowerCase().includes(search.toLowerCase()),
            )
            .map(([type, label, detail]) => (
              <button
                type="button"
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(dragKey, JSON.stringify({ type }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addField(type)}
                disabled={
                  (selectedSection?.fields.length ?? 0) >= 30 ||
                  (!selectedSection && stage.sections.length >= 32)
                }
                title={detail}
              >
                <span className="studio-component-symbol">
                  {
                    {
                      text: "Aa",
                      textarea: "¶",
                      number: "123",
                      table: "▦",
                      attachment: "↥",
                      link: "↗",
                      choice: "⌄",
                      boolean: "✓",
                      date: "31",
                      time: "◷",
                      datetime: "◴",
                      radio: "◉",
                      multichoice: "☑",
                      observation_refs: "◎",
                    }[type]
                  }
                </span>
                <span>{label}</span>
                <span className="studio-add">+</span>
              </button>
            ))}
        </div>
        <button
          type="button"
          className="studio-add-section"
          onClick={addSection}
          disabled={stage.sections.length >= 32}
        >
          + Add section
        </button>
        <button
          type="button"
          className="studio-add-section"
          disabled={!selectedSection}
          onClick={() =>
            edit((d) => {
              d.definition.stages
                .find((s) => s.key === stage.key)!
                .sections.find(
                  (s) => s.key === selectedSection!.key,
                )!.attestation_required = true;
            })
          }
        >
          + Authenticated sign-off
        </button>
        <p className="studio-helper">
          Patient identity is linked automatically. It is captured once by
          reception.
        </p>
        <nav className="studio-outline" aria-label="Journey stages">
          <p className="studio-kicker">JOURNEY OUTLINE</p>
          {draft.definition.stages.map((s, i) => (
            <button
              type="button"
              className={s.key === stage.key ? "is-active" : ""}
              key={s.key}
              onClick={() =>
                select({ stage: s.key, section: s.sections[0]?.key })
              }
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {s.label}
              <small>{s.sections.filter((x) => x.enabled).length}</small>
            </button>
          ))}
        </nav>
      </aside>
      <div className="studio-canvas-area">
        <div className="studio-canvas-toolbar">
          <span>{stage.label}</span>
          <span>
            {stage.sections.length} sections · A4 document layout available in
            PDF pages
          </span>
        </div>
        <article
          className="studio-paper"
          aria-label="Visual form canvas"
          style={
            {
              "--studio-brand": branding?.primary_color ?? "#103b4c",
              "--studio-accent": branding?.accent_color ?? "#17665f",
            } as React.CSSProperties
          }
        >
          <header className="studio-paper-header">
            <div>
              <p className="studio-kicker">PATIENT JOURNEY RECORD</p>
              <h2>{branding?.title ?? "Your facility"}</h2>
              <p>{draft.name}</p>
            </div>
            {branding?.logo_id && (
              <img
                alt="Facility logo"
                src={`/api/v1/journey/config/logos/${branding.logo_id}`}
              />
            )}
          </header>
          <div className="studio-patient-strip">
            <div>
              <small>Patient name</small>
              <strong>Linked patient record</strong>
            </div>
            <div>
              <small>CCU360 number</small>
              <strong>••••••</strong>
            </div>
            <div>
              <small>IP number</small>
              <strong>Facility identifier</strong>
            </div>
          </div>
          <button
            type="button"
            className="studio-stage-heading"
            onClick={() => select({ stage: stage.key })}
          >
            <span>{stage.label}</span>
            <small>Edit stage title</small>
          </button>
          {stage.sections.map((section, si) => (
            <section
              key={section.key}
              className={`studio-section ${selection.section === section.key ? "is-selected" : ""} ${!section.enabled ? "is-disabled" : ""}`}
              aria-label={section.label}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(dragKey)) e.preventDefault();
              }}
              onDrop={(e) => drop(e, section.key)}
            >
              <div className="studio-section-heading">
                <button
                  type="button"
                  onClick={() =>
                    select({ stage: stage.key, section: section.key })
                  }
                >
                  <span className="studio-section-number">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{section.label}</strong>
                    <small>
                      {section.kind === "administrative"
                        ? "Reception / administration"
                        : "Clinical documentation"}
                      {!section.enabled ? " · Hidden from employees" : ""}
                    </small>
                  </span>
                </button>
                <span className="studio-section-badge">
                  {(section.write_role_ids ?? section.role_ids).length} writing
                  teams
                </span>
              </div>
              <div className="studio-fields">
                {section.fields.map((field, fi) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={field.key}
                    className={`studio-field ${selection.field === field.key && selection.section === section.key ? "is-selected" : ""}`}
                    aria-label={`Edit ${field.label}`}
                    onClick={() =>
                      select({
                        stage: stage.key,
                        section: section.key,
                        field: field.key,
                      })
                    }
                    onKeyDown={(e) => {
                      if (
                        e.target === e.currentTarget &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        select({
                          stage: stage.key,
                          section: section.key,
                          field: field.key,
                        });
                      }
                    }}
                    draggable
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(dragKey))
                        e.preventDefault();
                    }}
                    onDrop={(e) => drop(e, section.key, field.key)}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData(
                        dragKey,
                        JSON.stringify({
                          field: field.key,
                          section: section.key,
                        }),
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <div className="studio-field-label">
                      <strong>
                        {field.label}
                        {field.required && (
                          <span className="studio-required"> *</span>
                        )}
                      </strong>
                      <small>
                        {fieldTypes.find(([t]) => t === field.type)?.[1]}
                      </small>
                    </div>
                    <FieldPreview field={field} />
                    {selection.field === field.key &&
                      selection.section === section.key && (
                        <div className="studio-field-actions">
                          <button
                            type="button"
                            aria-label={`Move ${field.label} up`}
                            disabled={!fi}
                            onClick={(e) => {
                              e.stopPropagation();
                              move(section.key, field.key, -1);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${field.label} down`}
                            disabled={fi === section.fields.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              move(section.key, field.key, 1);
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicate ${field.label}`}
                            disabled={section.fields.length >= 30}
                            onClick={(e) => {
                              e.stopPropagation();
                              const copy = {
                                ...structuredClone(field),
                                key: uid("field"),
                                label: `${field.label.slice(0, 113)} (copy)`,
                              };
                              edit((d) =>
                                d.definition.stages
                                  .find((s) => s.key === stage.key)!
                                  .sections.find((s) => s.key === section.key)!
                                  .fields.splice(fi + 1, 0, copy),
                              );
                              select({
                                stage: stage.key,
                                section: section.key,
                                field: copy.key,
                              });
                            }}
                          >
                            Duplicate
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="studio-drop-zone"
                onClick={() => {
                  select({ stage: stage.key, section: section.key });
                  addField("text", section.key);
                }}
                disabled={section.fields.length >= 30}
              >
                + Add field · or drop a component here
              </button>
              {section.attestation_required && (
                <p className="studio-signoff">
                  ✓ Authenticated employee attestation required
                </p>
              )}
            </section>
          ))}
          <button
            type="button"
            className="studio-empty-section"
            onClick={addSection}
            disabled={stage.sections.length >= 32}
          >
            + Add a section to {stage.label}
            <small>
              Group fields and assign the team responsible for completing them.
            </small>
          </button>
          <footer className="studio-paper-footer">
            CCU360 · Shared across linked care teams · Changes are recorded in
            the patient ledger
          </footer>
        </article>
      </div>
    </div>
  );
}
