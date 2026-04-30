import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8")
    );
    return NextResponse.json({ role: payload.role ?? "unknown", keyLength: key.length });
  } catch {
    return NextResponse.json({ role: "parse_error", keyLength: key.length });
  }
}
