import type { Template, Schema } from "@pdfme/common";
import type { Definition } from "@/features/live/journey-contract";

export const fieldName = (section: string, field: string) =>
  `${section}__${field}`;
const text = (
  name: string,
  content: string,
  x: number,
  y: number,
  width = 180,
  height = 8,
  fontSize = 10,
): Schema => ({
  name,
  type: "text",
  content,
  position: { x, y },
  width,
  height,
  fontName: "Inter",
  fontSize,
  fontColor: "#153b4c",
  alignment: "left",
  verticalAlignment: "top",
  lineHeight: 1.2,
  overflow: "expand",
  readOnly: true,
});
/** Stable names bind geometry to structured clinical fields. No executable expressions. */
export function createPaper(definition: Definition, title: string): Template {
  const pages: Schema[][] = [];
  let page: Schema[] = [],
    y = 0,
    sequence = 0;
  const start = () => {
    page = [
      text(`display_title_${pages.length}`, title, 15, 12, 180, 10, 15),
      text(
        `display_caption_${pages.length}`,
        "CCU360 | Shared patient journey",
        15,
        23,
        180,
        6,
        9,
      ),
    ];
    if (!pages.length)
      page.push(
        text("patient_name", "Patient name", 15, 34, 110),
        text("patient_ccu360", "CCU360 number", 130, 34, 65),
        text("patient_ip", "IP number", 15, 44, 110),
        text("patient_dob", "Date of birth", 130, 44, 65),
      );
    pages.push(page);
    y = pages.length === 1 ? 61 : 37;
  };
  start();
  for (const stage of definition.stages)
    for (const section of stage.sections.filter((s) => s.enabled)) {
      if (y > 240) start();
      page.push(
        text(
          `display_section_${sequence++}`,
          section.label,
          15,
          y,
          180,
          10,
          12,
        ),
      );
      y += 12;
      for (const field of section.fields) {
        const h =
          field.type === "table" ? 42 : field.type === "textarea" ? 26 : 14;
        if (y + h + 12 > 278) {
          start();
          page.push(
            text(
              `display_section_${sequence++}`,
              `${section.label} (continued)`,
              15,
              y,
              180,
              8,
              12,
            ),
          );
          y += 10;
        }
        page.push(
          text(
            `display_label_${sequence++}`,
            field.label + (field.required ? " *" : ""),
            15,
            y,
            180,
            7,
            9,
          ),
        );
        y += 8;
        const name = fieldName(section.key, field.key);
        if (field.type === "table") {
          const columns = field.columns ?? [];
          page.push({
            name,
            type: "table",
            position: { x: 15, y },
            width: 180,
            height: h,
            content: JSON.stringify([columns.map(() => "")]),
            showHead: true,
            repeatHead: true,
            head: columns.map((c) => c.label),
            headWidthPercentages: columns.map(() => 100 / columns.length),
            columnStyles: {},
            tableStyles: { borderColor: "#b7cbd0", borderWidth: 0.2 },
            headStyles: {
              fontName: "Inter",
              fontSize: 9,
              fontColor: "#ffffff",
              backgroundColor: "#17665f",
              padding: { top: 2, right: 2, bottom: 2, left: 2 },
            },
            bodyStyles: {
              fontName: "Inter",
              fontSize: 9,
              fontColor: "#153b4c",
              borderColor: "#b7cbd0",
              borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
              padding: { top: 2, right: 2, bottom: 2, left: 2 },
            },
            readOnly: true,
          });
        } else page.push(text(name, "", 15, y, 180, h));
        y += h + 7;
      }
      y += 6;
    }
  return {
    basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
    schemas: pages,
  };
}
export function fromDefinition(
  definition: Definition,
  title: string,
): Template {
  const saved = definition.document;
  return saved
    ? (structuredClone({
        basePdf: saved.basePdf,
        schemas: saved.schemas,
      }) as Template)
    : createPaper(definition, title);
}
const keep = new Set([
  "name",
  "type",
  "position",
  "width",
  "height",
  "rotate",
  "opacity",
  "readOnly",
  "content",
  "required",
  "fontSize",
  "fontName",
  "fontColor",
  "backgroundColor",
  "alignment",
  "verticalAlignment",
  "lineHeight",
  "characterSpacing",
  "strikethrough",
  "underline",
  "dynamicFontSize",
  "overflow",
  "borderWidth",
  "borderColor",
  "radius",
  "head",
  "headWidthPercentages",
  "showHead",
  "repeatHead",
  "tableStyles",
  "headStyles",
  "bodyStyles",
  "columnStyles",
  "alternateBackgroundColor",
  "padding",
  "textFormat",
  "fontVariantFallback",
  "color",
  "objectFit",
  "objectPosition",
]);
export function storedLayout(
  template: Template,
): NonNullable<Definition["document"]> {
  if (typeof template.basePdf !== "object" || !("width" in template.basePdf))
    throw new Error("Use blank A4 pages for this document.");
  return {
    engine: "pdfme",
    version: 1,
    basePdf: {
      width: template.basePdf.width,
      height: template.basePdf.height,
      padding: [...template.basePdf.padding],
    },
    schemas: template.schemas.map((page) =>
      page.map((schema) =>
        Object.fromEntries(
          Object.entries(schema).filter(([key]) => keep.has(key)),
        ),
      ),
    ),
  };
}
