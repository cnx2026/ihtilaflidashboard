import NodeCache from "node-cache";

// KPI, performans ve goalpex verileri için paylaşılan server-side cache.
// Tüm kullanıcılar aynı cache'i okur — Supabase saatte 1 kez sorgulanır.
// feedback, announcements, users cache'lenmez (gerçek zamanlı).
export const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export function getCacheKey(table: string, params: Record<string, string>) {
  return `${table}:${JSON.stringify(params)}`;
}
