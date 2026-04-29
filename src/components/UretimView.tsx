"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "@/context/UserContext";
import type { SummaryRow, DailyRow, UserRow } from "@/types";

// ── Yardımcılar ──────────────────────────────────────────────────
const toTr = (val: number | string, dec = 0) => {
  const n = parseFloat(String(val)) || 0;
  return dec === 0 ? Math.round(n).toLocaleString("tr-TR") : n.toFixed(dec).replace(".", ",");
};
const fmtPeriod = (p: string) => {
  if (!p?.includes("-")) return p;
  const [y, m] = p.split("-");
  return `${ ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"][parseInt(m)] } ${y}`;
};
const fmtDateShort = (d: string) => { const [,m,day] = d.split("-"); return `${day}/${m}`; };
const mkIni = (name: string) => (name?.[0] ?? "?").toUpperCase();

interface CwtRow { user_name: string; cwt: number; date: string }
interface DvsRow { planned_hc: number; actual_hc: number }

interface FullRow extends SummaryRow {
  team: string; team_leader: string;
  total_login: number; total_break: number; total_cwt_min: number;
  capped_fte: number; break_rate: number; missing_time: number;
}

// ── KPI Card ─────────────────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, sub }: { icon: string; iconBg: string; label: string; value: string; sub: string }) {
  return (
    <div className="kpi-card bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-center mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}><i className={`fa-solid ${icon}`} /></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <h3 className="text-3xl font-black tracking-tighter">{value}</h3>
      <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tight">{sub}</p>
    </div>
  );
}

