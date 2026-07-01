// Pure, deterministic real-time arena engine. No DOM/timing/global RNG — the
// caller passes elapsed ms and an input snapshot; randomness comes from a seed
// carried in the arena.
//
// Legibility model: attacks are TELEGRAPHED. An enemy that commits to a strike
// enters a `windup` (its target tile pulses) before the hit lands — giving the
// player a visible window to block (face it) or dodge (step off the tile). The
// player's own attack emits a `strike` event so the UI can animate a swing.

import { CONFIG, ENEMIES, PLAYER_BASE } from "./content.js";

const DEFAULT_WINDUP_MS = 420;

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Player combat stats from equipped gear ({ weapon, armour }). */
export function deriveStats(gear = {}) {
  const b = PLAYER_BASE;
  const w = gear.weapon;
  const a = gear.armour;
  return {
    maxHp: b.maxHp + (a?.maxHp || 0),
    attack: w ? w.attack : b.attack,
    defense: b.defense + (a?.defense || 0),
    moveCdMs: b.moveCdMs,
    attackCdMs: w ? w.attackCdMs : b.attackCdMs,
  };
}

/** Build the initial arena for an area, given player stats + combat resources. */
export function createArena(areaDef, stats, resources = {}, seed = 1) {
  const arena = {
    width: areaDef.width,
    height: areaDef.height,
    areaId: areaDef.id,
    waves: areaDef.waves,
    waveIndex: 0,
    player: {
      x: areaDef.playerStart.x,
      y: areaDef.playerStart.y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      defense: stats.defense,
      moveCdMs: stats.moveCdMs,
      attackCdMs: stats.attackCdMs,
      facing: { dx: 0, dy: -1 },
      moveCd: 0,
      attackCd: 0,
      blocking: false,
    },
    enemies: [],
    projectiles: [],
    resources: { tins: resources.tins || 0, tonics: resources.tonics || 0 },
    used: { tins: 0, tonics: 0 },
    status: "fighting",
    rngState: (seed >>> 0) || 1,
    nextId: 1,
  };
  spawnWave(arena, 0);
  return arena;
}

function spawnWave(arena, index) {
  for (const spec of arena.waves[index] || []) {
    const def = ENEMIES[spec.type];
    arena.enemies.push({
      id: arena.nextId++,
      type: spec.type,
      name: def.name,
      glyph: def.glyph,
      x: spec.x,
      y: spec.y,
      hp: def.hp,
      maxHp: def.hp,
      attack: def.attack,
      defense: def.defense,
      moveCdMs: def.moveCdMs,
      attackCdMs: def.attackCdMs,
      windupMs: def.windupMs || DEFAULT_WINDUP_MS,
      erratic: !!def.erratic,
      facing: { dx: 0, dy: 1 },
      moveCd: def.moveCdMs,
      attackCd: def.attackCdMs,
      windup: null, // { ms, target:{x,y} } while telegraphing a strike
    });
  }
}

function rand(arena) {
  arena.rngState = (Math.imul(arena.rngState, 1664525) + 1013904223) >>> 0;
  return arena.rngState / 4294967296;
}

const isWallTile = (a, x, y) =>
  x <= 0 || y <= 0 || x >= a.width - 1 || y >= a.height - 1;
const enemyAt = (a, x, y) => a.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
const isAdjacent = (e, p) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1;

function cloneArena(a) {
  return {
    ...a,
    player: { ...a.player, facing: { ...a.player.facing } },
    enemies: a.enemies.map((e) => ({
      ...e,
      facing: { ...e.facing },
      windup: e.windup ? { ...e.windup, target: { ...e.windup.target } } : null,
    })),
    projectiles: a.projectiles.map((pr) => ({ ...pr })),
    resources: { ...a.resources },
    used: { ...a.used },
  };
}

function cardinal(m) {
  const dx = m.dx || 0;
  const dy = m.dy || 0;
  // Restrict to 4 directions; on diagonal input prefer horizontal.
  if (dx && dy) return { dx: sign(dx), dy: 0 };
  return { dx: sign(dx), dy: sign(dy) };
}

// Damage the player takes from enemy `e`, accounting for a directional block.
function incomingDamage(arena, e) {
  const p = arena.player;
  const base = Math.max(1, e.attack - p.defense);
  if (!p.blocking) return base;
  const towardEnemy = { dx: sign(e.x - p.x), dy: sign(e.y - p.y) };
  if (towardEnemy.dx === p.facing.dx && towardEnemy.dy === p.facing.dy) return 0; // perfect
  return Math.ceil(base / 2); // braced, but hit from the side/back
}

