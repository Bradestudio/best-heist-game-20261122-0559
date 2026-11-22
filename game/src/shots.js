// The screenshot scenes behind ?shot=start|play|end|alarm. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a deterministic autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { CAMERA_VIEW_DISTANCE, GUARD_VIEW_DISTANCE, HUD_HEIGHT, PLAYER_RADIUS, STEP } from './config.js';
import {
  EVENT_CAUGHT,
  EVENT_ESCAPED,
  observerSeesPlayer,
  positionIsBlocked,
} from './world.js';
import { SCREEN_CAUGHT, SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 13;
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
let waitStreak = 0;
const PATH_CELL = 40;
const PATH_COLS = 32;
const PATH_ROWS = 17;

function cellCenterX(column) {
  return column * PATH_CELL + PATH_CELL / 2;
}

function cellCenterY(row) {
  return HUD_HEIGHT + row * PATH_CELL + PATH_CELL / 2;
}

function cellIsBlocked(state, column, row) {
  if (column < 0 || column >= PATH_COLS || row < 0 || row >= PATH_ROWS) return true;
  return positionIsBlocked(
    cellCenterX(column), cellCenterY(row), PLAYER_RADIUS + 4, state.walls,
  );
}

/**
 * Breadth-first path around walls on a coarse grid, from the player to the
 * target. Returns cell centres from the player's cell to the target's cell.
 */
function findWallPath(state, target) {
  const startColumn = Math.max(0, Math.min(PATH_COLS - 1, Math.floor(state.player.x / PATH_CELL)));
  const startRow = Math.max(
    0,
    Math.min(PATH_ROWS - 1, Math.floor((state.player.y - HUD_HEIGHT) / PATH_CELL)),
  );
  const goalColumn = Math.max(0, Math.min(PATH_COLS - 1, Math.floor(target.x / PATH_CELL)));
  const goalRow = Math.max(
    0,
    Math.min(PATH_ROWS - 1, Math.floor((target.y - HUD_HEIGHT) / PATH_CELL)),
  );
  const key = (column, row) => row * PATH_COLS + column;
  const cameFrom = new Map();
  const queue = [[startColumn, startRow]];
  cameFrom.set(key(startColumn, startRow), null);
  while (queue.length > 0) {
    const [column, row] = queue.shift();
    if (column === goalColumn && row === goalRow) break;
    const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let i = 0; i < neighbours.length; i += 1) {
      const nextColumn = column + neighbours[i][0];
      const nextRow = row + neighbours[i][1];
      if (cellIsBlocked(state, nextColumn, nextRow)) continue;
      if (cameFrom.has(key(nextColumn, nextRow))) continue;
      cameFrom.set(key(nextColumn, nextRow), [column, row]);
      queue.push([nextColumn, nextRow]);
    }
  }
  if (!cameFrom.has(key(goalColumn, goalRow))) return null;
  const cells = [];
  let current = [goalColumn, goalRow];
  while (current) {
    cells.unshift({ x: cellCenterX(current[0]), y: cellCenterY(current[1]) });
    current = cameFrom.get(key(current[0], current[1]));
  }
  return cells;
}

export function autopilotInput(state, cautious) {
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
  // Follow the wall-avoiding path to the target instead of pushing straight
  // at it through the walls.
  const path = findWallPath(state, target);
  const waypoint = path && path.length > 1 ? path[1] : target;

  let bestDirection = [0, 0];
  let bestScore = -Infinity;
  const currentWatched = positionIsWatched(state, state.player.x, state.player.y);
  for (let i = 0; i < DIRECTIONS.length; i += 1) {
    const [dx, dy] = DIRECTIONS[i];
    if (dx === 0 && dy === 0) continue;
    const nx = state.player.x + dx * 18;
    const ny = state.player.y + dy * 18;
    if (positionIsBlocked(nx, ny, PLAYER_RADIUS, state.walls)) continue;
    const distanceToTarget = Math.hypot(waypoint.x - nx, waypoint.y - ny);
    let score = -distanceToTarget;
    if (positionIsWatched(state, nx, ny)) score -= cautious ? 5000 : 40;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = [dx, dy];
    }
  }
  // Patience: when every way forward is watched but this spot is safe, wait
  // for the cone to sweep past — but never wait more than 4 seconds.
  const bestMoveWatched = positionIsWatched(
    state, state.player.x + bestDirection[0] * 18, state.player.y + bestDirection[1] * 18,
  );
  if (cautious && bestMoveWatched && !currentWatched && waitStreak < 240) {
    waitStreak += 1;
    return {
      dx: 0,
      dy: 0,
      sneak: true,
      smoke: false,
    };
  }
  waitStreak = 0;
  return {
    dx: bestDirection[0],
    dy: bestDirection[1],
    sneak: nearestGuardDistance(state) < 230,
    smoke: state.alarm > 45 && state.smokesLeft > 0,
  };
}

function runAutopilot(world, seconds, cautious, stopOnEscape) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, autopilotInput(world.state, cautious));
    if (events & EVENT_CAUGHT) break;
    if (world.state.status === 'complete') break;
    if (stopOnEscape && (events & EVENT_ESCAPED)) break;
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
    runAutopilot(world, ALARM_SECONDS, true, true);
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
    const events = runAutopilot(world, PLAY_SECONDS, true, true);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: world.state.score };
    if (events & EVENT_ESCAPED) return { screen: SCREEN_PLAY, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // The reckless pilot keeps going through every level until it is caught
    // or finishes the whole heist, so this frame differs from the play shot.
    const events = runAutopilot(world, END_LIMIT_SECONDS, false, false);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: world.state.score };
    if (world.state.status === 'complete') return { screen: SCREEN_COMPLETE, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  runAutopilot(world, START_SECONDS, true, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
