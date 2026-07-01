import { describe, it, expect } from "vitest";
import { deriveStats, createArena, stepArena } from "../combat.js";

// Minimal single-enemy area for focused tests.
const area = (type, ex, ey, px, py) => ({
  id: "test",
  width: 9,
  height: 5,
  playerStart: { x: px, y: py },
  waves: [[{ type, x: ex, y: ey }]],
});

const strongStats = { maxHp: 100, attack: 50, defense: 0, moveCdMs: 120, attackCdMs: 200 };

describe("deriveStats", () => {
  it("uses base stats with no gear", () => {
    expect(deriveStats({})).toMatchObject({ maxHp: 20, attack: 2, defense: 0 });
  });

  it("applies weapon and armour", () => {
    const s = deriveStats({
      weapon: { attack: 4, attackCdMs: 420 },
      armour: { maxHp: 10, defense: 2 },
    });
    expect(s).toMatchObject({ maxHp: 30, attack: 4, defense: 2, attackCdMs: 420 });
  });
});

describe("createArena", () => {
  it("places the player and spawns the first wave", () => {
    const a = createArena(area("crab", 2, 2, 4, 3), strongStats);
    expect(a.player).toMatchObject({ x: 4, y: 3, hp: 100 });
    expect(a.enemies).toHaveLength(1);
    expect(a.status).toBe("fighting");
  });
});

describe("movement", () => {
  it("steps one tile in the pressed direction and sets facing", () => {
    const a = createArena(area("crab", 0, 0, 4, 3), strongStats);
    a.enemies = []; // ignore the enemy for a clean movement check
    const { arena } = stepArena(a, 200, { move: { dx: 1, dy: 0 } });
    expect(arena.player.x).toBe(5);
    expect(arena.player.facing).toEqual({ dx: 1, dy: 0 });
  });
});

describe("attacking", () => {
  it("damages the faced enemy and wins when the last one dies", () => {
    // Player at (4,3) facing up (default); sardine directly above at (4,2).
    let a = createArena(area("sardine", 4, 2, 4, 3), strongStats);
    let events = [];
    // One strong hit kills the sardine (hp 3).
    ({ arena: a, events } = stepArena(a, 250, { attack: true }));
    expect(events.some((e) => e.type === "death")).toBe(true);
    expect(events.some((e) => e.type === "win")).toBe(true);
    expect(a.status).toBe("won");
  });
});

describe("blocking", () => {
  it("negates damage from the faced direction", () => {
    // Sardine above the player; player faces up (default) and blocks.
    const a = createArena(area("sardine", 4, 2, 4, 3), strongStats);
    // Advance enough for the enemy's attack cooldown to elapse.
    const { arena, events } = stepArena(a, 800, { block: true });
    expect(arena.player.hp).toBe(arena.player.maxHp);
    expect(events.some((e) => e.type === "block")).toBe(true);
  });
});

describe("losing", () => {
  it("ends in a loss when the player's hp reaches 0", () => {
    const a = createArena(area("sardine", 4, 2, 4, 3), strongStats);
    a.player.hp = 1; // one nip finishes us
    const { arena, events } = stepArena(a, 800, {}); // no block
    expect(arena.status).toBe("lost");
    expect(events.some((e) => e.type === "lose")).toBe(true);
  });
});

describe("throwing tins", () => {
  it("consumes a tin and the projectile flies down-range into an enemy", () => {
    let a = createArena(area("sardine", 5, 3, 2, 3), strongStats, { tins: 1 });
    a.player.facing = { dx: 1, dy: 0 }; // face the enemy to the right

    // Frame 1: throw (edge). Then let the projectile travel.
    ({ arena: a } = stepArena(a, 45, { throw: true }));
    expect(a.used.tins).toBe(1);

    let hit = a.enemies.length === 0;
    for (let i = 0; i < 6 && !hit; i++) {
      ({ arena: a } = stepArena(a, 45, {}));
      hit = a.enemies.length === 0;
    }
    expect(hit).toBe(true); // 7 dmg tin killed the 3-hp sardine
  });

  it("reports when there are no tins to throw", () => {
    const a = createArena(area("crab", 0, 0, 4, 3), strongStats, { tins: 0 });
    const { events } = stepArena(a, 16, { throw: true });
    expect(events.some((e) => e.type === "noTins")).toBe(true);
  });
});

describe("enemy AI", () => {
  it("paths toward the player when not adjacent", () => {
    // Crab far to the left; player still. Crab should close the distance.
    let a = createArena(area("crab", 2, 2, 6, 2), strongStats);
    const startX = a.enemies[0].x;
    for (let i = 0; i < 3; i++) ({ arena: a } = stepArena(a, 600, {}));
    expect(a.enemies[0].x).toBeGreaterThan(startX);
  });
});
