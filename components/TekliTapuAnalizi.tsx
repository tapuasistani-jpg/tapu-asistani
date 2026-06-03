"use client";

import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import AnalizSonucPanel from "@/components/AnalizSonucPanel";
import {
  isPdfFile,
  PDF_ACCEPT,
  PDF_ONLY_MESSAGE,
} from "@/lib/file-types";
import { analyzeTapuPdf, type TapuAnalizSonucu } from "@/lib/tapu-analiz";

export default function TekliTapuAnalizi() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<TapuAnalizSonucu | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!isPdfFile(file)) {
      setFileName(null);
      setSonuc(null);
      setError(PDF_ONLY_MESSAGE);
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError(null);
    setSonuc(null);

    try {
      const analiz = await analyzeTapuPdf(file);
      setSonuc(analiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiz başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Upload className="h-5 w-5 text-brand-600" />
          Tapu PDF Yükle
        </h2>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !loading && inputRef.current?.click()}
          onKeyDown={(e) =>
            e.key === "Enter" && !loading && inputRef.current?.click()
          }
          className={`flex min-h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors ${
            loading
              ? "cursor-wait opacity-70"
              : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/50"
          }`}
        >
          <Upload className="mb-3 h-12 w-12 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            Yalnızca PDF dosyası yükleyin
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Çok sayfalı tapu belgeleri desteklenir
          </p>
          {fileName && (
            <p className="mt-4 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-brand-700 shadow-sm">
              <FileText className="h-4 w-4" />
              {fileName}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PDF_ACCEPT}
          className="hidden"
          disabled={loading}
          onChange={handleFileChange}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-brand-600" />
          Takyidat Raporu
        </h2>
        <AnalizSonucPanel
          loading={loading}
          error={error}
          sonuc={sonuc}
          emptyMessage="Analiz sonuçları burada görünecek. Sol taraftan bir tapu PDF dosyası yükleyin."
        />
      </section>
    </div>
  );
}
