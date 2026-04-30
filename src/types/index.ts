export type Role = "admin" | "agent";
export type Page = "uretim" | "performans" | "goalpex" | "feedback" | "duyurular";

export interface CurrentUser {
  role: Role;
  user_name: string;
  email: string;
  team?: string;
}

export interface UserRow {
  user_name: string;
  user_mail?: string;
  role: Role;
  team: string;
  team_leader: string;
}

export interface SummaryRow {
  user_name: string;
  period: string;
  working_days?: number;
  fte?: number;
  break_rate?: number;
  missing_time?: number | string;
  dvs?: string;
  [key: string]: unknown;
}

export interface DailyRow {
  id: string;
  period: string;
  date: string;
  user_name: string;
  login: number;
  break_total: number;
}

export interface PerformanceRow {
  user_name: string;
  period: string;
  date: string | null;
  transaction_count: number;
  pool_average?: number;
  [key: string]: unknown;
}

export interface GoalpexRow {
  user_name: string;
  period: string;
  goalpex_puan: number;
  perf_puan?: number;
  kalite_puan?: number;
  quiz_puan?: number;
  iff_puan?: number;
  mola_puan?: number;
  sikayet_puan?: number;
  devamsiz_puan?: number;
  [key: string]: unknown;
}

export interface FeedbackRow {
  id: string;
  from_user: string;
  to_user: string;
  topic: string;
  title: string;
  type: "Olumlu" | "Bilgilendirme" | "Olumsuz";
  description?: string;
  image_url?: string;
  is_read: boolean;
  created_at: string;
  feedback_messages?: MessageRow[];
}

export interface MessageRow {
  id: string;
  feedback_id: string;
  sender: string;
  message: string;
  created_at: string;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body?: string;
  category: string;
  alarm_minutes?: number;
  image_url1?: string;
  image_url2?: string;
  created_by?: string;
  is_archived: boolean;
  created_at: string;
}
