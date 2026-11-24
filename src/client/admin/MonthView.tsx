import { cn } from "@/lib/utils";
import type { AdminBooking, AdminCalendar } from "../../shared/api";
import { swedishHoliday } from "../../shared/holidays";
import { dateKeyOf, weekdayOf } from "../../shared/time";
import { clock, longDay, weekdayNames } from "../i18n";

export function MonthView(props: { data: AdminCalendar; month: string; today: string; onDay: (date: string) => void }) {
  const names = weekdayNames("sv");
  const weeks: AdminCalendar["days"][] = [];
  for (let i = 0; i < props.data.days.length; i += 7) weeks.push(props.data.days.slice(i, i + 7));
  const visible = weeks.filter((w) => w.some((d) => d.date.startsWith(props.month)));
  const byDay = new Map<string, AdminBooking[]>();
  for (const b of props.data.bookings) {
    const k = dateKeyOf(b.start);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7">
        {names.map((n, i) => (
          <div key={n} className={cn("pt-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase", i > 0 && "border-l")}>
            {n}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${visible.length}, minmax(7rem, 1fr))` }}>
        {visible.flat().map((d) => {
          const inMonth = d.date.startsWith(props.month);
          const isToday = d.date === props.today;
          const past = d.date < props.today;
          const holiday = swedishHoliday(d.date)?.name;
          const allDay = [
            ...new Set(d.cells.flatMap((c) => (c.state.kind === "blocked" && c.state.reason === "allday" && c.state.label ? [c.state.label] : []))),
          ];
          const outside = d.cells.every((c) => c.state.kind === "blocked" && c.state.reason === "beyond");
          const bookings = byDay.get(d.date) ?? [];
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => props.onDay(d.date)}
              aria-label={`${longDay(Date.parse(`${d.date}T12:00:00Z`), "sv")}: ${d.slots.length} lediga tider, ${bookings.length} bokningar. Visa veckan.`}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 border-t px-1 pt-1 pb-1.5 text-left transition-colors hover:bg-accent/50",
                weekdayOf(d.date) > 0 && "border-l",
              )}
            >
              <span
                className={cn(
                  "mx-auto grid size-7 place-items-center rounded-full text-xs font-medium tabular-nums",
                  isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {Number(d.date.slice(8))}
              </span>
              {holiday && <Chip className="bg-ev-holiday text-ev-holiday-fg">{holiday}</Chip>}
              {allDay.map((l) => (
                <Chip key={l} className="bg-muted text-foreground">
                  {l}
                </Chip>
              ))}
              {!past && !outside && d.slots.length > 0 && (
                <Chip className="bg-ev-free text-ev-free-fg">
                  {d.slots.length} {d.slots.length === 1 ? "ledig tid" : "lediga tider"}
                </Chip>
              )}
              {bookings.slice(0, 2).map((b) => (
                <Chip key={b.id} className="bg-ev-booked text-ev-booked-fg">
                  <span className="tabular-nums">{clock(b.start)}</span> {b.name}
                </Chip>
              ))}
              {bookings.length > 2 && <span className="px-1.5 text-xs text-muted-foreground">{bookings.length - 2} till</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("truncate rounded px-1.5 py-px text-xs", className)}>{children}</span>;
}
