import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";

const fetchGoalpex = (period: string) =>
  unstable_cache(
    async () => {
      const supabase = createServerClient();
      const [goalpexRes, usersRes] = await Promise.all([
        supabase
          .from("goalpex_data")
          .select("*")
          .eq("period", period)
          .order("goalpex_puan", { ascending: false })
          .limit(10000),
        supabase.from("users").select("user_name,team,team_leader").limit(10000),
      ]);
      if (goalpexRes.error || usersRes.error) return null;
      return {
        goalpex: goalpexRes.data ?? [],
        users: usersRes.data ?? [],
      };
    },
    [`goalpex-${period}`],
    { revalidate: 3600, tags: [`goalpex`, `goalpex-${period}`] }
  )();

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period parametresi gerekli" }, { status: 400 });
  }

  const data = await fetchGoalpex(period);
  if (!data) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data);
}
