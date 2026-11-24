import { describe, expect, it } from "vitest";
import type { AdminCell } from "../../shared/api";
import { rangeActions } from "./blocks";

const H = 30 * 60000;
const cell = (i: number, rest: Partial<AdminCell>): AdminCell => ({
  start: i * H,
  end: (i + 1) * H,
  state: { kind: "free", via: "rules" },
  ...rest,
});

describe("rangeActions", () => {
  it("closes the free part of a range and opens the blocked part", () => {
    const cells = [
      cell(0, { state: { kind: "free", via: "rules", label: "Handledning DIT213GU" } }),
      cell(1, { state: { kind: "free", via: "rules", label: "Handledning DIT213GU" } }),
      cell(2, { state: { kind: "blocked", reason: "busy", label: "Kundmöte" } }),
    ];
    const a = rangeActions(cells);
    expect(a.close.map((c) => c.start)).toEqual([0, H]);
    expect(a.open.map((c) => c.start)).toEqual([2 * H]);
    expect(a.clear).toEqual([]);
  });

  it("leaves past time, bookings and time beyond the horizon alone", () => {
    const cells = [
      cell(0, { past: true }),
      cell(1, { state: { kind: "booked", bookingId: "b1", name: "Anna" } }),
      cell(2, { state: { kind: "blocked", reason: "beyond" } }),
    ];
    expect(rangeActions(cells)).toEqual({ close: [], open: [], clear: [] });
  });

  it("offers to clear cells with a manual change", () => {
    const cells = [
      cell(0, { override: "close", state: { kind: "blocked", reason: "closed" } }),
      cell(1, { override: "open", state: { kind: "free", via: "manual" } }),
      cell(2, {}),
    ];
    expect(rangeActions(cells).clear.map((c) => c.start)).toEqual([0, H]);
  });
});
