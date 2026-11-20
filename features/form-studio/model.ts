import type { Definition, Section } from "@/features/live/journey-contract";
import type { Template } from "@pdfme/common";
import {
  createPaper,
  fieldName,
  fromDefinition,
  storedLayout,
} from "@/features/document-studio/layout";
export type FormField = Section["fields"][number];
export const fieldTypes: [FormField["type"], string, string][] = [
  ["text", "Short text", "Names, descriptions and brief answers"],
  ["textarea", "Long text", "Clinical narratives and detailed notes"],
  ["number", "Number", "Measurements and numeric answers"],
  ["choice", "Dropdown", "Choose one answer from a list"],
  ["radio", "Single choice", "Show every available answer"],
  ["multichoice", "Multiple choices", "Choose several answers"],
  ["boolean", "Yes / no", "A clear binary answer"],
  ["date", "Date", "Calendar date"],
  ["time", "Time", "Time of day"],
  ["datetime", "Date & time", "Date and time together"],
  ["table", "Repeating table", "Structured rows with typed columns"],
  ["attachment", "Images & files", "Private clinical evidence"],
  ["link", "Web link", "An HTTPS reference"],
  ["observation_refs", "Observation reference", "Reuse recorded observations"],
];
export const uid = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
export function newField(type: FormField["type"]): FormField {
  return {
    key: uid("field"),
    label: fieldTypes.find(([t]) => t === type)![1],
    type,
    required: false,
    choices: ["choice", "radio", "multichoice"].includes(type)
      ? ["Option one", "Option two"]
      : [],
    columns:
      type === "table"
        ? [
            {
              key: "description",
              label: "Description",
              type: "text",
              required: false,
              choices: [],
            },
          ]
        : [],
    max_rows: 20,
  };
}
export function newSection(): Section {
  return {
    key: uid("section"),
    label: "New section",
    kind: "clinical",
    identity_roles: ["doctor", "nurse", "allied"],
    role_ids: [],
    write_role_ids: [],
    enabled: true,
    attestation_required: false,
    fields: [newField("textarea")],
  };
}
export function allFields(definition: Definition) {
  return definition.stages.flatMap((stage) =>
    stage.sections
      .filter((s) => s.enabled)
      .flatMap((section) =>
        section.fields.map((field) => ({
          stage,
          section,
          field,
          name: fieldName(section.key, field.key),
        })),
      ),
  );
}
export const patientBindings = [
  ["patient_name", "Patient name"],
  ["patient_ccu360", "CCU360 number"],
  ["patient_ip", "IP number"],
  ["patient_dob", "Date of birth"],
  ["journey_started", "Journey start"],
  ["journey_reference", "Journey reference"],
] as const;
function generatedSection(name: string, definition: Definition) {
  return definition.stages
    .flatMap((stage) => stage.sections)
    .find((section) => {
      const prefix = `display_section_${section.key}_`;
      return (
        name.startsWith(prefix) &&
        /^(?:[0-9]+|h_[a-f0-9]{12})$/.test(name.slice(prefix.length))
      );
    });
}
/** Reconcile schema edits without discarding an administrator's page geometry. */
export function syncPaper(
  definition: Definition,
  title: string,
): NonNullable<Definition["document"]> {
  const fresh = createPaper(definition, title);
  if (definition.document) {
    const { width, height } = definition.document.basePdf;
    for (const item of fresh.schemas.flat()) {
      item.position.x *= width / 210;
      item.position.y *= height / 297;
      item.width *= width / 210;
      item.height *= height / 297;
    }
    fresh.basePdf = {
      width,
      height,
      padding: [...definition.document.basePdf.padding] as [
        number,
        number,
        number,
        number,
      ],
    };
  }
  if (!definition.document) return storedLayout(fresh);
  const paper = fromDefinition(definition, title);
  const fields = new Map(allFields(definition).map((f) => [f.name, f.field]));
  const seen = new Set<string>();
  paper.schemas = paper.schemas.map((page) =>
    page.filter((schema) => {
      if (
        schema.name.includes("__") &&
        !schema.name.startsWith("display_") &&
        !fields.has(schema.name)
      )
        return false;
      if (
        schema.name.startsWith("display_label_") &&
        schema.name.includes("__") &&
        !fields.has(schema.name.slice(14))
      )
        return false;
      if (fields.has(schema.name)) {
        if (seen.has(schema.name)) return false;
        seen.add(schema.name);
        const field = fields.get(schema.name)!;
        const source = fresh.schemas
          .flat()
          .find((s) => s.name === schema.name)!;
        if (schema.type !== source.type)
          Object.assign(schema, source, {
            position: schema.position,
            width: schema.width,
            height: Math.min(
              source.height,
              definition.document!.basePdf.height - schema.position.y,
            ),
          });
        if (field.type === "table") {
          if (
            !Array.isArray(schema.head) ||
            schema.head.length !== field.columns!.length
          )
            schema.content = JSON.stringify([field.columns!.map(() => "")]);
          schema.head = field.columns!.map((c) => c.label);
          const old = schema.headWidthPercentages as number[] | undefined;
          if (old?.length !== field.columns!.length)
            schema.headWidthPercentages = field.columns!.map(
              () => 100 / field.columns!.length,
            );
        }
      }
      const linkedSection = generatedSection(schema.name, definition);
      if (
        /^display_section_[a-z][a-z0-9_]*_(?:[0-9]+|h_[a-f0-9]{12})$/.test(
          schema.name,
        ) &&
        (!linkedSection || !linkedSection.enabled)
      )
        return false;
      if (linkedSection)
        schema.content =
          linkedSection.label +
          (String(schema.content).endsWith(" (continued)")
            ? " (continued)"
            : "");
      const field = fields.get(schema.name.replace(/^display_label_/, ""));
      if (schema.name.startsWith("display_label_") && field)
        schema.content = field.label + (field.required ? " *" : "");
      return true;
    }),
  );
  const missing = new Set([...fields.keys()].filter((name) => !seen.has(name)));
  // Add only missing fields and their labels on fresh pages. Existing canvas content stays in place.
  if (missing.size)
    for (const page of fresh.schemas) {
      const content = page.filter(
        (s) =>
          missing.has(s.name) ||
          (s.name.startsWith("display_label_") &&
            missing.has(s.name.slice(14))),
      );
      if (content.length) {
        const headers = [
          "display_title_",
          "display_caption_",
          "display_facility_logo_",
        ].flatMap((prefix) => {
          const source =
            paper.schemas.flat().find((item) => item.name.startsWith(prefix)) ??
            page.find((item) => item.name.startsWith(prefix));
          return source
            ? [{ ...structuredClone(source), name: uid(prefix.slice(0, -1)) }]
            : [];
        });
        const sectionKeys = new Set(
          allFields(definition)
            .filter((item) =>
              content.some((element) => element.name === item.name),
            )
            .map((item) => item.section.key),
        );
        const headings = page.flatMap((item) => {
          const section = generatedSection(item.name, definition);
          return section && sectionKeys.has(section.key)
            ? [
                {
                  ...structuredClone(item),
                  name: `display_section_${section.key}_${uid("h")}`,
                },
              ]
            : [];
        });
        paper.schemas.push([...headers, ...headings, ...content]);
      }
    }
  // Generated decorative names may repeat between old and newly appended pages.
  const names = new Set<string>();
  for (const schema of paper.schemas.flat()) {
    if (names.has(schema.name)) schema.name = uid("display");
    names.add(schema.name);
  }
  return storedLayout(paper);
}
export function normalizeDecorations(
  template: Template,
  definition: Definition,
): Template {
  const result = structuredClone(template);
  const bound = new Set([
    ...allFields(definition).map((f) => f.name),
    ...patientBindings.map(([name]) => name),
  ]);
  for (const item of result.schemas.flat())
    if (
      !bound.has(item.name) &&
      !item.name.startsWith("display_") &&
      !item.name.includes("__")
    )
      item.name = uid("display");
  return result;
}
export function paperIssues(
  template: Template,
  definition: Definition,
): string[] {
  const schemas = template.schemas.flat(),
    issues: string[] = [],
    names = schemas.map((s) => s.name);
  if (
    template.schemas.length > 30 ||
    schemas.length > 1200 ||
    template.schemas.some((p) => p.length > 150)
  )
    issues.push(
      "Use at most 30 pages, 150 elements per page and 1,200 elements in total.",
    );
  if (new Set(names).size !== names.length)
    issues.push(
      "Each document element needs a unique name. Remove duplicated linked fields.",
    );
  for (const { name, field } of allFields(definition)) {
    const matches = schemas.filter((s) => s.name === name);
    if (!matches.length)
      issues.push(
        `${field.label}: missing from the PDF. Use Sync linked fields.`,
      );
    else if (
      field.type === "table" &&
      JSON.stringify(matches[0].head) !==
        JSON.stringify(field.columns?.map((c) => c.label))
    )
      issues.push(
        `${field.label}: table columns differ from the clinical field. Use Sync linked fields.`,
      );
    else if (matches[0].type !== (field.type === "table" ? "table" : "text"))
      issues.push(
        `${field.label}: restore its linked element type using Sync linked fields.`,
      );
  }
  const bounds =
    typeof template.basePdf === "object" && "width" in template.basePdf
      ? template.basePdf
      : { width: 210, height: 297 };
  const fieldNames = new Set(allFields(definition).map((f) => f.name));
  for (const s of schemas) {
    if (s.type === "table" && !fieldNames.has(s.name))
      issues.push(
        "Create repeating tables in Build form so their columns are linked to clinical data.",
      );
    if (
      s.position.x < 0 ||
      s.position.y < 0 ||
      s.position.x + s.width > bounds.width + 0.2 ||
      s.position.y + s.height > bounds.height + 0.2
    )
      issues.push(`${s.name}: move this element inside the A4 page.`);
    if (
      s.type === "image" &&
      !/^data:image\/(png|jpeg);base64,/.test(s.content ?? "")
    )
      issues.push(
        "Images must be embedded PNG or JPEG files. Remote images are not accepted.",
      );
    if (
      s.type !== "image" &&
      /[{}]|https?:|javascript:|file:|data:/i.test(
        JSON.stringify(s.content ?? ""),
      )
    )
      issues.push(
        `${s.name}: use plain labels; place patient links in a Web link field.`,
      );
  }
  return [...new Set(issues)];
}

/** Move a field without creating an invalid empty section or duplicate data key. */
export function moveField(
  definition: Definition,
  stageKey: string,
  sourceKey: string,
  targetKey: string,
  fieldKey: string,
  beforeKey?: string,
): string | undefined {
  const stage = definition.stages.find((s) => s.key === stageKey),
    source = stage?.sections.find((s) => s.key === sourceKey),
    target = stage?.sections.find((s) => s.key === targetKey);
  if (
    !source ||
    !target ||
    (source !== target &&
      (source.fields.length <= 1 || target.fields.length >= 30))
  )
    return;
  const index = source.fields.findIndex((f) => f.key === fieldKey);
  if (index < 0 || beforeKey === fieldKey) return;
  const field = source.fields.splice(index, 1)[0];
  if (source !== target && target.fields.some((f) => f.key === field.key))
    field.key = uid("field");
  const before = beforeKey
    ? target.fields.findIndex((f) => f.key === beforeKey)
    : -1;
  target.fields.splice(before < 0 ? target.fields.length : before, 0, field);
  return field.key;
}
