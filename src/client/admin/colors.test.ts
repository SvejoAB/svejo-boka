import { describe, expect, it } from "vitest";
import { parseColors } from "../../shared/colors";
import { colorVars } from "./colors";

describe("colorVars", () => {
  it("sets nothing for the built-in palette", () => {
    expect(colorVars({})).toEqual({});
  });

  it("gives a changed kind a pale fill, dark text and its own dot", () => {
    expect(colorVars({ school: "#ff0000" })).toEqual({
      "--ev-school": "color-mix(in oklab, #ff0000 20%, white)",
      "--ev-school-fg": "color-mix(in oklab, #ff0000 50%, black)",
      "--ev-school-dot": "#ff0000",
    });
  });

  it("keeps bookings solid with readable text", () => {
    expect(colorVars({ booked: "#ffeb3b" })).toEqual({ "--ev-booked": "#ffeb3b", "--ev-booked-fg": "#1f1f1f" });
    expect(colorVars({ booked: "#1a237e" })["--ev-booked-fg"]).toBe("#ffffff");
  });
});

describe("parseColors", () => {
  it("accepts known kinds with #rrggbb", () => {
    expect(parseColors({ free: "#34a853", closed: "#000000" })).toEqual({ free: "#34a853", closed: "#000000" });
  });

  it("rejects unknown kinds and anything that is not #rrggbb", () => {
    expect(parseColors({ lunch: "#34a853" })).toBeNull();
    expect(parseColors({ free: "red" })).toBeNull();
    expect(parseColors({ free: "#34a853; background: url(x)" })).toBeNull();
    expect(parseColors(["#34a853"])).toBeNull();
  });
});
