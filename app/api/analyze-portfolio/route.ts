import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/extract-pdf-text";
import { isPdfFile, PDF_ONLY_MESSAGE } from "@/lib/file-types";
import { analyzePortfoyYerel } from "@/lib/tapu-metin-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");

    const files = entries.filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "En az bir PDF dosyası gönderilmelidir." },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!isPdfFile(file)) {
        return NextResponse.json({ error: PDF_ONLY_MESSAGE }, { status: 400 });
      }
    }

    const belgeler = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const metin = await extractTextFromPdfBuffer(buffer);
        return { dosyaAdi: file.name, metin };
      })
    );

    const sonuc = analyzePortfoyYerel(belgeler);

    return NextResponse.json(sonuc);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
    console.error("[analyze-portfolio]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
