import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

// Tüm mevcut dönemleri döndürür — filtre dropdown'ları için kullanılır.
export async function GET() {
  const supabase = createServerClient();

  const [kpiRes, perfRes, goalpexRes] = await Promise.all([
    supabase.from("period_summary").select("period").order("period", { ascending: false }).limit(10000),
    supabase.from("performance_data").select("period").order("period", { ascending: false }).limit(10000),
    supabase.from("goalpex_data").select("period").order("period", { ascending: false }).limit(10000),
  ]);

  const unique = (data: { period: string }[] | null) =>
    [...new Set((data ?? []).map((d) => d.period))];

  return NextResponse.json({
    kpi: unique(kpiRes.data),
    performans: unique(perfRes.data),
    goalpex: unique(goalpexRes.data),
  });
}
