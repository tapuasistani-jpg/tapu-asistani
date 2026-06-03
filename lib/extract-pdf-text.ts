import type { PDFDocumentProxy } from "pdfjs-dist";

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf: PDFDocumentProxy = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  await pdf.destroy();

  const fullText = pageTexts.join("\n\n").trim();
  if (!fullText) {
    throw new Error(
      "PDF'den metin okunamadı. Belge taranmış görüntü olabilir; metin içeren PDF yükleyin."
    );
  }

  return fullText;
}
