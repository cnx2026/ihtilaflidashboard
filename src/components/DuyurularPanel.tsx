"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { AnnouncementRow, UserRow } from "@/types";

type Tab = "surec" | "operasyon" | "arsiv";

const catStyle = (cat: string) =>
  cat === "surec" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
const catLabel = (cat: string) => cat === "surec" ? "📋 Süreç" : "📣 Operasyon";
const catIcon = (cat: string) => cat === "surec" ? "fa-clipboard-list" : "fa-bullhorn";
const fmtDate = (ts: string) => new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (ts: string) => `${fmtDate(ts)} · ${fmtTime(ts)}`;

interface ReadRate { [id: string]: number }

interface NewDuyuruState {
  title: string; body: string; category: string;
  alarm_minutes: number; imageFile: File | null; imagePreview: string; submitting: boolean;
}

interface Props {
  onBadgeChange?: (badge: { surec: number; operasyon: number }) => void;
}

export default function DuyurularPanel({ onBadgeChange }: Props) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [readRates, setReadRates] = useState<ReadRate>({});
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("surec");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);

  // Alarm & popup
  const [alarm, setAlarm] = useState<{ id: string; title: string; cat: string } | null>(null);
  const [popup, setPopup] = useState<AnnouncementRow[]>([]);

  // New announcement modal
  const [showNew, setShowNew] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [newD, setNewD] = useState<NewDuyuruState>({
    title: "", body: "", category: "surec",
    alarm_minutes: 15, imageFile: null, imagePreview: "", submitting: false,
  });

  // ── Load announcements ─────────────────────────────────────────
  const load = useCallback(async () => {
    const basePromises: [Promise<Response>, Promise<Response>] = [
      fetch("/api/announcements"),
      fetch("/api/users"),
    ];
    const myReadsPromise = user?.user_name
      ? fetch(`/api/announcement-reads?user_name=${encodeURIComponent(user.user_name)}`)
      : Promise.resolve(null);
    const allReadsPromise = isAdmin ? fetch("/api/announcement-reads") : Promise.resolve(null);

    const [annRes, usersRes, myReadsRes, allReadsRes] = await Promise.all([
      ...basePromises, myReadsPromise, allReadsPromise,
    ]);

    const anns: AnnouncementRow[] = annRes.ok ? await annRes.json() : [];
    const users: UserRow[] = usersRes.ok ? await usersRes.json() : [];
    setAllUsers(users);
    setAnnouncements(anns);

    if (myReadsRes?.ok) {
      const reads: { announcement_id: string }[] = await myReadsRes.json();
      setReadIds(new Set(reads.map(r => r.announcement_id)));
    }

    if (allReadsRes?.ok) {
      const allReads: { announcement_id: string; user_name: string }[] = await allReadsRes.json();
      const agentUsers = users.filter(u => u.role === "agent");
      const rates: ReadRate = {};
      anns.forEach(d => {
        const targets = agentUsers; // team kolonu yok, tüm agentler hedef
        const targetNames = new Set(targets.map(u => u.user_name));
        const readers = new Set(allReads.filter(r =>
          r.announcement_id === d.id && targetNames.has(r.user_name)).map(r => r.user_name));
        rates[d.id] = targets.length > 0 ? Math.round((readers.size / targets.length) * 100) : 0;
      });
      setReadRates(rates);
    }

    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // ── Alarm check (every 5s) ─────────────────────────────────────
  useEffect(() => {
    function checkAlarm() {
      const shownKey = "shownDuyuruAlarms";
      const shown: string[] = JSON.parse(localStorage.getItem(shownKey) ?? "[]");
      const now = new Date();
      announcements.filter(d => !d.is_archived).forEach(d => {
        if (readIds.has(d.id)) return;
        if (shown.includes(d.id)) return;
        if (!d.alarm_minutes) return;
        const mins = Math.floor((now.getTime() - new Date(d.created_at).getTime()) / 60000);
        if (mins >= d.alarm_minutes) {
          shown.push(d.id);
          localStorage.setItem(shownKey, JSON.stringify(shown));
          setAlarm({ id: d.id, title: d.title, cat: d.category });
        }
      });
    }
    const t = setInterval(checkAlarm, 5000);
    return () => clearInterval(t);
  }, [announcements, readIds]);

  // ── Popup on load for unread ───────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const shownKey = "shownDuyuruPopups";
    const shown: string[] = JSON.parse(localStorage.getItem(shownKey) ?? "[]");
    const unread = announcements.filter(d =>
      !d.is_archived && !readIds.has(d.id) && !shown.includes(d.id));
    if (unread.length > 0) {
      setPopup(unread);
      const newShown = [...shown, ...unread.map(d => d.id)];
      localStorage.setItem(shownKey, JSON.stringify(newShown));
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return announcements.filter(d => {
      if (activeTab === "arsiv") return d.is_archived;
      if (d.is_archived) return false;
      if (d.category !== activeTab) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !(d.body ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [announcements, activeTab, search]);

  const selected = announcements.find(d => d.id === selectedId) ?? null;

  // Unread badge counts
  const unreadSurec = useMemo(() =>
    announcements.filter(d => !d.is_archived && d.category === "surec" && !readIds.has(d.id)).length,
    [announcements, readIds]);
  const unreadOp = useMemo(() =>
    announcements.filter(d => !d.is_archived && d.category === "operasyon" && !readIds.has(d.id)).length,
    [announcements, readIds]);

  // Report sidebar badge counts
  useEffect(() => {
    if (!onBadgeChange || isAdmin) return;
    onBadgeChange({ surec: unreadSurec, operasyon: unreadOp });
  }, [unreadSurec, unreadOp, onBadgeChange, isAdmin]);

  // ── Open detail ────────────────────────────────────────────────
  async function openDetail(id: string) {
    setSelectedId(id);
    // Mark as read
    if (!readIds.has(id) && user?.user_name) {
      await fetch(`/api/announcements/${id}/read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: user.user_name }),
      });
      setReadIds(prev => new Set([...prev, id]));
    }
  }

  // ── Archive / Unarchive ────────────────────────────────────────
  async function toggleArchive() {
    if (!selected) return;
    const next = !selected.is_archived;
    await fetch(`/api/announcements/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: next }),
    });
    setAnnouncements(prev => prev.map(d => d.id === selected.id ? { ...d, is_archived: next } : d));
    if (next) { setSelectedId(null); setActiveTab("surec"); }
  }

  // ── Delete ─────────────────────────────────────────────────────
  async function deleteAnn() {
    if (!selected || !confirm("Duyuruyu silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/announcements/${selected.id}`, { method: "DELETE" });
    setAnnouncements(prev => prev.filter(d => d.id !== selected.id));
    setSelectedId(null);
  }

  // ── Create new ────────────────────────────────────────────────
  async function submitNew() {
    if (!newD.title) return;
    setNewD(s => ({ ...s, submitting: true }));
    setSubmitError("");

    let imageUrl: string | undefined;
    if (newD.imageFile) {
      try {
        const supabase = createSupabaseBrowser();
        const ext = newD.imageFile.name.split(".").pop();
        const path = `duyuru/${Date.now()}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage.from("duyuru-gorseller").upload(path, newD.imageFile);
        if (upErr) throw upErr;
        if (up) {
          const { data: { publicUrl } } = supabase.storage.from("duyuru-gorseller").getPublicUrl(path);
          imageUrl = publicUrl;
        }
      } catch (e) {
        setSubmitError("Görsel yüklenemedi: " + (e instanceof Error ? e.message : String(e)));
        setNewD(s => ({ ...s, submitting: false }));
        return;
      }
    }

    try {
      const res = await fetch("/api/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newD.title, content: newD.body, category: newD.category,
          alarm_minutes: newD.alarm_minutes, image_url: imageUrl,
        }),
      });

      if (res.ok) {
        await load();
        setShowNew(false);
        setSubmitError("");
        setNewD({ title: "", body: "", category: "surec", alarm_minutes: 15, imageFile: null, imagePreview: "", submitting: false });
      } else {
        const errData = await res.json().catch(() => ({}));
        setSubmitError((errData as { error?: string }).error ?? "Duyuru yayınlanamadı. Lütfen tekrar deneyin.");
        setNewD(s => ({ ...s, submitting: false }));
      }
    } catch {
      setSubmitError("Ağ hatası. Lütfen bağlantınızı kontrol edin.");
      setNewD(s => ({ ...s, submitting: false }));
    }
  }

  // ── Export ─────────────────────────────────────────────────────
  async function exportAll() {
    const XLSX = await import("xlsx");
    const rows = filtered.map(d => ({
      "Başlık": d.title, "İçerik": d.body ?? "", "Kategori": catLabel(d.category),
      "Alarm (dk)": d.alarm_minutes ?? "",
      "Tarih": fmtDateTime(d.created_at),
      "Arşiv": d.is_archived ? "Evet" : "Hayır",
      "Okunma Oranı": isAdmin ? `%${readRates[d.id] ?? 0}` : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Duyurular");
    XLSX.writeFile(wb, `Duyurular_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-100">Duyurular</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Operasyon ve süreç bildirimleri.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Başlık veya içerikte ara..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-slate-800 dark:text-slate-100" />
            </div>
            {isAdmin && (
              <>
                <button onClick={exportAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest">
                  <i className="fa-solid fa-file-excel" /> Duyurular
                </button>
                <button onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest">
                  <i className="fa-solid fa-plus" /> Yeni Duyuru
                </button>
              </>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {(["surec", "operasyon", ...(isAdmin ? ["arsiv"] : [])] as Tab[]).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSelectedId(null); }}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400 hover:text-blue-500"}`}>
              {tab === "surec" ? "📋 Süreç" : tab === "operasyon" ? "📣 Operasyon" : "🗂️ Arşiv"}
              {tab === "surec" && unreadSurec > 0 && !isAdmin && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{unreadSurec}</span>
              )}
              {tab === "operasyon" && unreadOp > 0 && !isAdmin && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{unreadOp}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Body: split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: list */}
        <div className="w-80 xl:w-96 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                <i className="fa-solid fa-bullhorn text-2xl text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-400">Henüz duyuru yok.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(d => {
                const isActive = selectedId === d.id;
                const isUnread = !isAdmin && !readIds.has(d.id);
                return (
                  <button key={d.id} onClick={() => openDetail(d.id)}
                    className={`w-full text-left px-4 py-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isActive ? "bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-base ${catStyle(d.category)}`}>
                        <i className={`fa-solid ${catIcon(d.category)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${catStyle(d.category)}`}>
                            {catLabel(d.category)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">{fmtDate(d.created_at)}</span>
                        </div>
                        <p className={`text-sm font-black truncate leading-tight mb-1 ${isUnread ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                          {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5" />}
                          {d.title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate leading-relaxed">
                          {(d.body ?? "").substring(0, 60)}
                        </p>
                        {isAdmin && (
                          <div className="flex items-center justify-end mt-1.5">
                            <span className={`text-[10px] font-black ${(readRates[d.id] ?? 0) >= 80 ? "text-emerald-500" : (readRates[d.id] ?? 0) >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                              %{readRates[d.id] ?? 0}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <i className="fa-solid fa-bullhorn text-slate-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-500 dark:text-slate-400 tracking-tight">Bir duyuru seçin</p>
                <p className="text-xs text-slate-400 dark:text-slate-600 font-medium mt-1">Listeden bir duyuruya tıklayarak detayları görüntüleyin.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
              {/* Detail header */}
              <div className="px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${catStyle(selected.category)}`}>
                        {catLabel(selected.category)}
                      </span>
                      {selected.is_archived && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-500">🗂️ Arşiv</span>
                      )}
                    </div>
                    <h3 className="font-black text-lg tracking-tight leading-tight mb-2 text-slate-900 dark:text-slate-100">{selected.title}</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] text-slate-400">{fmtDateTime(selected.created_at)}</span>
                    </div>
                    {/* Admin read rate bar */}
                    {isAdmin && (
                      <div className="flex items-center gap-3 mt-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 inline-flex w-fit">
                        <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${(readRates[selected.id] ?? 0) >= 80 ? "bg-emerald-500" : (readRates[selected.id] ?? 0) >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${readRates[selected.id] ?? 0}%` }} />
                        </div>
                        <span className={`text-xs font-black ${(readRates[selected.id] ?? 0) >= 80 ? "text-emerald-500" : (readRates[selected.id] ?? 0) >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                          %{readRates[selected.id] ?? 0} okundu
                        </span>
                      </div>
                    )}
                    {/* Agent: read status */}
                    {!isAdmin && readIds.has(selected.id) && (
                      <div className="flex items-center gap-2 text-emerald-500 text-sm font-black mt-2">
                        <i className="fa-solid fa-circle-check" /> Okundu & Onaylandı
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={toggleArchive}
                        className="px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all border border-amber-500/20">
                        {selected.is_archived ? "📤 Arşivden Çıkar" : "🗂️ Arşivle"}
                      </button>
                      <button onClick={deleteAnn}
                        className="px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all border border-rose-500/20">
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-4 max-w-2xl">
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                    {selected.body || <span className="text-slate-400 italic">İçerik yok</span>}
                  </p>
                </div>
                {/* Image */}
                {selected.image_url1 && (
                  <div className="max-w-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm cursor-zoom-in"
                    onClick={() => window.open(selected.image_url1, "_blank")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.image_url1} alt="Görsel" className="w-full max-h-80 object-cover hover:scale-105 transition-transform" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Announcement Modal ─────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg p-8 space-y-5 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Yeni Duyuru</h3>
              <button onClick={() => { setShowNew(false); setSubmitError(""); }} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            {[
              { label: "Kategori", content: (
                <select value={newD.category} onChange={e => setNewD(s => ({ ...s, category: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                  <option value="surec">📋 Süreç</option>
                  <option value="operasyon">📣 Operasyon</option>
                </select>
              )},
              { label: "Başlık", content: (
                <input type="text" value={newD.title} onChange={e => setNewD(s => ({ ...s, title: e.target.value }))}
                  placeholder="Duyuru başlığı..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100" />
              )},
              { label: "Duyuru Metni", content: (
                <textarea value={newD.body} onChange={e => setNewD(s => ({ ...s, body: e.target.value }))}
                  rows={4} placeholder="Duyuru içeriği..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100" />
              )},
            ].map(f => (
              <div key={f.label} className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{f.label}</label>
                {f.content}
              </div>
            ))}
            {/* Image */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Görsel</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700">
                  <i className="fa-solid fa-paperclip" /> Dosya Seç
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) setNewD(s => ({ ...s, imageFile: file, imagePreview: URL.createObjectURL(file) }));
                    }} />
                </label>
                <span className="text-xs text-slate-400">{newD.imageFile ? newD.imageFile.name : "Dosya seçilmedi"}</span>
              </div>
              {newD.imagePreview && (
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newD.imagePreview} alt="Önizleme" className="w-full object-cover max-h-32" />
                </div>
              )}
            </div>
            {/* Alarm */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Alarm Süresi (Dakika)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={newD.alarm_minutes} min={5} max={1440}
                  onChange={e => setNewD(s => ({ ...s, alarm_minutes: parseInt(e.target.value) || 15 }))}
                  className="w-28 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100" />
                <span className="text-xs text-slate-400 font-medium">dakika içinde okunmazsa alarm gönderilir</span>
              </div>
            </div>
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-500">
                <i className="fa-solid fa-circle-exclamation" /> {submitError}
              </div>
            )}
            <button onClick={submitNew} disabled={newD.submitting || !newD.title}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all">
              {newD.submitting ? "Yayınlanıyor..." : "Duyuru Yayınla"}
            </button>
          </div>
        </div>
      )}

      {/* ── Alarm Popup ───────────────────────────────────────────── */}
      {alarm && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 border-2 border-rose-500/40 text-center space-y-4"
            style={{ boxShadow: "0 0 40px rgba(239,68,68,0.2)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-rose-500/15">
              <i className="fa-solid fa-triangle-exclamation text-3xl text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-rose-500 mb-1">⚠️ Okunmamış Duyuru!</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksiyon Gerekiyor</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              <strong className="text-slate-700 dark:text-slate-200">{catLabel(alarm.cat)}</strong> kategorisindeki{" "}
              <strong className="text-rose-500">"{alarm.title}"</strong> başlıklı duyuruyu henüz okumadınız. Lütfen en kısa sürede okuyunuz.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setAlarm(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Sonra Oku
              </button>
              <button onClick={() => {
                setAlarm(null);
                setActiveTab(alarm.cat as Tab);
                setTimeout(() => openDetail(alarm.id), 100);
              }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-2xl transition-all">
                Şimdi Oku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unread Popup ──────────────────────────────────────────── */}
      {popup.length > 0 && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <i className="fa-solid fa-bullhorn text-2xl text-blue-500" />
            </div>
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Yeni Duyuru!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {popup.length === 1
                ? `${catLabel(popup[0].category)} ile ilgili "${popup[0].title}" başlıklı yeni bir duyurunuz var. Aksiyon almanız rica edilir.`
                : `${popup.length} adet okunmamış duyurunuz var. Aksiyon almanız rica edilir.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPopup([])}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Sonra Gör
              </button>
              <button onClick={() => {
                setPopup([]);
                const first = popup[0];
                setActiveTab(first.category as Tab);
                setTimeout(() => openDetail(first.id), 100);
              }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl transition-all">
                Duyuruya Git
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
