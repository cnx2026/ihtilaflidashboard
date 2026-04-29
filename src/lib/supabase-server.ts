import { createClient } from "@supabase/supabase-js";

// Service role key — sadece server-side API route'larında kullanılır.
// Tarayıcıya asla gönderilmez.
export function createServerClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
