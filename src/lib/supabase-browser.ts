import { createBrowserClient } from "@supabase/ssr";

// Anon key — sadece auth (login/logout/session) için kullanılır.
// Veri okuma/yazma işlemleri API route'larından yapılır.
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
