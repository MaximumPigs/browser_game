import { describe, it, expect } from "vitest";
import {
  newGame,
  click,
  tick,
  buy,
  costOf,
  canAfford,
  perClick,
  perSecond,
  migrate,
  SAVE_VERSION,
} from "../state.js";

describe("newGame", () => {
  it("starts with zero chickens and the current save version", () => {
    const state = newGame();
    expect(state.chickens).toBe(0);
    expect(state.version).toBe(SAVE_VERSION);
  });

  it("starts with every upgrade owned zero times", () => {
    const state = newGame();
    expect(Object.values(state.upgrades).every((n) => n === 0)).toBe(true);
  });

  it("starts with zero lifetime chickens", () => {
    expect(newGame().lifetime).toBe(0);
  });
});

describe("perClick / perSecond", () => {
  it("collects 1 chicken per click by default", () => {
    expect(perClick(newGame())).toBe(1);
  });

  it("has no passive income by default", () => {
    expect(perSecond(newGame())).toBe(0);
  });

  it("reflects owned upgrades", () => {
    const state = { ...newGame(), upgrades: { ...newGame().upgrades, feed: 2, coop: 3 } };
    expect(perClick(state)).toBe(1 + 2); // base + 2 feed
    expect(perSecond(state)).toBe(3); // 3 coops
  });
});

describe("click", () => {
  it("adds perClick chickens without mutating the input", () => {
    const state = newGame();
    const next = click(state);
    expect(next.chickens).toBe(1);
    expect(state.chickens).toBe(0); // original untouched
  });

  it("also accrues lifetime chickens", () => {
    const next = click(newGame());
    expect(next.lifetime).toBe(1);
  });
});

describe("tick", () => {
  it("adds perSecond * seconds chickens", () => {
    const state = { ...newGame(), upgrades: { ...newGame().upgrades, coop: 5 } };
    expect(tick(state, 3).chickens).toBe(15); // 5/sec * 3s
  });

  it("also accrues lifetime chickens", () => {
    const state = { ...newGame(), upgrades: { ...newGame().upgrades, coop: 5 } };
    expect(tick(state, 3).lifetime).toBe(15);
  });
});

describe("costOf", () => {
  it("returns the base cost when none are owned", () => {
    expect(costOf(newGame(), "feed")).toBe(10);
  });

  it("grows with the number owned", () => {
    const state = { ...newGame(), upgrades: { ...newGame().upgrades, feed: 1 } };
    expect(costOf(state, "feed")).toBe(11); // floor(10 * 1.15)
  });
});

describe("canAfford / buy", () => {
  it("cannot afford or buy without enough chickens", () => {
    const state = newGame();
    expect(canAfford(state, "feed")).toBe(false);
    expect(buy(state, "feed")).toBe(state); // unchanged
  });

  it("buys an upgrade, deducting cost and incrementing the count", () => {
    const state = { ...newGame(), chickens: 50 };
    const next = buy(state, "feed");
    expect(next.chickens).toBe(40); // 50 - 10
    expect(next.upgrades.feed).toBe(1);
  });

  it("ignores unknown upgrade ids", () => {
    const state = { ...newGame(), chickens: 9999 };
    expect(buy(state, "nope")).toBe(state);
  });
});

describe("migrate", () => {
  it("fills in missing upgrades and stamps the current version", () => {
    const old = { chickens: 42 };
    const migrated = migrate(old);
    expect(migrated.chickens).toBe(42);
    expect(migrated.upgrades.coop).toBe(0);
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it("seeds lifetime from current chickens when absent", () => {
    expect(migrate({ chickens: 42 }).lifetime).toBe(42);
    expect(migrate({ chickens: 5, lifetime: 900 }).lifetime).toBe(900);
  });

  it("carries v1 `points` over to `chickens`", () => {
    const v1 = { version: 1, points: 7, perClick: 1, perSecond: 0 };
    expect(migrate(v1).chickens).toBe(7);
  });
});
