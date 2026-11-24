import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Link2, LogOut, Menu, Settings, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sv } from "react-day-picker/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmCancel, dateFromKey, keyFromDate, PersonAvatar } from "@/components/app";
import { cn } from "@/lib/utils";
import type { AdminBooking, AdminCalendar as Calendar_, AdminCell, AdminMe, AdminSettings } from "../../shared/api";
import { addDays, dateKeyOf, startOfWeek } from "../../shared/time";
import { request, RequestError } from "../api";
import { capitalize, clock, longDay, shortDay } from "../i18n";
import { KIND_DOT, LEGEND, type Action } from "./blocks";
import { applyColors } from "./colors";
import { MonthView } from "./MonthView";
import { SettingsDialog } from "./SettingsDialog";
import { WeekView } from "./WeekView";

type View = "week" | "month";

const LOGIN_ERRORS: Record<string, string> = {
  not_allowed: "Det kontot kan inte logga in här. Logga in med Google-kontot som din bokningssida hör till.",
  scope: "Google gav inte tillgång till kalendern. Logga in igen och godkänn kalenderåtkomsten.",
  state: "Inloggningen tog för lång tid. Försök igen.",
  identity: "Google kunde inte bekräfta kontot. Försök igen.",
  access_denied: "Inloggningen avbröts.",
};

const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const SHORT = ["jan", "feb", "mars", "apr", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];

export default function AdminCalendar() {
  const [me, setMe] = useState<AdminMe | "signed-out" | null>(null);
  const loginError = new URLSearchParams(location.search).get("login_error");

  useEffect(() => {
    document.title = "Bokningar";
    request<AdminMe>("/api/admin/me")
      .then(setMe)
      .catch(() => setMe("signed-out"));
  }, []);

  if (me === null) return <div className="min-h-dvh bg-shell" />;
  if (me === "signed-out" || !me.connected) {
    return (
      <div className="grid min-h-dvh place-items-center bg-shell p-4">
        <Card className="w-full max-w-sm gap-5 p-7 shadow-sm">
          <AppMark />
          <p className="text-sm text-muted-foreground">
            {me === "signed-out"
              ? "Logga in med ditt Google-konto för att se din kalender och dina bokningar."
              : "Google Kalender är inte kopplad. Logga in igen och godkänn kalenderåtkomsten."}
          </p>
          {loginError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {LOGIN_ERRORS[loginError] ?? "Inloggningen misslyckades. Försök igen."}
            </p>
          )}
          <Button asChild className="h-10 rounded-full">
            <a href="/auth/login">{me === "signed-out" ? "Logga in med Google" : "Koppla Google Kalender"}</a>
          </Button>
        </Card>
      </div>
    );
  }
  return <Owner me={me} />;
}

function AppMark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <CalendarDays className="size-5" aria-hidden />
      </span>
      <span className={cn("text-[22px] text-foreground/80", compact && "hidden sm:inline")}>Bokningar</span>
    </span>
  );
}

