/** CCU360 accepts structured blank-page layouts, never arbitrary PDF backgrounds.
 * Keep pdfme's unused PDFium/Node converter out of both browser bundles. */
const unsupported = async (): Promise<never> => {
  throw new Error(
    "Use editable A4 pages for this journey document. PDF backgrounds cannot be imported.",
  );
};
export const pdf2img = unsupported;
export const pdf2size = unsupported;
export const img2pdf = unsupported;
