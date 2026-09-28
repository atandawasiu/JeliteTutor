import { supabase } from "@/integrations/supabase/client";

export type BadgeKey =
  | "first_test"
  | "perfect_score"
  | "ten_tests"
  | "fifty_tests"
  | "first_thread"
  | "helpful"
  | "streak_7";

export async function awardPoints(_userId: string, points: number, reason: string) {
  // Server-side validated via SECURITY DEFINER RPC; user_id comes from auth.uid()
  await supabase.rpc("award_points", { _points: points, _reason: reason });
}

export async function awardBadge(_userId: string, key: BadgeKey) {
  // Server-side validated via SECURITY DEFINER RPC; criteria checked in DB
  await supabase.rpc("award_badge", { _badge_key: key });
}

export async function notify(userId: string, title: string, body?: string, link?: string) {
  await supabase.from("notifications").insert({ user_id: userId, title, body: body ?? null, link: link ?? null });
}
