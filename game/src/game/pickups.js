import { allocId, clampToArena } from "./world.js";
import { dist } from "../engine/utils.js";

export function spawnXpGem(world, x, y, value) {
  const tier = value >= 20 ? "large" : value >= 8 ? "medium" : "small";
  const pos = clampToArena(world, x, y);
  world.pickups.push({
    id: allocId(),
    active: true,
    kind: "xp",
    x: pos.x,
    y: pos.y,
    value,
    tier,
    radius: tier === "large" ? 9 : tier === "medium" ? 7 : 5,
    color: tier === "large" ? "#a78bfa" : tier === "medium" ? "#60a5fa" : "#7dd3fc",
    magnetized: false,
  });
}

export function spawnGold(world, x, y, value) {
  world.pickups.push({
    id: allocId(),
    active: true,
    kind: "gold",
    x,
    y,
    value,
    radius: 6,
    color: "#fbbf24",
    magnetized: false,
  });
}

export function spawnHealth(world, x, y, amount) {
  world.pickups.push({
    id: allocId(),
    active: true,
    kind: "health",
    x,
    y,
    value: amount,
    radius: 8,
    color: "#4ade80",
    magnetized: false,
  });
}

export function spawnChest(world, x, y) {
  world.pickups.push({
    id: allocId(),
    active: true,
    kind: "chest",
    x,
    y,
    radius: 12,
    color: "#fbbf24",
    magnetized: false,
  });
}

export function spawnOverdrive(world, x, y) {
  world.pickups.push({
    id: allocId(),
    active: true,
    kind: "overdrive",
    x,
    y,
    radius: 10,
    color: "#f97316",
    magnetized: false,
  });
}

export function updatePickup(p, world, dt, player, pickupRadius) {
  const d = dist(p.x, p.y, player.x, player.y);
  if (d < pickupRadius && p.kind !== "chest") {
    p.magnetized = true;
  }
  if (p.magnetized) {
    const speed = Math.max(260, 900 - d * 2);
    const dx = (player.x - p.x) / (d || 1);
    const dy = (player.y - p.y) / (d || 1);
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
  }
}
