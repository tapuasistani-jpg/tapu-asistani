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
    setError(null);
    setSonuc(null);
    setLoading(true);

    try {
      const res = await analyzeTapuPdf(file);
      setSonuc(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Upload className="h-5 w-5 text-brand-600" />
          Tapu PDF Yükleme
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
          <Upload className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            PDF dosyasını seçin veya sürükleyin
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tüm sayfalar okunur → ücretsiz metin analizi ile takyidat raporu
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PDF_ACCEPT}
          className="hidden"
          disabled={loading}
          onChange={handleFileChange}
        />

        {fileName && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Takyidat Analiz Raporu
        </h2>
        <AnalizSonucPanel
          loading={loading}
          error={error}
          sonuc={sonuc}
          emptyMessage="Sol taraftan tapu PDF yükleyin. Beyan, şerh, hak/mükellefiyet ve ipotek özeti burada görünecek."
        />
      </section>
    </div>
  );
}
