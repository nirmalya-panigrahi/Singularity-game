import { GameState, LevelData, ProbeState, GameObject, Vector2D, Epoch } from '../types';
import { soundFX } from './sound';

// Deterministic PRNG (Park-Miller LCG)
export function createPRNG(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Constants
export const PHYSICS_WIDTH = 1600;
export const PHYSICS_HEIGHT = 900;
export const G = 8;
const TRAJECTORY_POINTS = 100;
const SWITCH_COOLDOWN_TIME = 2.0;
const SOFTENING_RADIUS = 20;
const MAX_VELOCITY_STEP = 25;
const GOAL_RADIUS = 48;

export class GameEngine {
  gameState: GameState;
  probe: ProbeState;
  levelData: LevelData;
  timeScale: number = 1.0;
  lastDt: number = 1.0;
  simTime: number = 0;
  lastTeleportSimTime: number = -10;
  collided: boolean = false;

  // Trajectory preview cache
  private cachedTrajectoryVelocity: Vector2D = { x: 0, y: 0 };
  private cachedTrajectoryWave: boolean = false;
  private cachedTrajectoryPos: Vector2D = { x: -1, y: -1 };
  private cachedTrajectory: Vector2D[] = [];

  constructor(level: number = 1) {
    this.gameState = {
      level,
      epoch: this.getEpochForLevel(level),
      integrity: 100,
      status: 'preview',
      score: 0,
      stardust: 0,
      requiredStardust: 15 + level * 5,
      optimumScore: 0,
      timeScale: 1.0,
      heat: 0,
      switchCooldown: 0,
      goalCollected: false,
      launches: 0,
      fragmentsCollected: 0,
      totalFragments: 0,
      levelStartTime: Date.now(),
      sessionTimeLeft: 60,
    };

    this.levelData = this.generateLevel(level);
    this.probe = {
      pos: { ...this.levelData.startPos },
      prevPos: { ...this.levelData.startPos },
      radius: 8,
      isWaveState: false,
      launched: false,
    };
  }

  getEpochForLevel(level: number): Epoch {
    if (level <= 10) return 'Classical';
    if (level <= 20) return 'Quantum';
    if (level <= 30) return 'Relativity';
    return 'Thermal';
  }

  private isTooCloseToList(pos: Vector2D, minDist: number, list: { pos: Vector2D; radius?: number }[]): boolean {
    for (const item of list) {
      const r = item.radius || 0;
      const dx = pos.x - item.pos.x;
      const dy = pos.y - item.pos.y;
      if (dx * dx + dy * dy < (minDist + r) * (minDist + r)) {
        return true;
      }
    }
    return false;
  }

  generateLevel(level: number): LevelData {
    const epoch = this.getEpochForLevel(level);
    const startPos = { x: 90, y: PHYSICS_HEIGHT / 2 };

    // Try deterministic seed, perturbing slightly if no trajectory reaches the goal
    for (let attempt = 0; attempt < 5; attempt++) {
      const rng = createPRNG(level * 4321 + 7 + attempt * 997);
      const goalPos = {
        x: PHYSICS_WIDTH * 0.86,
        y: PHYSICS_HEIGHT * (0.2 + rng() * 0.6),
      };

      const objects: GameObject[] = [];
      const reservedZones: { pos: Vector2D; radius: number }[] = [
        { pos: startPos, radius: 95 },
        { pos: goalPos, radius: 110 },
      ];

      let dustPlaced = 0;
      const planetCount = 3 + Math.min(3, Math.floor(level / 5));
      const portalCount = level > 5 ? Math.min(2, 1 + Math.floor((level - 6) / 10)) : 0;
      const requiredDust = 15 + level * 5;
      const targetDust = requiredDust * 2 + 10;
      const planetColors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#00f0ff', '#d946ef'];
      const gravityScale = epoch === 'Relativity' ? 1.25 : epoch === 'Thermal' ? 1.15 : 1.0;

      // Place Planets with clearance checks
      for (let i = 0; i < planetCount; i++) {
        let placed = false;
        for (let tries = 0; tries < 25; tries++) {
          const x = PHYSICS_WIDTH * (0.2 + (i / planetCount) * 0.56) + (rng() - 0.5) * 90;
          const y = PHYSICS_HEIGHT * (0.16 + rng() * 0.68);
          const radius = 42 + rng() * 32;

          if (!this.isTooCloseToList({ x, y }, radius + 45, reservedZones)) {
            const mass = (1200 + rng() * 1800) * gravityScale;
            objects.push({
              id: `planet-${i}`,
              pos: { x, y },
              radius,
              type: 'Planet',
              mass,
              color: planetColors[Math.floor(rng() * planetColors.length)],
            });
            reservedZones.push({ pos: { x, y }, radius });

            // Stardust ring around planet
            const dustInRing = Math.floor(targetDust / planetCount) + 5;
            for (let j = 0; j < dustInRing; j++) {
              const angle = (j / dustInRing) * Math.PI * 2 + rng() * 0.3;
              const dist = radius + 36 + rng() * 55;
              const dx = x + Math.cos(angle) * dist;
              const dy = y + Math.sin(angle) * dist;
              if (dx > 30 && dx < PHYSICS_WIDTH - 30 && dy > 30 && dy < PHYSICS_HEIGHT - 30) {
                objects.push({
                  id: `dust-${i}-${j}`,
                  pos: { x: dx, y: dy },
                  radius: 4.5,
                  type: 'Stardust',
                  collected: false,
                });
                dustPlaced++;
              }
            }
            placed = true;
            break;
          }
        }
        if (!placed && objects.length === 0) {
          // Fallback central planet if needed
          objects.push({
            id: `planet-fallback-${i}`,
            pos: { x: PHYSICS_WIDTH * 0.5, y: PHYSICS_HEIGHT * 0.5 },
            radius: 50,
            type: 'Planet',
            mass: 1800,
            color: '#00f0ff',
          });
        }
      }

      // Place Portals (Wormholes) from level 6+
      for (let i = 0; i < portalCount; i++) {
        const idA = `portal-${i}-a`;
        const idB = `portal-${i}-b`;
        const posA = { x: PHYSICS_WIDTH * (0.24 + rng() * 0.18), y: PHYSICS_HEIGHT * (0.18 + rng() * 0.64) };
        const posB = { x: PHYSICS_WIDTH * (0.58 + rng() * 0.18), y: PHYSICS_HEIGHT * (0.18 + rng() * 0.64) };

        if (!this.isTooCloseToList(posA, 45, reservedZones) && !this.isTooCloseToList(posB, 45, reservedZones)) {
          objects.push({ id: idA, pos: posA, radius: 34, type: 'Portal', targetId: idB });
          objects.push({ id: idB, pos: posB, radius: 34, type: 'Portal', targetId: idA });
          reservedZones.push({ pos: posA, radius: 40 }, { pos: posB, radius: 40 });
        }
      }

      // Quantum+ Epoch (Levels 11+): Asteroids (phased in Wave mode) & QuantumFields
      if (level >= 11) {
        const asteroidCount = Math.min(6, 2 + Math.floor((level - 10) / 4));
        for (let i = 0; i < asteroidCount; i++) {
          for (let tries = 0; tries < 15; tries++) {
            const ax = PHYSICS_WIDTH * (0.24 + rng() * 0.54);
            const ay = PHYSICS_HEIGHT * (0.12 + rng() * 0.76);
            const ar = 20 + rng() * 18;
            if (!this.isTooCloseToList({ x: ax, y: ay }, ar + 24, reservedZones)) {
              const vertices = Array.from({ length: 8 }, () => 0.78 + rng() * 0.42);
              objects.push({
                id: `asteroid-${i}`,
                pos: { x: ax, y: ay },
                radius: ar,
                type: 'Asteroid',
                angle: rng() * Math.PI * 2,
                vertices,
              });
              reservedZones.push({ pos: { x: ax, y: ay }, radius: ar });
              break;
            }
          }
        }

        const qFieldCount = epoch === 'Quantum' ? 2 : 1;
        for (let i = 0; i < qFieldCount; i++) {
          const qx = PHYSICS_WIDTH * (0.3 + rng() * 0.4);
          const qy = PHYSICS_HEIGHT * (0.2 + rng() * 0.6);
          objects.push({
            id: `qfield-${i}`,
            pos: { x: qx, y: qy },
            radius: 75 + rng() * 25,
            type: 'QuantumField',
          });
        }
      }

      // Relativity+ Epoch (Levels 21+): Nebulas (viscous drag in Particle mode, clean in Wave mode)
      if (level >= 21) {
        const nebulaCount = Math.min(3, 1 + Math.floor((level - 20) / 6));
        for (let i = 0; i < nebulaCount; i++) {
          const nx = PHYSICS_WIDTH * (0.3 + rng() * 0.42);
          const ny = PHYSICS_HEIGHT * (0.18 + rng() * 0.64);
          objects.push({
            id: `nebula-${i}`,
            pos: { x: nx, y: ny },
            radius: 90 + rng() * 35,
            type: 'Nebula',
            color: '#ff5500',
          });
        }
      }

      // Thermal Epoch (Levels 31+): Cold Sinks (cool core heat rapidly)
      if (level >= 31) {
        const sinkCount = 2;
        for (let i = 0; i < sinkCount; i++) {
          const cx = PHYSICS_WIDTH * (0.28 + i * 0.3 + rng() * 0.1);
          const cy = PHYSICS_HEIGHT * (0.2 + rng() * 0.6);
          objects.push({
            id: `coldsink-${i}`,
            pos: { x: cx, y: cy },
            radius: 75,
            type: 'ColdSink',
          });
        }
      }

      // Place Data Fragments (High-value bonus + 15 stardust)
      const fragmentCount = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < fragmentCount; i++) {
        for (let tries = 0; tries < 15; tries++) {
          const fx = PHYSICS_WIDTH * (0.22 + rng() * 0.58);
          const fy = PHYSICS_HEIGHT * (0.14 + rng() * 0.72);
          if (!this.isTooCloseToList({ x: fx, y: fy }, 22, reservedZones)) {
            objects.push({
              id: `fragment-${i}`,
              pos: { x: fx, y: fy },
              radius: 13,
              type: 'DataFragment',
              collected: false,
            });
            break;
          }
        }
      }

      // Ensure enough total dust exists even after boundary filtering
      while (dustPlaced < requiredDust + 15) {
        const angle = rng() * Math.PI * 2;
        const fx = PHYSICS_WIDTH * (0.18 + rng() * 0.64);
        const fy = PHYSICS_HEIGHT * (0.12 + rng() * 0.76);
        objects.push({
          id: `dust-extra-${dustPlaced}`,
          pos: { x: fx + Math.cos(angle) * 12, y: fy + Math.sin(angle) * 12 },
          radius: 4.5,
          type: 'Stardust',
          collected: false,
        });
        dustPlaced++;
      }

      // Verify reachability to goal via lightweight sweep
      const solved = this.findSolvedTrajectory(startPos, objects, goalPos);
      if (solved || attempt === 4) {
        this.gameState.totalFragments = fragmentCount;
        this.gameState.requiredStardust = requiredDust;
        this.gameState.optimumScore = dustPlaced * 10 + fragmentCount * 5000 + 5000;

        return {
          objects,
          startPos,
          goalPos,
          solvedTrajectory: solved ?? undefined,
        };
      }
    }

    return {
      objects: [],
      startPos,
      goalPos: { x: PHYSICS_WIDTH * 0.86, y: PHYSICS_HEIGHT / 2 },
    };
  }

  private findSolvedTrajectory(start: Vector2D, objects: GameObject[], goal: Vector2D): Vector2D[] | null {
    for (let angle = -0.9; angle <= 0.9; angle += 0.15) {
      for (let speed = 7; speed <= 20; speed += 2.5) {
        const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        const sim = this.simulateTrajectory(start, vel, objects, goal);
        if (sim.success) return sim.points;
      }
    }
    return null;
  }

  // Shared Verlet acceleration + position step (used by both update & trajectory preview)
  private integrateStep(
    currentPos: Vector2D,
    prevPos: Vector2D,
    effectiveDt: number,
    dtRatio: number,
    objects: GameObject[]
  ): { pos: Vector2D; prevPos: Vector2D } {
    let accX = 0;
    let accY = 0;

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (obj.type === 'Planet' && obj.mass) {
        const dx = obj.pos.x - currentPos.x;
        const dy = obj.pos.y - currentPos.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq + SOFTENING_RADIUS * SOFTENING_RADIUS);
        const force = (G * obj.mass) / (dist * dist * dist);
        accX += dx * force;
        accY += dy * force;
      }
    }

    const dtSq = effectiveDt * effectiveDt;
    let nextX = currentPos.x + (currentPos.x - prevPos.x) * dtRatio + accX * dtSq;
    let nextY = currentPos.y + (currentPos.y - prevPos.y) * dtRatio + accY * dtSq;

    // Velocity capping
    const dx = nextX - currentPos.x;
    const dy = nextY - currentPos.y;
    const stepDistSq = dx * dx + dy * dy;
    if (stepDistSq > MAX_VELOCITY_STEP * MAX_VELOCITY_STEP) {
      const stepDist = Math.sqrt(stepDistSq);
      nextX = currentPos.x + (dx / stepDist) * MAX_VELOCITY_STEP;
      nextY = currentPos.y + (dy / stepDist) * MAX_VELOCITY_STEP;
    }

    return {
      prevPos: { x: currentPos.x, y: currentPos.y },
      pos: { x: nextX, y: nextY },
    };
  }

  // Pure simulation for level generator verification
  simulateTrajectory(
    start: Vector2D,
    velocity: Vector2D,
    objects: GameObject[],
    goal: Vector2D
  ): { success: boolean; points: Vector2D[] } {
    let p = { ...start };
    let prev = { x: p.x - velocity.x, y: p.y - velocity.y };
    const points: Vector2D[] = [];

    for (let i = 0; i < 400; i++) {
      const stepped = this.integrateStep(p, prev, 1.0, 1.0, objects);
      p = stepped.pos;
      prev = stepped.prevPos;
      points.push({ ...p });

      // Crash check against solid planets
      for (const obj of objects) {
        if (obj.type === 'Planet') {
          const d = Math.hypot(obj.pos.x - p.x, obj.pos.y - p.y);
          if (d < obj.radius + 6) return { success: false, points };
        }
      }

      if (p.x < 0 || p.x > PHYSICS_WIDTH || p.y < 0 || p.y > PHYSICS_HEIGHT) {
        return { success: false, points };
      }

      if (Math.hypot(p.x - goal.x, p.y - goal.y) < GOAL_RADIUS) {
        return { success: true, points };
      }
    }
    return { success: false, points };
  }

  update(dt: number) {
    if (this.gameState.status !== 'playing' || !this.probe.launched) return;

    // Clamp dt to protect Verlet stability & timer on tab switches / lag spikes
    const clampedDt = Math.min(Math.max(dt, 0.05), 2.5);
    this.simTime += clampedDt / 60;

    // Session timer
    this.gameState.sessionTimeLeft -= clampedDt / 60;
    if (this.gameState.sessionTimeLeft <= 0) {
      this.gameState.sessionTimeLeft = 0;
      this.gameState.status = 'lost';
      this.gameState.failureReason = 'time_out';
      soundFX.loss();
      return;
    }

    // Check environmental field effects at probe position
    let inQuantumField = false;
    let inColdSink = false;
    let inNebula = false;
    const objects = this.levelData.objects;

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (obj.type === 'QuantumField' || obj.type === 'ColdSink' || obj.type === 'Nebula') {
        const dx = this.probe.pos.x - obj.pos.x;
        const dy = this.probe.pos.y - obj.pos.y;
        if (dx * dx + dy * dy < obj.radius * obj.radius) {
          if (obj.type === 'QuantumField') inQuantumField = true;
          if (obj.type === 'ColdSink') inColdSink = true;
          if (obj.type === 'Nebula') inNebula = true;
        }
      }
    }

    // Cooldown Logic (QuantumField speeds recharge 2x)
    if (this.gameState.switchCooldown > 0) {
      const cooldownTick = (clampedDt / 60) * (inQuantumField ? 2.0 : 1.0);
      this.gameState.switchCooldown = Math.max(0, this.gameState.switchCooldown - cooldownTick);
    }

    // Thermal Logic:
    // Particle Mode cools naturally; Wave Mode builds passive heat (higher in Thermal epoch)
    if (this.probe.isWaveState) {
      const baseWaveHeat = this.gameState.epoch === 'Thermal' ? 0.22 : 0.1;
      const heatGain = inQuantumField ? baseWaveHeat * 0.3 : baseWaveHeat;
      this.gameState.heat += heatGain * clampedDt;
    } else {
      this.gameState.heat = Math.max(0, this.gameState.heat - 0.25 * clampedDt);
    }

    // Nebula adds thermal drag in Particle mode only (Wave mode phases cleanly)
    if (inNebula && !this.probe.isWaveState) {
      this.gameState.heat += 0.18 * clampedDt;
      const vx = this.probe.pos.x - this.probe.prevPos.x;
      const vy = this.probe.pos.y - this.probe.prevPos.y;
      this.probe.prevPos.x = this.probe.pos.x - vx * Math.pow(0.985, clampedDt);
      this.probe.prevPos.y = this.probe.pos.y - vy * Math.pow(0.985, clampedDt);
    }

    // Cold Sinks rapidly cool core heat
    if (inColdSink) {
      this.gameState.heat = Math.max(0, this.gameState.heat - 0.85 * clampedDt);
    }

    if (this.gameState.heat >= 100) {
      this.gameState.heat = 100;
      this.gameState.status = 'lost';
      this.gameState.failureReason = 'overheated';
      soundFX.loss();
      return;
    }

    // Time-Corrected Verlet step
    const effectiveDt = clampedDt;
    const dtRatio = effectiveDt / this.lastDt;
    const stepped = this.integrateStep(this.probe.pos, this.probe.prevPos, effectiveDt, dtRatio, objects);
    this.probe.prevPos = stepped.prevPos;
    this.probe.pos = stepped.pos;
    this.lastDt = effectiveDt;

    // Collisions
    this.checkCollisions(effectiveDt);

    // Elastic Wall Boundaries
    const { pos } = this.probe;
    if (pos.y < 0) {
      this.reflectProbe(0, -1, 1.0);
      this.probe.pos.y = 1;
      this.gameState.heat += 2;
      soundFX.bounce();
    } else if (pos.y > PHYSICS_HEIGHT) {
      this.reflectProbe(0, 1, 1.0);
      this.probe.pos.y = PHYSICS_HEIGHT - 1;
      this.gameState.heat += 2;
      soundFX.bounce();
    } else if (pos.x < 0) {
      this.reflectProbe(-1, 0, 1.0);
      this.probe.pos.x = 1;
      this.gameState.heat += 2;
      soundFX.bounce();
    } else if (pos.x > PHYSICS_WIDTH) {
      this.reflectProbe(1, 0, 1.0);
      this.probe.pos.x = PHYSICS_WIDTH - 1;
      this.gameState.heat += 2;
      soundFX.bounce();
    }
  }

  reflectProbe(nx: number, ny: number, multiplier: number = 1.0) {
    const vx = this.probe.pos.x - this.probe.prevPos.x;
    const vy = this.probe.pos.y - this.probe.prevPos.y;
    const dot = vx * nx + vy * ny;

    const rvx = (vx - 2 * dot * nx) * multiplier;
    const rvy = (vy - 2 * dot * ny) * multiplier;

    this.probe.prevPos = {
      x: this.probe.pos.x - rvx,
      y: this.probe.pos.y - rvy,
    };
  }

  calcDistSq(p1: Vector2D, p2: Vector2D) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
  }

  checkCollisions(dt: number = 1) {
    const { pos, radius } = this.probe;
    const distToGoalSq = this.calcDistSq(pos, this.levelData.goalPos);

    // Goal (Eye of the Singularity) check
    if (distToGoalSq < GOAL_RADIUS * GOAL_RADIUS) {
      if (this.gameState.stardust >= this.gameState.requiredStardust) {
        this.gameState.status = 'won';
        this.gameState.goalCollected = true;

        const vx = this.probe.pos.x - this.probe.prevPos.x;
        const vy = this.probe.pos.y - this.probe.prevPos.y;
        const entrySpeed = Math.hypot(vx, vy);
        const speedBonus = Math.floor(entrySpeed * 200);

        const timeRemainingBonus = Math.max(0, Math.floor(this.gameState.sessionTimeLeft * 150));
        const launchBonus = Math.max(0, 5000 - (this.gameState.launches - 1) * 1000);
        const fragmentMultiplier = 1.0 + this.gameState.fragmentsCollected * 0.5;

        this.gameState.score = Math.floor(
          (this.gameState.score + timeRemainingBonus + launchBonus + speedBonus) * fragmentMultiplier
        );
        soundFX.win();
        return;
      } else {
        // Magnetic siphon when grazing outer eye, gentle deflection at inner iris (no unfair instant loss)
        this.gameState.stardust += (2 * dt) / 60;
        this.gameState.score += 2;

        if (distToGoalSq < 32 * 32) {
          const dx = pos.x - this.levelData.goalPos.x;
          const dy = pos.y - this.levelData.goalPos.y;
          const dist = Math.max(1, Math.sqrt(distToGoalSq));
          const nx = dx / dist;
          const ny = dy / dist;
          this.reflectProbe(nx, ny, 0.95);
          this.probe.pos.x = this.levelData.goalPos.x + nx * 35;
          this.probe.pos.y = this.levelData.goalPos.y + ny * 35;
          this.triggerCollision();
          this.gameState.goalLockedFlashUntil = Date.now() + 1800;
          soundFX.lockedGoal();
        }
      }
    }

    const objects = this.levelData.objects;
    const len = objects.length;
    for (let i = 0; i < len; i++) {
      const obj = objects[i];
      const dx = pos.x - obj.pos.x;
      const dy = pos.y - obj.pos.y;
      const distSq = dx * dx + dy * dy;
      const combinedRadius = radius + obj.radius;

      if (distSq < combinedRadius * combinedRadius) {
        // Data Fragment Collection
        if (obj.type === 'DataFragment' && !obj.collected) {
          obj.collected = true;
          this.gameState.fragmentsCollected++;
          this.gameState.score += 1000;
          this.gameState.stardust += 15;
          soundFX.fragment();
        }

        // Stardust Collection (generous pickup radius)
        if (obj.type === 'Stardust' && !obj.collected) {
          obj.collected = true;
          this.gameState.stardust += 1;
          this.gameState.score += 10;
          soundFX.stardust();
        }

        // Asteroid Collision (Solid to Particle, Phased by Wave)
        if (obj.type === 'Asteroid' && !this.probe.isWaveState) {
          const dist = Math.max(1, Math.sqrt(distSq));
          const nx = dx / dist;
          const ny = dy / dist;
          const overstep = combinedRadius - dist + 2;
          this.probe.pos.x += nx * overstep;
          this.probe.pos.y += ny * overstep;
          this.probe.prevPos.x += nx * overstep;
          this.probe.prevPos.y += ny * overstep;
          this.reflectProbe(nx, ny, 0.92);
          this.triggerCollision();
          this.gameState.heat += 10;
          soundFX.bounce();
          return;
        }

        // Planet Collision
        if (obj.type === 'Planet') {
          if (distSq < combinedRadius * 0.95 * (combinedRadius * 0.95)) {
            const dist = Math.max(1, Math.sqrt(distSq));
            const nx = dx / dist;
            const ny = dy / dist;
            const overstep = combinedRadius - dist + 2;
            this.probe.pos.x += nx * overstep;
            this.probe.pos.y += ny * overstep;
            this.probe.prevPos.x += nx * overstep;
            this.probe.prevPos.y += ny * overstep;
            this.reflectProbe(nx, ny, 1.0);
            this.triggerCollision();
            this.gameState.heat += this.probe.isWaveState ? 10 : 6;
            soundFX.bounce();
            return;
          }
        }

        // Portal Logic (0.75s simulated cooldown to avoid ping-ponging)
        if (obj.type === 'Portal' && obj.targetId) {
          if (this.simTime - this.lastTeleportSimTime > 0.75) {
            const target = objects.find((o) => o.id === obj.targetId);
            if (target) {
              const vx = this.probe.pos.x - this.probe.prevPos.x;
              const vy = this.probe.pos.y - this.probe.prevPos.y;
              this.probe.pos = { x: target.pos.x, y: target.pos.y };
              this.probe.prevPos = { x: target.pos.x - vx, y: target.pos.y - vy };
              this.lastTeleportSimTime = this.simTime;
              soundFX.portal();
            }
          }
        }
      }
    }
  }

  triggerCollision() {
    this.collided = true;
    setTimeout(() => {
      this.collided = false;
    }, 200);
  }

  toggleState() {
    if (this.gameState.switchCooldown > 0 || this.gameState.status === 'won' || this.gameState.status === 'lost') return;
    this.probe.isWaveState = !this.probe.isWaveState;
    this.gameState.switchCooldown = SWITCH_COOLDOWN_TIME;
    if (this.probe.launched) {
      this.gameState.heat = Math.min(99, this.gameState.heat + 5);
    }
    soundFX.phaseShift(this.probe.isWaveState);
  }

  launch(velocity: Vector2D) {
    if (this.gameState.status === 'won' || this.gameState.status === 'lost') return;

    if (!this.probe.launched) {
      this.gameState.levelStartTime = Date.now();
      this.lastDt = 1.0;
    } else {
      // Mid-flight course correction impulse (adds heat & counts as an extra launch)
      this.gameState.heat = Math.min(99, this.gameState.heat + 12);
    }

    this.gameState.launches++;
    this.probe.launched = true;
    this.gameState.status = 'playing';
    this.probe.prevPos = {
      x: this.probe.pos.x - velocity.x,
      y: this.probe.pos.y - velocity.y,
    };
    soundFX.launch();
  }

  getTrajectory(velocity: Vector2D, points: number = TRAJECTORY_POINTS): Vector2D[] {
    const dvx = Math.abs(velocity.x - this.cachedTrajectoryVelocity.x);
    const dvy = Math.abs(velocity.y - this.cachedTrajectoryVelocity.y);
    const dpx = Math.abs(this.probe.pos.x - this.cachedTrajectoryPos.x);
    const dpy = Math.abs(this.probe.pos.y - this.cachedTrajectoryPos.y);

    if (
      dvx < 0.001 &&
      dvy < 0.001 &&
      dpx < 0.1 &&
      dpy < 0.1 &&
      this.cachedTrajectoryWave === this.probe.isWaveState &&
      this.cachedTrajectory.length > 0
    ) {
      return this.cachedTrajectory;
    }

    const trajectory: Vector2D[] = [{ x: this.probe.pos.x, y: this.probe.pos.y }];
    let tempPos = { x: this.probe.pos.x, y: this.probe.pos.y };
    let prevPos = { x: tempPos.x - velocity.x, y: tempPos.y - velocity.y };

    const objects = this.levelData.objects;
    const goalPos = this.levelData.goalPos;
    let lastSimTeleport = -100;

    for (let i = 0; i < points; i++) {
      const stepped = this.integrateStep(tempPos, prevPos, 1.0, 1.0, objects);
      tempPos = stepped.pos;
      prevPos = stepped.prevPos;

      // Mirror wall reflection in preview
      if (tempPos.y < 0) {
        const vy = tempPos.y - prevPos.y;
        tempPos.y = 1;
        prevPos.y = tempPos.y + vy;
      } else if (tempPos.y > PHYSICS_HEIGHT) {
        const vy = tempPos.y - prevPos.y;
        tempPos.y = PHYSICS_HEIGHT - 1;
        prevPos.y = tempPos.y + vy;
      }
      if (tempPos.x < 0) {
        const vx = tempPos.x - prevPos.x;
        tempPos.x = 1;
        prevPos.x = tempPos.x + vx;
      } else if (tempPos.x > PHYSICS_WIDTH) {
        const vx = tempPos.x - prevPos.x;
        tempPos.x = PHYSICS_WIDTH - 1;
        prevPos.x = tempPos.x + vx;
      }

      // Check solid collisions & portal jumps so trajectory is faithful
      let stopPreview = false;
      for (let j = 0; j < objects.length; j++) {
        const obj = objects[j];
        const dx = tempPos.x - obj.pos.x;
        const dy = tempPos.y - obj.pos.y;
        const distSq = dx * dx + dy * dy;
        const combined = this.probe.radius + obj.radius;

        if (obj.type === 'Planet' && distSq < combined * 0.95 * (combined * 0.95)) {
          const dist = Math.max(1, Math.sqrt(distSq));
          const nx = dx / dist;
          const ny = dy / dist;
          const vx = tempPos.x - prevPos.x;
          const vy = tempPos.y - prevPos.y;
          const dot = vx * nx + vy * ny;
          const rvx = vx - 2 * dot * nx;
          const rvy = vy - 2 * dot * ny;
          tempPos.x += nx * (combined - dist + 2);
          tempPos.y += ny * (combined - dist + 2);
          prevPos.x = tempPos.x - rvx;
          prevPos.y = tempPos.y - rvy;
        } else if (obj.type === 'Asteroid' && !this.probe.isWaveState && distSq < combined * combined) {
          const dist = Math.max(1, Math.sqrt(distSq));
          const nx = dx / dist;
          const ny = dy / dist;
          const vx = tempPos.x - prevPos.x;
          const vy = tempPos.y - prevPos.y;
          const dot = vx * nx + vy * ny;
          const rvx = (vx - 2 * dot * nx) * 0.92;
          const rvy = (vy - 2 * dot * ny) * 0.92;
          tempPos.x += nx * (combined - dist + 2);
          tempPos.y += ny * (combined - dist + 2);
          prevPos.x = tempPos.x - rvx;
          prevPos.y = tempPos.y - rvy;
        } else if (obj.type === 'Portal' && obj.targetId && distSq < combined * combined && i - lastSimTeleport > 45) {
          const target = objects.find((o) => o.id === obj.targetId);
          if (target) {
            const vx = tempPos.x - prevPos.x;
            const vy = tempPos.y - prevPos.y;
            tempPos = { x: target.pos.x, y: target.pos.y };
            prevPos = { x: target.pos.x - vx, y: target.pos.y - vy };
            lastSimTeleport = i;
          }
        }
      }

      trajectory.push({ x: tempPos.x, y: tempPos.y });

      const dxGoal = tempPos.x - goalPos.x;
      const dyGoal = tempPos.y - goalPos.y;
      if (dxGoal * dxGoal + dyGoal * dyGoal < GOAL_RADIUS * GOAL_RADIUS) {
        stopPreview = true;
      }
      if (stopPreview) break;
    }

    this.cachedTrajectoryVelocity = { ...velocity };
    this.cachedTrajectoryWave = this.probe.isWaveState;
    this.cachedTrajectoryPos = { ...this.probe.pos };
    this.cachedTrajectory = trajectory;
    return trajectory;
  }

  reset() {
    this.gameState.status = 'preview';
    this.gameState.failureReason = undefined;
    this.gameState.integrity = 100;
    this.gameState.heat = 0;
    this.gameState.stardust = 0;
    this.gameState.score = 0;
    this.gameState.launches = 0;
    this.gameState.fragmentsCollected = 0;
    this.gameState.sessionTimeLeft = 60;
    this.gameState.goalCollected = false;
    this.gameState.goalLockedFlashUntil = undefined;
    this.gameState.switchCooldown = 0;
    this.lastDt = 1.0;
    this.simTime = 0;
    this.lastTeleportSimTime = -10;
    this.cachedTrajectory = [];

    this.levelData.objects.forEach((obj) => {
      if ('collected' in obj) obj.collected = false;
    });
    this.probe = {
      pos: { ...this.levelData.startPos },
      prevPos: { ...this.levelData.startPos },
      radius: 8,
      isWaveState: false,
      launched: false,
    };
  }

  getHint(): string {
    const epoch = this.gameState.epoch;
    if (epoch === 'Quantum') {
      return 'Asteroids deflect Particles—press SPACE to phase through them in Wave mode.';
    }
    if (epoch === 'Relativity') {
      return 'Heavy gravity & viscous Nebulas ahead. Wave mode glides cleanly through orange clouds.';
    }
    if (epoch === 'Thermal') {
      return 'Wave mode builds intense heat here. Skim through icy cyan Cold Sinks to cool down.';
    }
    const hints = [
      'Use planetary gravity wells to slingshot around and collect golden stardust rings.',
      'The Golden Eye opens only after reaching the stardust quota shown at top center.',
      'Portals warp your probe instantly—aim into one to emerge from its twin.',
      'Drag anywhere anytime while flying to execute a mid-flight course correction.',
      'Cyan Data Fragments count for +15 Stardust and boost your final score multiplier.',
    ];
    return hints[(this.gameState.level - 1) % hints.length];
  }
}
