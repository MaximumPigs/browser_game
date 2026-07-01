import { describe, it, expect } from "vitest";
import {
  newGame,
  tick,
  fishPerSec,
  canFish,
  eatAllFish,
  buyItem,
  walkPier,
  applyReward,
  afterCombat,
  migrate,
  SAVE_VERSION,
} from "../state.js";

const withFlags = (extra) => ({ ...newGame(), flags: { ...newGame().flags, ...extra } });

describe("newGame", () => {
  it("starts empty at the current version", () => {
    const s = newGame();
    expect(s.fish).toBe(0);
    expect(s.tins).toBe(0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.flags.canneryUnlocked).toBe(false);
  });
});

describe("tick", () => {
  it("accrues fish at the base rate", () => {
    expect(tick(newGame(), 5).fish).toBe(5);
  });

  it("reveals the joke button at 10 fish and the shop at 30", () => {
    expect(tick(newGame(), 10).flags.eatRevealed).toBe(true);
    expect(tick(newGame(), 10).flags.shopRevealed).toBe(false);
    expect(tick(newGame(), 30).flags.shopRevealed).toBe(true);
  });

  it("auto-cans fish into tins once the Cannery + a canner exist", () => {
    const s = { ...withFlags({ canneryUnlocked: true }), fish: 100, autoCanRate: 1 };
    const next = tick(s, 1);
    // +1 fish accrued, then 1 can: -10 fish, +1 tin.
    expect(next.tins).toBeCloseTo(1);
    expect(next.fish).toBeCloseTo(91);
  });
});

describe("fishPerSec", () => {
  it("includes shop bonuses", () => {
    const s = { ...newGame(), fishRateBonus: 0.5 };
    expect(fishPerSec(s)).toBe(1.5);
  });
});

describe("canFish", () => {
  it("is a no-op until the Cannery is unlocked", () => {
    const s = { ...newGame(), fish: 50 };
    expect(canFish(s)).toBe(s);
  });

  it("needs at least 10 fish", () => {
    const s = { ...withFlags({ canneryUnlocked: true }), fish: 5 };
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
    const s = { ...newGame(), fish: 20 };
    const next = buyItem(s, "bait");
    expect(next.fish).toBe(5); // 20 - 15
    expect(next.fishRateBonus).toBe(0.5);
    expect(next.bought.bait).toBe(1);
  });

  it("equipping the first weapon triggers the pier story beat", () => {
    const s = { ...newGame(), fish: 40 };
    const next = buyItem(s, "harpoon");
    expect(next.weapon.id).toBe("harpoon");
    expect(next.flags.pierPrompt).toBe(true);
    expect(next.bought.harpoon).toBe(true);
  });

  it("will not sell a once-item twice", () => {
    const s = { ...newGame(), fish: 200 };
    const once = buyItem(s, "harpoon");
    expect(buyItem(once, "harpoon")).toBe(once);
  });

  it("hides flag-gated items until the flag is set", () => {
    const locked = { ...newGame(), fish: 300 };
    expect(buyItem(locked, "autocanner")).toBe(locked);
    const unlocked = { ...withFlags({ canneryUnlocked: true }), fish: 300 };
    expect(buyItem(unlocked, "autocanner").autoCanRate).toBe(1);
  });
});

describe("walkPier", () => {
  it("needs the pier prompt first, then unlocks the adventure", () => {
    expect(walkPier(newGame())).toEqual(newGame());
    const primed = withFlags({ pierPrompt: true });
    expect(walkPier(primed).flags.adventureUnlocked).toBe(true);
  });
});

describe("applyReward", () => {
  it("grants fish and sets unlock/clear flags", () => {
    const next = applyReward(newGame(), {
      fish: 150,
      unlockFlag: "canneryUnlocked",
      clearsFlag: "docksCleared",
    });
    expect(next.fish).toBe(150);
    expect(next.flags.canneryUnlocked).toBe(true);
    expect(next.flags.docksCleared).toBe(true);
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
  it("fills missing fields and stamps the version", () => {
    const m = migrate({ fish: 7 });
    expect(m.fish).toBe(7);
    expect(m.tins).toBe(0);
    expect(m.flags.canneryUnlocked).toBe(false);
    expect(m.version).toBe(SAVE_VERSION);
  });
});
