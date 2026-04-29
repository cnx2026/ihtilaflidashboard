import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";

const fetchPerformans = (period: string) =>
  unstable_cache(
    async () => {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from("performance_data")
        .select("*")
        .eq("period", period)
        .limit(10000);
      if (error) return null;
      return data ?? [];
    },
    [`performans-${period}`],
    { revalidate: 3600, tags: [`performans`, `performans-${period}`] }
  )();

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period parametresi gerekli" }, { status: 400 });
  }

  const data = await fetchPerformans(period);
  if (data === null) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data);
}
