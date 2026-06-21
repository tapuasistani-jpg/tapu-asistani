"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { TapuAnalizSonucu } from "@/lib/tapu-analiz";

type Props = {
  loading: boolean;
  error: string | null;
  sonuc: TapuAnalizSonucu | null;
  emptyMessage: string;
};

export default function AnalizSonucPanel({
  loading,
  error,
  sonuc,
  emptyMessage,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm text-slate-600">
          PDF okunuyor ve takyidat raporu hazırlanıyor…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (!sonuc) {
    return (
      <div className="min-h-[280px] rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm leading-relaxed text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
        {sonuc.rapor}
      </pre>
    </div>
  );
}
