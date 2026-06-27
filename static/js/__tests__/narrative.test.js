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
  nightLine,
  idleLine,
  collectFlicker,
  COLLECT_FLICKER,
  resetGreeting,
  glitchArt,
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
    expect(tickerPool(2)).toEqual(tickerPool(1)); // Stage 2 adds no lines
    expect(tickerPool(5)).toEqual(tickerPool(3)); // Stages 4-5 add no lines
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

describe("nightLine", () => {
  it("fires only in the small hours", () => {
    expect(nightLine(2, 0)).not.toBe(null);
    expect(nightLine(23, 0)).not.toBe(null);
    expect(nightLine(14, 0)).toBe(null);
  });
});

describe("idleLine", () => {
  it("fires only once the player has been still a while", () => {
    expect(idleLine(10, 0)).toBe(null);
    expect(idleLine(60, 0)).not.toBe(null);
  });
});

describe("collectFlicker", () => {
  it("is silent before Stage 3", () => {
    expect(collectFlicker(2, 0)).toBe(null);
  });

  it("returns an alternate label from Stage 3 on", () => {
    expect(COLLECT_FLICKER[3]).toContain(collectFlicker(3, 0));
    expect(COLLECT_FLICKER[3]).toContain(collectFlicker(5, 1));
  });
});

describe("resetGreeting", () => {
  it("stays silent before Stage 3, with no resets, or nothing remembered", () => {
    expect(resetGreeting(2, 100000, 1)).toBe(null);
    expect(resetGreeting(3, 100000, 0)).toBe(null);
    expect(resetGreeting(3, 0, 1)).toBe(null);
  });

  it("remembers the peak flock after a wipe at Stage 3+", () => {
    expect(resetGreeting(3, 80000, 1)).toBe(
      "Welcome back. We waited. All 80k of us.",
    );
  });
});

describe("glitchArt", () => {
  const art = ["abc", "def", "ghi"].join("\n");

  it("leaves lines with offset 0 untouched", () => {
    expect(glitchArt(art, [0, 0, 0])).toBe(art);
  });

  it("indents lines with a positive offset", () => {
    expect(glitchArt(art, [0, 2, 0]).split("\n")[1]).toBe("  def");
  });

  it("pulls lines left with a negative offset, only eating spaces", () => {
    const indented = ["  ab", "cd"].join("\n");
    // line 0 has 2 leading spaces: -3 removes at most those 2, not the 'a'
    expect(glitchArt(indented, [-3, 0]).split("\n")[0]).toBe("ab");
  });

  it("tolerates a short/missing offsets array", () => {
    expect(glitchArt(art, [])).toBe(art);
  });
});