function tryThrow(arena, events) {
  const p = arena.player;
  if (arena.resources.tins - arena.used.tins <= 0) {
    events.push({ type: "noTins" });
    return;
  }
  arena.used.tins += 1;
  arena.projectiles.push({
    x: p.x + p.facing.dx,
    y: p.y + p.facing.dy,
    dx: p.facing.dx,
    dy: p.facing.dy,
    damage: CONFIG.throwTinDamage,
    stepMs: 45,
    moveCd: 45,
    alive: true,
  });
  events.push({ type: "throw" });
}

function tryTonic(arena, events) {
  const p = arena.player;
  if (arena.resources.tonics - arena.used.tonics <= 0 || p.hp >= p.maxHp) return;
  arena.used.tonics += 1;
  p.hp = Math.min(p.maxHp, p.hp + CONFIG.tonicHeal);
  events.push({ type: "heal" });
}

function stepProjectiles(arena, dtMs, events) {
  for (const pr of arena.projectiles) {
    pr.moveCd -= dtMs;
    while (pr.alive && pr.moveCd <= 0) {
      if (isWallTile(arena, pr.x, pr.y)) {
        pr.alive = false;
        break;
      }
      const foe = enemyAt(arena, pr.x, pr.y);
      if (foe) {
        foe.hp -= pr.damage;
        events.push({ type: "hit", target: "enemy", name: foe.name, dmg: pr.damage, x: foe.x, y: foe.y });
        if (foe.hp <= 0) events.push({ type: "death", name: foe.name, x: foe.x, y: foe.y });
        pr.alive = false;
        break;
      }
      pr.x += pr.dx;
      pr.y += pr.dy;
      pr.moveCd += pr.stepMs;
    }
  }
  arena.projectiles = arena.projectiles.filter((pr) => pr.alive);
}

function stepEnemyToward(arena, e) {
  const p = arena.player;
  const dx = sign(p.x - e.x);
  const dy = sign(p.y - e.y);
  let candidates;
  if (e.erratic && rand(arena) < 0.4) {
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    candidates = [dirs[Math.floor(rand(arena) * 4)]];
  } else if (Math.abs(p.x - e.x) >= Math.abs(p.y - e.y)) {
    candidates = [{ dx, dy: 0 }, { dx: 0, dy }];
  } else {
    candidates = [{ dx: 0, dy }, { dx, dy: 0 }];
  }
  for (const c of candidates) {
    if (!c.dx && !c.dy) continue;
    const nx = e.x + c.dx;
    const ny = e.y + c.dy;
    if (isWallTile(arena, nx, ny)) continue;
    if (nx === p.x && ny === p.y) continue; // don't step onto the player
    if (enemyAt(arena, nx, ny)) continue;
    e.x = nx;
    e.y = ny;
    e.facing = { dx: c.dx, dy: c.dy };
    return;
  }
}

// One enemy's turn: resolve a telegraphed strike, start a new telegraph, or move.
function stepEnemy(arena, e, dtMs, events) {
  const p = arena.player;
  e.moveCd = Math.max(0, e.moveCd - dtMs);
  e.attackCd = Math.max(0, e.attackCd - dtMs);

  if (e.windup) {
    e.windup.ms -= dtMs;
    if (e.windup.ms <= 0) {
      const t = e.windup.target;
      if (p.x === t.x && p.y === t.y) {
        const dmg = incomingDamage(arena, e);
        if (dmg > 0) {
          p.hp -= dmg;
          events.push({ type: "hit", target: "player", name: e.name, dmg, x: p.x, y: p.y });
        } else {
          events.push({ type: "blocked", name: e.name });
        }
      } else {
        events.push({ type: "miss", name: e.name }); // player dodged the telegraph
      }
      e.attackCd = e.attackCdMs;
      e.windup = null;
    }
    return; // no moving while winding up
  }

  if (isAdjacent(e, p)) {
    if (e.attackCd <= 0) {
      e.facing = { dx: sign(p.x - e.x), dy: sign(p.y - e.y) };
      e.windup = { ms: e.windupMs, target: { x: p.x, y: p.y } };
      events.push({ type: "windup", name: e.name, x: p.x, y: p.y });
    }
  } else if (e.moveCd <= 0) {
    stepEnemyToward(arena, e);
    e.moveCd = e.moveCdMs;
  }
}

/**
 * Advance the arena by `dtMs`, applying the input snapshot:
 *   { move:{dx,dy}|null, attack:bool(held), block:bool(held),
 *     throw:bool(edge), tonic:bool(edge) }
 * Returns { arena: nextArena, events: [...] }. Pure — the input arena is not
 * mutated.
 */
