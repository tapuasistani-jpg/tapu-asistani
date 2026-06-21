import pdfParse from "pdf-parse";

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  const data = await pdfParse(buffer);

  const fullText = data.text?.trim() ?? "";
  if (!fullText) {
    throw new Error(
      "PDF'den metin okunamadı. Belge taranmış görüntü olabilir; metin içeren PDF yükleyin."
    );
  }

  return fullText;
}
