import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerClient();

  const { error } = await supabase.from("announcements").update(body).eq("id", id);

  if (error) return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) return NextResponse.json({ error: "Silinemedi" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
