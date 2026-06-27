import { describe, it, expect } from "vitest";
import {
  stageFor,
  tickerLine,
  tickerPool,
  TICKERS,
  artFor,
  ART,
  describeUpgrade,
  UPGRADE_DESCRIPTIONS,
  returnMessage,
  missingCount,
} from "../narrative.js";

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

describe("artFor", () => {
  it("uses the friendly eye before Stage 2", () => {
    expect(artFor(0)).toBe(ART[0]);
    expect(artFor(1)).toBe(ART[0]);
    expect(artFor(0)).toContain("( o   )>");
  });

  it("switches to the dark eye at Stage 2 and stays there", () => {
    expect(artFor(2)).toBe(ART[2]);
    expect(artFor(5)).toBe(ART[2]);
    expect(artFor(2)).toContain("( ●   )>");
  });
});

describe("describeUpgrade", () => {
  it("returns the default description before Stage 2", () => {
    expect(describeUpgrade(0, "feed", "default")).toBe("default");
    expect(describeUpgrade(1, "rooster", "default")).toBe("default");
  });

  it("returns the darker override from Stage 2 on", () => {
    expect(describeUpgrade(2, "rooster", "default")).toBe(
      UPGRADE_DESCRIPTIONS[2].rooster,
    );
    expect(describeUpgrade(5, "barn", "default")).toBe(
      UPGRADE_DESCRIPTIONS[2].barn,
    );
  });

  it("falls back to the default for upgrades without an override", () => {
    expect(describeUpgrade(2, "unknown", "default")).toBe("default");
  });
});

describe("missingCount", () => {
  it("reports at least one and scales by the minute, capped at 99", () => {
    expect(missingCount(0)).toBe(1);
    expect(missingCount(60)).toBe(1);
    expect(missingCount(180)).toBe(3);
    expect(missingCount(10_000_000)).toBe(99);
  });
});

describe("returnMessage", () => {
  it("stays silent before Stage 2 or after a brief gap", () => {
    expect(returnMessage(1, 9999)).toBe(null);
    expect(returnMessage(2, 59)).toBe(null);
  });

  it("reports missing chickens after a real absence at Stage 2+", () => {
    expect(returnMessage(2, 180)).toBe("While you were away, 3 went missing.");
  });
});
