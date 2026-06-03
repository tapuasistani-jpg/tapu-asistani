"use client";

import { FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  isPdfFile,
  PDF_ACCEPT,
  PDF_ONLY_MESSAGE,
} from "@/lib/file-types";
import { analyzePortfoyPdfs } from "@/lib/tapu-analiz";

type YukluDosya = {
  id: string;
  file: File;
};

export default function CokluTapuPortfoy() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dosyalar, setDosyalar] = useState<YukluDosya[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [portfoyRaporu, setPortfoyRaporu] = useState<string | null>(null);

  const dosyaEkle = (yeni: File[]) => {
    const gecersiz = yeni.filter((f) => !isPdfFile(f));
    if (gecersiz.length > 0) {
      setHata(PDF_ONLY_MESSAGE);
      return;
    }
    setHata(null);
    const eklenen: YukluDosya[] = yeni.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
    }));
    setDosyalar((prev) => [...prev, ...eklenen]);
    setPortfoyRaporu(null);
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) dosyaEkle(files);
  };

  const handleSil = (id: string) => {
    setDosyalar((prev) => prev.filter((d) => d.id !== id));
    setPortfoyRaporu(null);
  };

  const handleTemizle = () => {
    setDosyalar([]);
    setPortfoyRaporu(null);
    setHata(null);
  };

  const handleAnaliz = async () => {
    if (dosyalar.length === 0) {
      setHata("Önce en az bir PDF yükleyin.");
      return;
    }

    setYukleniyor(true);
    setHata(null);
    setPortfoyRaporu(null);

    try {
      const sonuc = await analyzePortfoyPdfs(dosyalar.map((d) => d.file));
      setPortfoyRaporu(sonuc.rapor);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Portföy analizi başarısız.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Upload className="h-5 w-5 text-brand-600" />
          Portföy Tapu PDF Yükleme
        </h2>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !yukleniyor && inputRef.current?.click()}
          onKeyDown={(e) =>
            e.key === "Enter" && !yukleniyor && inputRef.current?.click()
          }
          className={`flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors ${
            yukleniyor
              ? "cursor-wait opacity-70"
              : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/50"
          }`}
        >
          <Upload className="mb-3 h-10 w-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            Birden fazla PDF seçin — tek birleşik portföy raporu üretilir
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tüm belgeler birleştirilerek ada/parsel bazlı tek rapor oluşturulur
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PDF_ACCEPT}
          multiple
          className="hidden"
          disabled={yukleniyor}
          onChange={handleFilesChange}
        />

        {dosyalar.length > 0 && (
          <ul className="mt-4 space-y-2">
            {dosyalar.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  {d.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleSil(d.id)}
                  disabled={yukleniyor}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Dosyayı kaldır"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAnaliz}
            disabled={yukleniyor || dosyalar.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {yukleniyor && <Loader2 className="h-4 w-4 animate-spin" />}
            Portföy Raporu Oluştur
          </button>
          {dosyalar.length > 0 && (
            <button
              type="button"
              onClick={handleTemizle}
              disabled={yukleniyor}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Tümünü Temizle
            </button>
          )}
        </div>

        {hata && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {hata}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Birleşik Portföy Takyidat Raporu
        </h2>
        {yukleniyor ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="text-sm text-slate-600">
              {dosyalar.length} belge okunuyor ve birleşik portföy raporu
              hazırlanıyor…
            </p>
          </div>
        ) : portfoyRaporu ? (
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
              {portfoyRaporu}
            </pre>
          </div>
        ) : (
          <div className="min-h-[200px] rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            PDF dosyalarını yükleyip &quot;Portföy Raporu Oluştur&quot; butonuna
            basın. Tüm tapular tek raporda birleştirilecektir.
          </div>
        )}
      </section>
    </div>
  );
}
