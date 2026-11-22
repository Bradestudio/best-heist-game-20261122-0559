// The simulation: one room, a thief, patrolling guards with vision cones and a
// state machine, sweeping cameras, loot, smoke tools and the alarm meter.
// Pure logic — no drawing here — so the autopilot can drive it step by step.
import {
  ALARM_DECAY,
  ALARM_MAX,
  ALARM_RISE_CAMERA,
  ALARM_RISE_GUARD,
  CAMERA_SWEEP_SPEED,
  CAMERA_VIEW_DISTANCE,
  CAMERA_VIEW_HALF_ANGLE,
  GUARD_SPEED_CHASE,
  GUARD_SPEED_PATROL,
  GUARD_VIEW_DISTANCE,
  GUARD_VIEW_HALF_ANGLE,
  PLAYER_RADIUS,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
  SMOKE_COST,
  SMOKE_RADIUS,
  SMOKE_SECONDS,
} from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_ESCAPED = 4;
export const EVENT_SMOKE = 8;
export const EVENT_SPOTTED = 16;

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_ALERT = 'alert';
export const GUARD_RETURN = 'return';

export function gradeForMaxAlarm(maxAlarm) {
  if (maxAlarm < 25) return 'HANTU';
  if (maxAlarm < 60) return 'BAYANGAN';
  return 'TERLIHAT';
}

/** True when a circle at (x,y) would touch any wall — used by the autopilot. */
export function positionIsBlocked(x, y, radius, walls) {
  return circleHitsWall(x, y, radius, walls);
}

function circleHitsWall(x, y, radius, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    const nearestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const nearestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

function pointInWall(x, y, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) return true;
  }
  return false;
}

/** True when no wall blocks the straight line from (x0,y0) to (x1,y1). */
export function hasLineOfSight(x0, y0, x1, y1, walls) {
  const distance = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, walls)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** True when the observer at (ox,oy) facing `angle` can see the player. */
export function observerSeesPlayer(ox, oy, angle, viewDistance, halfAngle, player, walls, smoke) {
  const dx = player.x - ox;
  const dy = player.y - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > viewDistance) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  if (smoke && smoke.timer > 0) {
    const smokeDistance = Math.hypot(player.x - smoke.x, player.y - smoke.y);
    const observerDistance = Math.hypot(ox - smoke.x, oy - smoke.y);
    if (smokeDistance < SMOKE_RADIUS && observerDistance > SMOKE_RADIUS * 0.4) return false;
  }
  return hasLineOfSight(ox, oy, player.x, player.y, walls);
}

