"use client";

import { Building2, Layers, Ruler } from "lucide-react";

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
        <div className="flex h-16 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="truncate text-lg font-semibold text-slate-900">
            Tapu Asistanı
          </span>
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