function Owner({ me }: { me: AdminMe }) {
  const today = dateKeyOf(Date.now());
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [data, setData] = useState<Calendar_ | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<AdminBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reqId = useRef(0);

  const range = useMemo(
    () => (view === "week" ? { from: startOfWeek(anchor), days: 7 } : { from: startOfWeek(`${anchor.slice(0, 7)}-01`), days: 42 }),
    [view, anchor],
  );

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await request<Calendar_>(`/api/admin/calendar?from=${range.from}&days=${range.days}`);
      if (id !== reqId.current) return;
      setData(d);
      setError(null);
    } catch (err) {
      if (id !== reqId.current) return;
      if (err instanceof RequestError && err.status === 401) location.reload();
      setError(
        err instanceof RequestError && err.code === "not_connected"
          ? "Google Kalender är inte kopplad längre. Logga in igen."
          : "Kalendern gick inte att hämta.",
      );
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setSidebar(false);
    // The owner's own event colours; the built-in palette until they load.
    request<AdminSettings>("/api/admin/settings")
      .then((s) => applyColors(s.colors))
      .catch(() => undefined);
  }, []);

  async function act(cells: AdminCell[], action: Action) {
    if (!data) return;
    const starts = new Set(cells.map((c) => c.start));
    // Show the change at once; the reload brings the real state.
    setData({
      ...data,
      days: data.days.map((d) => ({
        ...d,
        cells: d.cells.map((c) =>
          !starts.has(c.start)
            ? c
            : action === "open"
              ? { ...c, override: "open" as const, state: { kind: "free" as const, via: "manual" as const } }
              : action === "close"
                ? { ...c, override: "close" as const, state: { kind: "blocked" as const, reason: "closed" as const } }
                : { ...c, override: undefined },
        ),
      })),
    });
    try {
      await request("/api/admin/override", { method: "POST", body: { starts: [...starts], action } });
      toast(action === "open" ? "Tiden är öppnad" : action === "close" ? "Tiden är stängd" : "Ändringen är borttagen");
    } catch (err) {
      setError(err instanceof RequestError ? err.message : "Ändringen sparades inte.");
    }
    void load();
  }

  async function cancelBooking() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await request(`/api/admin/bookings/${cancelTarget.id}/cancel`, { method: "POST", body: {} });
      toast("Mötet är avbokat");
      setCancelTarget(null);
      void load();
    } catch {
      setError("Avbokningen gick inte igenom. Försök igen.");
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  }

  function shift(dir: -1 | 1) {
    if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(me.bookingUrl);
    toast("Bokningslänken är kopierad", { description: me.bookingUrl.replace(/^https?:\/\//, "") });
  }

  async function signOut() {
    await request("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    location.href = "/admin";
  }

  const title = view === "week" ? weekTitle(startOfWeek(anchor)) : `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}`;
  const unit = view === "week" ? "vecka" : "månad";

  return (
    <div className="flex h-dvh flex-col bg-shell">
      {/* top bar */}
      <header className="flex h-16 shrink-0 items-center gap-0.5 px-1.5 sm:gap-2 sm:px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="rounded-full" onClick={() => setSidebar((s) => !s)} aria-label="Huvudmeny">
              <Menu className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Huvudmeny</TooltipContent>
        </Tooltip>
        <span className="mr-8 hidden sm:block">
          <AppMark compact />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" className="h-9 shrink-0 rounded-full px-3 sm:px-4" onClick={() => setAnchor(today)} aria-label="Idag">
              <CalendarCheck className="sm:hidden" />
              <span className="hidden sm:inline">Idag</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{capitalize(longDay(Date.now(), "sv"))}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(-1)} aria-label={`Föregående ${unit}`}>
              <ChevronLeft className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Föregående {unit}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(1)} aria-label={`Nästa ${unit}`}>
              <ChevronRight className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nästa {unit}</TooltipContent>
        </Tooltip>
        <h1 className="ml-1 shrink-0 text-base whitespace-nowrap text-foreground/90 sm:shrink sm:truncate sm:text-[22px]">
          <span className="sm:hidden">{capitalize(shortTitle(view, anchor))}</span>
          <span className="hidden sm:inline">{capitalize(title)}</span>
        </h1>
        <div className="ml-auto flex items-center gap-1 pl-2 sm:gap-2">
          <Select value={view} onValueChange={(v) => setView(v as View)}>
            <SelectTrigger className="h-9 gap-1 rounded-full px-3 sm:px-4" aria-label="Visning">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="week">Vecka</SelectItem>
              <SelectItem value="month">Månad</SelectItem>
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" asChild>
                <a href={me.bookingUrl} target="_blank" rel="noreferrer" aria-label="Öppna bokningssidan">
                  <ExternalLink className="size-5" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Öppna bokningssidan</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden rounded-full sm:inline-flex"
                onClick={() => setSettingsOpen(true)}
                aria-label="Inställningar"
              >
                <Settings className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Inställningar</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded-full" aria-label="Konto">
                <PersonAvatar name={me.person.name} className="size-8" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block font-medium">{me.person.name}</span>
                <span className="block text-muted-foreground">{me.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Settings />
                Inställningar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut />
                Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* sidebar */}
        {sidebar && (
          <>
            <button
              type="button"
              aria-label="Stäng menyn"
              className="fixed inset-0 z-30 bg-black/20 lg:hidden"
              onClick={() => setSidebar(false)}
            />
            <aside className="absolute inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col gap-4 overflow-y-auto bg-shell px-3 pb-4 shadow-xl lg:static lg:shadow-none">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="mt-1 ml-1 inline-flex h-14 items-center gap-3 self-start rounded-2xl bg-background px-5 text-sm font-medium shadow-[0_1px_3px_rgb(0_0_0/0.2),0_4px_8px_rgb(0_0_0/0.08)] transition-shadow hover:shadow-[0_2px_6px_rgb(0_0_0/0.22),0_8px_16px_rgb(0_0_0/0.1)]"
              >
                <Link2 className="size-5 text-primary" aria-hidden />
                Kopiera bokningslänk
              </button>
              <Calendar
                mode="single"
                locale={sv}
                weekStartsOn={1}
                showWeekNumber
                month={dateFromKey(anchor)}
                onMonthChange={(m) => setAnchor(keyFromDate(m))}
                selected={dateFromKey(anchor)}
                onSelect={(d) => d && setAnchor(keyFromDate(d))}
                today={dateFromKey(today)}
                className="bg-transparent p-1 [--cell-size:--spacing(7)]"
              />
              <section>
                <h2 className="px-2 pb-2 text-sm font-medium">Förklaring</h2>
                <ul className="grid gap-1.5 px-2 text-sm text-foreground/80">
                  {LEGEND.map(([kind, label]) => (
                    <li key={kind} className="flex items-center gap-2.5">
                      <span aria-hidden className={cn("size-3 shrink-0 rounded-full", KIND_DOT[kind])} />
                      {label}
                    </li>
                  ))}
                </ul>
              </section>
              <UpcomingBookings
                bookings={data?.bookings ?? null}
                onShow={(b) => {
                  setView("week");
                  setAnchor(dateKeyOf(b.start));
                }}
                onCancel={setCancelTarget}
              />
            </aside>
          </>
        )}

        {/* main */}
        <main className="min-w-0 flex-1 pr-2 pb-2 pl-2 lg:pl-0 sm:pr-4 sm:pb-4">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-background">
            {error && (
              <div role="alert" className="flex items-center justify-between gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
                <Button variant="ghost" size="sm" onClick={() => { setError(null); void load(); }}>
                  Försök igen
                </Button>
              </div>
            )}
            <div className={cn("min-h-0 flex-1 overflow-hidden", view === "month" && "overflow-y-auto", loading && data && "opacity-80 transition-opacity")}>
              {!data ? (
                <div role="status" aria-busy className="grid gap-3 p-4">
                  <span className="sr-only">Hämtar kalendern…</span>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-[30rem] w-full" />
                </div>
              ) : view === "week" ? (
                <WeekView data={data} today={today} onAction={(cells, a) => void act(cells, a)} onCancel={setCancelTarget} />
              ) : (
                <MonthView
                  data={data}
                  month={anchor.slice(0, 7)}
                  today={today}
                  onDay={(date) => {
                    setView("week");
                    setAnchor(date);
                  }}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={() => void load()} />
      <ConfirmCancel
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Avboka mötet?"
        body={
          cancelTarget
            ? `${cancelTarget.name}, ${capitalize(longDay(cancelTarget.start, "sv"))} ${clock(cancelTarget.start)}–${clock(cancelTarget.end)}. Kalenderhändelsen tas bort och ${cancelTarget.name.split(" ")[0]} får ett mejl om att mötet är inställt.`
            : ""
        }
        confirmLabel="Avboka mötet"
        cancelLabel="Behåll"
        busy={cancelling}
        busyLabel="Avbokar…"
        onConfirm={() => void cancelBooking()}
      />
    </div>
  );
}

function UpcomingBookings(props: {
  bookings: AdminBooking[] | null;
  onShow: (b: AdminBooking) => void;
  onCancel: (b: AdminBooking) => void;
}) {
  return (
    <section>
      <h2 className="px-2 pb-2 text-sm font-medium">Kommande bokningar</h2>
      {props.bookings === null ? (
        <div className="grid gap-2 px-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : props.bookings.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">Inga bokningar än. Kopiera länken och skicka den till den du vill träffa.</p>
      ) : (
        <ul className="grid gap-1">
          {props.bookings.map((b) => (
            <li key={b.id} className="group rounded-lg px-2 py-1.5 hover:bg-accent">
              <button type="button" className="flex w-full min-w-0 items-start gap-2.5 text-left" onClick={() => props.onShow(b)}>
                <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-ev-booked" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium [overflow-wrap:anywhere]">{b.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {capitalize(shortDay(b.start, "sv"))}, {clock(b.start)}–{clock(b.end)}
                  </span>
                </span>
              </button>
              <div className="mt-1 flex gap-1 pl-5">
                {b.meetUrl && (
                  <Button asChild variant="ghost" size="xs" className="rounded-full text-primary hover:text-primary">
                    <a href={b.meetUrl} target="_blank" rel="noreferrer">
                      <Video />
                      Meet
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => props.onCancel(b)}
                >
                  Avboka
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Phone top bar: the month name, plus the year only when it is not this year. */
function shortTitle(view: View, anchor: string): string {
  const d = view === "week" ? startOfWeek(anchor) : anchor;
  const month = MONTHS[Number(d.slice(5, 7)) - 1];
  return d.slice(0, 4) === String(new Date().getFullYear()) ? month : `${SHORT[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

function weekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const [y1, m1] = monday.split("-").map(Number);
  const [y2, m2] = sunday.split("-").map(Number);
  if (m1 === m2) return `${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${SHORT[m1 - 1]} – ${SHORT[m2 - 1]} ${y1}`;
  return `${SHORT[m1 - 1]} ${y1} – ${SHORT[m2 - 1]} ${y2}`;
}
