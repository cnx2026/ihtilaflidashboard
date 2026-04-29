import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("feedback")
    .select("*, feedback_messages(*)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from_user, to_user, topic, type, title, description, image_url } = body;

  if (!from_user || !to_user || !topic || !type || !title) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("feedback")
    .insert({ from_user, to_user, topic, type, title, description, image_url, is_read: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Kayıt oluşturulamadı" }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
