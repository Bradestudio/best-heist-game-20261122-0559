// The cinematic renderer: one canvas frame holds the whole room — floor, walls,
// loot, exit, guards with raycast vision cones, sweeping cameras, the thief,
// smoke, a radial night-light with vignette, and the HUD with the alarm meter.
import {
  ALARM_MAX,
  CAMERA_VIEW_DISTANCE,
  CAMERA_VIEW_HALF_ANGLE,
  GUARD_VIEW_DISTANCE,
  GUARD_VIEW_HALF_ANGLE,
  HUD_HEIGHT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './config.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_COMPLETE = 'complete';

const FONT_TITLE = '900 84px "Arial Black", Arial, sans-serif';
const FONT_HEADING = '900 34px "Arial Black", Arial, sans-serif';
const FONT_BODY = '700 17px Arial, sans-serif';
const FONT_SMALL = '700 13px Arial, sans-serif';
const FONT_HUD = '900 20px "Arial Black", Arial, sans-serif';

function raycastDistance(x, y, angle, maxDistance, walls) {
  const step = 6;
  for (let d = step; d <= maxDistance; d += step) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    for (let i = 0; i < walls.length; i += 1) {
      const wall = walls[i];
      if (px >= wall.x && px <= wall.x + wall.w && py >= wall.y && py <= wall.y + wall.h) return d;
    }
  }
  return maxDistance;
}

function drawVisionCone(context, x, y, angle, distance, halfAngle, walls, color) {
  const rays = 26;
  context.beginPath();
  context.moveTo(x, y);
  for (let i = 0; i <= rays; i += 1) {
    const rayAngle = angle - halfAngle + (2 * halfAngle * i) / rays;
    const reach = raycastDistance(x, y, rayAngle, distance, walls);
    context.lineTo(x + Math.cos(rayAngle) * reach, y + Math.sin(rayAngle) * reach);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = color.replace(/[\d.]+\)$/, '0.55)');
  context.lineWidth = 1.5;
  context.stroke();
}

function drawFloor(context, walls) {
  context.fillStyle = '#171a26';
  context.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
  context.strokeStyle = 'rgba(255,255,255,0.045)';
  context.lineWidth = 1;
  for (let x = 0; x <= VIEW_WIDTH; x += 64) {
    context.beginPath();
    context.moveTo(x, HUD_HEIGHT);
    context.lineTo(x, VIEW_HEIGHT);
    context.stroke();
  }
  for (let y = HUD_HEIGHT; y <= VIEW_HEIGHT; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(VIEW_WIDTH, y);
    context.stroke();
  }
  context.fillStyle = '#1d2133';
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    context.fillRect(wall.x, wall.y, wall.w, wall.h);
    context.fillStyle = '#2c3250';
    context.fillRect(wall.x, wall.y, wall.w, 4);
    context.fillStyle = '#1d2133';
  }
}

