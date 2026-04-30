"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import * as XLSX from "xlsx";
import type { PerformanceRow, UserRow } from "@/types";

const MONTHS = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function fmtPeriod(p: string) {
  if (!p || !p.includes("-")) return p;
  const [y, m] = p.split("-");
  return `${MONTHS[parseInt(m)]} ${y}`;
}
function fmtDateTR(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day} ${MONTHS[parseInt(m)]} ${y}`;
}
function fmtDateShort(d: string) {
  if (!d) return "-";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

interface PerfRow extends PerformanceRow {
  performance_pct?: number;
  [key: string]: unknown;
}

interface OzelModalState {
  open: boolean;
  users: string[];
  days: string[];
  selectedUsers: Set<string>;
  selectedDays: Set<string>;
  userSearch: string;
}

export default function PerformansView() {
  const { user } = useUser();
  const isAgent = user?.role === "agent";

  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [allData, setAllData] = useState<PerfRow[]>([]);
  const [teamUserNames, setTeamUserNames] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [ozel, setOzel] = useState<OzelModalState>({
    open: false, users: [], days: [], selectedUsers: new Set(), selectedDays: new Set(), userSearch: "",
  });
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/periods")
      .then((r) => r.json())
      .then((d) => {
        const ps: string[] = d.performans ?? [];
        setPeriods(ps);
        if (ps.length > 0) setSelectedPeriod(ps[0]);
      });
  }, []);

  // Agent için aynı ekipteki kullanıcı listesini çek
  useEffect(() => {
    if (!isAgent || !user?.team) return;
    fetch("/api/users")
      .then(r => r.json())
      .then((data: UserRow[]) => {
        const names = new Set(
          data.filter(u => u.team === user!.team).map(u => u.user_name.toLowerCase().trim())
        );
        setTeamUserNames(names);
      });
  }, [isAgent, user?.team]);

  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    setAllData([]);
    setSelectedDate("all");
    fetch(`/api/performans?period=${selectedPeriod}`)
      .then((r) => r.json())
      .then((data: PerfRow[]) => { setAllData(data ?? []); })
      .finally(() => setLoading(false));
  }, [selectedPeriod]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const dates = [...new Set(allData.map((d) => d.date).filter((d) => d !== null && d !== undefined) as string[])].sort((a, b) => b.localeCompare(a));

  const filtered = useCallback((): PerfRow[] => {
    let rows = selectedDate === "all"
      ? allData.filter((d) => d.date === null)
      : allData.filter((d) => d.date === selectedDate);
    if (isAgent && user?.user_name) {
      if (teamUserNames.size > 0) {
        rows = rows.filter((d) => teamUserNames.has(String(d.user_name ?? "").toLowerCase().trim()));
      } else {
        rows = rows.filter((d) => String(d.user_name ?? "").toLowerCase().trim() === user.user_name.toLowerCase().trim());
      }
    }
    if (search) {
      rows = rows.filter((d) => d.user_name.toLowerCase().includes(search.toLowerCase()));
    }
    return [...rows].sort((a, b) => (parseFloat(String(b.performance_pct ?? 0)) || 0) - (parseFloat(String(a.performance_pct ?? 0)) || 0));
  }, [allData, selectedDate, isAgent, user, search, teamUserNames]);

  const rows = filtered();
  const maxActual = Math.max(...rows.map((d) => parseFloat(String(d.transaction_count ?? 0)) || 0), 1);

  // ─── Export helpers ───────────────────────────────────────────────

  function exportKumulatif() {
    const kd = allData.filter((d) => d.date === null)
      .sort((a, b) => (parseFloat(String(b.performance_pct ?? 0)) || 0) - (parseFloat(String(a.performance_pct ?? 0)) || 0));
    const exportRows = kd.map((d) => {
      const avg = parseFloat(String(d.pool_average ?? 0)) || 0;
      const actual = parseFloat(String(d.transaction_count ?? 0)) || 0;
      const pct = parseFloat(String(d.performance_pct ?? 0)) || 0;
      return {
        "Temsilci": d.user_name,
        "Havuz Ortalaması": avg > 0 ? parseFloat(avg.toFixed(2)) : "",
        "Gerçekleşen": actual || "",
        "Performans %": pct > 0 ? pct / 100 : "",
        "Ort. Uzaklık": avg > 0 ? parseFloat((actual - avg).toFixed(2)) : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const c = XLSX.utils.encode_cell({ r: R, c: 3 });
      if (ws[c]) { ws[c].t = "n"; ws[c].z = "0.00%"; }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kümülatif");
    XLSX.writeFile(wb, `Performans_Kumulatif_${selectedPeriod}.xlsx`);
    setExportOpen(false);
  }

  function buildPivotData(users: string[], days: string[]) {
    const dr = allData.filter((d) => d.date !== null);
    const ds: Record<string, { avg: number; hc: number; total: number }> = {};
    days.forEach((day) => {
      const dd = dr.filter((d) => d.date === day);
      ds[day] = {
        avg: dd.length > 0 ? (parseFloat(String(dd[0].pool_average ?? 0)) || 0) : 0,
        hc: dd.length,
        total: dd.reduce((s, d) => s + (parseFloat(String(d.transaction_count ?? 0)) || 0), 0),
      };
    });
    const exportRows = users.map((u) => {
      const row: Record<string, unknown> = { "Temsilci": u };
      days.forEach((day) => {
        const m = dr.find((d) => d.user_name === u && d.date === day);
        row[fmtDateShort(day)] = m ? (parseFloat(String(m.transaction_count ?? 0)) || "") : "";
      });
      return row;
    });
    const aR: Record<string, unknown> = { "Temsilci": "Havuz Ortalaması" };
    const hR: Record<string, unknown> = { "Temsilci": "HC" };
    const tR: Record<string, unknown> = { "Temsilci": "Toplam İşlem" };
    days.forEach((day) => {
      aR[fmtDateShort(day)] = ds[day].avg > 0 ? parseFloat(ds[day].avg.toFixed(2)) : "";
      hR[fmtDateShort(day)] = ds[day].hc || "";
      tR[fmtDateShort(day)] = ds[day].total || "";
    });
    return { rows: exportRows, avgRow: aR, hcRow: hR, totalRow: tR };
  }

  function exportGunluk() {
    const dr = allData.filter((d) => d.date !== null);
    const days = [...new Set(dr.map((d) => d.date as string))].sort();
    const users = [...new Set(dr.map((d) => d.user_name))].sort();
    const { rows: exportRows, avgRow, hcRow, totalRow } = buildPivotData(users, days);
    const ws = XLSX.utils.json_to_sheet([...exportRows, {}, avgRow, hcRow, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Günlük");
    XLSX.writeFile(wb, `Performans_Gunluk_${selectedPeriod}.xlsx`);
    setExportOpen(false);
  }

  function openOzel() {
    const dr = allData.filter((d) => d.date !== null);
    const days = [...new Set(dr.map((d) => d.date as string))].sort();
    const users = [...new Set(dr.map((d) => d.user_name))].sort();
    setOzel({ open: true, users, days, selectedUsers: new Set(), selectedDays: new Set(), userSearch: "" });
    setExportOpen(false);
  }

  function exportOzel() {
    const users = [...ozel.selectedUsers];
    const days = [...ozel.selectedDays].sort();
    if (users.length === 0 || days.length === 0) return;
    const { rows: exportRows, avgRow, hcRow, totalRow } = buildPivotData(users, days);
    const ws = XLSX.utils.json_to_sheet([...exportRows, {}, avgRow, hcRow, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Özel");
    XLSX.writeFile(wb, `Performans_Ozel_${selectedPeriod}.xlsx`);
    setOzel((o) => ({ ...o, open: false }));
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-5 z-20">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase">Performans</h2>
            <p className="text-xs text-slate-400 font-medium">Temsilci bazlı işlem performansı ve sıralama.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Period + Date filters */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="relative border-r border-slate-200 dark:border-slate-800 pr-2">
                <i className="fa-solid fa-calendar-day absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs pointer-events-none" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[150px] text-slate-800 dark:text-slate-100"
                >
                  {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                </select>
              </div>
              <div className="relative">
                <i className="fa-solid fa-calendar-check absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-transparent border-none text-sm font-bold cursor-pointer outline-none min-w-[170px] text-slate-800 dark:text-slate-100"
                >
                  <option value="all">Tümü (Kümülatif)</option>
                  {dates.map((d) => <option key={d} value={d}>{fmtDateTR(d)}</option>)}
                </select>
              </div>
            </div>
            {/* Search */}
            <div className="relative min-w-[200px]">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Temsilci Ara..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-slate-800 dark:text-slate-100"
              />
            </div>
            {/* Export */}
            {!isAgent && (
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((o) => !o)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest"
                >
                  <i className="fa-solid fa-file-export" /> Excel Export <i className="fa-solid fa-chevron-down text-[10px]" />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 min-w-[170px]">
                    <button onClick={exportKumulatif} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <i className="fa-solid fa-layer-group text-purple-500" /> Kümülatif
                    </button>
                    <button onClick={exportGunluk} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <i className="fa-solid fa-calendar-days text-blue-500" /> Günlük (Tüm)
                    </button>
                    <button onClick={openOzel} className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <i className="fa-solid fa-sliders text-amber-500" /> Özel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Yükleniyor...</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 h-full">
            {/* Top 10 Sidebar */}
            <div className="w-64 shrink-0">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 text-sm">
                    <i className="fa-solid fa-trophy" />
                  </div>
                  <div>
                    <h3 className="font-black tracking-tight text-sm">Top 10</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Performans Sıralaması</p>
                  </div>
                </div>
                <div className="p-3 space-y-1 overflow-y-auto flex-1">
                  {rows.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 text-xs font-bold">Veri yok</p>
                  ) : rows.slice(0, 10).map((row, i) => {
                    const rank = i + 1;
                    const pct = parseFloat(String(row.performance_pct ?? 0)) || 0;
                    const actual = parseFloat(String(row.transaction_count ?? 0)) || 0;
                    const badgeCls =
                      rank === 1 ? "bg-amber-400 text-white" :
                      rank === 2 ? "bg-slate-400 text-white" :
                      rank === 3 ? "bg-amber-700 text-white" :
                      "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
                    return (
                      <div key={row.user_name} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                        <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black ${badgeCls}`}>{rank}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{row.user_name}</p>
                          <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-rose-400"}`}
                              style={{ width: `${Math.min((actual / maxActual) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-[11px] font-black shrink-0 ${pct >= 100 ? "text-emerald-500" : "text-rose-500"}`}>
                          %{pct.toFixed(1).replace(".", ",")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 min-w-0">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-black tracking-tight text-sm">Temsilci Performans Detayı</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {selectedDate === "all" ? "Kümülatif Veriler" : `${fmtDateTR(selectedDate)} Verileri`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-black text-slate-400 uppercase tracking-widest text-[10px]">
                      <tr>
                        <th className="px-5 py-4">Temsilci Bilgisi</th>
                        <th className="px-5 py-4 text-center">Havuz Ort.</th>
                        <th className="px-5 py-4 text-center">Gerçekleşen</th>
                        <th className="px-5 py-4 text-center">Performans %</th>
                        <th className="px-5 py-4 text-center">Ort. Uzaklık</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-bold text-sm">
                            Bu dönem için veri bulunamadı.
                          </td>
                        </tr>
                      ) : rows.map((row) => {
                        const pct = parseFloat(String(row.performance_pct ?? 0)) || 0;
                        const actual = parseFloat(String(row.transaction_count ?? 0)) || 0;
                        const avg = parseFloat(String(row.pool_average ?? 0)) || 0;
                        const dist = actual - avg;
                        return (
                          <tr key={row.user_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-[10px]">
                                  {row.user_name[0]?.toUpperCase()}
                                </div>
                                <span className="font-bold text-sm truncate">{row.user_name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-center text-slate-500 font-medium text-sm">
                              {avg > 0 ? avg.toFixed(0) : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-center font-black text-sm">
                              {actual > 0 ? actual : "-"}
                            </td>
                            <td className={`px-5 py-3.5 text-center font-black text-sm ${pct >= 100 ? "text-emerald-500" : "text-rose-500"}`}>
                              %{pct.toFixed(1).replace(".", ",")}
                            </td>
                            <td className={`px-5 py-3.5 text-center font-black text-sm ${dist >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              {avg > 0 ? `${dist >= 0 ? "+" : ""}${dist.toFixed(0)}` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Özel Export Modal */}
      {ozel.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-lg tracking-tight">Export</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Temsilci ve gün seçimi yapın</p>
              </div>
              <button onClick={() => setOzel((o) => ({ ...o, open: false }))} className="text-slate-400 hover:text-rose-500 transition-colors text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Users */}
            <div className="mb-5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Temsilciler</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setOzel((o) => ({ ...o, selectedUsers: new Set(o.users) }))} className="text-xs font-bold text-blue-500 hover:underline">Tümünü Seç</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setOzel((o) => ({ ...o, selectedUsers: new Set() }))} className="text-xs font-bold text-slate-400 hover:underline">Temizle</button>
              </div>
              <div className="relative mb-2">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                <input
                  type="text"
                  value={ozel.userSearch}
                  onChange={(e) => setOzel((o) => ({ ...o, userSearch: e.target.value }))}
                  placeholder="Temsilci ara..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1 bg-slate-50 dark:bg-slate-800/50">
                {ozel.users.filter((u) => !ozel.userSearch || u.toLowerCase().includes(ozel.userSearch.toLowerCase())).map((u) => (
                  <label key={u} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={ozel.selectedUsers.has(u)}
                      onChange={(e) => setOzel((o) => {
                        const s = new Set(o.selectedUsers);
                        e.target.checked ? s.add(u) : s.delete(u);
                        return { ...o, selectedUsers: s };
                      })}
                      className="rounded"
                    />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{u}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Days */}
            <div className="mb-6">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Günler</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setOzel((o) => ({ ...o, selectedDays: new Set(o.days) }))} className="text-xs font-bold text-blue-500 hover:underline">Tümünü Seç</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setOzel((o) => ({ ...o, selectedDays: new Set() }))} className="text-xs font-bold text-slate-400 hover:underline">Temizle</button>
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-800/50">
                {ozel.days.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={ozel.selectedDays.has(d)}
                      onChange={(e) => setOzel((o) => {
                        const s = new Set(o.selectedDays);
                        e.target.checked ? s.add(d) : s.delete(d);
                        return { ...o, selectedDays: s };
                      })}
                      className="rounded"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{fmtDateShort(d)}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={exportOzel}
              disabled={ozel.selectedUsers.size === 0 || ozel.selectedDays.size === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all"
            >
              <i className="fa-solid fa-file-export mr-2" /> Export Yap
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
