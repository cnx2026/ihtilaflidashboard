"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import Sidebar from "@/components/Sidebar";
import UretimView from "@/components/UretimView";
import PerformansView from "@/components/PerformansView";
import GoalpexView from "@/components/GoalpexView";
import FeedbackPanel from "@/components/FeedbackPanel";
import DuyurularPanel from "@/components/DuyurularPanel";
import type { Page, FeedbackRow, AnnouncementRow } from "@/types";

const catLabel = (cat: string) => cat === "surec" ? "📋 Süreç" : "📣 Operasyon";

export default function Dashboard() {
  const { loading, user } = useUser();
  const [activePage, setActivePage] = useState<Page>("uretim");
  const [feedbackBadge, setFeedbackBadge] = useState({ blue: 0, green: 0, red: 0 });
  const [duyuruBadge, setDuyuruBadge] = useState({ surec: 0, operasyon: 0 });
  const [globalAlarm, setGlobalAlarm] = useState<{ id: string; title: string; cat: string } | null>(null);
  const [feedbackPopup, setFeedbackPopup] = useState(false);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  const activePageRef = useRef(activePage);
  const prevFeedbackTotal = useRef<number | null>(null);
  const prevFeedbackIds = useRef<Set<string>>(new Set());

  useEffect(() => { activePageRef.current = activePage; }, [activePage]);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "dark";
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);

  // Global feedback badge poll (10s — agent only)
  const checkFeedbackBadge = useCallback(async () => {
    if (!user?.user_name || user.role === "admin") return;
    const res = await fetch("/api/feedback");
    if (!res.ok) return;
    const data: FeedbackRow[] = await res.json();
    const mine = data.filter(f => f.to_user === user.user_name && !f.is_read);
    const total = mine.length;

    if (prevFeedbackTotal.current !== null && total > prevFeedbackTotal.current && activePageRef.current !== "feedback") {
      const newItems = mine.filter(f => !prevFeedbackIds.current.has(f.id));
      if (newItems.length > 0) {
        setPendingFeedbackId(newItems[0].id);
        setFeedbackPopup(true);
      }
    }
    prevFeedbackTotal.current = total;
    prevFeedbackIds.current = new Set(mine.map(f => f.id));

    setFeedbackBadge({
      blue: mine.filter(f => f.type === "Bilgilendirme").length,
      green: mine.filter(f => f.type === "Olumlu").length,
      red: mine.filter(f => f.type === "Olumsuz").length,
    });
  }, [user?.user_name, user?.role]);

  useEffect(() => {
    checkFeedbackBadge();
    const t = setInterval(checkFeedbackBadge, 10000);
    return () => clearInterval(t);
  }, [checkFeedbackBadge]);

  // Global duyuru badge + alarm check (5s — agent only)
  const checkDuyuru = useCallback(async () => {
    if (!user?.user_name || user.role === "admin") return;
    const [annRes, readsRes] = await Promise.all([
      fetch("/api/announcements"),
      fetch(`/api/announcement-reads?user_name=${encodeURIComponent(user.user_name)}`),
    ]);
    if (!annRes.ok) return;
    const anns: AnnouncementRow[] = await annRes.json();
    const readIds = new Set<string>(
      readsRes.ok
        ? (await readsRes.json() as { announcement_id: string }[]).map(r => r.announcement_id)
        : []
    );
    const active = anns.filter(d => !d.is_archived);

    setDuyuruBadge({
      surec: active.filter(d => d.category === "surec" && !readIds.has(d.id)).length,
      operasyon: active.filter(d => d.category === "operasyon" && !readIds.has(d.id)).length,
    });

    if (activePageRef.current === "duyurular") return;
    const shownKey = "shownDuyuruAlarms";
    const shown: string[] = JSON.parse(localStorage.getItem(shownKey) ?? "[]");
    const now = new Date();
    for (const d of active) {
      if (readIds.has(d.id) || shown.includes(d.id) || !d.alarm_minutes) continue;
      const mins = Math.floor((now.getTime() - new Date(d.created_at).getTime()) / 60000);
      if (mins >= d.alarm_minutes) {
        shown.push(d.id);
        localStorage.setItem(shownKey, JSON.stringify(shown));
        setGlobalAlarm({ id: d.id, title: d.title, cat: d.category });
        break;
      }
    }
  }, [user?.user_name, user?.role]);

  useEffect(() => {
    checkDuyuru();
    const t = setInterval(checkDuyuru, 5000);
    return () => clearInterval(t);
  }, [checkDuyuru]);

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
      {activePage === "feedback"   && (
        <FeedbackPanel
          onBadgeChange={setFeedbackBadge}
          initialOpenId={pendingFeedbackId}
          onInitialOpen={() => setPendingFeedbackId(null)}
        />
      )}
      {activePage === "duyurular"  && <DuyurularPanel onBadgeChange={setDuyuruBadge} />}

      {/* Geri bildirim popup */}
      {feedbackPopup && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 border-2 border-blue-500/40 text-center space-y-4"
            style={{ boxShadow: "0 0 40px rgba(59,130,246,0.15)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-blue-500/10">
              <i className="fa-solid fa-envelope text-3xl text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-blue-500 mb-1">Yeni Geri Bildirim!</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bildirim</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Okunmamış yeni bir geri bildiriminiz var. Lütfen kontrol ediniz.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setFeedbackPopup(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Sonra Gör
              </button>
              <button
                onClick={() => { setFeedbackPopup(false); setActivePage("feedback"); }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl transition-all"
              >
                Hemen Oku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global duyuru alarm popup */}
      {globalAlarm && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 border-2 border-rose-500/40 text-center space-y-4"
            style={{ boxShadow: "0 0 40px rgba(239,68,68,0.2)" }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-rose-500/15">
              <i className="fa-solid fa-triangle-exclamation text-3xl text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-rose-500 mb-1">⚠️ Okunmamış Duyuru!</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksiyon Gerekiyor</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              <strong className="text-slate-700 dark:text-slate-200">{catLabel(globalAlarm.cat)}</strong>{" "}
              kategorisindeki <strong className="text-rose-500">&quot;{globalAlarm.title}&quot;</strong> başlıklı
              duyuruyu henüz okumadınız.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setGlobalAlarm(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Sonra Oku
              </button>
              <button
                onClick={() => { setGlobalAlarm(null); setActivePage("duyurular"); }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-2xl transition-all"
              >
                Şimdi Oku
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
