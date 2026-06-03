import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/extract-pdf-text";
import { isPdfFile, PDF_ONLY_MESSAGE } from "@/lib/file-types";
import { analyzeTapuTextWithGpt } from "@/lib/openai-tapu";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF dosyası gönderilmedi." },
        { status: 400 }
      );
    }

    if (!isPdfFile(file)) {
      return NextResponse.json({ error: PDF_ONLY_MESSAGE }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tapuMetni = await extractTextFromPdfBuffer(buffer);
    const sonuc = await analyzeTapuTextWithGpt(tapuMetni);

    return NextResponse.json(sonuc);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
    console.error("[analyze-tapu]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
