import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";

const fetchKPI = (period: string) =>
  unstable_cache(
    async () => {
      const supabase = createServerClient();
      const [summaryRes, dailyRes, usersRes] = await Promise.all([
        supabase.from("period_summary").select("*").eq("period", period).limit(10000),
        supabase.from("daily_data").select("*").eq("period", period).limit(10000),
        supabase.from("users").select("user_name,team,team_leader,role").limit(10000),
      ]);
      if (summaryRes.error || dailyRes.error || usersRes.error) return null;
      return {
        summary: summaryRes.data ?? [],
        daily: dailyRes.data ?? [],
        users: usersRes.data ?? [],
      };
    },
    [`kpi-${period}`],
    { revalidate: 3600, tags: [`kpi`, `kpi-${period}`] }
  )();

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period parametresi gerekli" }, { status: 400 });
  }

  const data = await fetchKPI(period);
  if (!data) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data);
}
