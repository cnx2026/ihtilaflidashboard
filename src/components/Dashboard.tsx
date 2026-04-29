"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import Sidebar from "@/components/Sidebar";
import UretimView from "@/components/UretimView";
import PerformansView from "@/components/PerformansView";
import GoalpexView from "@/components/GoalpexView";
import FeedbackPanel from "@/components/FeedbackPanel";
import type { Page } from "@/types";

function Placeholder({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-5 z-20">
        <div>
          <h2 className="text-xl font-black tracking-tighter uppercase">{title}</h2>
          <p className="text-xs text-slate-400 font-medium">{desc}</p>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <i className={`fa-solid ${icon} text-4xl text-slate-300 dark:text-slate-700`} />
          <p className="text-slate-400 font-bold text-sm">Yakında...</p>
        </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  const { loading } = useUser();
  const [activePage, setActivePage] = useState<Page>("uretim");
  const feedbackBadge = { blue: 0, green: 0, red: 0 };
  const duyuruBadge = { surec: 0, operasyon: 0 };

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "dark";
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-blue-400 font-black tracking-widest animate-pulse uppercase text-xs">Veriler Eşitleniyor</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} feedbackBadge={feedbackBadge} duyuruBadge={duyuruBadge} />

      {activePage === "uretim"     && <UretimView />}
      {activePage === "performans" && <PerformansView />}
      {activePage === "goalpex"    && <GoalpexView />}
      {activePage === "feedback"   && <FeedbackPanel />}
      {activePage === "duyurular"  && <Placeholder title="Duyurular" desc="Ekip duyuruları ve bilgilendirmeler." icon="fa-bullhorn" />}
    </div>
  );
}
