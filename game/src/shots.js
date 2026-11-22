// The screenshot scenes behind ?shot=start|play|end|alarm. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a deterministic autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { CAMERA_VIEW_DISTANCE, GUARD_VIEW_DISTANCE, PLAYER_RADIUS, STEP } from './config.js';
import {
  EVENT_CAUGHT,
  EVENT_ESCAPED,
  observerSeesPlayer,
  positionIsBlocked,
} from './world.js';
import { SCREEN_CAUGHT, SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const ALARM_SECONDS = 14;
const END_LIMIT_SECONDS = 600;
const DIRECTIONS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function nearestGuardDistance(state) {
  let best = Infinity;
  for (let i = 0; i < state.guards.length; i += 1) {
    const distance = Math.hypot(state.guards[i].x - state.player.x, state.guards[i].y - state.player.y);
    if (distance < best) best = distance;
  }
  return best;
}

function positionIsWatched(state, x, y) {
  const probe = { x, y };
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (observerSeesPlayer(
      guard.x, guard.y, guard.angle, GUARD_VIEW_DISTANCE, 0.52, probe, state.walls, state.smoke,
    )) return true;
  }
  for (let i = 0; i < state.cameras.length; i += 1) {
    const camera = state.cameras[i];
    if (observerSeesPlayer(
      camera.x, camera.y, camera.angle, CAMERA_VIEW_DISTANCE, 0.42, probe, state.walls, state.smoke,
    )) return true;
  }
  return false;
}

/**
 * Pick a move toward the nearest loot (or the exit once all loot is taken).
 * A cautious pilot refuses watched squares and sneaks near guards; a reckless
 * one walks straight at the target and gets caught, as a hurried player is.
 */
function autopilotInput(state, cautious) {
  let target = null;
  let bestTargetDistance = Infinity;
  for (let i = 0; i < state.loot.length; i += 1) {
    const item = state.loot[i];
    if (item.taken) continue;
    const distance = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (distance < bestTargetDistance) {
      bestTargetDistance = distance;
      target = item;
    }
  }
  if (!target) target = { x: state.exit.x + state.exit.w / 2, y: state.exit.y + state.exit.h / 2 };

  let bestDirection = [0, 0];
  let bestScore = -Infinity;
  for (let i = 0; i < DIRECTIONS.length; i += 1) {
    const [dx, dy] = DIRECTIONS[i];
    const nx = state.player.x + dx * 18;
    const ny = state.player.y + dy * 18;
    if (positionIsBlocked(nx, ny, PLAYER_RADIUS, state.walls)) continue;
    const distanceToTarget = Math.hypot(target.x - nx, target.y - ny);
    let score = -distanceToTarget;
    if (positionIsWatched(state, nx, ny)) score -= cautious ? 5000 : 40;
    for (let g = 0; g < state.guards.length; g += 1) {
      const guardDistance = Math.hypot(state.guards[g].x - nx, state.guards[g].y - ny);
      if (guardDistance < 90) score -= (90 - guardDistance) * 4;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDirection = [dx, dy];
    }
  }
  return {
    dx: bestDirection[0],
    dy: bestDirection[1],
    sneak: nearestGuardDistance(state) < 230,
    smoke: state.alarm > 70 && state.smokesLeft > 0,
  };
}

function runAutopilot(world, seconds, cautious) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, autopilotInput(world.state, cautious));
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_ESCAPED) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'alarm') {
    runAutopilot(world, ALARM_SECONDS, true);
    world.state.alarm = 78;
    world.state.maxAlarm = 78;
    const player = world.state.player;
    for (let i = 0; i < world.state.guards.length; i += 1) {
      const guard = world.state.guards[i];
      if (guard.mode === 'patrol') {
        guard.mode = 'investigate';
        guard.lastSeen = { x: player.x, y: player.y };
        break;
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'play') {
    const events = runAutopilot(world, PLAY_SECONDS, true);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: world.state.score };
    if (events & EVENT_ESCAPED) return { screen: SCREEN_PLAY, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    const events = runAutopilot(world, END_LIMIT_SECONDS, false);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: world.state.score };
    if (world.state.status === 'complete') return { screen: SCREEN_COMPLETE, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  runAutopilot(world, START_SECONDS, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
