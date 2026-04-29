import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { cache, getCacheKey } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period parametresi gerekli" }, { status: 400 });
  }

  const key = getCacheKey("performans", { period });
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("performance_data")
    .select("*")
    .eq("period", period)
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
  }

  const payload = data ?? [];
  cache.set(key, payload);

  return NextResponse.json(payload, {
    headers: { "X-Cache": "MISS" },
  });
}
