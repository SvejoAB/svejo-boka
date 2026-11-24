// Turns the owner's event colours into the CSS variables the calendar uses.
// A changed colour gives a pale fill and dark text of the same hue, like the built-in palette.

import { COLOR_KINDS, type EventColors } from "../../shared/colors";

const DOT_KINDS = new Set(["free", "school", "busy", "sport"]);

export function colorVars(colors: EventColors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const kind of COLOR_KINDS) {
    const c = colors[kind];
    if (!c) continue;
    if (kind === "booked") {
      vars["--ev-booked"] = c;
      vars["--ev-booked-fg"] = contrast(c, "#1f1f1f") > contrast(c, "#ffffff") ? "#1f1f1f" : "#ffffff";
      continue;
    }
    vars[`--ev-${kind}`] = `color-mix(in oklab, ${c} 20%, white)`;
    vars[`--ev-${kind}-fg`] = `color-mix(in oklab, ${c} 50%, black)`;
    if (DOT_KINDS.has(kind)) vars[`--ev-${kind}-dot`] = c;
    if (kind === "closed") vars["--ev-closed-stripe"] = `color-mix(in srgb, ${c} 25%, transparent)`;
  }
  return vars;
}

/** Every variable colorVars can set, so a reset can remove them. */
const ALL_VARS = Object.keys(
  colorVars(Object.fromEntries(COLOR_KINDS.map((k) => [k, "#000000"])) as EventColors),
);

/** Applies the colours to the whole page, popovers and dialogs included. */
export function applyColors(colors: EventColors): void {
  const style = document.documentElement.style;
  const vars = colorVars(colors);
  for (const name of ALL_VARS) {
    if (vars[name]) style.setProperty(name, vars[name]);
    else style.removeProperty(name);
  }
}

/** WCAG contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
