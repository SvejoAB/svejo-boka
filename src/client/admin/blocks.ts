// Turns the engine's half-hour cells into calendar blocks: consecutive cells
// with the same meaning become one event, like in a normal calendar.

import type { AdminCell } from "../../shared/api";

export type Action = "open" | "close" | "clear";

export type Kind =
  | "booked"
  | "free"
  | "info"
  | "short"
  | "opened"
  | "closed"
  | "busy"
  | "allday"
  | "beyond";

export interface Look {
  key: string;
  kind: Kind;
  label: string;
  /** What clicking a half-hour of this block can do. */
  action: Action | "booking" | null;
  /** One-line reason, shown in the popover. */
  reason: string;
  /** Already started: shown faded, nothing to change. */
  past?: boolean;
}

export const KIND_CLASS: Record<Kind, string> = {
  booked: "bg-ev-booked text-ev-booked-fg",
  free: "bg-ev-free text-ev-free-fg",
  info: "bg-ev-info text-ev-info-fg",
  short: "bg-background text-ev-free-fg border border-dashed border-ev-free-fg/40",
  opened: "bg-ev-free text-ev-free-fg border-2 border-ev-free-fg",
  closed: "stripes-closed bg-ev-closed text-ev-closed-fg",
  busy: "bg-ev-busy text-ev-busy-fg",
  allday: "bg-muted text-muted-foreground",
  beyond: "bg-muted/60 text-muted-foreground",
};

/** Solid dot for legends and popovers; never a bordered square that reads as a checkbox. */
export const KIND_DOT: Record<Kind, string> = {
  booked: "bg-ev-booked",
  free: "bg-ev-free-dot",
  info: "bg-ev-info-dot",
  short: "bg-background ring-1 ring-inset ring-ev-free-fg/50",
  opened: "bg-ev-free ring-2 ring-inset ring-ev-free-fg",
  closed: "stripes-closed bg-ev-closed",
  busy: "bg-ev-busy-dot",
  allday: "bg-[#9aa0a6]",
  beyond: "bg-muted",
};

export function lookOf(cell: AdminCell, bookable: boolean): Look {
  const look = baseLook(cell, bookable);
  if (!cell.past) return look;
  // Past time keeps its meaning but cannot be changed; bookings stay clickable.
  return { ...look, key: `past:${look.key}`, past: true, action: look.action === "booking" ? "booking" : null };
}

function baseLook(cell: AdminCell, bookable: boolean): Look {
  const s = cell.state;
  if (s.kind === "booked") {
    return { key: `b:${s.bookingId}`, kind: "booked", label: s.name, action: "booking", reason: "Bokad" };
  }
  if (s.kind === "free") {
    if (s.via === "manual") {
      return { key: "opened", kind: "opened", label: "Öppnad av dig", action: "clear", reason: "Du har öppnat tiden för bokning." };
    }
    const label = s.label ?? "Ledig";
    if (!bookable && !cell.past) {
      return {
        key: `short:${label}`,
        kind: "short",
        label: `${label} · för kort`,
        action: "close",
        reason: "Ledig, men ett helt möte ryms inte här, eller tiden ligger närmare än din framförhållning.",
      };
    }
    return {
      key: `free:${label}`,
      kind: s.label ? "info" : "free",
      label,
      action: "close",
      reason: s.label ? `${label}: från en kalender som bara visas. Bokbar tills du stänger tiden.` : "Bokbar.",
    };
  }
  const label = s.label ?? "";
  switch (s.reason) {
    case "beyond":
      return { key: "beyond", kind: "beyond", label: "Utanför 4 veckor", action: null, reason: "Längre fram än fyra veckor går inte att boka." };
    case "closed":
      return { key: "closed", kind: "closed", label: "Stängd av dig", action: "clear", reason: "Du har stängt tiden för bokning." };
    case "busy":
      return { key: `busy:${label}`, kind: "busy", label, action: "open", reason: "Upptagen i din kalender." };
    case "allday":
      return { key: `allday:${label}`, kind: "allday", label, action: "open", reason: `Heldag: ${label}. Stängd för bokning.` };
  }
}

export interface Block {
  look: Look;
  /** Index of the first half-hour in the day. */
  first: number;
  cells: AdminCell[];
}

export function dayBlocks(cells: AdminCell[], slots: number[], meetingLength: number): Block[] {
  const covered = new Set<number>();
  for (const s of slots) for (let t = s; t < s + meetingLength * 60000; t += 30 * 60000) covered.add(t);
  const blocks: Block[] = [];
  cells.forEach((cell, i) => {
    const look = lookOf(cell, covered.has(cell.start));
    const prev = blocks.at(-1);
    if (prev && prev.look.key === look.key && prev.first + prev.cells.length === i) prev.cells.push(cell);
    else blocks.push({ look, first: i, cells: [cell] });
  });
  return blocks;
}

/**
 * What each action would change in a dragged range of half-hours. Past time,
 * bookings and time beyond the horizon are left alone.
 */
export function rangeActions(cells: AdminCell[]): Record<Action, AdminCell[]> {
  const editable = cells.filter(
    (c) => !c.past && c.state.kind !== "booked" && !(c.state.kind === "blocked" && c.state.reason === "beyond"),
  );
  return {
    close: editable.filter((c) => c.state.kind === "free"),
    open: editable.filter((c) => c.state.kind === "blocked"),
    clear: editable.filter((c) => c.override !== undefined),
  };
}

export const LEGEND: [Kind, string][] = [
  ["free", "Bokbar"],
  ["info", "Bokbar, med händelse"],
  ["short", "Ledig men för kort"],
  ["booked", "Bokad"],
  ["opened", "Öppnad av dig"],
  ["closed", "Stängd av dig"],
  ["busy", "Upptagen"],
  ["allday", "Heldag"],
];
