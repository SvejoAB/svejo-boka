// Turns the engine's half-hour cells into calendar blocks: consecutive cells
// with the same meaning become one event, like in a normal calendar.

import type { AdminCell } from "../../shared/api";

export type Action = "open" | "close" | "clear";

export type Kind =
  | "booked"
  | "free"
  | "free-school"
  | "short"
  | "opened"
  | "closed"
  | "school"
  | "busy"
  | "sport"
  | "gap"
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
  "free-school": "bg-ev-free text-ev-free-fg",
  short: "bg-background text-ev-free-fg border border-dashed border-ev-free-fg/40",
  opened: "bg-ev-free text-ev-free-fg border-2 border-ev-free-fg",
  closed: "stripes-closed bg-ev-closed text-ev-closed-fg",
  school: "bg-ev-school text-ev-school-fg",
  busy: "bg-ev-busy text-ev-busy-fg",
  sport: "bg-ev-sport text-ev-sport-fg",
  gap: "dots bg-ev-gap text-ev-gap-fg",
  allday: "bg-muted text-muted-foreground",
  beyond: "bg-muted/60 text-muted-foreground",
};

/** Solid dot for legends and popovers; never a bordered square that reads as a checkbox. */
export const KIND_DOT: Record<Kind, string> = {
  booked: "bg-ev-booked",
  free: "bg-ev-free-dot",
  "free-school": "bg-ev-free-dot",
  short: "bg-background ring-1 ring-inset ring-ev-free-fg/50",
  opened: "bg-ev-free ring-2 ring-inset ring-ev-free-fg",
  closed: "stripes-closed bg-ev-closed",
  school: "bg-ev-school-dot",
  busy: "bg-ev-busy-dot",
  sport: "bg-ev-sport-dot",
  gap: "dots bg-ev-gap ring-1 ring-inset ring-black/10",
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
    const label = s.via === "school" ? (s.label ?? "Övning") : "Ledig";
    if (!bookable && !cell.past) {
      return {
        key: `short:${label}`,
        kind: "short",
        label: s.via === "school" ? `${label} · för kort` : "Ledig · för kort",
        action: "close",
        reason: "Ledig, men ett helt möte ryms inte här, eller tiden ligger närmare än din framförhållning.",
      };
    }
    return {
      key: `free:${label}`,
      kind: s.via === "school" ? "free-school" : "free",
      label,
      action: "close",
      reason: s.via === "school" ? `${label}: räknas som ledig tid. Bokbar.` : "Bokbar.",
    };
  }
  const label = s.label ?? "";
  switch (s.reason) {
    case "beyond":
      return { key: "beyond", kind: "beyond", label: "Utanför 4 veckor", action: null, reason: "Längre fram än fyra veckor går inte att boka." };
    case "closed":
      return { key: "closed", kind: "closed", label: "Stängd av dig", action: "clear", reason: "Du har stängt tiden för bokning." };
    case "lunch":
      return { key: "lunch", kind: "gap", label: "Lunch", action: "open", reason: "Lunch, 12–13. Stängd om du inte öppnar den." };
    case "buffer":
      return { key: "buffer", kind: "gap", label: "Restid", action: "open", reason: `30 minuter restid kring ${label}.` };
    case "school":
      return { key: `school:${label}`, kind: "school", label, action: "open", reason: "Skolan. Stängd för bokning." };
    case "busy":
      return { key: `busy:${label}`, kind: "busy", label, action: "open", reason: "Upptagen i din kalender." };
    case "sport":
      return { key: `sport:${label}`, kind: "sport", label: label.replace(/\s*\/\/.*$/, ""), action: "open", reason: "IK Virgo. Stängd för bokning." };
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

export const LEGEND: [Kind, string][] = [
  ["free", "Bokbar"],
  ["short", "Ledig men för kort"],
  ["booked", "Bokad"],
  ["opened", "Öppnad av dig"],
  ["closed", "Stängd av dig"],
  ["school", "Skola"],
  ["busy", "Upptagen"],
  ["sport", "Träning"],
  ["gap", "Lunch och restid"],
  ["allday", "Heldag"],
];
