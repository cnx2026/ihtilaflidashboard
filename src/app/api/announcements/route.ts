import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { title, content, category, alarm_minutes, image_url } = payload;

  if (!title || !category) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const supabase = createServerClient();

  // DB kolon isimleri: body (içerik), image_url1 (görsel), team kolonu yok
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title,
      body: content || null,
      category,
      alarm_minutes: alarm_minutes || null,
      image_url1: image_url || null,
      is_archived: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message ?? "Duyuru oluşturulamadı" }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
