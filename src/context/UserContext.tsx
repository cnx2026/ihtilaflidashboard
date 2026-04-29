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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const { data: rows } = await supabase
        .from("users")
        .select("user_name,role")
        .eq("user_mail", authUser.email)
        .limit(1);

      const r = rows?.[0];
      setUser({
        role: r?.role ?? "agent",
        user_name: r?.user_name ?? authUser.email!.split("@")[0].replace(".", " "),
        email: authUser.email!,
      });
      setLoading(false);
    }

    load();
  }, []);

  return <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
