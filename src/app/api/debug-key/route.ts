import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url = process.env.SUPABASE_URL ?? "";

  let keyRole = "parse_error";
  try {
    keyRole = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8")
    ).role ?? "unknown";
  } catch { /* ignore */ }

  // Test: gerçek bir sorgu yapıp service_role çalışıyor mu diye kontrol et
  let queryOk = false;
  let queryError = "";
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .limit(1);
    queryOk = !error;
    if (error) queryError = error.message;
  } catch (e) {
    queryError = String(e);
  }

  return NextResponse.json({
    keyRole,
    keyLength: key.length,
    urlSet: url.length > 0,
    urlPrefix: url.slice(0, 30),
    queryOk,
    queryError,
  });
}
