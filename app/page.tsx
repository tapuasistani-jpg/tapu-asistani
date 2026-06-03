"use client";

import { useState } from "react";
import Navbar, { type TabId } from "@/components/Navbar";
import TekliTapuAnalizi from "@/components/TekliTapuAnalizi";
import CokluTapuPortfoy from "@/components/CokluTapuPortfoy";
import ProjeOlcumAraci from "@/components/ProjeOlcumAraci";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("tekli");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "tekli" && <TekliTapuAnalizi />}
        {activeTab === "coklu" && <CokluTapuPortfoy />}
        {activeTab === "olcum" && <ProjeOlcumAraci />}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-slate-500">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="max-w-3xl text-center text-[11px] leading-relaxed md:text-left">
              <span className="font-semibold text-slate-700">UYARI:</span> Bu
              platform tarafından sunulan analizler, raporlar ve hesaplamalar
              resmi belge niteliği taşımamaktadır. Verilen bilgilerin doğruluğu
              ve güncelliği garanti edilmemekte olup, tüm verilerin resmi
              kurumlar ve belgeler üzerinden kontrol edilmesi kullanıcının
              sorumluluğundadır. Oluşabilecek hatalardan platformumuz sorumlu
              tutulamaz.
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>
                İletişim:{" "}
                <a
                  href="mailto:info@tapuasistani.com"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  info@tapuasistani.com
                </a>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400 sm:flex-row">
            <div>
              © {new Date().getFullYear()} Tapu Asistanı. Tüm hakları
              saklıdır.
            </div>
            <div className="flex items-center gap-1">
              <span>Developed by</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Emre Arslan
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
