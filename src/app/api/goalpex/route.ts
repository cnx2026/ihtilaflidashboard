import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { cache, getCacheKey } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period parametresi gerekli" }, { status: 400 });
  }

  const key = getCacheKey("goalpex", { period });
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

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

  if (goalpexRes.error || usersRes.error) {
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
  }

  const payload = {
    goalpex: goalpexRes.data ?? [],
    users: usersRes.data ?? [],
  };

  cache.set(key, payload);

  return NextResponse.json(payload, {
    headers: { "X-Cache": "HIT" },
  });
}
