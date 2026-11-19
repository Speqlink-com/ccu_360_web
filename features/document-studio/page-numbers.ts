import type { text } from "@pdfme/schemas";
/** Page labels are drawn from the PDF page itself; clinical text stays literal. */
export function withPageNumbers(plugin: typeof text): typeof text {
  return {
    ...plugin,
    pdf: (args) =>
      plugin.pdf({
        ...args,
        value:
          args.schema.name === "display_page_number"
            ? `Page ${args.pdfDoc.getPages().indexOf(args.page) + 1}`
            : args.value,
      }),
  };
}