function moveWithWalls(entity, dx, dy, radius, walls) {
  const nextX = entity.x + dx;
  if (!circleHitsWall(nextX, entity.y, radius, walls)) entity.x = nextX;
  const nextY = entity.y + dy;
  if (!circleHitsWall(entity.x, nextY, radius, walls)) entity.y = nextY;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    player: { x: 0, y: 0 },
    guards: [],
    cameras: [],
    loot: [],
    exit: null,
    walls: [],
    alarm: 0,
    maxAlarm: 0,
    score: 0,
    lootTaken: 0,
    smoke: { x: 0, y: 0, timer: 0 },
    smokesLeft: 2,
    time: 0,
    status: 'playing',
    grades: [],
    levelStartScore: 0,
    stepCount: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.player = { x: level.playerStart.x, y: level.playerStart.y };
    state.walls = level.walls;
    state.exit = level.exit;
    state.loot = level.loot.map((item) => ({ ...item, taken: false }));
    state.guards = level.guards.map((definition) => ({
      x: definition.waypoints[0].x,
      y: definition.waypoints[0].y,
      angle: 0,
      waypointIndex: 1 % definition.waypoints.length,
      pauseTimer: 0,
      mode: GUARD_PATROL,
      suspicion: 0,
      lastSeen: null,
      lostTimer: 0,
      waypoints: definition.waypoints,
      pauseSeconds: definition.pauseSeconds,
    }));
    state.cameras = level.cameras.map((definition, index2) => ({
      x: definition.x,
      y: definition.y,
      baseAngle: definition.baseAngle,
      sweepRadians: definition.sweepRadians,
      phase: index2 * 1.7,
      angle: definition.baseAngle,
    }));
    state.alarm = 0;
    state.maxAlarm = 0;
    state.lootTaken = 0;
    state.smoke = { x: 0, y: 0, timer: 0 };
    state.smokesLeft = 2;
    state.time = 0;
    state.status = 'playing';
    state.levelStartScore = state.score;
  }

  function reset() {
    state.score = 0;
    state.grades = [];
    loadLevel(0);
  }

  function currentLevel() {
    return LEVELS[state.levelIndex];
  }

  function stepGuard(guard, dt, events) {
    const player = state.player;
    const sneakFactor = state.playerSneaking ? 0.55 : 1;
    const seen = observerSeesPlayer(
      guard.x, guard.y, guard.angle, GUARD_VIEW_DISTANCE * sneakFactor, GUARD_VIEW_HALF_ANGLE,
      player, state.walls, state.smoke,
    );
    if (seen) {
      guard.suspicion = Math.min(1, guard.suspicion + dt * 1.4);
      guard.lastSeen = { x: player.x, y: player.y };
      guard.lostTimer = 0;
      state.alarm = Math.min(ALARM_MAX, state.alarm + ALARM_RISE_GUARD * dt);
      if (guard.suspicion >= 1 && guard.mode !== GUARD_ALERT) {
        guard.mode = GUARD_ALERT;
        return events | EVENT_SPOTTED;
      }
      if (guard.mode === GUARD_PATROL) guard.mode = GUARD_SUSPICIOUS;
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - dt * 0.25);
      if (guard.mode === GUARD_ALERT) {
        guard.lostTimer += dt;
        if (guard.lostTimer > 3) guard.mode = GUARD_RETURN;
      } else if (guard.mode === GUARD_SUSPICIOUS && guard.suspicion <= 0) {
        guard.mode = GUARD_INVESTIGATE;
      }
    }

    if (guard.mode === GUARD_PATROL) {
      const target = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else {
        const dx = target.x - guard.x;
        const dy = target.y - guard.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = guard.pauseSeconds;
        } else {
          const speed = GUARD_SPEED_PATROL * dt;
          guard.angle = Math.atan2(dy, dx);
          moveWithWalls(guard, (dx / distance) * speed, (dy / distance) * speed, 12, state.walls);
        }
      }
    } else if (guard.mode === GUARD_INVESTIGATE && guard.lastSeen) {
      const dx = guard.lastSeen.x - guard.x;
      const dy = guard.lastSeen.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 10) {
        guard.mode = GUARD_RETURN;
      } else {
        const speed = GUARD_SPEED_PATROL * 1.4 * dt;
        guard.angle = Math.atan2(dy, dx);
        moveWithWalls(guard, (dx / distance) * speed, (dy / distance) * speed, 12, state.walls);
      }
    } else if (guard.mode === GUARD_ALERT) {
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 14) {
        const speed = GUARD_SPEED_CHASE * dt;
        guard.angle = Math.atan2(dy, dx);
        moveWithWalls(guard, (dx / distance) * speed, (dy / distance) * speed, 12, state.walls);
      }
      if (distance < PLAYER_RADIUS + 14) {
        state.status = 'caught';
        return events | EVENT_CAUGHT;
      }
    } else if (guard.mode === GUARD_RETURN) {
      const target = guard.waypoints[guard.waypointIndex];
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) {
        guard.mode = GUARD_PATROL;
      } else {
        const speed = GUARD_SPEED_PATROL * dt;
        guard.angle = Math.atan2(dy, dx);
        moveWithWalls(guard, (dx / distance) * speed, (dy / distance) * speed, 12, state.walls);
      }
    }
    return events;
  }

  function stepCamera(camera, dt) {
    camera.angle = camera.baseAngle
      + Math.sin(state.time * CAMERA_SWEEP_SPEED + camera.phase) * camera.sweepRadians;
    const sneakFactor = state.playerSneaking ? 0.55 : 1;
    const seen = observerSeesPlayer(
      camera.x, camera.y, camera.angle, CAMERA_VIEW_DISTANCE * sneakFactor, CAMERA_VIEW_HALF_ANGLE,
      state.player, state.walls, state.smoke,
    );
    if (seen) {
      state.alarm = Math.min(ALARM_MAX, state.alarm + ALARM_RISE_CAMERA * dt);
      const nearest = nearestGuardTo(state.player.x, state.player.y);
      if (nearest && nearest.mode === GUARD_PATROL) {
        nearest.mode = GUARD_INVESTIGATE;
        nearest.lastSeen = { x: state.player.x, y: state.player.y };
      }
    }
  }

  function nearestGuardTo(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (let i = 0; i < state.guards.length; i += 1) {
      const distance = Math.hypot(state.guards[i].x - x, state.guards[i].y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = state.guards[i];
      }
    }
    return best;
  }

  /**
   * Advance the world one fixed step. `input` is { dx, dy, sneak, smoke }.
   * Returns a bitmask of EVENT_* flags for this step.
   */
  function step(dt, input) {
    if (state.status !== 'playing') return EVENT_NONE;
    state.time += dt;
    state.stepCount += 1;
    state.playerSneaking = !!input.sneak;
    let events = EVENT_NONE;

    if (input.smoke && state.smokesLeft > 0 && state.smoke.timer <= 0) {
      state.smoke = { x: state.player.x, y: state.player.y, timer: SMOKE_SECONDS };
      state.smokesLeft -= 1;
      state.score = Math.max(0, state.score - SMOKE_COST);
      events |= EVENT_SMOKE;
    }
    if (state.smoke.timer > 0) state.smoke.timer -= dt;

    const speed = (input.sneak ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED) * dt;
    const length = Math.hypot(input.dx, input.dy);
    if (length > 0) {
      moveWithWalls(
        state.player,
        (input.dx / length) * speed,
        (input.dy / length) * speed,
        PLAYER_RADIUS,
        state.walls,
      );
    }

    for (let i = 0; i < state.loot.length; i += 1) {
      const item = state.loot[i];
      if (!item.taken && Math.hypot(item.x - state.player.x, item.y - state.player.y) < 30) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += item.value;
        events |= EVENT_LOOT;
      }
    }

    for (let i = 0; i < state.cameras.length; i += 1) stepCamera(state.cameras[i], dt);
    for (let i = 0; i < state.guards.length; i += 1) {
      events = stepGuard(state.guards[i], dt, events);
      if (state.status === 'caught') break;
    }

    state.alarm = Math.max(0, state.alarm - ALARM_DECAY * dt);
    if (state.alarm > state.maxAlarm) state.maxAlarm = state.alarm;
    if (state.alarm >= ALARM_MAX) {
      state.status = 'caught';
      return events | EVENT_CAUGHT;
    }
    if (state.status !== 'playing') return events;

    const exit = state.exit;
    const allLootTaken = state.lootTaken >= state.loot.length;
    if (
      allLootTaken
      && state.player.x > exit.x - 10 && state.player.x < exit.x + exit.w + 10
      && state.player.y > exit.y - 10 && state.player.y < exit.y + exit.h + 10
    ) {
      state.grades.push(gradeForMaxAlarm(state.maxAlarm));
      state.score += 500;
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.status = 'complete';
      } else {
        loadLevel(state.levelIndex + 1);
      }
      return events | EVENT_ESCAPED;
    }
    return events;
  }

  function retryLevel() {
    state.score = state.levelStartScore;
    loadLevel(state.levelIndex);
  }

  reset();
  return { state, reset, loadLevel, step, retryLevel, currentLevel };
}