function drawLootItem(context, item, time) {
  if (item.taken) return;
  const bob = Math.sin(time * 3 + item.x) * 3;
  const glow = context.createRadialGradient(item.x, item.y + bob, 2, item.x, item.y + bob, 34);
  glow.addColorStop(0, 'rgba(255, 214, 90, 0.85)');
  glow.addColorStop(1, 'rgba(255, 214, 90, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(item.x, item.y + bob, 34, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.translate(item.x, item.y + bob);
  context.rotate(Math.PI / 4);
  context.fillStyle = '#ffd65a';
  context.fillRect(-9, -9, 18, 18);
  context.fillStyle = '#fff3c4';
  context.fillRect(-9, -9, 18, 6);
  context.restore();
  context.fillStyle = '#ffe9a8';
  context.font = FONT_SMALL;
  context.textAlign = 'center';
  context.fillText(item.label, item.x, item.y + bob + 30);
}

function drawExitDoor(context, exit, allLootTaken, time) {
  const pulse = allLootTaken ? 0.55 + Math.sin(time * 5) * 0.25 : 0.25;
  context.fillStyle = allLootTaken ? `rgba(46, 204, 113, ${pulse})` : 'rgba(46, 204, 113, 0.18)';
  context.fillRect(exit.x, exit.y, exit.w, exit.h);
  context.strokeStyle = '#2ecc71';
  context.lineWidth = 3;
  context.strokeRect(exit.x, exit.y, exit.w, exit.h);
  context.fillStyle = '#a9f5c6';
  context.font = '900 15px "Arial Black", Arial, sans-serif';
  context.textAlign = 'center';
  context.save();
  context.translate(exit.x + exit.w / 2, exit.y + exit.h / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(allLootTaken ? 'KABUR!' : 'EXIT', 0, 5);
  context.restore();
}

function drawGuardFigure(context, guard, walls) {
  const coneColor = guard.mode === 'alert'
    ? 'rgba(231, 76, 60, 0.34)'
    : guard.mode === 'patrol'
      ? 'rgba(241, 196, 15, 0.20)'
      : 'rgba(230, 126, 34, 0.30)';
  drawVisionCone(
    context, guard.x, guard.y, guard.angle,
    GUARD_VIEW_DISTANCE, GUARD_VIEW_HALF_ANGLE, walls, coneColor,
  );
  context.fillStyle = '#2c3e63';
  context.beginPath();
  context.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#5d7bb3';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#f1c40f';
  context.beginPath();
  context.arc(
    guard.x + Math.cos(guard.angle) * 7, guard.y + Math.sin(guard.angle) * 7, 5, 0, Math.PI * 2,
  );
  context.fill();
  if (guard.mode !== 'patrol') {
    context.fillStyle = guard.mode === 'alert' ? '#e74c3c' : '#e67e22';
    context.font = '900 18px "Arial Black", Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(guard.mode === 'alert' ? '!' : '?', guard.x, guard.y - 22);
  }
}

function drawCameraFigure(context, camera, walls) {
  drawVisionCone(
    context, camera.x, camera.y, camera.angle,
    CAMERA_VIEW_DISTANCE, CAMERA_VIEW_HALF_ANGLE, walls, 'rgba(231, 76, 60, 0.16)',
  );
  context.fillStyle = '#3a3f52';
  context.fillRect(camera.x - 9, camera.y - 7, 18, 14);
  context.fillStyle = '#e74c3c';
  context.beginPath();
  context.arc(camera.x + Math.cos(camera.angle) * 11, camera.y + Math.sin(camera.angle) * 11, 4, 0, Math.PI * 2);
  context.fill();
}

function drawThiefFigure(context, player, sneaking, time) {
  const radius = sneaking ? 11 : 13;
  const glow = context.createRadialGradient(player.x, player.y, 4, player.x, player.y, 60);
  glow.addColorStop(0, 'rgba(255, 220, 120, 0.20)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(player.x, player.y, 60, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#14100c';
  context.beginPath();
  context.arc(player.x, player.y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#ffd65a';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#ffd65a';
  context.beginPath();
  context.arc(player.x, player.y - 3, 5, 0, Math.PI * 2);
  context.fill();
  if (sneaking) {
    context.fillStyle = '#9fb4d8';
    context.font = FONT_SMALL;
    context.textAlign = 'center';
    context.fillText('menyusup…', player.x, player.y - 22);
  }
}

function drawSmokeCloud(context, smoke) {
  if (smoke.timer <= 0) return;
  const alpha = Math.min(0.75, smoke.timer / 2);
  const gradient = context.createRadialGradient(smoke.x, smoke.y, 10, smoke.x, smoke.y, 130);
  gradient.addColorStop(0, `rgba(200, 205, 215, ${alpha})`);
  gradient.addColorStop(1, 'rgba(200, 205, 215, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(smoke.x, smoke.y, 130, 0, Math.PI * 2);
  context.fill();
}

function drawNightLight(context, player) {
  const light = context.createRadialGradient(
    player.x, player.y, 60, player.x, player.y, 520,
  );
  light.addColorStop(0, 'rgba(2, 4, 12, 0)');
  light.addColorStop(1, 'rgba(2, 4, 12, 0.62)');
  context.fillStyle = light;
  context.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
  const vignette = context.createRadialGradient(
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 300, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 820,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function alarmColor(alarm) {
  if (alarm < 25) return '#2ecc71';
  if (alarm < 60) return '#f39c12';
  return '#e74c3c';
}

function drawAlarmMeter(context, alarm, x, y, width) {
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x, y, width, 18);
  context.fillStyle = alarmColor(alarm);
  context.fillRect(x, y, Math.max(0, (alarm / ALARM_MAX) * width), 18);
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 1;
  context.strokeRect(x, y, width, 18);
  context.fillStyle = '#ffffff';
  context.font = FONT_SMALL;
  context.textAlign = 'left';
  context.fillText(`ALARM ${Math.round(alarm)}%`, x, y - 6);
}

function drawHud(context, state) {
  const level = LEVELS[state.levelIndex];
  context.fillStyle = '#0b0e1a';
  context.fillRect(0, 0, VIEW_WIDTH, HUD_HEIGHT);
  context.fillStyle = '#ffd65a';
  context.font = FONT_HUD;
  context.textAlign = 'left';
  context.fillText(`VELMORA HEIST — ${level.name}`, 16, 28);
  context.fillStyle = '#9fb4d8';
  context.font = FONT_SMALL;
  context.fillText(level.subtitle, 16, 50);
  context.fillStyle = '#ffffff';
  context.font = FONT_BODY;
  context.textAlign = 'center';
  context.fillText(`LOOT ${state.lootTaken}/${state.loot.length}`, 640, 26);
  context.fillStyle = '#ffd65a';
  context.fillText(`$${state.score.toLocaleString('en-US')}`, 640, 48);
  drawAlarmMeter(context, state.alarm, 940, 26, 260);
  context.fillStyle = '#9fb4d8';
  context.font = FONT_SMALL;
  context.textAlign = 'right';
  context.fillText(`ASAP x${state.smokesLeft}  [SPASI]`, 1216, 50);
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  state.grades.forEach((grade, index) => {
    context.fillText(`${LEVELS[index].name}: ${grade}`, 16, VIEW_HEIGHT - 12 - index * 18);
  });
}

function drawCenterPanel(context, title, lines, accent) {
  context.fillStyle = 'rgba(5, 7, 16, 0.72)';
  context.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
  context.fillStyle = accent;
  context.font = FONT_TITLE;
  context.textAlign = 'center';
  context.fillText(title, VIEW_WIDTH / 2, 300);
  context.fillStyle = '#ffffff';
  context.font = FONT_BODY;
  lines.forEach((line, index) => {
    context.fillText(line, VIEW_WIDTH / 2, 350 + index * 30);
  });
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');

  function draw(state, screen, best, banner) {
    context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawFloor(context, state.walls);
    drawExitDoor(context, state.exit, state.lootTaken >= state.loot.length, state.time);
    state.loot.forEach((item) => drawLootItem(context, item, state.time));
    state.cameras.forEach((camera) => drawCameraFigure(context, camera, state.walls));
    state.guards.forEach((guard) => drawGuardFigure(context, guard, state.walls));
    drawSmokeCloud(context, state.smoke);
    drawThiefFigure(context, state.player, !!state.playerSneaking, state.time);
    drawNightLight(context, state.player);
    drawHud(context, state);

    if (banner) {
      context.fillStyle = 'rgba(5, 7, 16, 0.85)';
      context.fillRect(340, 96, 600, 54);
      context.strokeStyle = '#ffd65a';
      context.lineWidth = 2;
      context.strokeRect(340, 96, 600, 54);
      context.fillStyle = '#ffd65a';
      context.font = FONT_HEADING;
      context.textAlign = 'center';
      context.fillText(banner, VIEW_WIDTH / 2, 133);
    }

    if (screen === SCREEN_TITLE) {
      drawCenterPanel(context, 'VELMORA HEIST', [
        'Tiga job. Satu malam. Jangan sampai ketahuan.',
        'WASD / panah: bergerak   •   Shift: menyusup   •   Spasi: bom asap (-$150)',
        'Klik mouse: berjalan ke titik itu   •   Curi semua loot, lalu kabur lewat pintu EXIT.',
        'Penjaga dan kamera menaikkan ALARM. Alarm 100% = ketahuan.',
        'Tekan ENTER untuk mulai — skor terbaik $' + best.toLocaleString('en-US'),
      ], '#ffd65a');
    } else if (screen === SCREEN_PAUSED) {
      drawCenterPanel(context, 'JEDA', ['Tekan P atau Esc untuk lanjut.', 'Tekan ENTER untuk mulai ulang level.'], '#9fb4d8');
    } else if (screen === SCREEN_CAUGHT) {
      drawCenterPanel(context, 'KETAHUAN!', [
        `Alarm mencapai 100% di ${LEVELS[state.levelIndex].name}.`,
        'Tekan ENTER untuk mencoba lagi level ini.',
      ], '#e74c3c');
    } else if (screen === SCREEN_COMPLETE) {
      const gradeText = state.grades.map((grade, index) => `${LEVELS[index].name}: ${grade}`).join('   •   ');
      drawCenterPanel(context, 'HEIST SELESAI!', [
        `Semua loot berhasil dibawa kabur. Skor akhir $${state.score.toLocaleString('en-US')}.`,
        gradeText,
        'Tekan ENTER untuk main lagi.',
      ], '#2ecc71');
    }
  }

  return { draw };
}
