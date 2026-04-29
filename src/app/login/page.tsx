"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "#0a0a0f" }}
    >
      {/* Arka plan efektleri */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, background: "radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)", animation: "floatOrb 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, background: "radial-gradient(circle,rgba(59,130,246,0.1) 0%,transparent 70%)", animation: "floatOrb 10s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative w-full max-w-sm mx-4" style={{ animation: "fadeIn 0.5s ease-out forwards" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", padding: 12, background: "rgba(99,102,241,0.1)", borderRadius: 16, border: "1px solid rgba(99,102,241,0.2)", marginBottom: 16 }}>
            <img
              src="https://appexchange.salesforce.com/image_host/0f3dad29-4a38-468b-8fb9-cbabe4acb8f1.png"
              style={{ height: 36, width: "auto" }}
              alt="logo"
            />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "white", letterSpacing: "-0.03em", margin: 0 }}>
            Hoş Geldiniz
          </h1>
        </div>

        {/* Form kartı */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 32, backdropFilter: "blur(20px)" }}>
          <form onSubmit={handleLogin}>
            {/* E-posta */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                E-Posta
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="isim.soyisim@concentrix.com"
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "all 0.2s" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.6)"; e.target.style.background = "rgba(99,102,241,0.08)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Şifre */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Şifre
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "all 0.2s" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.6)"; e.target.style.background = "rgba(99,102,241,0.08)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Hata mesajı */}
            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, color: "#f87171", fontSize: 13, fontWeight: 500, textAlign: "center", marginBottom: 16 }}>
                Hatalı e-posta veya şifre.
              </div>
            )}

            {/* Giriş butonu */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: 14, background: "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", letterSpacing: "0.02em", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
              onMouseEnter={(e) => { if (!loading) { (e.target as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.target as HTMLButtonElement).style.boxShadow = "0 8px 25px rgba(99,102,241,0.4)"; } }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.transform = "translateY(0)"; (e.target as HTMLButtonElement).style.boxShadow = "none"; }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <i className="fa-solid fa-circle-notch fa-spin" /> Giriş yapılıyor...
                </span>
              ) : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
