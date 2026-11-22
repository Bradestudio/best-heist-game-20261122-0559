// Keyboard and mouse input: WASD/arrows to move, Shift to sneak, Space for a
// smoke bomb, P/Esc to pause, Enter to confirm. Mouse click sets a waypoint
// the thief walks toward; clicking a guard marks nothing, it only moves.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_SMOKE = 'smoke';

export function createInput(canvas, onAction) {
  const keys = new Set();
  let waypoint = null;
  let smokeQueued = false;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onKeyDown(event) {
    const key = keyName(event);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
    }
    if (key === ' ' && !keys.has(' ')) smokeQueued = true;
    if (key === 'enter') onAction(ACTION_CONFIRM);
    if (key === 'p' || key === 'P' || key === 'escape') onAction(ACTION_PAUSE);
    keys.add(key);
  }

  function onKeyUp(event) {
    keys.delete(keyName(event));
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    waypoint = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function onBlur() {
    keys.clear();
    waypoint = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  function readMovement(player) {
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    if (dx === 0 && dy === 0 && waypoint) {
      const distanceX = waypoint.x - player.x;
      const distanceY = waypoint.y - player.y;
      if (Math.hypot(distanceX, distanceY) < 8) {
        waypoint = null;
      } else {
        dx = distanceX;
        dy = distanceY;
      }
    }
    const smoke = smokeQueued;
    smokeQueued = false;
    return {
      dx,
      dy,
      sneak: keys.has('shift'),
      smoke,
    };
  }

  return { readMovement };
}
