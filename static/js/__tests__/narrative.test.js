import { describe, it, expect } from "vitest";
import { stageFor, tickerLine, tickerPool, TICKERS } from "../narrative.js";

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

describe("tickerPool", () => {
  it("is just the Stage 0 lines at stage 0", () => {
    expect(tickerPool(0)).toEqual(TICKERS[0]);
  });

  it("accumulates lines as stages unlock", () => {
    expect(tickerPool(1)).toEqual([...TICKERS[0], ...TICKERS[1]]);
  });

  it("reuses unlocked lines for stages with no new content", () => {
    expect(tickerPool(5)).toEqual(tickerPool(1));
  });

  it("keeps Stage 0 lines first so index 0 stays wholesome", () => {
    expect(tickerPool(5)[0]).toBe(TICKERS[0][0]);
  });
});

describe("tickerLine", () => {
  it("returns a stage 0 line at stage 0", () => {
    expect(TICKERS[0]).toContain(tickerLine(0, 0));
  });

  it("wraps the index around the available lines", () => {
    const n = TICKERS[0].length;
    expect(tickerLine(0, n)).toBe(tickerLine(0, 0));
    expect(tickerLine(0, -1)).toBe(tickerLine(0, n - 1));
  });

  it("can surface Stage 1 lines once that stage is reached", () => {
    const pool = tickerPool(1);
    const seen = pool.map((_, i) => tickerLine(1, i));
    for (const line of TICKERS[1]) expect(seen).toContain(line);
  });
});
