import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

// GET /api/announcement-reads?user_name=X  → o kullanıcının okuduğu duyuru id'leri
// GET /api/announcement-reads              → tüm okundu kayıtları (admin read-rate hesabı)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userName = searchParams.get("user_name");

  const supabase = createServerClient();

  if (userName) {
    const { data, error } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_name", userName);

    if (error) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id, user_name");

  if (error) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
