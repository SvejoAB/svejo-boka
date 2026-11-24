import { Bell, Mail, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminSettings } from "../../shared/api";
import { request, RequestError } from "../api";

export function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  if (h === 168) return "1 vecka";
  if (h === 1) return "1 timme";
  if (h % 24 === 0 && h > 24) return `${h} timmar (${h / 24} dygn)`;
  return `${h} timmar`;
}

export function SettingsDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [notice, setNotice] = useState(0);
  const [reminders, setReminders] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    request<AdminSettings>("/api/admin/settings")
      .then((s) => {
        setSettings(s);
        setNotice(s.minNotice);
        setReminders(s.reminders);
      })
      .catch(() => setError("Inställningarna gick inte att hämta."));
  }, [props.open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const s = await request<AdminSettings>("/api/admin/settings", { method: "PUT", body: { minNotice: notice, reminders } });
      setSettings(s);
      toast("Inställningarna är sparade");
      props.onOpenChange(false);
      props.onSaved();
    } catch (err) {
      setError(err instanceof RequestError ? err.message : "Inställningarna sparades inte.");
    } finally {
      setSaving(false);
    }
  }

  const available = settings?.reminderOptions.filter((m) => !reminders.includes(m)) ?? [];
  const canAdd = settings ? reminders.length < settings.maxReminders && available.length > 0 : false;
  const example = exampleText(notice);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">Inställningar</DialogTitle>
          <DialogDescription>Gäller din bokningssida och alla nya och kommande bokningar.</DialogDescription>
        </DialogHeader>

        {!settings ? (
          error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid gap-3" role="status" aria-busy>
              <Skeleton className="h-16" />
              <Skeleton className="h-24" />
            </div>
          )
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-2">
              <Label htmlFor="notice" className="text-base font-medium">
                Framförhållning
              </Label>
              <p className="text-sm text-muted-foreground">Hur nära inpå någon kan boka dig.</p>
              <Select value={String(notice)} onValueChange={(v) => setNotice(Number(v))}>
                <SelectTrigger id="notice" className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.noticeOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {hoursLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{example}</p>
            </section>

            <Separator />

            <section className="grid gap-2">
              <h3 className="flex items-center gap-2 text-base font-medium">
                <Bell className="size-4 text-muted-foreground" aria-hidden />
                Påminnelser till kunden
              </h3>
              <p className="text-sm text-muted-foreground">
                E-post med tid, Meet-länk och avbokningslänk. Svar går till din e-post.
              </p>
              {reminders.length === 0 ? (
                <p className="text-sm">Inga påminnelser.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {[...reminders]
                    .sort((a, b) => b - a)
                    .map((m) => (
                      <li key={m} className="flex items-center justify-between rounded-lg bg-muted/60 py-1 pr-1 pl-3 text-sm">
                        {hoursLabel(m)} före mötet
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={`Ta bort påminnelsen ${hoursLabel(m)} före`}
                          onClick={() => setReminders((r) => r.filter((x) => x !== m))}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
              {canAdd && (
                <Select value="" onValueChange={(v) => setReminders((r) => [...r, Number(v)])}>
                  <SelectTrigger className="w-60" aria-label="Lägg till påminnelse">
                    <span className="flex items-center gap-2 text-primary">
                      <Plus className="size-4" aria-hidden />
                      Lägg till påminnelse
                    </span>
                  </SelectTrigger>
                  {/* No current value to align to, so open below the trigger. */}
                  <SelectContent position="popper">
                    {available.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {hoursLabel(m)} före
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                En påminnelse skickas bara om bokningen gjordes innan dess, så den som bokar med kort varsel får ingen
                påminnelse för en tid som redan passerat.
              </p>
            </section>

            <Separator />

            <section className="grid gap-2 text-sm">
              <h3 className="flex items-center gap-2 text-base font-medium">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                E-post som skickas
              </h3>
              <ul className="grid gap-1.5 text-muted-foreground">
                <li>
                  <span className="text-foreground">Till kunden vid bokning:</span> Googles kalenderinbjudan från din
                  adress och en bekräftelse från noreply@svejo.se, båda med Meet-länken.
                </li>
                <li>
                  <span className="text-foreground">Till dig:</span> ett mejl när någon bokar och när någon avbokar.
                </li>
                <li>
                  <span className="text-foreground">Vid avbokning:</span> Google meddelar kunden att mötet är inställt.
                </li>
              </ul>
              {!settings.emailEnabled && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                  E-post är inte aktiverad på servern, så bara Googles inbjudan skickas just nu.
                </p>
              )}
            </section>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => props.onOpenChange(false)}>
            Avbryt
          </Button>
          <Button className="rounded-full px-5" disabled={!settings || saving} onClick={() => void save()}>
            {saving ? "Sparar…" : "Spara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exampleText(minutes: number): string {
  if (!minutes) return "";
  const days = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];
  const h = minutes / 60;
  const startDay = Math.floor((10 + h) / 24);
  const startHour = (10 + h) % 24;
  const day = startDay === 0 ? "samma dag" : startDay < 7 ? days[startDay % 7] : "måndagen veckan efter";
  return `Exempel: bokar någon på måndag kl. 10:00 kan mötet tidigast börja ${day} kl. ${String(startHour).padStart(2, "0")}:00.`;
}
