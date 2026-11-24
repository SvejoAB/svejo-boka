import { Mail, Phone, Video, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AdminBooking, AdminCalendar, AdminCell } from "../../shared/api";
import { swedishHoliday } from "../../shared/holidays";
import { minutesOf, weekdayOf } from "../../shared/time";
import { capitalize, clock, longDay, weekdayNames } from "../i18n";
import { dayBlocks, KIND_CLASS, KIND_DOT, rangeActions, type Action, type Block } from "./blocks";

const SLOT_PX = 24; // one half-hour
const DAY_START = 8 * 60;

/** A range of half-hours dragged out in one day column. */
interface Selection {
  day: number;
  from: number;
  to: number;
  /** The mouse is released and the actions are shown. */
  done: boolean;
}

export function WeekView(props: {
  data: AdminCalendar;
  today: string;
  onAction: (cells: AdminCell[], action: Action) => void;
  onCancel: (b: AdminBooking) => void;
}) {
  const { data } = props;
  const names = weekdayNames("sv");
  const rows = data.days[0]?.cells ?? [];
  const scroller = useRef<HTMLDivElement>(null);
  const todayIndex = data.days.findIndex((d) => d.date === props.today);
  const now = useNow();
  const [selection, setSelection] = useState<Selection | null>(null);
  const press = useRef<{ day: number; from: number; dragging: boolean } | null>(null);
  const swallowClick = useRef(false);

  // Drag with the mouse to select several half-hours, like in Google Calendar.
  // Touch keeps tap-to-open, so scrolling still works.
  const rowAt = (e: PointerEvent<HTMLDivElement>) =>
    Math.min(rows.length - 1, Math.max(0, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / SLOT_PX)));

  // On a narrow screen the week scrolls sideways; start at today, not Monday.
  useEffect(() => {
    const el = scroller.current;
    if (!el || todayIndex < 1 || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, todayIndex * ((el.scrollWidth - 56) / 7));
  }, [todayIndex, data.days[0]?.date]);

  const allDay = data.days.map((d) => {
    const labels = new Set<string>();
    for (const c of d.cells) if (c.state.kind === "blocked" && c.state.reason === "allday" && c.state.label) labels.add(c.state.label);
    const holiday = swedishHoliday(d.date)?.name;
    return { holiday, labels: [...labels] };
  });
  const hasAllDay = allDay.some((a) => a.holiday || a.labels.length);
  const nowTop = ((minutesOf(now) - DAY_START) / 30) * SLOT_PX;
  const nowVisible = todayIndex >= 0 && nowTop >= 0 && nowTop <= rows.length * SLOT_PX;

  return (
    <div ref={scroller} className="h-full overflow-auto">
      <div className="grid w-max min-w-full grid-cols-[3.5rem_repeat(7,minmax(calc((100vw-4.5rem)/3),1fr))] md:grid-cols-[3.5rem_repeat(7,minmax(5.5rem,1fr))]">
        {/* day headers, pinned while the hours scroll */}
        <div className="sticky top-0 left-0 z-30 bg-background" />
        {data.days.map((d) => {
          const wd = weekdayOf(d.date);
          const isToday = d.date === props.today;
          return (
            <div key={d.date} className="sticky top-0 z-20 flex flex-col items-center gap-1 bg-background pt-3 pb-2">
              <span className={cn("text-[11px] font-medium tracking-wide uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                {names[wd]}
              </span>
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-full text-2xl leading-none tabular-nums",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {Number(d.date.slice(8))}
              </span>
            </div>
          );
        })}

        {/* all-day row */}
        {hasAllDay && (
          <>
            <div className="sticky left-0 z-20 border-b bg-background" />
            {allDay.map((a, i) => (
              <div key={data.days[i].date} className="grid content-start gap-0.5 border-b border-l px-1 pb-1">
                {a.holiday && (
                  <span className="truncate rounded bg-ev-holiday px-1.5 py-0.5 text-xs text-ev-holiday-fg">{a.holiday}</span>
                )}
                {a.labels.map((l) => (
                  <span key={l} className="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-foreground" title={l}>
                    {l}
                  </span>
                ))}
              </div>
            ))}
          </>
        )}

        {/* hour gutter */}
        <div className="sticky left-0 z-20 bg-background" style={{ height: rows.length * SLOT_PX }}>
          <div className="relative h-full">
          {rows.map((c, i) =>
            i % 2 === 0 && i > 0 ? (
              <span
                key={c.start}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                style={{ top: i * SLOT_PX }}
              >
                {clock(c.start)}
              </span>
            ) : null,
          )}
          </div>
        </div>

        {/* days */}
        {data.days.map((d, di) => {
          const blocks = dayBlocks(d.cells, d.slots, data.meetingLength);
          return (
            <div
              key={d.date}
              className="@container relative border-l select-none"
              style={{
                height: rows.length * SLOT_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${SLOT_PX * 2}px)`,
              }}
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse" || e.button !== 0) return;
                press.current = { day: di, from: rowAt(e), dragging: false };
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (!p || p.day !== di) return;
                if (!(e.buttons & 1)) {
                  press.current = null; // released outside the column before the drag began
                  return;
                }
                const row = rowAt(e);
                if (!p.dragging && row === p.from) return;
                if (!p.dragging) {
                  p.dragging = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
                setSelection({ day: di, from: p.from, to: row, done: false });
              }}
              onPointerUp={() => {
                const p = press.current;
                press.current = null;
                if (!p?.dragging) return;
                setSelection((s) => (s ? { ...s, done: true } : null));
                // The release also clicks the block under the mouse; that click must not open its popover.
                swallowClick.current = true;
                setTimeout(() => (swallowClick.current = false), 0);
              }}
              onPointerCancel={() => {
                press.current = null;
                setSelection(null);
              }}
              onClickCapture={(e) => {
                if (!swallowClick.current) return;
                swallowClick.current = false;
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              {blocks.map((b) => (
                <EventBlock key={`${b.first}:${b.look.key}`} block={b} bookings={data.bookings} onAction={props.onAction} onCancel={props.onCancel} />
              ))}
              {selection?.day === di && (
                <RangeSelection
                  cells={d.cells.slice(Math.min(selection.from, selection.to), Math.max(selection.from, selection.to) + 1)}
                  first={Math.min(selection.from, selection.to)}
                  done={selection.done}
                  onClose={() => setSelection(null)}
                  onAction={props.onAction}
                />
              )}
              {nowVisible && di === todayIndex && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                  <div className="relative h-0.5 bg-now">
                    <span className="absolute -top-[5px] -left-1.5 size-3 rounded-full bg-now" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock(props: {
  block: Block;
  bookings: AdminBooking[];
  onAction: (cells: AdminCell[], action: Action) => void;
  onCancel: (b: AdminBooking) => void;
}) {
  const { block } = props;
  const { look, cells } = block;
  const [open, setOpen] = useState(false);
  const [cellIndex, setCellIndex] = useState(0);
  const start = cells[0].start;
  const end = cells.at(-1)!.end;
  const tall = cells.length >= 2;
  const interactive = look.action !== null;
  const booking = look.kind === "booked" ? props.bookings.find((b) => `b:${b.id}` === look.key) : undefined;
  const style = { top: block.first * SLOT_PX + 1, height: cells.length * SLOT_PX - 2 };

  // Text on a patterned block gets a solid backing so it stays readable.
  const backing = look.kind === "closed" ? "w-fit max-w-full rounded-sm bg-ev-closed px-0.5 -mx-0.5" : "";
  const content = (
    <>
      <span className={cn("block truncate font-medium", backing)}>{look.label}</span>
      {tall && (
        <span className={cn("block truncate opacity-80 tabular-nums", backing)}>
          {clock(start)}
          <span className="hidden @[6.5rem]:inline">–{clock(end)}</span>
        </span>
      )}
    </>
  );
  const className = cn(
    "absolute left-0.5 right-1.5 overflow-hidden rounded-md px-2 py-0.5 text-left text-xs leading-[18px]",
    KIND_CLASS[look.kind],
    look.past && "opacity-45",
  );

  if (!interactive) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  const cell = cells[Math.min(cellIndex, cells.length - 1)];
  const verb = look.action === "open" ? "Öppna" : look.action === "close" ? "Stäng" : "Ta bort ändringen för";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(className, "transition-[filter] hover:brightness-95 focus-visible:z-10 data-[state=open]:z-10 data-[state=open]:shadow-lg")}
          style={style}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCellIndex(Math.max(0, Math.floor((e.clientY - rect.top) / SLOT_PX)));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setCellIndex(0);
          }}
          aria-label={`${look.label}, ${capitalize(longDay(start, "sv"))} ${clock(start)}–${clock(end)}`}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-80 p-0">
        <div className="flex justify-end p-1">
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => setOpen(false)} aria-label="Stäng">
            <X />
          </Button>
        </div>
        <div className="grid gap-3 px-5 pb-5">
          <div className="flex gap-3">
            <span aria-hidden className={cn("mt-1.5 size-3.5 shrink-0 rounded-full", KIND_DOT[look.kind])} />
            <div className="min-w-0">
              <p className="text-lg leading-snug [overflow-wrap:anywhere]">{look.label}</p>
              <p className="text-sm text-muted-foreground">
                {capitalize(longDay(start, "sv"))} · {clock(start)}–{clock(end)}
              </p>
            </div>
          </div>

          {booking ? (
            <>
              <ul className="grid gap-2 pl-6.5 text-sm">
                <li>
                  <a href={`mailto:${booking.email}`} className="inline-flex items-center gap-2 hover:underline [overflow-wrap:anywhere]">
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {booking.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 hover:underline">
                    <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {booking.phone}
                  </a>
                </li>
                {booking.message && <li className="text-muted-foreground [overflow-wrap:anywhere]">“{booking.message}”</li>}
              </ul>
              <div className="flex flex-wrap gap-2 pl-6.5">
                {booking.meetUrl && (
                  <Button asChild size="sm" className="rounded-full">
                    <a href={booking.meetUrl} target="_blank" rel="noreferrer">
                      <Video />
                      Gå med i Meet
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setOpen(false);
                    props.onCancel(booking);
                  }}
                >
                  Avboka
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="pl-6.5 text-sm text-muted-foreground">{look.reason}</p>
              <div className="grid gap-2 pl-6.5">
                <Button
                  size="sm"
                  variant={look.action === "clear" ? "outline" : "default"}
                  className="justify-start rounded-full"
                  onClick={() => {
                    setOpen(false);
                    props.onAction([cell], look.action as Action);
                  }}
                >
                  {verb} {clock(cell.start)}–{clock(cell.end)}
                </Button>
                {cells.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="justify-start rounded-full"
                    onClick={() => {
                      setOpen(false);
                      props.onAction(cells, look.action as Action);
                    }}
                  >
                    {look.action === "clear" ? "Ta bort ändringen för hela" : `${verb} hela`} {clock(start)}–{clock(end)}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeSelection(props: {
  cells: AdminCell[];
  first: number;
  done: boolean;
  onClose: () => void;
  onAction: (cells: AdminCell[], action: Action) => void;
}) {
  const { cells } = props;
  const start = cells[0].start;
  const end = cells.at(-1)!.end;
  const range = `${clock(start)}–${clock(end)}`;
  const actions = rangeActions(cells);
  const choices: { action: Action; label: string }[] = [];
  if (actions.close.length) choices.push({ action: "close", label: `Stäng ${range}` });
  if (actions.open.length) choices.push({ action: "open", label: `Öppna ${range}` });
  if (actions.clear.length) choices.push({ action: "clear", label: "Ta bort dina ändringar" });

  const block = (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0.5 right-1.5 z-20 overflow-hidden rounded-md bg-primary px-2 py-0.5 text-xs leading-[18px] text-primary-foreground shadow-lg"
      style={{ top: props.first * SLOT_PX + 1, height: cells.length * SLOT_PX - 2 }}
    >
      <span className="block truncate font-medium tabular-nums">{range}</span>
    </div>
  );
  if (!props.done) return block;

  return (
    <Popover open onOpenChange={(open) => !open && props.onClose()}>
      <PopoverAnchor asChild>{block}</PopoverAnchor>
      <PopoverContent align="start" side="right" className="w-80 p-0">
        <div className="flex justify-end p-1">
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={props.onClose} aria-label="Stäng">
            <X />
          </Button>
        </div>
        <div className="grid gap-3 px-5 pb-5">
          <div className="flex gap-3">
            <span aria-hidden className="mt-1.5 size-3.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="text-lg leading-snug">Markerad tid</p>
              <p className="text-sm text-muted-foreground">
                {capitalize(longDay(start, "sv"))} · {range}
              </p>
            </div>
          </div>
          {choices.length === 0 ? (
            <p className="pl-6.5 text-sm text-muted-foreground">Den här tiden går inte att ändra.</p>
          ) : (
            <div className="grid gap-2 pl-6.5">
              {choices.map((c, i) => (
                <Button
                  key={c.action}
                  size="sm"
                  variant={i === 0 ? "default" : "outline"}
                  className="justify-start rounded-full"
                  onClick={() => {
                    props.onClose();
                    props.onAction(actions[c.action], c.action);
                  }}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

