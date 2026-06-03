"use client";

import { Building2, Layers, LogIn, Ruler, UserPlus } from "lucide-react";
import Link from "next/link"; // Link importunu ekledik

export type TabId = "tekli" | "coklu" | "olcum";

const tabs: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: "tekli", label: "Tekli Tapu Analizi", icon: Building2 },
  { id: "coklu", label: "Çoklu Tapu (Portföy)", icon: Layers },
  { id: "olcum", label: "Proje Ölçüm Aracı", icon: Ruler },
];

type NavbarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="truncate text-lg font-semibold text-slate-900">
              Tapu Asistanı
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Giriş Yap Linki */}
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <LogIn className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Giriş Yap</span>
            </Link>

            {/* Kayıt Ol Linki */}
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Kayıt Ol</span>
            </Link>
          </div>
        </div>

        <nav className="-mb-px flex gap-1 overflow-x-auto pb-0">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}