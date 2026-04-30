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
  const body = await request.json();
  const { title, content, category, team, alarm_minutes, image_url } = body;

  if (!title || !category) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, content, category, team: team ?? "all", alarm_minutes, image_url, is_archived: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message ?? "Duyuru oluşturulamadı" }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
