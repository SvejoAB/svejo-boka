import { CalendarDays, CalendarX2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmCancel, LangSwitch, PersonAvatar } from "@/components/app";
import type { ManagedBooking } from "../../shared/api";
import { request, RequestError } from "../api";
import { capitalize, clock, longDay, useLang } from "../i18n";

export function ManageBooking({ token }: { token: string }) {
  const { lang, t, toggle } = useLang();
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [error, setError] = useState<"not_found" | "generic" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);

  useEffect(() => {
    request<ManagedBooking>(`/api/b/${token}`)
      .then(setBooking)
      .catch((err) => setError(err instanceof RequestError && err.status === 404 ? "not_found" : "generic"));
  }, [token]);

  useEffect(() => {
    document.title = t.manageTitle;
  }, [t]);

  async function cancel() {
    setBusy(true);
    setCancelFailed(false);
    try {
      await request(`/api/b/${token}/cancel`, { method: "POST", body: {} });
      setBooking((b) => (b ? { ...b, status: "cancelled" } : b));
    } catch {
      setCancelFailed(true);
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  }

  const when = booking ? `${capitalize(longDay(booking.start, lang))}, ${clock(booking.start)}–${clock(booking.end)}` : "";
  const past = booking ? booking.start <= Date.now() : false;
  const cancelled = booking?.status === "cancelled";

  return (
    <div className="min-h-dvh bg-shell px-3 py-6 sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <Card className="mx-auto w-full max-w-xl gap-6 p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-3">
          {booking ? <PersonAvatar name={booking.person.name} /> : <Skeleton className="size-10 rounded-full" />}
          <LangSwitch label={t.language} title={t.languageLabel} onClick={toggle} />
        </div>
        {error ? (
          <p className="text-muted-foreground">{error === "not_found" ? t.notFound : t.errGeneric}</p>
        ) : !booking ? (
          <div role="status" aria-busy className="grid gap-3">
            <span className="sr-only">{t.manageTitle}</span>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-normal tracking-tight [overflow-wrap:anywhere]">
                {cancelled ? t.cancelled : t.meetingWith(booking.person.name)}
              </h1>
            </div>
            <ul className="grid gap-3 text-sm">
              <li className="flex items-center gap-3">
                {cancelled ? (
                  <CalendarX2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cancelled ? "text-muted-foreground line-through" : "tabular-nums"}>{when}</span>
              </li>
              {!cancelled && booking.meetUrl && (
                <li className="flex items-center gap-3">
                  <Video className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={booking.meetUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {booking.meetUrl.replace(/^https:\/\//, "")}
                  </a>
                </li>
              )}
            </ul>
            {cancelled && <p className="text-sm text-muted-foreground">{t.cancelledBody}</p>}
            {!cancelled && past && <p className="text-sm text-muted-foreground">{t.past}</p>}
            {cancelFailed && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t.errGeneric}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {booking.status === "confirmed" && !past && (
                <>
                  {booking.meetUrl && (
                    <Button asChild className="rounded-full px-5">
                      <a href={booking.meetUrl} target="_blank" rel="noreferrer">
                        <Video />
                        {t.joinMeet}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full px-5" onClick={() => setConfirming(true)}>
                    {t.cancel}
                  </Button>
                </>
              )}
              {(cancelled || !past) && (
                <Button asChild variant={cancelled ? "default" : "outline"} className="rounded-full px-5">
                  <a href={`/${booking.person.slug}?lang=${lang}`}>{t.rebook}</a>
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
      <ConfirmCancel
        open={confirming}
        onOpenChange={setConfirming}
        title={t.cancelConfirmTitle}
        body={t.cancelConfirmBody(when)}
        confirmLabel={t.cancel}
        cancelLabel={t.keep}
        busy={busy}
        busyLabel={t.cancelling}
        onConfirm={() => void cancel()}
      />
    </div>
  );
}
