import { useEffect, useState } from "react";
import { Loader2, Save, Settings as SettingsIcon, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { toast } from "sonner";

type Settings = Record<string, string | null>;

const TEXT_SECTIONS: { title: string; fields: { key: string; label: string; long?: boolean; placeholder?: string }[] }[] = [
  {
    title: "Site Identity",
    fields: [
      { key: "brand_name", label: "Brand name" },
      { key: "tagline", label: "Tagline" },
      { key: "header_announcement", label: "Header announcement bar (leave empty to hide)" },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "contact_email", label: "Email" },
      { key: "contact_phone", label: "Phone" },
      { key: "contact_address", label: "Address" },
    ],
  },
  {
    title: "Social Media (full URLs, leave empty to hide icon)",
    fields: [
      { key: "social_facebook", label: "Facebook URL" },
      { key: "social_twitter", label: "Twitter / X URL" },
      { key: "social_instagram", label: "Instagram URL" },
      { key: "social_youtube", label: "YouTube URL" },
      { key: "social_linkedin", label: "LinkedIn URL" },
      { key: "social_whatsapp", label: "WhatsApp URL" },
    ],
  },
  {
    title: "Footer & Legal",
    fields: [
      { key: "footer_about", label: "Footer about text", long: true },
      { key: "copyright_text", label: "Copyright line" },
      { key: "legal_tagline", label: "Legal tagline" },
    ],
  },
];

export function SiteSettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
    if (error) setLoadError(error.message);
    else if (data) { setSettings(data as Settings); setLoadError(null); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`admin-site-settings-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...rest } = settings;
    const query = id
      ? supabase.from("site_settings").update(rest as never).eq("id", id as string)
      : supabase.from("site_settings").insert(rest as never);
    const { error } = await query;
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Site settings saved — live on the website now");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!settings) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Unable to load site settings. {loadError ?? "Please try again."}<Button variant="outline" size="sm" className="ml-3" onClick={load}>Retry</Button></div>;
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold">Header & Footer Settings</h3>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5 bg-gradient-hero text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-semibold">Jelite Tutor Authentication & Email Brand</h4>
              <p className="mt-1 text-sm text-muted-foreground">Supabase Auth powers sign in, Google login, email confirmation, password recovery, and secure sessions.</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Project</p><p className="font-medium">Jelite Tutor</p></div>
                <div><p className="text-xs text-muted-foreground">Website</p><p className="font-medium break-all">{window.location.origin}</p></div>
                <div><p className="text-xs text-muted-foreground">Email sender</p><p className="font-medium">Jelite Tutor Support</p></div>
                <div><p className="text-xs text-muted-foreground">Templates</p><p className="font-medium">Confirm, reset, invite</p></div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground"><MailCheck className="h-4 w-4 shrink-0 text-primary" /> Configure the branded sender name, logo, and email copy in Supabase Dashboard → Authentication → Email Templates. Keep the redirect URL set to this website.</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h4 className="mb-4 font-display text-sm font-semibold">Site Logo</h4>
          <ImageUpload
            label="Logo image"
            value={(settings["logo_url"] as string) ?? ""}
            onChange={(url) => setSettings({ ...settings, logo_url: url })}
            previewClass="h-16 w-auto max-w-[200px] object-contain"
          />
        </div>

        {TEXT_SECTIONS.map((sec) => (
          <div key={sec.title} className="rounded-2xl border border-border bg-card p-5">
            <h4 className="mb-4 font-display text-sm font-semibold">{sec.title}</h4>
            <div className="space-y-3">
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.long ? (
                    <Textarea
                      value={(settings[f.key] as string) ?? ""}
                      onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                      className="mt-1"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={(settings[f.key] as string) ?? ""}
                      onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                      className="mt-1"
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
