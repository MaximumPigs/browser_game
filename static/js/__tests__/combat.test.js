import { describe, it, expect } from "vitest";
import { deriveStats, createArena, stepArena, arenaCells } from "../combat.js";

// Minimal single-enemy area for focused tests.
const area = (type, ex, ey, px, py) => ({
  id: "test",
  width: 9,
  height: 5,
  playerStart: { x: px, y: py },
  waves: [[{ type, x: ex, y: ey }]],
});

const strongStats = { maxHp: 100, attack: 50, defense: 0, moveCdMs: 120, attackCdMs: 200 };

// A sardine directly above a player at (4,3): attackCdMs 650, windupMs 400.
const sardineAbove = () => createArena(area("sardine", 4, 2, 4, 3), strongStats);

describe("deriveStats", () => {
  it("uses base stats with no gear", () => {
    expect(deriveStats({})).toMatchObject({ maxHp: 20, attack: 2, defense: 0 });
  });
  it("applies weapon and armour", () => {
    const s = deriveStats({ weapon: { attack: 4, attackCdMs: 420 }, armour: { maxHp: 10, defense: 2 } });
    expect(s).toMatchObject({ maxHp: 30, attack: 4, defense: 2, attackCdMs: 420 });
  });
});

describe("player attack", () => {
  it("emits a swing, damages the faced enemy, and wins on the last kill", () => {
    let { arena, events } = stepArena(sardineAbove(), 250, { attack: true });
    expect(events.some((e) => e.type === "strike")).toBe(true);
    expect(events.some((e) => e.type === "death")).toBe(true);
    expect(events.some((e) => e.type === "win")).toBe(true);
    expect(arena.status).toBe("won");
  });
});

describe("enemy telegraph (wind-up)", () => {
  it("winds up before dealing any damage", () => {
    const { arena, events } = stepArena(sardineAbove(), 700, {});
    expect(events.some((e) => e.type === "windup")).toBe(true);
    expect(events.some((e) => e.type === "hit" && e.target === "player")).toBe(false);
    expect(arena.player.hp).toBe(arena.player.maxHp); // no damage yet
  });

  it("blocking through the telegraph negates the strike", () => {
    let a = sardineAbove();
    ({ arena: a } = stepArena(a, 700, { block: true })); // start wind-up
    const { arena, events } = stepArena(a, 450, { block: true }); // resolve
    expect(events.some((e) => e.type === "blocked")).toBe(true);
    expect(arena.player.hp).toBe(arena.player.maxHp);
  });

  it("stepping off the telegraphed tile dodges the strike", () => {
    let a = sardineAbove();
    ({ arena: a } = stepArena(a, 700, {})); // start wind-up (targets 4,3)
    const { arena, events } = stepArena(a, 450, { move: { dx: 1, dy: 0 } }); // step away, then it resolves
    expect(events.some((e) => e.type === "miss")).toBe(true);
    expect(arena.player.hp).toBe(arena.player.maxHp);
    expect(arena.player.x).toBe(5);
  });

  it("connects for damage if you neither block nor dodge", () => {
    let a = sardineAbove();
    a.player.hp = 1; // one nip finishes us
    ({ arena: a } = stepArena(a, 700, {})); // wind-up
    const { arena, events } = stepArena(a, 450, {}); // resolve → hit
    expect(events.some((e) => e.type === "hit" && e.target === "player")).toBe(true);
    expect(arena.status).toBe("lost");
  });
});

describe("throwing tins", () => {
  it("consumes a tin and the projectile flies into an enemy", () => {
    let a = createArena(area("sardine", 5, 3, 2, 3), strongStats, { tins: 1 });
    a.player.facing = { dx: 1, dy: 0 };
    ({ arena: a } = stepArena(a, 45, { throw: true }));
    expect(a.used.tins).toBe(1);
    let cleared = a.enemies.length === 0;
    for (let i = 0; i < 6 && !cleared; i++) {
      ({ arena: a } = stepArena(a, 45, {}));
      cleared = a.enemies.length === 0;
    }
    expect(cleared).toBe(true);
  });
});

describe("enemy AI", () => {
  it("paths toward the player when not adjacent", () => {
    let a = createArena(area("crab", 2, 2, 6, 2), strongStats);
    const startX = a.enemies[0].x;
    for (let i = 0; i < 3; i++) ({ arena: a } = stepArena(a, 600, {}));
    expect(a.enemies[0].x).toBeGreaterThan(startX);
  });
});

describe("arenaCells (render source)", () => {
  it("marks the player with a directional glyph and highlights the aim tile", () => {
    const a = createArena(area("crab", 1, 1, 4, 3), strongStats); // enemy out of the way
    const grid = arenaCells(a);
    expect(grid[3][4]).toMatchObject({ kind: "player", glyph: "▲" }); // facing up
    expect(grid[2][4].aim).toBe(true); // faced tile

    const moved = stepArena(a, 200, { move: { dx: 1, dy: 0 } }).arena;
    expect(arenaCells(moved)[3][5].glyph).toBe("▶"); // now facing right
  });

  it("marks the telegraphed tile during an enemy wind-up", () => {
    const { arena } = stepArena(sardineAbove(), 700, {});
    expect(arenaCells(arena)[3][4].telegraph).toBe(true); // the player's tile is targeted
  });
});
