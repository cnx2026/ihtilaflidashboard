"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/context/UserContext";
import type { Page } from "@/types";

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  feedbackBadge: { blue: number; green: number; red: number };
  duyuruBadge: { surec: number; operasyon: number };
}

const mkIni = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "uretim",     label: "Üretim Takip", icon: "fa-chart-line" },
  { id: "performans", label: "Performans",    icon: "fa-gauge-high" },
  { id: "goalpex",    label: "Goalpex",       icon: "fa-bullseye" },
  { id: "duyurular",  label: "Duyurular",     icon: "fa-bullhorn" },
  { id: "feedback",   label: "Geri Bildirim", icon: "fa-envelope" },
];

export default function Sidebar({ activePage, onNavigate, feedbackBadge, duyuruBadge }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">(
    typeof document !== "undefined"
      ? (document.documentElement.classList.contains("dark") ? "dark" : "light")
      : "dark"
  );
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setTheme(isDark ? "dark" : "light");
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function changePassword() {
    setPwError("");
    setPwSuccess(false);
    if (!pw.current || !pw.next || !pw.confirm) { setPwError("Tüm alanları doldurun."); return; }
    if (pw.next.length < 6) { setPwError("Yeni şifre en az 6 karakter olmalı."); return; }
    if (pw.next !== pw.confirm) { setPwError("Yeni şifreler eşleşmiyor."); return; }

    const supabase = createSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user!.email, password: pw.current });
    if (signInError) { setPwError("Mevcut şifre hatalı."); return; }

    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) { setPwError("Şifre güncellenemedi."); return; }
    setPwSuccess(true);
    setTimeout(() => { setShowPasswordModal(false); setPw({ current: "", next: "", confirm: "" }); }, 2000);
  }

  const activeClass = "flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 transition-all shadow-sm text-sm";
  const inactiveClass = "flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-blue-500 font-bold transition-all text-sm";

  return (
    <>
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-30 shadow-2xl shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-3">
            <div className="bg-blue-600/10 p-3 rounded-2xl w-fit">
              <img src="https://appexchange.salesforce.com/image_host/0f3dad29-4a38-468b-8fb9-cbabe4acb8f1.png" className="h-7 w-auto" alt="logo" />
            </div>
            <h1 className="text-base font-black leading-tight tracking-tighter">
              İhtilaflı Data<br /><span className="text-blue-500">KPI Dashboard</span>
            </h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1.5">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full text-left ${activePage === id ? activeClass : inactiveClass}`}
            >
              <i className={`fa-solid ${icon}`} />
              <span>{label}</span>
              {id === "duyurular" && (
                <>
                  {duyuruBadge.surec > 0 && <span className="fb-badge bg-violet-500 text-white ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full">{duyuruBadge.surec}</span>}
                  {duyuruBadge.operasyon > 0 && <span className="fb-badge bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{duyuruBadge.operasyon}</span>}
                </>
              )}
              {id === "feedback" && (
                <>
                  {feedbackBadge.blue > 0 && <span className="fb-badge bg-blue-500 text-white ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full">{feedbackBadge.blue}</span>}
                  {feedbackBadge.green > 0 && <span className="fb-badge bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{feedbackBadge.green}</span>}
                  {feedbackBadge.red > 0 && <span className="fb-badge bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{feedbackBadge.red}</span>}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Alt panel */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4 px-1">
            <button onClick={toggleTheme} className="text-slate-400 hover:text-blue-500 transition-colors">
              <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"} text-lg`} />
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 transition-colors">
              <i className="fa-solid fa-right-from-bracket text-lg" />
            </button>
            <button onClick={() => setShowPasswordModal(true)} className="text-slate-400 hover:text-amber-500 transition-colors">
              <i className="fa-solid fa-key text-lg" />
            </button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs uppercase tracking-tighter">
              {user ? mkIni(user.user_name) : "--"}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold truncate tracking-tight">{user?.user_name ?? "Kullanıcı"}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {user?.role === "admin" ? "Yönetici Paneli" : "Temsilci Paneli"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Şifre Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-lg tracking-tight">Şifre Değiştir</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Yeni şifrenizi belirleyin</p>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="space-y-4">
              {["current", "next", "confirm"].map((field, i) => (
                <div key={field}>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                    {i === 0 ? "Mevcut Şifre" : i === 1 ? "Yeni Şifre" : "Yeni Şifre Tekrar"}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={pw[field as keyof typeof pw]}
                    onChange={(e) => setPw((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              ))}
              {pwError && <div className="py-3 px-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium text-center">{pwError}</div>}
              {pwSuccess && <div className="py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium text-center">Şifreniz başarıyla güncellendi!</div>}
              <button onClick={changePassword} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all">
                <i className="fa-solid fa-key mr-2" /> Şifremi Güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
