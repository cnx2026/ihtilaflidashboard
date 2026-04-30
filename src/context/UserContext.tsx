"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { CurrentUser } from "@/types";

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    async function load() {
      // Sadece auth session — anon key ile tablo sorgusu yok
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Profil bilgisi server-side /api/me üzerinden gelir
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setLoading(false); return; }

      const profile: CurrentUser = await res.json();
      setUser(profile);
      setLoading(false);
    }

    load();
  }, []);

  return <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
