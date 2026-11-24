// Event colours in the owner calendar that the owner can change in /admin.

export const COLOR_KINDS = ["free", "info", "booked", "busy", "closed"] as const;
export type ColorKind = (typeof COLOR_KINDS)[number];

/** Only the colours the owner changed; the rest keep the built-in palette. */
export type EventColors = Partial<Record<ColorKind, string>>;

export const COLOR_LABELS: Record<ColorKind, string> = {
  free: "Bokbar",
  info: "Bokbar, med händelse",
  booked: "Bokad",
  busy: "Upptagen",
  closed: "Stängd av dig",
};

/** The built-in colour of each kind, as its legend dot shows it. */
export const DEFAULT_COLORS: Record<ColorKind, string> = {
  free: "#8ab4f8",
  info: "#a29bd6",
  booked: "#0b57d0",
  busy: "#5bb5a2",
  closed: "#b3261e",
};

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Known kinds with a lowercase #rrggbb colour, or null if a known kind has anything else.
 * Kinds that no longer exist (saved before they were removed) are dropped.
 */
export function parseColors(input: unknown): EventColors | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const out: EventColors = {};
  for (const [kind, value] of Object.entries(input)) {
    if (!(COLOR_KINDS as readonly string[]).includes(kind)) continue;
    if (typeof value !== "string" || !HEX.test(value)) return null;
    out[kind as ColorKind] = value;
  }
  return out;
}
