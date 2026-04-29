"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import * as XLSX from "xlsx";
import type { GoalpexRow, UserRow } from "@/types";

const MONTHS = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const fmtPeriod = (p: string) => {
  if (!p?.includes("-")) return p;
  const [y, m] = p.split("-");
  return `${MONTHS[parseInt(m)]} ${y}`;
};

// ── Scoring formulas (from index.html:1301-1308) ─────────────────
function calcPerfPuan(v: number | null): number | null {
  if (v === null) return null;
  if (v >= 120) return 45; if (v >= 110) return 30;
  if (v >= 95) return 20; if (v >= 90) return 10; return 0;
}
function calcIffPuan(v: number | null): number | null {
  if (v === null) return null;
  if (v === 0) return 40; if (v <= 199) return 35; if (v <= 399) return 20;
  if (v <= 499) return 10; if (v <= 999) return 0; return -120;
}
function calcKalitePuan(v: number | null): number | null {
  if (v === null) return null;
  return v >= 97 ? 25 : -120;
}
function calcQuizPuan(v: number | null): number | null {
  if (v === null) return null;
  if (v >= 95) return 10; if (v >= 90) return 5; return 0;
}
function calcMolaPuan(v: number | null): number | null {
  if (v === null) return null;
  return v >= 15 && v <= 16 ? 0 : -10;
}
function calcSikayetPuan(v: number): number { return v >= 1 ? -120 : 0; }
function calcDevamsizPuan(v: number): number {
  if (v === 0) return 0; if (v === 1) return -15; return -120;
}
function getPrim(p: number): { prim: string; band: string } {
  if (p >= 116) return { prim: "₺4.200", band: "116–120 puan bandı" };
  if (p >= 111) return { prim: "₺3.900", band: "111–115 puan bandı" };
  if (p >= 106) return { prim: "₺3.700", band: "106–110 puan bandı" };
  if (p >= 101) return { prim: "₺3.200", band: "101–105 puan bandı" };
  if (p >= 95) return { prim: "₺2.800", band: "95–100 puan bandı" };
  if (p >= 90) return { prim: "₺2.500", band: "90–94 puan bandı" };
  if (p >= 85) return { prim: "₺2.250", band: "85–89 puan bandı" };
  if (p >= 80) return { prim: "₺2.000", band: "80–84 puan bandı" };
  return { prim: "Prim yok", band: "80 puanın altında prim ödenmez" };
}

interface FullGoalpexRow extends GoalpexRow {
  team: string;
  tl: string;
}

interface SimState {
  perf: string; iff: string; kalite: string; quiz: string; mola: string;
  sikayet: string; devamsiz: string;
}

// ── Mini KPI card ─────────────────────────────────────────────────
function GpCard({ icon, iconBg, label, value, sub }: { icon: string; iconBg: string; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-center mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}><i className={`fa-solid ${icon}`} /></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-100">{value}</h3>
      <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tight">{sub}</p>
    </div>
  );
}

