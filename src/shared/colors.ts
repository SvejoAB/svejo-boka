// Event colours in the owner calendar that the owner can change in /admin.

export const COLOR_KINDS = ["free", "booked", "school", "busy", "sport", "closed", "gap"] as const;
export type ColorKind = (typeof COLOR_KINDS)[number];

/** Only the colours the owner changed; the rest keep the built-in palette. */
export type EventColors = Partial<Record<ColorKind, string>>;

export const COLOR_LABELS: Record<ColorKind, string> = {
  free: "Bokbar",
  booked: "Bokad",
  school: "Skola",
  busy: "Upptagen",
  sport: "Träning",
  closed: "Stängd av dig",
  gap: "Lunch och restid",
};

/** The built-in colour of each kind, as its legend dot shows it. */
export const DEFAULT_COLORS: Record<ColorKind, string> = {
  free: "#8ab4f8",
  booked: "#0b57d0",
  school: "#a29bd6",
  busy: "#5bb5a2",
  sport: "#6dbf83",
  closed: "#b3261e",
  gap: "#9aa0a6",
};

const HEX = /^#[0-9a-f]{6}$/;

/** Known kinds with a lowercase #rrggbb colour, or null if anything else is in there. */
export function parseColors(input: unknown): EventColors | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const out: EventColors = {};
  for (const [kind, value] of Object.entries(input)) {
    if (!(COLOR_KINDS as readonly string[]).includes(kind) || typeof value !== "string" || !HEX.test(value)) return null;
    out[kind as ColorKind] = value;
  }
  return out;
}
