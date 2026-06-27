import { describe, it, expect } from "vitest";
import { stageFor, tickerLine, TICKERS } from "../narrative.js";

describe("stageFor", () => {
  it("starts at stage 0", () => {
    expect(stageFor(0)).toBe(0);
    expect(stageFor(999)).toBe(0);
    expect(stageFor(undefined)).toBe(0);
  });

  it("advances at each lifetime threshold", () => {
    expect(stageFor(1_000)).toBe(1);
    expect(stageFor(10_000)).toBe(2);
    expect(stageFor(75_000)).toBe(3);
    expect(stageFor(500_000)).toBe(4);
    expect(stageFor(2_000_000)).toBe(5);
  });

  it("never exceeds the last defined stage", () => {
    expect(stageFor(999_999_999)).toBe(5);
  });
});

describe("tickerLine", () => {
  it("returns a stage 0 line", () => {
    expect(TICKERS[0]).toContain(tickerLine(0, 0));
  });

  it("wraps the index around the available lines", () => {
    const n = TICKERS[0].length;
    expect(tickerLine(0, n)).toBe(tickerLine(0, 0));
    expect(tickerLine(0, -1)).toBe(tickerLine(0, n - 1));
  });

  it("falls back to stage 0 lines for stages without content", () => {
    expect(TICKERS[0]).toContain(tickerLine(5, 0));
  });
});
