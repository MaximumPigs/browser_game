import { describe, it, expect, beforeEach } from "vitest";
import { save, load, clear, loadMemory, saveMemory } from "../save.js";

// Minimal in-memory localStorage so the browser-facing save layer can be tested
// under Vitest's node environment.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

describe("save/load", () => {
  it("round-trips a game and starts fresh after clear", () => {
    save({ version: 3, chickens: 5, lifetime: 5, upgrades: {} });
    expect(load().chickens).toBe(5);
    clear();
    expect(load().chickens).toBe(0); // newGame
  });
});

describe("memory", () => {
  it("defaults to a blank record", () => {
    expect(loadMemory()).toEqual({ peakLifetime: 0, resets: 0 });
  });

  it("round-trips and fills missing fields", () => {
    saveMemory({ peakLifetime: 1234 });
    expect(loadMemory()).toEqual({ peakLifetime: 1234, resets: 0 });
  });

  it("SURVIVES clear() — the farm remembers after a wipe", () => {
    save({ version: 3, chickens: 9, lifetime: 9, upgrades: {} });
    saveMemory({ peakLifetime: 80000, resets: 2 });

    clear();

    expect(load().chickens).toBe(0); // save gone
    expect(loadMemory()).toEqual({ peakLifetime: 80000, resets: 2 }); // memory stays
  });
});
