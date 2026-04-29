import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("user_name,user_mail,role,team,team_leader")
    .limit(10000);

  if (error) return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });

  return NextResponse.json(data ?? []);
}
