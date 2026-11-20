import type { Template } from "@pdfme/common";
import type { z } from "zod";
import type { brand, Definition } from "@/features/live/journey-contract";
import { fromDefinition } from "@/features/document-studio/layout";
export type Branding = z.infer<typeof brand>;
export async function logoData(
  branding?: Branding,
): Promise<string | undefined> {
  if (!branding?.logo_id) return;
  const response = await fetch(
    `/api/v1/journey/config/logos/${branding.logo_id}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok)
    throw new Error(
      "The facility logo could not be loaded. Reload branding before saving the document.",
    );
  const blob = await response.blob(),
    image = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 256 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image preparation is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.85);
    if (result.length > 200000)
      throw new Error("Use a smaller facility logo for the document header.");
    return result;
  } finally {
    image.close();
  }
}
export async function brandedPaper(
  definition: Definition,
  title: string,
  branding?: Branding,
  refreshHeader = false,
): Promise<Template> {
  const template = fromDefinition(definition, title);
  if (definition.document && !refreshHeader) return template;
  const logo = await logoData(branding);
  for (const [i, page] of template.schemas.entries()) {
    for (let index = page.length - 1; index >= 0; index--)
      if (page[index].name.startsWith("display_facility_logo_"))
        page.splice(index, 1);
    for (const s of page) {
      if (s.name.startsWith("display_title_")) {
        s.content = branding?.title ?? title;
        s.fontColor = branding?.primary_color ?? "#153b4c";
        if (logo) s.width = 145;
      }
      if (s.name.startsWith("display_caption_")) s.content = title;
      if (s.type === "table" && s.headStyles)
        (s.headStyles as Record<string, unknown>).backgroundColor =
          branding?.accent_color ?? "#17665f";
    }
    if (logo)
      page.push({
        name: `display_facility_logo_${i}`,
        type: "image",
        content: logo,
        position: { x: 168, y: 12 },
        width: 27,
        height: 17,
        objectFit: "contain",
        readOnly: true,
      });
  }
  return template;
}
export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