export function stepArena(prev, dtMs, input = {}) {
  if (prev.status !== "fighting") return { arena: prev, events: [] };
  const arena = cloneArena(prev);
  const events = [];
  const p = arena.player;

  p.moveCd = Math.max(0, p.moveCd - dtMs);
  p.attackCd = Math.max(0, p.attackCd - dtMs);
  p.blocking = !!input.block;

  // Consumables work even while braced.
  if (input.throw) tryThrow(arena, events);
  if (input.tonic) tryTonic(arena, events);

  if (!p.blocking) {
    if (input.move && (input.move.dx || input.move.dy) && p.moveCd <= 0) {
      const dir = cardinal(input.move);
      p.facing = dir;
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;
      if (!isWallTile(arena, nx, ny) && !enemyAt(arena, nx, ny)) {
        p.x = nx;
        p.y = ny;
      }
      p.moveCd = p.moveCdMs;
    }
    if (input.attack && p.attackCd <= 0) {
      const tx = p.x + p.facing.dx;
      const ty = p.y + p.facing.dy;
      events.push({ type: "strike", x: tx, y: ty }); // swing animation
      const foe = enemyAt(arena, tx, ty);
      if (foe) {
        const dmg = Math.max(1, p.attack - foe.defense);
        foe.hp -= dmg;
        events.push({ type: "hit", target: "enemy", name: foe.name, dmg, x: tx, y: ty });
        if (foe.hp <= 0) events.push({ type: "death", name: foe.name, x: tx, y: ty });
      }
      p.attackCd = p.attackCdMs;
    }
  }

  stepProjectiles(arena, dtMs, events);
  arena.enemies = arena.enemies.filter((e) => e.hp > 0);

  for (const e of arena.enemies) stepEnemy(arena, e, dtMs, events);
  arena.enemies = arena.enemies.filter((e) => e.hp > 0);

  if (p.hp <= 0) {
    p.hp = 0;
    arena.status = "lost";
    events.push({ type: "lose" });
  } else if (arena.enemies.length === 0) {
    if (arena.waveIndex < arena.waves.length - 1) {
      arena.waveIndex += 1;
      spawnWave(arena, arena.waveIndex);
      events.push({ type: "wave", index: arena.waveIndex });
    } else {
      arena.status = "won";
      events.push({ type: "win" });
    }
  }

  return { arena, events };
}

// --- Rendering source (pure) ------------------------------------------------

const FACING_GLYPH = (f) =>
  f.dy < 0 ? "▲" : f.dy > 0 ? "▼" : f.dx < 0 ? "◀" : "▶"; // ▲▼◀▶

/**
 * Pure render source: a 2D grid of cell descriptors the UI turns into styled
 * elements. Each cell: { glyph, kind, aim?, telegraph?, blocking?, winding? }.
 * kind ∈ wall | floor | player | enemy | tin.
 */
export function arenaCells(arena) {
  const grid = [];
  for (let y = 0; y < arena.height; y++) {
    const row = [];
    for (let x = 0; x < arena.width; x++) {
      row.push(isWallTile(arena, x, y) ? { glyph: "#", kind: "wall" } : { glyph: " ", kind: "floor" });
    }
    grid.push(row);
  }

  const p = arena.player;
  const at = (x, y) => (grid[y] && grid[y][x] ? grid[y][x] : null);

  // Aim highlight on the player's faced tile.
  const aim = at(p.x + p.facing.dx, p.y + p.facing.dy);
  if (aim) aim.aim = true;

  // Enemy telegraphs.
  for (const e of arena.enemies) {
    if (e.windup) {
      const t = at(e.windup.target.x, e.windup.target.y);
      if (t) t.telegraph = true;
    }
  }

  for (const pr of arena.projectiles) {
    const c = at(pr.x, pr.y);
    if (c) {
      c.glyph = "o";
      c.kind = "tin";
    }
  }
  for (const e of arena.enemies) {
    const c = at(e.x, e.y);
    if (c) {
      c.glyph = e.glyph;
      c.kind = "enemy";
      c.winding = !!e.windup;
    }
  }
  const pc = at(p.x, p.y);
  if (pc) {
    pc.glyph = FACING_GLYPH(p.facing);
    pc.kind = "player";
    pc.blocking = p.blocking;
  }
  return grid;
}

/** Plain-text render (back-compat / debugging), built from arenaCells. */
export function renderArena(arena) {
  return arenaCells(arena)
    .map((row) => row.map((c) => c.glyph).join(""))
    .join("\n");
}