export default function UretimView() {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);

  const [fullData, setFullData] = useState<FullRow[]>([]);
  const [cwtAllData, setCwtAllData] = useState<CwtRow[]>([]);
  const [dailyAllData, setDailyAllData] = useState<DailyRow[]>([]);
  const [dvsStat, setDvsStat] = useState<{ rate: number | null }>({ rate: null });

  const [teamFilter, setTeamFilter] = useState("all");
  const [tlFilter, setTlFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOzelModal, setShowOzelModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [modalUserSearch, setModalUserSearch] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  // Dönem listesi yükle
  useEffect(() => {
    fetch("/api/periods").then(r => r.json()).then(d => {
      const list: string[] = d.kpi ?? [];
      setPeriods(list);
      if (list.length > 0) setPeriod(list[0]);
    });
  }, []);

  // Dönem değişince veri yükle
  useEffect(() => {
    if (!period) return;
    setLoading(true);
    fetch(`/api/kpi?period=${encodeURIComponent(period)}`)
      .then(r => r.json())
      .then(d => {
        const summary: SummaryRow[] = d.summary ?? [];
        const daily: DailyRow[] = d.daily ?? [];
        const users: UserRow[] = d.users ?? [];
        const cwt: CwtRow[] = d.cwt ?? [];
        const dvs: DvsRow[] = d.dvs ?? [];

        setCwtAllData(cwt);
        setDailyAllData(daily);

        // DVS
        const tp = dvs.reduce((s, x) => s + (parseFloat(String(x.planned_hc)) || 0), 0);
        const ta = dvs.reduce((s, x) => s + (parseFloat(String(x.actual_hc)) || 0), 0);
        setDvsStat({ rate: tp > 0 ? (tp - ta) / tp : null });

        // Veriyi birleştir
        const rows: FullRow[] = summary.map(s => {
          const nm = s.user_name?.toLowerCase().trim();
          const um = users.find(u => u.user_name?.toLowerCase().trim() === nm) ?? {} as UserRow;
          const dr = daily.filter(d => d.user_name?.toLowerCase().trim() === nm);
          const cr = cwt.filter(c => c.user_name?.toLowerCase().trim() === nm);
          const total_login = dr.reduce((acc, x) => acc + (parseFloat(String(x.login)) || 0), 0);
          const total_break = dr.reduce((acc, x) => acc + (parseFloat(String(x.break_total)) || 0), 0);
          return {
            ...s,
            team: um.team ?? "-",
            team_leader: um.team_leader ?? "-",
            total_login,
            total_break,
            total_cwt_min: cr.reduce((acc, x) => acc + (parseFloat(String(x.cwt)) || 0), 0),
            capped_fte: Math.min(1.0, parseFloat(String(s.fte)) || 0),
            break_rate: total_login > 0 ? total_break / total_login : 0,
            missing_time: parseFloat(String(s.missing_time)) || 0,
          };
        });

        // Agent sadece kendi ekibini görür
        const filtered = !isAdmin
          ? (() => {
              const myTeam = users.find(u => u.user_name?.toLowerCase().trim() === user?.user_name?.toLowerCase().trim())?.team ?? "";
              return myTeam ? rows.filter(r => r.team === myTeam) : rows;
            })()
          : rows;

        setFullData(filtered);
        setTeamFilter("all");
        setTlFilter("all");
        setSearch("");
      })
      .finally(() => setLoading(false));
  }, [period, isAdmin, user?.user_name]);

  // Filtreli veri
  const filtered = useMemo(() => {
    return fullData.filter(d => {
      if (teamFilter !== "all" && d.team !== teamFilter) return false;
      if (tlFilter !== "all" && d.team_leader !== tlFilter) return false;
      if (search && !d.user_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.capped_fte - a.capped_fte);
  }, [fullData, teamFilter, tlFilter, search]);

  const teams = useMemo(() => [...new Set(fullData.map(d => d.team).filter(t => t && t !== "-"))].sort(), [fullData]);
  const tls = useMemo(() => {
    const base = teamFilter !== "all" ? fullData.filter(d => d.team === teamFilter) : fullData;
    return [...new Set(base.map(d => d.team_leader).filter(t => t && t !== "-"))].sort();
  }, [fullData, teamFilter]);

  // KPI hesaplamaları
  const filteredNames = new Set(filtered.map(d => d.user_name?.toLowerCase().trim()));
  const cwtFiltered = (teamFilter === "all" && tlFilter === "all" && !search)
    ? cwtAllData
    : cwtAllData.filter(c => filteredNames.has(c.user_name?.toLowerCase().trim()));

  const kpiCWT = cwtFiltered.reduce((s, d) => s + (parseFloat(String(d.cwt)) || 0), 0) / 60;
  const kpiFTE = filtered.reduce((s, d) => s + d.capped_fte, 0);
  const sumLogin = filtered.reduce((s, d) => s + d.total_login, 0);
  const sumBreak = filtered.reduce((s, d) => s + d.total_break, 0);
  const kpiBreak = sumLogin > 0 ? (sumBreak / sumLogin) * 100 : 0;
  const kpiMissing = filtered.reduce((s, d) => s + d.missing_time, 0);

  // Export
  function exportSummary() {
    const rows = filtered.map(d => ({
      "Temsilci": d.user_name, "Ekip": d.team, "Lider": d.team_leader,
      "FTE (Cap)": toTr(d.capped_fte, 2), "Mola Oranı": toTr(d.break_rate * 100, 2) + "%",
      "Eksik Süre (dk)": toTr(d.missing_time),
    }));
    const csv = [Object.keys(rows[0]).join(";"), ...rows.map(r => Object.values(r).join(";"))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Uretim_Ozet_${period}.csv`; a.click();
    setShowExportMenu(false);
  }

  // Modal verisi
  const modalDays = useMemo(() => {
    if (!selectedMetric) return [];
    const source = selectedMetric === "cwt" ? cwtAllData : dailyAllData;
    return [...new Set(source.map(d => d.date).filter(Boolean))].sort() as string[];
  }, [selectedMetric, cwtAllData, dailyAllData]);

  const allUsers = useMemo(() => [...new Set(fullData.map(d => d.user_name))].sort(), [fullData]);
  const visibleUsers = useMemo(() => new Set(filtered.map(d => d.user_name)), [filtered]);
  const filteredModalUsers = allUsers.filter(u => u.toLowerCase().includes(modalUserSearch.toLowerCase()));

  function openOzelModal() {
    setShowExportMenu(false);
    setSelectedMetric(null);
    setSelectedUsers(new Set(filtered.map(d => d.user_name)));
    setSelectedDays(new Set());
    setModalUserSearch("");
    setShowOzelModal(true);
  }

  function exportOzel() {
    if (!selectedMetric) { alert("Lütfen bir metrik seçin."); return; }
    if (selectedUsers.size === 0) { alert("En az bir temsilci seçin."); return; }
    if (selectedDays.size === 0) { alert("En az bir gün seçin."); return; }
    const days = [...selectedDays].sort();
    const users = [...selectedUsers];
    const cwtMap: Record<string, number> = {};
    cwtAllData.forEach(d => { if (!d.date) return; const k = `${d.user_name}__${d.date}`; cwtMap[k] = (cwtMap[k] || 0) + (parseFloat(String(d.cwt)) || 0); });
    const rows = users.map(u => {
      const row: Record<string, string | number> = { "Temsilci": u };
      days.forEach(day => {
        let val: string | number = "";
        if (selectedMetric === "cwt") { val = cwtMap[`${u}__${day}`] || ""; }
        else if (selectedMetric === "molaorani") {
          const dr = dailyAllData.find(d => d.user_name === u && d.date === day);
          if (dr) { const l = parseFloat(String(dr.login)) || 0, b = parseFloat(String(dr.break_total)) || 0; val = l > 0 ? (b / l).toFixed(4) : ""; }
        } else {
          const dk = selectedMetric === "login" ? "login" : "break_total";
          const dr = dailyAllData.find(d => d.user_name === u && d.date === day);
          val = dr ? (parseFloat(String((dr as unknown as Record<string, unknown>)[dk])) || "") : "";
        }
        row[fmtDateShort(day)] = val;
      });
      return row;
    });
    const csv = [Object.keys(rows[0]).join(";"), ...rows.map(r => Object.values(r).join(";"))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Uretim_Ozel_${period}.csv`; a.click();
    setShowOzelModal(false);
  }

  const METRICS = [
    { key: "login", label: "Login", icon: "fa-clock", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { key: "mola", label: "Mola", icon: "fa-mug-hot", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { key: "molaorani", label: "Mola Oranı", icon: "fa-percent", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    { key: "cwt", label: "Net Login", icon: "fa-stopwatch", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-5 z-20">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase">Üretim Takip</h2>
            <p className="text-xs text-slate-400 font-medium">Operasyonel veriler ve gerçekleşme analizi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Filtreler */}
            <div className="filter-container flex items-center gap-3 bg-white dark:bg-slate-900 px-2 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                <i className="fa-solid fa-calendar-day absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs pointer-events-none" />
                <select value={period} onChange={e => setPeriod(e.target.value)} className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[160px] text-slate-800 dark:text-slate-100">
                  {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                </select>
              </div>
              <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                <i className="fa-solid fa-layer-group absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setTlFilter("all"); }} className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[130px] text-slate-800 dark:text-slate-100">
                  <option value="all">Tüm Ekipler</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="relative">
                <i className="fa-solid fa-user-tie absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                <select value={tlFilter} onChange={e => setTlFilter(e.target.value)} className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[140px] text-slate-800 dark:text-slate-100">
                  <option value="all">Tüm Liderler</option>
                  {tls.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="relative min-w-[220px]">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Hızlı Temsilci Ara..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-slate-800 dark:text-slate-100" />
            </div>
            {/* Export */}
            <div className="relative" ref={exportRef}>
              <button onClick={() => setShowExportMenu(v => !v)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest">
                <i className="fa-solid fa-file-export" /> Excel Export <i className="fa-solid fa-chevron-down text-[10px]" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl min-w-[180px] overflow-hidden">
                  <button onClick={exportSummary} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <i className="fa-solid fa-layer-group text-purple-500" /> Özet
                  </button>
                  <button onClick={openOzelModal} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <i className="fa-solid fa-sliders text-amber-500" /> Özel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* KPI Kartları */}
            <div className={`grid gap-4 ${isAdmin ? "grid-cols-2 lg:grid-cols-5" : "flex flex-wrap justify-center"}`}>
              {isAdmin && (
                <KpiCard icon="fa-stopwatch" iconBg="bg-blue-500/10 text-blue-500" label="NET SAAT" value={toTr(kpiCWT)} sub="Toplam Net Çalışma" />
              )}
              {isAdmin && (
                <KpiCard icon="fa-users" iconBg="bg-purple-500/10 text-purple-500" label="GÜNCEL" value={toTr(kpiFTE, 2)} sub="Kümülatif FTE" />
              )}
              <KpiCard icon="fa-mug-hot" iconBg="bg-amber-500/10 text-amber-500" label="OPERASYONEL" value={toTr(kpiBreak, 2) + "%"} sub="Mola Oranı" />
              <KpiCard icon="fa-hourglass-half" iconBg="bg-rose-500/10 text-rose-500" label="DAKİKA" value={toTr(kpiMissing)} sub="Toplam Eksik Süre" />
              <div className="kpi-card bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800" style={{ minWidth: 180 }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl"><i className="fa-solid fa-user-slash" /></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DÖNEM</span>
                </div>
                <h3 className={`text-3xl font-black tracking-tighter ${dvsStat.rate === null ? "" : dvsStat.rate > 0.05 ? "text-rose-500" : "text-emerald-500"}`}>
                  {dvsStat.rate !== null ? toTr(dvsStat.rate * 100, 2) + "%" : "—"}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tight">Devamsızlık Oranı</p>
              </div>
            </div>

            {/* Tablo */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-black text-slate-400 uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="px-6 py-5">Temsilci Bilgisi</th>
                      <th className="px-6 py-5">Yönetici</th>
                      {isAdmin && <th className="px-6 py-5 text-center">FTE (Cap)</th>}
                      <th className="px-6 py-5 text-center">Mola Oranı</th>
                      <th className="px-6 py-5 text-center">Eksik Süre</th>
                      <th className="px-6 py-5 text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                    {filtered.map(row => {
                      const m = Math.round(row.missing_time);
                      const bR = row.break_rate * 100;
                      let statusClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                      let statusText = "HEDEFTE";
                      if (m > 60 || row.capped_fte < 0.85) { statusClass = "text-rose-500 bg-rose-500/10 border-rose-500/20"; statusText = "KRİTİK"; }
                      else if (m > 0) { statusClass = "text-amber-500 bg-amber-500/10 border-amber-500/20"; statusText = "TAKİPTE"; }
                      return (
                        <tr key={row.user_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-[10px]">{mkIni(row.user_name)}</div>
                              <span className="tracking-tight truncate text-sm">{row.user_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-medium text-sm">{row.team_leader}</td>
                          {isAdmin && <td className="px-6 py-4 text-center font-black text-sm">{toTr(row.capped_fte, 2)}</td>}
                          <td className="px-6 py-4 text-center text-slate-500 font-medium text-sm">{toTr(bR, 2)}%</td>
                          <td className={`px-6 py-4 text-center font-black text-sm ${m > 0 ? "text-rose-500" : "text-emerald-500"}`}>{toTr(m)} dk</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-widest ${statusClass}`}>{statusText}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">Veri bulunamadı</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Özel Export Modal */}
      {showOzelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-lg tracking-tight">Özel Export</h3>
              <button onClick={() => setShowOzelModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors text-xl"><i className="fa-solid fa-xmark" /></button>
            </div>

            {/* Metrik seçimi */}
            <div className="mb-5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Metrik</label>
              <div className="grid grid-cols-2 gap-2">
                {METRICS.map(m => (
                  <button key={m.key} onClick={() => { setSelectedMetric(m.key); setSelectedDays(new Set()); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${selectedMetric === m.key ? m.color + " border-current" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                    <i className={`fa-solid ${m.icon}`} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Temsilciler */}
            <div className="mb-5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Temsilciler</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setSelectedUsers(new Set(allUsers))} className="text-xs font-bold text-blue-500 hover:underline">Tümünü Seç</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelectedUsers(new Set())} className="text-xs font-bold text-slate-400 hover:underline">Temizle</button>
              </div>
              <input type="text" value={modalUserSearch} onChange={e => setModalUserSearch(e.target.value)} placeholder="Temsilci ara..." className="w-full mb-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1 bg-slate-50 dark:bg-slate-800/50">
                {filteredModalUsers.map(u => (
                  <label key={u} className="flex items-center gap-2 cursor-pointer text-sm font-semibold py-0.5">
                    <input type="checkbox" className="accent-blue-500" checked={selectedUsers.has(u)} onChange={e => { const s = new Set(selectedUsers); e.target.checked ? s.add(u) : s.delete(u); setSelectedUsers(s); }} />
                    <span className={visibleUsers.has(u) ? "" : "text-slate-400"}>{u}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Günler */}
            <div className="mb-6">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Günler {selectedMetric && <span className="text-slate-400">({fmtDateShort(modalDays[0] ?? "-")} — {fmtDateShort(modalDays[modalDays.length - 1] ?? "-")})</span>}</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setSelectedDays(new Set(modalDays))} className="text-xs font-bold text-blue-500 hover:underline">Tümünü Seç</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelectedDays(new Set())} className="text-xs font-bold text-slate-400 hover:underline">Temizle</button>
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-800/50">
                {modalDays.length === 0 && <p className="col-span-3 text-center text-xs font-bold text-slate-400 py-2">Önce metrik seçin</p>}
                {modalDays.map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                    <input type="checkbox" className="accent-blue-500" checked={selectedDays.has(d)} onChange={e => { const s = new Set(selectedDays); e.target.checked ? s.add(d) : s.delete(d); setSelectedDays(s); }} />
                    {fmtDateShort(d)}
                  </label>
                ))}
              </div>
            </div>

            <button onClick={exportOzel} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all">
              <i className="fa-solid fa-file-export mr-2" /> İndir
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
