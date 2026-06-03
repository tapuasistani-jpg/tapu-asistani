/** PDF'in ilk sayfasını canvas görüntüsüne (data URL) dönüştürür */
export async function pdfIlkSayfaDataUrl(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas oluşturulamadı.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  await pdf.destroy();

  return canvas.toDataURL("image/png");
}
