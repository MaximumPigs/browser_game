import { describe, it, expect } from "vitest";
import {
  newGame,
  tick,
  fishPerSec,
  canFish,
  eatAllFish,
  buyItem,
  triggerDiscovery,
  applyReward,
  afterCombat,
  migrate,
  SAVE_VERSION,
} from "../state.js";

const withFlags = (extra) => ({ ...newGame(), flags: { ...newGame().flags, ...extra } });

describe("newGame", () => {
  it("starts empty at the current version with no discoveries", () => {
    const s = newGame();
    expect(s.fish).toBe(0);
    expect(s.tins).toBe(0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.discovered).toEqual({});
    expect(s.found).toEqual([]);
  });
});

describe("tick", () => {
  it("accrues fish at the base rate (no threshold reveals)", () => {
    const next = tick(newGame(), 30);
    expect(next.fish).toBe(30);
    // Reveals are discovery-driven now, never flipped by tick.
    expect(next.flags.shopRevealed).toBe(false);
    expect(next.flags.eatRevealed).toBe(false);
  });

  it("auto-cans fish into tins once the Cannery + a canner exist", () => {
    const s = { ...withFlags({ canneryUnlocked: true }), fish: 100, autoCanRate: 1 };
    const next = tick(s, 1);
    expect(next.tins).toBeCloseTo(1);
    expect(next.fish).toBeCloseTo(91);
  });
});

describe("fishPerSec", () => {
  it("includes shop bonuses", () => {
    expect(fishPerSec({ ...newGame(), fishRateBonus: 0.5 })).toBe(1.5);
  });
});

describe("canFish", () => {
  it("is a no-op until the Cannery is unlocked", () => {
    const s = { ...newGame(), fish: 50 };
    expect(canFish(s)).toBe(s);
  });

  it("spends 10 fish for 1 tin", () => {
    const s = { ...withFlags({ canneryUnlocked: true }), fish: 25 };
    const next = canFish(s);
    expect(next.fish).toBe(15);
    expect(next.tins).toBe(1);
  });
});

describe("eatAllFish", () => {
  it("empties the bucket and counts the shame", () => {
    const next = eatAllFish({ ...newGame(), fish: 42 });
    expect(next.fish).toBe(0);
    expect(next.stats.eats).toBe(1);
  });
});

describe("buyItem", () => {
  it("refuses when unaffordable and leaves state untouched", () => {
    const s = newGame();
    expect(buyItem(s, "bait")).toBe(s);
  });

  it("applies a fish-rate item and deducts its cost", () => {
    const next = buyItem({ ...newGame(), fish: 20 }, "bait");
    expect(next.fish).toBe(5);
    expect(next.fishRateBonus).toBe(0.5);
    expect(next.bought.bait).toBe(1);
  });

  it("equips a weapon (which the pier clue keys off of)", () => {
    const next = buyItem({ ...newGame(), fish: 40 }, "harpoon");
    expect(next.weapon.id).toBe("harpoon");
    expect(next.bought.harpoon).toBe(true);
  });

  it("will not sell a once-item twice", () => {
    const once = buyItem({ ...newGame(), fish: 200 }, "harpoon");
    expect(buyItem(once, "harpoon")).toBe(once);
  });

  it("hides flag-gated items until the flag is set", () => {
    const locked = { ...newGame(), fish: 300 };
    expect(buyItem(locked, "autocanner")).toBe(locked);
    const unlocked = { ...withFlags({ canneryUnlocked: true }), fish: 300 };
    expect(buyItem(unlocked, "autocanner").autoCanRate).toBe(1);
  });
});

describe("triggerDiscovery", () => {
  it("flips the discovery's flags and records it (idempotently)", () => {
    const once = triggerDiscovery(newGame(), "market");
    expect(once.flags.shopRevealed).toBe(true);
    expect(once.discovered.market).toBe(true);
    // Second trigger is a no-op (same reference).
    expect(triggerDiscovery(once, "market")).toBe(once);
  });

  it("the pier discovery unlocks the adventure", () => {
    expect(triggerDiscovery(newGame(), "thePier").flags.adventureUnlocked).toBe(true);
  });

  it("ignores unknown ids", () => {
    const s = newGame();
    expect(triggerDiscovery(s, "nope")).toBe(s);
  });
});

describe("applyReward", () => {
  it("grants fish, sets flags, and records a found object", () => {
    const next = applyReward(newGame(), {
      fish: 150,
      unlockFlag: "canneryUnlocked",
      clearsFlag: "docksCleared",
      found: "deed",
    });
    expect(next.fish).toBe(150);
    expect(next.flags.canneryUnlocked).toBe(true);
    expect(next.flags.docksCleared).toBe(true);
    expect(next.found).toContain("deed");
  });
});

describe("afterCombat", () => {
  it("deducts tins thrown and tonics drunk, never below zero", () => {
    const s = { ...newGame(), tins: 5, inv: { tonic: 2 } };
    const next = afterCombat(s, { tinsUsed: 2, tonicsUsed: 3 });
    expect(next.tins).toBe(3);
    expect(next.inv.tonic).toBe(0);
  });
});

describe("migrate", () => {
  it("fills missing fields (incl. discovery state) and stamps the version", () => {
    const m = migrate({ fish: 7 });
    expect(m.fish).toBe(7);
    expect(m.discovered).toEqual({});
    expect(m.found).toEqual([]);
    expect(m.version).toBe(SAVE_VERSION);
  });
});
