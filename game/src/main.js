// Boot and the one loop for VELMORA HEIST: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between five screens: title, play, paused, caught and complete.
//
// ?seed=N fixes the run. ?shot=start|play|end|alarm (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createSeededRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_ESCAPED, EVENT_LOOT, EVENT_SMOKE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createSoundBank } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_COMPLETE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const BANNER_SECONDS = 2.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createSeededRandom(seed));
const renderer = createRenderer(canvas);
const sounds = createSoundBank();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, handleAction);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let banner = null;
  let bannerTimer = 0;
  let accumulator = 0;
  let last = performance.now();
  let lastFootstep = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    banner = null;
    screen = SCREEN_PLAY;
    announce('Playing. Steal all the loot, then escape through the exit.');
  }

  function handleAction(action) {
    sounds.unlockAudio();
    if (action === ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_COMPLETE) {
        startGame();
      } else if (screen === SCREEN_CAUGHT) {
        world.retryLevel();
        accumulator = 0;
        banner = null;
        screen = SCREEN_PLAY;
        announce('Retrying the level. Stay out of the cones.');
      }
    } else if (action === ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) {
      sounds.playLootChime();
      announce(`Loot taken. ${world.state.lootTaken} of ${world.state.loot.length}.`);
    }
    if (events & EVENT_SMOKE) sounds.playSmokePuff();
    if (events & EVENT_ESCAPED) {
      sounds.playEscapeFanfare();
      if (world.state.status === 'complete') {
        screen = SCREEN_COMPLETE;
        if (world.state.score > best) {
          best = world.state.score;
          saveBest(best);
        }
        announce(`Heist complete! Final score ${world.state.score}.`);
      } else {
        banner = `LEVEL CLEAR — ${world.state.grades[world.state.grades.length - 1]}! Job ${world.state.levelIndex + 1} of 3.`;
        bannerTimer = BANNER_SECONDS;
        announce(banner);
      }
    }
    if (events & EVENT_CAUGHT) {
      sounds.playCaughtSting();
      sounds.stopAlarmHum();
      screen = SCREEN_CAUGHT;
      announce('Caught! Press Enter to retry the level.');
    }
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const movement = input.readMovement(world.state.player);
        if ((movement.dx !== 0 || movement.dy !== 0) && now - lastFootstep > 380) {
          lastFootstep = now;
          sounds.playFootstep();
        }
        handleEvents(world.step(STEP, movement));
        if (screen !== SCREEN_PLAY) break;
      }
      if (world.state.alarm > 25) {
        sounds.startAlarmHum();
        sounds.setAlarmLevel(world.state.alarm / 100);
      } else {
        sounds.stopAlarmHum();
      }
      if (bannerTimer > 0) {
        bannerTimer -= elapsed;
        if (bannerTimer <= 0) banner = null;
      }
    }
    renderer.draw(world.state, screen, best, banner);
    requestAnimationFrame(frame);
  }

  announce('VELMORA HEIST. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
