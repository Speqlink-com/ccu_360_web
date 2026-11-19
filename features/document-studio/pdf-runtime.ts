import { withPageNumbers } from "./page-numbers";
import type { Font } from "@pdfme/common";
let font: Promise<Font> | undefined;
export function loadFont() {
  return (font ??= fetch("/fonts/Inter.ttf", { cache: "force-cache" })
    .then(async (r) => {
      if (!r.ok)
        throw new Error("The document font could not be loaded. Retry.");
      return { Inter: { data: await r.arrayBuffer(), fallback: true } };
    })
    .catch((e) => {
      font = undefined;
      throw e;
    }));
}
export async function runtime() {
  const [{ Designer, Viewer }, { generate }, plugins, font] = await Promise.all(
    [
      import("@pdfme/ui"),
      import("@pdfme/generator"),
      import("@pdfme/schemas"),
      loadFont(),
    ],
  );
  const documentText = withPageNumbers(plugins.text);
  return {
    Designer,
    Viewer,
    generate,
    font,
    plugins: {
      Text: documentText,
      Table: plugins.table,
      Image: plugins.image,
      Line: plugins.line,
      Rectangle: plugins.rectangle,
      Ellipse: plugins.ellipse,
    },
  };
}
