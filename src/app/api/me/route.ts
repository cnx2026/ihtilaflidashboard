import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

// JWT'yi doğrular, users tablosundan profil döner.
// Anon key yerine service role key kullanır — tarayıcıdan doğrudan tablo sorgusu olmaz.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const token = auth.slice(7);

  const supabase = createServerClient();

  // JWT'yi doğrula
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  const { data: rows } = await supabase
    .from("users")
    .select("user_name,role,team")
    .eq("user_mail", user.email)
    .limit(1);

  const r = rows?.[0];
  return NextResponse.json({
    role: r?.role ?? "agent",
    user_name: r?.user_name ?? user.email.split("@")[0].replace(".", " "),
    email: user.email,
    team: r?.team ?? "",
  });
}
