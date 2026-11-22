# VELMORA HEIST — Steal the Night

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Bradestudio/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Bradestudio/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A cinematic top-down stealth heist game, built for the [make.fun best heist game bounty](https://make.fun/bounty/best-heist-game-20261122-0559). Three jobs in one night — a museum gallery, a bank vault, a penthouse — each a single room you must cross unseen: guards with sweeping vision cones and a patrol/suspicious/investigate/alert state machine, security cameras that dispatch guards to your last seen position, loot to steal, and an alarm meter that decides whether you leave as a ghost, a shadow, or caught red-handed.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No network, no build step, no files outside `game/`.

- **WASD / arrow keys** — move the thief (click the mouse to walk to a point)
- **Shift** — sneak: slower, but guards and cameras see you from much closer
- **Space** — smoke bomb (2 per level, costs $150): breaks every line of sight
- **P / Esc** — pause · **Enter** — start / retry

Steal every loot item in the room, then escape through the green EXIT door. Getting spotted raises the ALARM meter; at 100% you are caught. Each level grades your stealth: **HANTU** (alarm stayed under 25%), **BAYANGAN** (under 60%), or **TERLIHAT**.

## Shots

`?shot=start|play|end|alarm` stages a deterministic scene (fixed seed) for screenshots — see `shots.json`. The autopilot plays the real rules forward, so every screenshot is a genuine render of the game.

## Files

- `game/` — the playable game (static files only)
  - `game/src/config.js` — tuning constants
  - `game/src/levels.js` — the three heist rooms
  - `game/src/world.js` — simulation: guards, cameras, alarm, loot, smoke
  - `game/src/render.js` — cinematic canvas renderer (vision cones, night light, HUD)
  - `game/src/input.js` — keyboard + mouse
  - `game/src/audio.js` — synthesized Web Audio sounds, no audio files
  - `game/src/shots.js` — deterministic autopilot screenshot scenes
  - `game/src/random.js` — seeded RNG
  - `game/src/main.js` — boot and game loop
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — tiny local static server for play-testing

## License

MIT — see [LICENSE](LICENSE).

---

Built for the make.fun bounty — https://make.fun/bounty/best-heist-game-20261122-0559?ref=qjs4e9sj
