import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user_name } = await request.json();

  if (!user_name) return NextResponse.json({ error: "user_name gerekli" }, { status: 400 });

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("announcement_reads")
    .select("id")
    .eq("announcement_id", id)
    .eq("user_name", user_name)
    .maybeSingle();

  if (!existing) {
    await supabase.from("announcement_reads").insert({ announcement_id: id, user_name });
  }

  return NextResponse.json({ ok: true });
}
