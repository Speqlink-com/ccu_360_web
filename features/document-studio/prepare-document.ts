import type { Schema, Template } from "@pdfme/common";
import type { DocumentSnapshot } from "./current-document";
import { fieldName, fromDefinition } from "./layout";
export function prepareDocument(data: DocumentSnapshot): Template {
  const view = data.case,
    template = fromDefinition(view.template.definition, view.template.name);
  const values: Record<string, string> = {
    patient_name: view.patient.display_name,
    patient_ccu360: `CCU360: ${view.patient.ccu360_number ?? "Not recorded"}`,
    patient_ip: `IP: ${view.patient.ip_number ?? view.patient.identifier}`,
    patient_dob: `DOB: ${view.patient.date_of_birth ?? "Not recorded"}`,
    journey_started: view.encounter.admitted_at,
    journey_reference: view.encounter.id,
  };
  for (const stage of view.template.definition.stages)
    for (const section of stage.sections) {
      const note = data.entries.find((e) => e.section_key === section.key);
      for (const field of section.fields) {
        const value = note?.values[field.key],
          name = fieldName(section.key, field.key);
        if (field.type === "table") {
          values[name] = JSON.stringify(
            value?.status === "present" && Array.isArray(value.value)
              ? value.value.map((row) =>
                  (field.columns ?? []).map((c) => {
                    const v =
                      row && typeof row === "object"
                        ? (row as Record<string, unknown>)[c.key]
                        : null;
                    return typeof v === "boolean"
                      ? v
                        ? "Yes"
                        : "No"
                      : String(v ?? "");
                  }),
                )
              : [
                  (field.columns ?? []).map((_, i) =>
                    i === 0
                      ? value
                        ? `${value.status}: ${value.reason ?? ""}`
                        : "Awaiting documentation"
                      : "",
                  ),
                ],
          );
        } else if (!value) values[name] = "Awaiting documentation";
        else if (value.status !== "present")
          values[name] =
            `${value.status.replaceAll("_", " ")}: ${value.reason ?? ""}`;
        else if (field.type === "attachment")
          values[name] = Array.isArray(value.value)
            ? value.value
                .map((id) => {
                  const file = data.attachments.find((f) => f.id === id);
                  return file
                    ? `${file.filename} [${file.sha256.slice(0, 12)}]`
                    : `File ${String(id)}`;
                })
                .join("\n")
            : "";
        else
          values[name] =
            typeof value.value === "boolean"
              ? value.value
                ? "Yes"
                : "No"
              : Array.isArray(value.value)
                ? value.value.join(", ")
                : String(value.value ?? "");
        if (note?.status === "draft" && field.type !== "table")
          values[name] =
            `[DRAFT - ${note.author.display_name}]\n${values[name]}`;
      }
    }
  for (const page of template.schemas)
    for (const schema of page) {
      schema.readOnly = true;
      if (schema.name in values) schema.content = values[schema.name];
      if (
        schema.type === "table" &&
        data.entries.some(
          (e) =>
            e.status === "draft" &&
            schema.name.startsWith(e.section_key + "__"),
        ) &&
        Array.isArray(schema.head)
      )
        schema.head = schema.head.map((value, index) =>
          index === 0 ? `DRAFT | ${value}` : value,
        );
    }
  // Provenance is part of each generated copy; no copy is presented as a personal signature.
  const page: Schema[] = [
    {
      name: "display_provenance_title",
      type: "text",
      position: { x: 15, y: 15 },
      width: 180,
      height: 10,
      fontName: "Inter",
      fontSize: 14,
      readOnly: true,
      content: "Document provenance",
    },
    {
      name: "display_provenance",
      type: "text",
      position: { x: 15, y: 30 },
      width: 180,
      height: 240,
      fontName: "Inter",
      fontSize: 9,
      lineHeight: 1.3,
      overflow: "expand",
      readOnly: true,
      content: [
        "Current sheet: latest note per section. Earlier rounds and revisions remain in the full ledger.",
        "Working copy. Drafts are not attested. Server integrity seals are available in the signed ledger export.",
        `Generated: ${new Date().toISOString()}`,
        `Journey: ${view.encounter.id}`,
        `Template version: ${view.template.version}`,
        `Source ledger version: ${view.encounter.version}`,
        `Ledger head: ${data.head_hash}`,
        ...(data.export_record
          ? [
              `Server output reference: ${data.export_record.output_id}`,
              `Signed HTML ledger SHA-256: ${String(data.export_record.manifest.html_sha256)}`,
              `Evidence signing key: ${data.export_record.key_id}`,
            ]
          : []),
        "",
        ...data.entries.map(
          (e) =>
            `${e.section_key} | ${e.status.toUpperCase()} | ${e.author.display_name} | ${e.author.team_role_name ?? ""} | ${e.recorded_at} | revision ${e.revision} | ${e.id}`,
        ),
      ].join("\n\n"),
    },
  ];
  if (typeof template.basePdf === "object" && "width" in template.basePdf) {
    const paper = template.basePdf;
    paper.padding = [
      Math.max(10, paper.padding[0]),
      paper.padding[1],
      Math.max(10, paper.padding[2]),
      paper.padding[3],
    ];
    paper.staticSchema = [
      {
        name: "display_patient_reference",
        type: "text",
        position: { x: 15, y: 3 },
        width: paper.width - 30,
        height: 5,
        fontName: "Inter",
        fontSize: 7,
        readOnly: false,
        content: `CCU360 ${view.patient.ccu360_number ?? "Registry record"} | Journey ${view.encounter.id}`,
      },
      {
        name: "display_copy_scope",
        type: "text",
        position: { x: 15, y: paper.height - 6 },
        width: paper.width - 65,
        height: 4,
        fontName: "Inter",
        fontSize: 7,
        readOnly: false,
        content: `Working copy - Drafts marked - Source ledger v${view.encounter.version}`,
      },
      {
        name: "display_page_number",
        type: "text",
        position: { x: paper.width - 45, y: paper.height - 6 },
        width: 30,
        height: 4,
        fontName: "Inter",
        fontSize: 7,
        readOnly: false,
        content: "",
      },
    ];
  }
  template.schemas.push(page);
  // Patient text is literal input, never a pdfme expression template.
  for (const page of template.schemas)
    for (const schema of page)
      if (schema.type === "text") schema.readOnly = false;
  return template;
}

export function documentInputs(template: Template) {
  return [
    Object.fromEntries(
      [
        ...template.schemas.flat(),
        ...(typeof template.basePdf === "object" && "width" in template.basePdf
          ? (template.basePdf.staticSchema ?? [])
          : []),
      ]
        .filter((schema) => schema.type === "text")
        .map((schema) => [schema.name, schema.content ?? ""]),
    ),
  ];
}
