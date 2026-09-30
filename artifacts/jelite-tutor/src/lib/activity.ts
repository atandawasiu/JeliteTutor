import { supabase } from "@/integrations/supabase/client";

export async function recordActivity(eventType: string, metadata: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // The activity table is intentionally best-effort so analytics never blocks a user action.
  await (supabase.from("user_activity") as any).insert({
    user_id: user.id,
    event_type: eventType,
    metadata,
  });
}
