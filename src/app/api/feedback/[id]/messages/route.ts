import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("feedback_messages")
    .select("*")
    .eq("feedback_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Mesajlar alınamadı" }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { sender, message } = await request.json();

  if (!sender || !message) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("feedback_messages")
    .insert({ feedback_id: id, sender, message })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Mesaj gönderilemedi" }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
