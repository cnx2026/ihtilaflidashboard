"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { FeedbackRow, MessageRow, UserRow } from "@/types";

// ── Static data ───────────────────────────────────────────────────
const FB_TITLES: Record<string, string[]> = {
  KPI: ["Kalite Puanı", "Devamsızlık Oranı", "İşlem Adedi", "SL Oranı", "Şikayet Oranı", "İFF Toplamı (TL)"],
  Operasyonel: ["Ekip İçi Uyumsuzluk", "Mola Kullanımı", "Vardiya Uyumsuzluğu", "Fraud İşlem"],
  Kalite: [
    "KVKK Anonsu", "Kendini Tanıtmama", "Müşteri Açıklaması Kırılımı",
    "Satıcı Hatası Kırılımı", "Script Düzenleme", "Hatalı Ret", "Hatalı Onay",
    "Hatalı Cezai İşlem & Paketleme Ruleseti", "Hatalı Cezai İşlem & Hatalı Analiz Raporu",
    "Hatalı Cezai İşlem & Yanlış Ürün İncelemesi",
    "Arama Ruleseti Uyumsuzluk & Aramadan Ret", "Arama Ruleseti Uyumsuzluk & < 30 Saniye Arama",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────
const mkIni = (name: string) =>
  (name || "?").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

const fmtDateTime = (ts: string) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
};

type FbType = "Olumlu" | "Bilgilendirme" | "Olumsuz";

const typeStyles: Record<FbType, { badge: string; icon: string; text: string }> = {
  Olumlu: { badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: "fa-circle-check", text: "Olumlu" },
  Bilgilendirme: { badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: "fa-circle-info", text: "Bilgilendirme" },
  Olumsuz: { badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: "fa-circle-exclamation", text: "Olumsuz" },
};

const topicStyles: Record<string, string> = {
  Kalite: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  KPI: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Operasyonel: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

interface NewFbState {
  to_user: string; type: FbType; topic: string; title: string;
  description: string; imageFile: File | null; imagePreview: string;
  submitting: boolean;
}

interface Props {
  onBadgeChange?: (badge: { blue: number; green: number; red: number }) => void;
}

export default function FeedbackPanel({ onBadgeChange }: Props) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Admin filters
  const [filterUser, setFilterUser] = useState("all");
  const [filterSender, setFilterSender] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Agent filters + tabs
  const [agentTab, setAgentTab] = useState<"olumlu" | "bana-ait">("bana-ait");
  const [agentFilterType, setAgentFilterType] = useState("all");
  const [agentFilterTopic, setAgentFilterTopic] = useState("all");
  const [agentFilterTitle, setAgentFilterTitle] = useState("all");

  // New feedback modal
  const [showNew, setShowNew] = useState(false);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [newFb, setNewFb] = useState<NewFbState>({
    to_user: "", type: "Bilgilendirme", topic: "Kalite", title: "",
    description: "", imageFile: null, imagePreview: "", submitting: false,
  });

  // ── Load feedback ─────────────────────────────────────────────
  const loadFeedback = useCallback(async () => {
    const res = await fetch("/api/feedback");
    if (!res.ok) return;
    const data: FeedbackRow[] = await res.json();
    setFeedbacks(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  // Agent polling every 30s
  useEffect(() => {
    if (isAdmin) return;
    const t = setInterval(loadFeedback, 30000);
    return () => clearInterval(t);
  }, [isAdmin, loadFeedback]);

  // Load users for new feedback modal
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users").then(r => r.json()).then((data: UserRow[]) => setAllUsers(data));
  }, [isAdmin]);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = feedbacks;
    if (!isAdmin && user?.user_name) {
      if (agentTab === "bana-ait") {
        list = list.filter(f => f.to_user === user.user_name);
      } else {
        list = list.filter(f => f.type === "Olumlu");
      }
      if (agentFilterType !== "all") list = list.filter(f => f.type === agentFilterType);
      if (agentFilterTopic !== "all") list = list.filter(f => f.topic === agentFilterTopic);
      if (agentFilterTitle !== "all") list = list.filter(f => f.title === agentFilterTitle);
    } else {
      if (filterUser !== "all") list = list.filter(f => f.to_user === filterUser);
      if (filterSender !== "all") list = list.filter(f => f.from_user === filterSender);
      if (filterTopic !== "all") list = list.filter(f => f.topic === filterTopic);
      if (filterType !== "all") list = list.filter(f => f.type === filterType);
    }
    return list;
  }, [feedbacks, isAdmin, user, agentTab, agentFilterType, agentFilterTopic, agentFilterTitle, filterUser, filterSender, filterTopic, filterType]);

  const unreadBana = useMemo(() =>
    feedbacks.filter(f => f.to_user === user?.user_name && !f.is_read).length,
    [feedbacks, user]);
  const unreadOlumlu = useMemo(() =>
    feedbacks.filter(f => f.type === "Olumlu" && f.to_user !== user?.user_name && !f.is_read).length,
    [feedbacks, user]);

  // Report sidebar badge counts
  useEffect(() => {
    if (!onBadgeChange || !user?.user_name) return;
    const mine = feedbacks.filter(f => f.to_user === user.user_name && !f.is_read);
    onBadgeChange({
      blue: mine.filter(f => f.type === "Bilgilendirme").length,
      green: mine.filter(f => f.type === "Olumlu").length,
      red: mine.filter(f => f.type === "Olumsuz").length,
    });
  }, [feedbacks, user, onBadgeChange]);

  const selectedFb = feedbacks.find(f => f.id === selectedId) ?? null;

  // unique users/senders for admin filters
  const uniqueUsers = useMemo(() => [...new Set(feedbacks.map(f => f.to_user).filter(Boolean))].sort(), [feedbacks]);
  const uniqueSenders = useMemo(() => [...new Set(feedbacks.map(f => f.from_user).filter(Boolean))].sort(), [feedbacks]);
  const titleOptions = useMemo(() => FB_TITLES[agentFilterTopic] ?? [], [agentFilterTopic]);

  // ── Open detail ───────────────────────────────────────────────
  async function openDetail(id: string) {
    setSelectedId(id);
    setReplyText("");

    // Mark as read
    const fb = feedbacks.find(f => f.id === id);
    if (fb && !fb.is_read && fb.to_user === user?.user_name) {
      await fetch(`/api/feedback/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, is_read: true } : f));
    }

    // Load messages
    const res = await fetch(`/api/feedback/${id}/messages`);
    if (res.ok) setMessages(await res.json());
  }

  // ── Send reply ────────────────────────────────────────────────
  async function sendReply() {
    if (!replyText.trim() || !selectedId || !user) return;
    setSendingReply(true);
    const res = await fetch(`/api/feedback/${selectedId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: user.user_name, message: replyText.trim() }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setReplyText("");
      // Mark other side's feedback as unread
      if (selectedFb) {
        const other = selectedFb.from_user.toLowerCase() === user.user_name.toLowerCase()
          ? selectedFb.to_user : selectedFb.from_user;
        if (other.toLowerCase() !== user.user_name.toLowerCase()) {
          await fetch(`/api/feedback/${selectedId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_read: false }),
          });
        }
      }
    }
    setSendingReply(false);
  }

  // ── Delete ────────────────────────────────────────────────────
  async function deleteFb() {
    if (!selectedId || !confirm("Bu geri bildirimi silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/feedback/${selectedId}`, { method: "DELETE" });
    setFeedbacks(prev => prev.filter(f => f.id !== selectedId));
    setSelectedId(null);
    setMessages([]);
  }

  // ── New feedback ──────────────────────────────────────────────
  async function submitNew() {
    if (!newFb.to_user || !newFb.title || !user) return;
    setNewFb(s => ({ ...s, submitting: true }));

    let imageUrl: string | undefined;

    if (newFb.imageFile) {
      const supabase = createSupabaseBrowser();
      const ext = newFb.imageFile.name.split(".").pop();
      const path = `feedback/${Date.now()}.${ext}`;
      const { data: upload } = await supabase.storage.from("feedback-images").upload(path, newFb.imageFile);
      if (upload) {
        const { data: { publicUrl } } = supabase.storage.from("feedback-images").getPublicUrl(path);
        imageUrl = publicUrl;
      }
    }

    const res = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_user: user.user_name, to_user: newFb.to_user,
        topic: newFb.topic, type: newFb.type, title: newFb.title,
        description: newFb.description, image_url: imageUrl,
      }),
    });

    if (res.ok) {
      await loadFeedback();
      setShowNew(false);
      setNewFb({ to_user: "", type: "Bilgilendirme", topic: "Kalite", title: "", description: "", imageFile: null, imagePreview: "", submitting: false });
    } else {
      setNewFb(s => ({ ...s, submitting: false }));
    }
  }

  // ── Export (admin) ─────────────────────────────────────────────
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = filtered.map(f => ({
      "Gönderen": f.from_user, "Alıcı": f.to_user, "Tip": f.type,
      "Konu": f.topic, "Başlık": f.title,
      "Açıklama": f.description ?? "",
      "Tarih": fmtDateTime(f.created_at),
      "Okundu": f.is_read ? "Evet" : "Hayır",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Feedback");
    XLSX.writeFile(wb, `GeriBildirim_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-100">Geri Bildirim</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isAdmin ? "Yönetici — temsilci değerlendirme sistemi." : "Bildirimleriniz ve yanıtlar."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                {/* Admin filters */}
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden text-sm">
                  {[
                    { id: "user", val: filterUser, set: setFilterUser, opts: uniqueUsers, label: "Tüm Temsilciler", icon: "fa-user" },
                    { id: "sender", val: filterSender, set: setFilterSender, opts: uniqueSenders, label: "Tüm Gönderenler", icon: "fa-user-pen" },
                  ].map(f => (
                    <div key={f.id} className="relative border-r border-slate-200 dark:border-slate-800 pr-2 last:border-r-0 last:pr-0">
                      <i className={`fa-solid ${f.icon} absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none`} />
                      <select value={f.val} onChange={e => f.set(e.target.value)}
                        className="pl-9 pr-7 py-2 bg-transparent border-none font-bold cursor-pointer outline-none min-w-[140px] text-slate-800 dark:text-slate-100">
                        <option value="all">{f.label}</option>
                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                    <i className="fa-solid fa-tag absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                    <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
                      className="pl-9 pr-7 py-2 bg-transparent border-none font-bold cursor-pointer outline-none min-w-[120px] text-slate-800 dark:text-slate-100">
                      <option value="all">Tüm Konular</option>
                      {["Kalite", "KPI", "Operasyonel"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <i className="fa-solid fa-circle-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                      className="pl-9 pr-7 py-2 bg-transparent border-none font-bold cursor-pointer outline-none min-w-[130px] text-slate-800 dark:text-slate-100">
                      <option value="all">Tüm Tipler</option>
                      {["Olumlu", "Bilgilendirme", "Olumsuz"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={exportExcel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest">
                  <i className="fa-solid fa-file-excel" /> Rapor
                </button>
                <button onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest">
                  <i className="fa-solid fa-pen-to-square" /> Yeni Bildirim
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Body: split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: list */}
        <div className="w-80 xl:w-96 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
          {/* Agent: tabs + filters */}
          {!isAdmin && (
            <>
              <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <i className="fa-solid fa-circle-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                  <select value={agentFilterType} onChange={e => setAgentFilterType(e.target.value)}
                    className="pl-8 pr-6 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer outline-none text-slate-800 dark:text-slate-100">
                    <option value="all">Tüm Tipler</option>
                    {["Olumlu", "Bilgilendirme", "Olumsuz"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <i className="fa-solid fa-tag absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                  <select value={agentFilterTopic} onChange={e => { setAgentFilterTopic(e.target.value); setAgentFilterTitle("all"); }}
                    className="pl-8 pr-6 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer outline-none text-slate-800 dark:text-slate-100">
                    <option value="all">Tüm Konular</option>
                    {["Kalite", "KPI", "Operasyonel"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {agentFilterTopic !== "all" && (
                  <select value={agentFilterTitle} onChange={e => setAgentFilterTitle(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer outline-none text-slate-800 dark:text-slate-100 max-w-[160px]">
                    <option value="all">Tüm Başlıklar</option>
                    {titleOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-800">
                {(["olumlu", "bana-ait"] as const).map(tab => (
                  <button key={tab} onClick={() => setAgentTab(tab)}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-1.5 ${agentTab === tab ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400 hover:text-blue-500"}`}>
                    {tab === "olumlu" ? "🌟 Olumlu" : "👤 Bana Ait"}
                    {tab === "olumlu" && unreadOlumlu > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{unreadOlumlu}</span>
                    )}
                    {tab === "bana-ait" && unreadBana > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{unreadBana}</span>
                    )}
                  </button>
                ))}
              </div>
              {!isAdmin && unreadBana > 0 && agentTab === "bana-ait" && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 shrink-0">
                  <i className="fa-solid fa-bell text-blue-500 text-sm" />
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{unreadBana} okunmamış bildirim</p>
                </div>
              )}
            </>
          )}

          {/* List */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                <i className="fa-solid fa-envelope-open text-2xl text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-400">Bildirim bulunamadı</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(fb => {
                const ts = typeStyles[fb.type] ?? typeStyles.Bilgilendirme;
                const isActive = selectedId === fb.id;
                const isUnread = !fb.is_read && fb.to_user === user?.user_name;
                return (
                  <button key={fb.id} onClick={() => openDetail(fb.id)}
                    className={`w-full text-left px-4 py-3.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isActive ? "bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${ts.badge}`}>
                        <i className={`fa-solid ${ts.icon} mr-1`} />{fb.type}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${topicStyles[fb.topic] ?? "bg-slate-100 text-slate-500"}`}>
                        {fb.topic}
                      </span>
                    </div>
                    <p className={`text-sm font-bold truncate ${isUnread ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>{fb.title}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{fb.from_user} → {fb.to_user}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(fb.created_at)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedFb ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <i className="fa-solid fa-envelope-open-text text-slate-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-500 dark:text-slate-400 tracking-tight">Bir bildirim seçin</p>
                <p className="text-xs text-slate-400 dark:text-slate-600 font-medium mt-1">Listeden bir geri bildirim seçerek detaylarını görüntüleyin.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
              {/* Detail header */}
              <div className="px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${typeStyles[selectedFb.type]?.badge}`}>
                        <i className={`fa-solid ${typeStyles[selectedFb.type]?.icon} mr-1`} />{selectedFb.type}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${topicStyles[selectedFb.topic] ?? "bg-slate-100 text-slate-500"}`}>
                        {selectedFb.topic}
                      </span>
                    </div>
                    <h3 className="font-black text-base tracking-tight leading-tight text-slate-900 dark:text-slate-100">{selectedFb.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-blue-600 inline-flex items-center justify-center text-white font-black text-[9px]">{mkIni(selectedFb.from_user)}</span>
                        {selectedFb.from_user}
                      </span>
                      <i className="fa-solid fa-arrow-right text-slate-300 text-[10px]" />
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-slate-500 inline-flex items-center justify-center text-white font-black text-[9px]">{mkIni(selectedFb.to_user)}</span>
                        {selectedFb.to_user}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto">{fmtDateTime(selectedFb.created_at)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={deleteFb}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0">
                      <i className="fa-solid fa-trash-can" /> Sil
                    </button>
                  )}
                </div>
              </div>

              {/* Scroll area */}
              <div className="flex-1 overflow-y-auto">
                {/* Original message */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800/60">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Bildirim İçeriği</p>
                  <div className="flex justify-start gap-2 mt-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-[10px] shrink-0 mt-1">
                      {mkIni(selectedFb.from_user)}
                    </div>
                    <div className="max-w-[85%]">
                      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
                        {selectedFb.description ? (
                          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedFb.description}</p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">İçerik yok</p>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{selectedFb.from_user} · {fmtDateTime(selectedFb.created_at)}</p>
                    </div>
                  </div>
                  {selectedFb.image_url && (
                    <div className="mt-4 ml-9 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedFb.image_url} alt="Görsel" className="w-full object-cover max-h-60" />
                    </div>
                  )}
                </div>

                {/* Replies */}
                {messages.length > 0 && (
                  <div className="px-8 py-6 space-y-4">
                    {messages.map(msg => {
                      const isMine = msg.sender === user?.user_name;
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[10px] shrink-0 mt-1 ${isMine ? "bg-blue-600" : "bg-slate-500"}`}>
                            {mkIni(msg.sender)}
                          </div>
                          <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                            <div className={`px-4 py-3 rounded-2xl shadow-sm border text-sm ${isMine ? "bg-blue-600 text-white border-blue-500 rounded-tr-sm" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-700 rounded-tl-sm"}`}>
                              {msg.message}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{msg.sender} · {fmtDateTime(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reply box */}
              <div className="px-8 py-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs mb-0.5">
                    {mkIni(user?.user_name ?? "")}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={replyText} onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                      rows={2}
                      placeholder="Yanıtınızı yazın... (Ctrl+Enter ile gönder)"
                      className="w-full px-4 py-2.5 mb-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                    />
                    <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-reply" /> Yanıtla
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Feedback Modal (admin) ─────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100">Yeni Geri Bildirim</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Temsilci seç, konu ve başlık belirle</p>
              </div>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-rose-500 transition-colors text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Temsilci</label>
                  <select value={newFb.to_user} onChange={e => setNewFb(s => ({ ...s, to_user: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    <option value="">Seçiniz...</option>
                    {allUsers.filter(u => u.role === "agent").map(u => <option key={u.user_name} value={u.user_name}>{u.user_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tip</label>
                  <select value={newFb.type} onChange={e => setNewFb(s => ({ ...s, type: e.target.value as FbType }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    <option value="Olumlu">✅ Olumlu</option>
                    <option value="Bilgilendirme">ℹ️ Bilgilendirme</option>
                    <option value="Olumsuz">⚠️ Olumsuz</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Konu</label>
                  <select value={newFb.topic} onChange={e => setNewFb(s => ({ ...s, topic: e.target.value, title: "" }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    {["Kalite", "KPI", "Operasyonel"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Başlık</label>
                  <select value={newFb.title} onChange={e => setNewFb(s => ({ ...s, title: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    <option value="">Başlık seçin...</option>
                    {(FB_TITLES[newFb.topic] ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Açıklama</label>
                <textarea value={newFb.description} onChange={e => setNewFb(s => ({ ...s, description: e.target.value }))}
                  rows={5} placeholder="Geri bildirim detaylarını yazın..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100" />
              </div>
              {/* Image upload */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Görsel (Opsiyonel)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700">
                    <i className="fa-solid fa-paperclip" /> Dosya Seç
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setNewFb(s => ({ ...s, imageFile: file, imagePreview: url }));
                        }
                      }} />
                  </label>
                  <span className="text-xs text-slate-400">
                    {newFb.imageFile ? newFb.imageFile.name : "Dosya seçilmedi"}
                  </span>
                </div>
                {newFb.imagePreview && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newFb.imagePreview} alt="Önizleme" className="w-full object-cover max-h-32" />
                  </div>
                )}
              </div>
              <button onClick={submitNew}
                disabled={newFb.submitting || !newFb.to_user || !newFb.title}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all">
                <i className="fa-solid fa-paper-plane mr-2" />
                {newFb.submitting ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
