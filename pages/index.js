import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [period, setPeriod] = useState("");
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ozet");

  // Dönemleri yükle
  useEffect(() => {
    async function fetchPeriods() {
      const { data } = await supabase
        .from("daily_data")
        .select("period")
        .order("period", { ascending: false });
      if (data) {
        const unique = [...new Set(data.map((d) => d.period))];
        setPeriods(unique);
        if (unique.length > 0) setPeriod(unique[0]);
      }
    }
    fetchPeriods();
  }, []);

  // Seçili döneme göre veri yükle
  useEffect(() => {
    if (!period) return;
    async function fetchData() {
      setLoading(true);
      const [u, d, s] = await Promise.all([
        supabase.from("users").select("*").order("user_name"),
        supabase.from("daily_data").select("*").eq("period", period).order("date"),
        supabase.from("period_summary").select("*").eq("period", period).order("user_name"),
      ]);
      setUsers(u.data || []);
      setDailyData(d.data || []);
      setSummary(s.data || []);
      setLoading(false);
    }
    fetchData();
  }, [period]);

  // Kullanıcı bazlı günlük veriyi grupla
  function getUserDaily(userName) {
    return dailyData.filter((d) => d.user_name === userName);
  }

  // Dönem formatla
  function formatPeriod(p) {
    if (!p) return "";
    const [y, m] = p.split("-");
    const months = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${months[parseInt(m)]} ${y}`;
  }

  // Toplam hesapla
  const toplamLogin = dailyData.reduce((s, d) => s + (d.login || 0), 0);
  const toplamBreak = dailyData.reduce((s, d) => s + (d.break_total || 0), 0);
  const toplamCwt   = dailyData.reduce((s, d) => s + (d.cwt || 0), 0);
  const ortalamaFte = summary.length
    ? (summary.reduce((s, d) => s + (d.fte || 0), 0) / summary.length).toFixed(2)
    : 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", color: "white", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Workforce Dashboard</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Performans & Çalışma Süresi Takibi</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 14, background: "#1e293b", color: "white", cursor: "pointer" }}
        >
          {periods.map((p) => (
            <option key={p} value={p}>{formatPeriod(p)}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: "32px 40px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#64748b", fontSize: 16 }}>Veriler yükleniyor...</div>
        ) : (
          <>
            {/* KPI Kartları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
              {[
                { label: "Toplam Login", value: toplamLogin.toFixed(0) + " dk", color: "#3b82f6" },
                { label: "Toplam Break", value: toplamBreak.toFixed(0) + " dk", color: "#f59e0b" },
                { label: "Toplam CWT",   value: toplamCwt.toFixed(0) + " dk",   color: "#10b981" },
                { label: "Ort. FTE",     value: ortalamaFte,                     color: "#8b5cf6" },
              ].map((kpi) => (
                <div key={kpi.label} style={{ background: "white", borderRadius: 12, padding: "24px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `4px solid ${kpi.color}` }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 500 }}>{kpi.label}</p>
                  <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[
                { id: "ozet", label: "Dönem Özeti" },
                { id: "gunluk", label: "Günlük Detay" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                    background: activeTab === tab.id ? "#0f172a" : "white",
                    color: activeTab === tab.id ? "white" : "#64748b",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dönem Özeti Tab */}
            {activeTab === "ozet" && (
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {["Kullanıcı", "Takım Lideri", "Çalışma Günü", "Eksik Süre", "Mola Oranı", "FTE"].map((h) => (
                        <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s, i) => {
                      const user = users.find((u) => u.user_name === s.user_name);
                      return (
                        <tr key={s.user_name} style={{ background: i % 2 === 0 ? "white" : "#fafafa" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{s.user_name}</td>
                          <td style={{ padding: "12px 16px", color: "#64748b" }}>{user?.team_leader || "-"}</td>
                          <td style={{ padding: "12px 16px", color: "#374151" }}>{s.working_days ?? "-"}</td>
                          <td style={{ padding: "12px 16px", color: s.missing_time ? "#ef4444" : "#374151" }}>{s.missing_time || "-"}</td>
                          <td style={{ padding: "12px 16px", color: "#374151" }}>{s.break_rate != null ? `%${s.break_rate}` : "-"}</td>
                          <td style={{ padding: "12px 16px", color: "#374151" }}>{s.fte ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Günlük Detay Tab */}
            {activeTab === "gunluk" && (
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {["Tarih", "Kullanıcı", "Login (dk)", "Break (dk)", "CWT (dk)"].map((h) => (
                        <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((d, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#fafafa" }}>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{new Date(d.date).toLocaleDateString("tr-TR")}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{d.user_name}</td>
                        <td style={{ padding: "12px 16px", color: "#3b82f6" }}>{d.login?.toFixed(2) ?? "-"}</td>
                        <td style={{ padding: "12px 16px", color: "#f59e0b" }}>{d.break_total?.toFixed(2) ?? "-"}</td>
                        <td style={{ padding: "12px 16px", color: "#10b981" }}>{d.cwt?.toFixed(2) ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
