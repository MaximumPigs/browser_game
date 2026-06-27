import { describe, it, expect } from "vitest";
import { newGame, click, tick, migrate, SAVE_VERSION } from "../state.js";

describe("newGame", () => {
  it("starts with zero points and the current save version", () => {
    const state = newGame();
    expect(state.points).toBe(0);
    expect(state.version).toBe(SAVE_VERSION);
  });
});

describe("click", () => {
  it("adds perClick points without mutating the input", () => {
    const state = newGame();
    const next = click(state);
    expect(next.points).toBe(1);
    expect(state.points).toBe(0); // original untouched
  });
});

describe("tick", () => {
  it("adds perSecond * seconds points", () => {
    const state = { ...newGame(), perSecond: 5 };
    expect(tick(state, 3).points).toBe(15);
  });
});

describe("migrate", () => {
  it("fills in missing fields and stamps the current version", () => {
    const old = { points: 42 }; // a save from before perSecond existed
    const migrated = migrate(old);
    expect(migrated.points).toBe(42);
    expect(migrated.perSecond).toBe(0);
    expect(migrated.version).toBe(SAVE_VERSION);
  });
});