// ── Scala card ────────────────────────────────────────────────────
function ScalaCard({ accent, icon, label, badge, rows }: {
  accent: string; icon: string; label: string; badge?: string;
  rows: { kpi: string; puan: string; type: "pos" | "neu" | "neg" }[];
}) {
  const accentMap: Record<string, { border: string; text: string; bg: string }> = {
    emerald: { border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { border: "border-amber-500/30", text: "text-amber-400", bg: "bg-amber-500/10" },
    blue: { border: "border-blue-500/30", text: "text-blue-400", bg: "bg-blue-500/10" },
    purple: { border: "border-purple-500/30", text: "text-purple-400", bg: "bg-purple-500/10" },
    orange: { border: "border-orange-500/30", text: "text-orange-400", bg: "bg-orange-500/10" },
    rose: { border: "border-rose-500/30", text: "text-rose-400", bg: "bg-rose-500/10" },
    slate: { border: "border-slate-500/30", text: "text-slate-400", bg: "bg-slate-500/10" },
  };
  const c = accentMap[accent] ?? accentMap.slate;
  const puanColor = (t: "pos" | "neu" | "neg") =>
    t === "pos" ? "text-emerald-500" : t === "neg" ? "text-rose-500" : "text-slate-400";
  return (
    <div className={`bg-slate-900 rounded-2xl border ${c.border} p-4`}>
      <div className={`flex items-center gap-2 pb-3 mb-3 border-b ${c.border}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
          <i className={`fa-solid ${icon} ${c.text} text-sm`} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-wider ${c.text}`}>{label}</span>
        {badge && <span className={`ml-auto text-[11px] font-black ${c.text} bg-current/10 px-2 py-0.5 rounded-full border ${c.border}`} style={{ background: "rgba(0,0,0,0.2)" }}>{badge}</span>}
      </div>
      <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
        <span>KPI</span><span>PUAN</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${r.type === "pos" ? "bg-emerald-500/5" : r.type === "neg" ? "bg-rose-500/5" : "bg-slate-800/50"}`}>
            <span className="text-xs font-bold text-slate-300">{r.kpi}</span>
            <span className={`text-xs font-black ${puanColor(r.type)}`}>{r.puan}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GoalpexView() {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [allData, setAllData] = useState<FullGoalpexRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamFilter, setTeamFilter] = useState("all");
  const [tlFilter, setTlFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showScala, setShowScala] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [sim, setSim] = useState<SimState>({ perf: "", iff: "", kalite: "", quiz: "", mola: "", sikayet: "0", devamsiz: "0" });

  useEffect(() => {
    fetch("/api/periods").then(r => r.json()).then(d => {
      const ps: string[] = d.goalpex ?? [];
      setPeriods(ps);
      if (ps.length > 0) setSelectedPeriod(ps[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    setAllData([]);
    fetch(`/api/goalpex?period=${selectedPeriod}`)
      .then(r => r.json())
      .then(d => {
        const rows: GoalpexRow[] = d.goalpex ?? [];
        const users: UserRow[] = d.users ?? [];
        const userMap: Record<string, { team: string; tl: string }> = {};
        users.forEach(u => { userMap[u.user_name] = { team: u.team ?? "-", tl: u.team_leader ?? "-" }; });
        setAllData(rows.map(r => ({ ...r, team: userMap[r.user_name]?.team ?? "-", tl: userMap[r.user_name]?.tl ?? "-" })));
      })
      .finally(() => setLoading(false));
  }, [selectedPeriod]);

  const teams = useMemo(() => [...new Set(allData.map(d => d.team).filter(t => t && t !== "-"))].sort(), [allData]);
  const tls = useMemo(() => {
    const src = teamFilter !== "all" ? allData.filter(d => d.team === teamFilter) : allData;
    return [...new Set(src.map(d => d.tl).filter(t => t && t !== "-"))].sort();
  }, [allData, teamFilter]);

  const filtered = useMemo(() => {
    return allData.filter(d => {
      if (teamFilter !== "all" && d.team !== teamFilter) return false;
      if (tlFilter !== "all" && d.tl !== tlFilter) return false;
      if (search && !d.user_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (!isAdmin && user?.user_name && d.user_name.toLowerCase().trim() !== user.user_name.toLowerCase().trim()) return false;
      return true;
    });
  }, [allData, teamFilter, tlFilter, search, isAdmin, user]);

  // KPI summaries
  const totalPrim = filtered.reduce((s, d) => s + (parseFloat(String(d.prim_tutari ?? 0)) || 0), 0);
  const primAlan = filtered.filter(d => (parseFloat(String(d.prim_tutari ?? 0)) || 0) > 0).length;
  const perfOlan = filtered.filter(d => (parseFloat(String(d.perf_puan ?? d.perf_pct ?? 0)) || 0) > 0).length;
  const primOran = perfOlan > 0 ? (primAlan / perfOlan) * 100 : 0;

  // Agent KPI
  const myRow = !isAdmin ? filtered[0] : null;
  const myPuan = myRow ? Math.max(0, parseFloat(String(myRow.goalpex_puan ?? 0)) || 0) : 0;
  const myPrim = myRow ? Math.max(0, parseFloat(String(myRow.prim_tutari ?? 0)) || 0) : 0;

  // Simulator calculation
  const simResult = useMemo(() => {
    const pv = sim.perf !== "" ? parseFloat(sim.perf) : null;
    const iv = sim.iff !== "" ? parseFloat(sim.iff) : null;
    const kv = sim.kalite !== "" ? parseFloat(sim.kalite) : null;
    const qv = sim.quiz !== "" ? parseFloat(sim.quiz) : null;
    const mv = sim.mola !== "" ? parseFloat(sim.mola) : null;
    const pp = calcPerfPuan(pv); const pi = calcIffPuan(iv);
    const pk = calcKalitePuan(kv); const pq = calcQuizPuan(qv);
    const pm = calcMolaPuan(mv);
    const ps = calcSikayetPuan(parseInt(sim.sikayet));
    const pd = calcDevamsizPuan(parseInt(sim.devamsiz));
    const parts = [pp, pi, pk, pq, pm];
    if (parts.some(x => x === null)) return { pp, pi, pk, pq, pm, ps, pd, total: null };
    const total = (pp ?? 0) + (pi ?? 0) + (pk ?? 0) + (pq ?? 0) + (pm ?? 0) + ps + pd;
    return { pp, pi, pk, pq, pm, ps, pd, total };
  }, [sim]);

  // Export
  function exportExcel() {
    const exportRows = filtered.map(d => ({
      "Temsilci": d.user_name, "Ekip": d.team, "Takım Lideri": d.tl,
      "Performans %": d.perf_pct ? (parseFloat(String(d.perf_pct)) * 100).toFixed(2) : "",
      "IFF": d.iff_puan != null ? parseFloat(String(d.iff_puan)) : (d.iff != null ? parseFloat(String(d.iff)) : ""),
      "Kalite": d.kalite_puan != null ? parseFloat(String(d.kalite_puan)) : "",
      "Quiz": d.quiz_puan != null ? parseFloat(String(d.quiz_puan)) : "",
      "Mola %": d.mola_puan != null ? parseFloat(String(d.mola_puan)) : (d.mola_pct ? (parseFloat(String(d.mola_pct)) * 100).toFixed(2) : ""),
      "Şikayet": d.sikayet_puan != null ? d.sikayet_puan : "",
      "Devamsızlık": d.devamsiz_puan != null ? d.devamsiz_puan : "",
      "Goalpex Puanı": Math.max(0, parseFloat(String(d.goalpex_puan ?? 0)) || 0),
      "Prim Tutarı": Math.max(0, parseFloat(String(d.prim_tutari ?? 0)) || 0),
    }));
    const totalRow = { "Temsilci": "GENEL TOPLAM", "Ekip": "", "Takım Lideri": "", "Performans %": "", "IFF": "", "Kalite": "", "Quiz": "", "Mola %": "", "Şikayet": "", "Devamsızlık": "", "Goalpex Puanı": "", "Prim Tutarı": totalPrim };
    const ws = XLSX.utils.json_to_sheet([...exportRows, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Goalpex");
    XLSX.writeFile(wb, `Goalpex_${selectedPeriod}.xlsx`);
  }

  const fmtPuan = (v: number | null | undefined) => v != null ? `${v > 0 ? "+" : ""}${v}` : "—";

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-5 z-20">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase text-slate-900 dark:text-slate-100">Goalpex</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Temsilci bazlı prim ve performans değerlendirmesi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                <i className="fa-solid fa-calendar-day absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs pointer-events-none" />
                <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[160px] text-slate-800 dark:text-slate-100">
                  {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                </select>
              </div>
              {isAdmin && (
                <>
                  <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                    <i className="fa-solid fa-layer-group absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                    <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setTlFilter("all"); }}
                      className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[130px] text-slate-800 dark:text-slate-100">
                      <option value="all">Tüm Ekipler</option>
                      {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <i className="fa-solid fa-user-tie absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                    <select value={tlFilter} onChange={e => setTlFilter(e.target.value)}
                      className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[140px] text-slate-800 dark:text-slate-100">
                      <option value="all">Tüm Liderler</option>
                      {tls.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="relative min-w-[200px]">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Temsilci Ara..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-slate-800 dark:text-slate-100" />
            </div>
            {isAdmin && (
              <button onClick={exportExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest">
                <i className="fa-solid fa-file-export" /> Excel Export
              </button>
            )}
            <button onClick={() => setShowScala(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
              <i className="fa-solid fa-table-list" /> Goalpex Scala
            </button>
            <button onClick={() => setShowSim(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest"
              style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
              <i className="fa-solid fa-calculator" /> Goalpex Simulator
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            {isAdmin ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" style={{ maxWidth: 900, margin: "0 auto" }}>
                <GpCard icon="fa-trophy" iconBg="bg-indigo-500/10 text-indigo-500" label="DÖNEM"
                  value={"₺" + totalPrim.toLocaleString("tr-TR")} sub="Toplam Prim Tutarı" />
                <GpCard icon="fa-users" iconBg="bg-emerald-500/10 text-emerald-500" label="TEMSİLCİ"
                  value={primAlan + " kişi"} sub="Prim Alan Temsilci" />
                <GpCard icon="fa-percent" iconBg="bg-amber-500/10 text-amber-500" label="ORAN"
                  value={primOran.toFixed(1).replace(".", ",") + "%"} sub="Prim Alan Temsilci %" />
              </div>
            ) : (
              <div className="flex justify-center gap-4" style={{ maxWidth: 900, margin: "0 auto" }}>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800" style={{ width: 280 }}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-xl"><i className="fa-solid fa-bullseye" /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DÖNEM</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-100">{myPuan > 0 ? myPuan + " P" : "0 P"}</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tight">Goalpex Puanım</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800" style={{ width: 280 }}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl"><i className="fa-solid fa-trophy" /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DÖNEM</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-100">
                    {myPrim > 0 ? "₺" + myPrim.toLocaleString("tr-TR") : "₺0"}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tight">Prim Tutarım</p>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black tracking-tight text-sm text-slate-900 dark:text-slate-100">Temsilci Goalpex Detayı</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dönem Değerlendirmesi</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-black text-slate-400 uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="px-5 py-4 min-w-[160px]">Temsilci Bilgisi</th>
                      <th className="px-4 py-4 text-center">Perf. %</th>
                      <th className="px-4 py-4 text-center">IFF</th>
                      <th className="px-4 py-4 text-center">Kalite</th>
                      <th className="px-4 py-4 text-center">Quiz</th>
                      <th className="px-4 py-4 text-center">Mola %</th>
                      <th className="px-4 py-4 text-center">Şikayet</th>
                      <th className="px-4 py-4 text-center">Devamsızlık</th>
                      {isAdmin && <th className="px-4 py-4 text-center">Goalpex P</th>}
                      {isAdmin && <th className="px-4 py-4 text-center">Prim Tutarı</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 8} className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                              <i className="fa-solid fa-bullseye text-violet-500 text-2xl" />
                            </div>
                            <p className="text-slate-400 font-bold text-sm">Bu dönem için Goalpex verisi bulunamadı</p>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.map((row, i) => {
                      const puan = Math.max(0, parseFloat(String(row.goalpex_puan ?? 0)) || 0);
                      const prim = Math.max(0, parseFloat(String(row.prim_tutari ?? 0)) || 0);
                      const perf = (parseFloat(String(row.perf_pct ?? 0)) || 0) * 100;
                      const kalite = parseFloat(String(row.kalite_puan ?? 0)) || 0;
                      const quiz = parseFloat(String(row.quiz_puan ?? 0)) || 0;
                      const mola = (parseFloat(String(row.mola_puan ?? row.mola_pct ?? 0)) || 0);
                      const molaPct = row.mola_pct ? mola * 100 : mola;
                      const sikayet = parseFloat(String(row.sikayet_puan ?? 0)) || 0;
                      const devamsiz = parseFloat(String(row.devamsiz_puan ?? 0)) || 0;
                      const iff = parseFloat(String(row.iff_puan ?? row.iff ?? 0)) || 0;
                      const puanC = puan >= 100 ? "text-emerald-500" : puan >= 80 ? "text-amber-500" : "text-rose-500";
                      const primC = prim > 0 ? "text-indigo-500" : "text-slate-400";
                      const perfC = perf >= 100 ? "text-emerald-500" : "text-rose-500";
                      const kaliteC = kalite >= 97 ? "text-emerald-500" : "text-rose-500";
                      const molaC = (molaPct >= 15 && molaPct <= 16) ? "text-emerald-500" : "text-rose-500";
                      return (
                        <tr key={row.user_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 font-black text-[10px]">{i + 1}</div>
                              <span className="font-bold text-sm truncate">{row.user_name}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-sm ${perfC}`}>
                            %{perf.toFixed(1).replace(".", ",")}
                          </td>
                          <td className="px-4 py-4 text-center font-medium text-sm text-slate-600 dark:text-slate-300">
                            {iff > 0 ? "₺" + iff.toLocaleString("tr-TR") : "-"}
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-sm ${kaliteC}`}>
                            {kalite > 0 ? kalite.toFixed(2).replace(".", ",") : "-"}
                          </td>
                          <td className="px-4 py-4 text-center font-medium text-sm text-slate-600 dark:text-slate-300">
                            {quiz > 0 ? quiz.toFixed(1).replace(".", ",") : "-"}
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-sm ${molaC}`}>
                            {molaPct > 0 ? molaPct.toFixed(2).replace(".", ",") + "%" : "-"}
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-sm ${sikayet > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {sikayet}
                          </td>
                          <td className={`px-4 py-4 text-center font-black text-sm ${devamsiz > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {devamsiz}
                          </td>
                          {isAdmin && (
                            <td className={`px-4 py-4 text-center font-black text-sm ${puanC}`}>
                              {puan > 0 ? puan + " P" : "0 P"}
                            </td>
                          )}
                          {isAdmin && (
                            <td className={`px-4 py-4 text-center font-black text-sm ${primC}`}>
                              {prim > 0 ? "₺" + prim.toLocaleString("tr-TR") : "₺0"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Scala Modal ───────────────────────────────────────────── */}
      {showScala && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-950 z-10 rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15"><i className="fa-solid fa-table-list text-indigo-400 text-lg" /></div>
                <div>
                  <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100">Goalpex Scala</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Prim Değerlendirme Kriterleri</p>
                </div>
              </div>
              <button onClick={() => setShowScala(false)} className="text-slate-400 hover:text-rose-500 transition-colors text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScalaCard accent="emerald" icon="fa-gauge-high" label="Performans %" badge="45P" rows={[
                { kpi: "%120+", puan: "+45", type: "pos" }, { kpi: "%110–%120", puan: "+30", type: "pos" },
                { kpi: "%95–%99", puan: "+20", type: "pos" }, { kpi: "%90–%94", puan: "+10", type: "pos" },
                { kpi: "%90 altı", puan: "0", type: "neu" },
              ]} />
              <ScalaCard accent="amber" icon="fa-turkish-lira-sign" label="IFF" badge="40P" rows={[
                { kpi: "₺0", puan: "+40", type: "pos" }, { kpi: "₺0–₺199", puan: "+35", type: "pos" },
                { kpi: "₺200–₺399", puan: "+20", type: "pos" }, { kpi: "₺400–₺499", puan: "+10", type: "pos" },
                { kpi: "₺500–₺999", puan: "0", type: "neu" }, { kpi: "> ₺1000", puan: "−120", type: "neg" },
              ]} />
              <ScalaCard accent="blue" icon="fa-star" label="Kalite" badge="25P" rows={[
                { kpi: "97–100", puan: "+25", type: "pos" }, { kpi: "< 97", puan: "−120", type: "neg" },
              ]} />
              <ScalaCard accent="purple" icon="fa-circle-question" label="Quiz" badge="10P" rows={[
                { kpi: "95–100", puan: "+10", type: "pos" }, { kpi: "90–95", puan: "+5", type: "pos" },
                { kpi: "< 90", puan: "0", type: "neu" },
              ]} />
              <ScalaCard accent="orange" icon="fa-mug-hot" label="Mola %" rows={[
                { kpi: "%15–%16", puan: "0", type: "neu" }, { kpi: "> %16", puan: "−10", type: "neg" },
                { kpi: "< %15", puan: "−10", type: "neg" },
              ]} />
              <ScalaCard accent="rose" icon="fa-triangle-exclamation" label="Şikayet" rows={[
                { kpi: "0 şikayet", puan: "0", type: "neu" }, { kpi: "≥ 1 şikayet", puan: "−120", type: "neg" },
              ]} />
              <ScalaCard accent="slate" icon="fa-user-xmark" label="Devamsızlık" rows={[
                { kpi: "0 gün", puan: "0", type: "neu" }, { kpi: "1 gün", puan: "−15", type: "neg" },
                { kpi: "2 gün ve üzeri", puan: "−120", type: "neg" },
              ]} />
              {/* Prim tablosu */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-indigo-500/40 p-4" style={{ boxShadow: "0 0 24px rgba(99,102,241,0.15)" }}>
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-indigo-500/30">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20">
                    <i className="fa-solid fa-trophy text-indigo-400 text-sm" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">Prim Tablosu</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { band: "116–120P", prim: "₺4.200" }, { band: "111–115P", prim: "₺3.900" },
                    { band: "106–110P", prim: "₺3.700" }, { band: "101–105P", prim: "₺3.200" },
                    { band: "95–100P", prim: "₺2.800" }, { band: "90–94P", prim: "₺2.500" },
                    { band: "85–89P", prim: "₺2.250" }, { band: "80–84P", prim: "₺2.000" },
                  ].map(r => (
                    <div key={r.band} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{r.band}</span>
                      <span className="text-xs font-black text-indigo-400">{r.prim}</span>
                    </div>
                  ))}
                  <div className="mt-1 pt-2 border-t border-indigo-500/20 flex justify-between text-xs font-black px-1">
                    <span className="text-slate-500 dark:text-slate-300">Max Puan</span>
                    <span className="text-indigo-400">120 P</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Simulator Modal ───────────────────────────────────────── */}
      {showSim && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-950 z-10 rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15"><i className="fa-solid fa-calculator text-amber-400 text-lg" /></div>
                <div>
                  <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100">Goalpex Simulator</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hedef senaryolarını hesapla</p>
                </div>
              </div>
              <button onClick={() => setShowSim(false)} className="text-slate-400 hover:text-rose-500 transition-colors text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { key: "perf", label: "Performans %", icon: "fa-gauge-high", color: "text-emerald-400", placeholder: "Örn: 95", type: "number" },
                  { key: "iff", label: "IFF (₺)", icon: "fa-turkish-lira-sign", color: "text-amber-400", placeholder: "Örn: 150", type: "number" },
                  { key: "kalite", label: "Kalite Puanı", icon: "fa-star", color: "text-blue-400", placeholder: "Örn: 98", type: "number" },
                  { key: "quiz", label: "Quiz Puanı", icon: "fa-circle-question", color: "text-purple-400", placeholder: "Örn: 92", type: "number" },
                  { key: "mola", label: "Mola Oranı (%)", icon: "fa-mug-hot", color: "text-orange-400", placeholder: "Örn: 15.5", type: "number" },
                ].map(f => (
                  <div key={f.key}>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      <i className={`fa-solid ${f.icon} ${f.color} mr-1`} />{f.label}
                    </span>
                    <input type="number" value={sim[f.key as keyof SimState]}
                      onChange={e => setSim(s => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100" />
                  </div>
                ))}
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                    <i className="fa-solid fa-triangle-exclamation text-rose-400 mr-1" />Şikayet Sayısı
                  </span>
                  <select value={sim.sikayet} onChange={e => setSim(s => ({ ...s, sikayet: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    <option value="0">0 — Şikayet yok</option>
                    <option value="1">≥ 1 — Şikayet var</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                    <i className="fa-solid fa-user-xmark text-slate-400 mr-1" />Devamsızlık (Gün)
                  </span>
                  <select value={sim.devamsiz} onChange={e => setSim(s => ({ ...s, devamsiz: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer">
                    <option value="0">0 gün</option>
                    <option value="1">1 gün</option>
                    <option value="2">2+ gün</option>
                  </select>
                </div>
              </div>

              {/* Result */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 bg-slate-50 dark:bg-slate-900">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Puan Dökümü</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Performans %", val: simResult.pp },
                      { label: "IFF", val: simResult.pi },
                      { label: "Kalite", val: simResult.pk },
                      { label: "Quiz", val: simResult.pq },
                      { label: "Mola %", val: simResult.pm },
                      { label: "Şikayet", val: simResult.ps },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex justify-between text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500">{label}</span>
                        <span className={val === null ? "text-slate-400" : (val ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {val === null ? "—" : fmtPuan(val)}
                        </span>
                      </div>
                    ))}
                    <div className="col-span-2 flex justify-between text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500">Devamsızlık</span>
                      <span className={(simResult.pd ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}>{fmtPuan(simResult.pd)}</span>
                    </div>
                  </div>
                </div>
                <div className="p-5 border-t border-slate-200 dark:border-slate-800"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.06))" }}>
                  {simResult.total !== null ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goalpex Puanı</p>
                          <p className={`text-4xl font-black tracking-tighter mt-1 ${simResult.total >= 80 ? "text-indigo-400" : "text-rose-500"}`}>
                            {simResult.total} P
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahmini Prim</p>
                          <p className={`text-4xl font-black tracking-tighter mt-1 ${simResult.total >= 80 ? "text-emerald-400" : "text-rose-500"}`}>
                            {getPrim(simResult.total).prim}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] font-bold text-slate-500 text-center">{getPrim(simResult.total).band}</p>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm font-bold text-slate-400">Tüm alanları doldurun</p>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={() => setSim({ perf: "", iff: "", kalite: "", quiz: "", mola: "", sikayet: "0", devamsiz: "0" })}
                className="mt-4 w-full py-2.5 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold rounded-xl text-xs uppercase tracking-widest transition-all">
                <i className="fa-solid fa-rotate-left mr-1" /> Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
