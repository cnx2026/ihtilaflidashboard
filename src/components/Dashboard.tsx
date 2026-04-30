"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import Sidebar from "@/components/Sidebar";
import UretimView from "@/components/UretimView";
import PerformansView from "@/components/PerformansView";
import GoalpexView from "@/components/GoalpexView";
import FeedbackPanel from "@/components/FeedbackPanel";
import DuyurularPanel from "@/components/DuyurularPanel";
import type { Page } from "@/types";

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
      {activePage === "duyurular"  && <DuyurularPanel />}
    </div>
  );
}
