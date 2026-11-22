// The three jobs of VELMORA HEIST. Each level is one room the thief crosses:
// walls shape several routes, guards walk patrol loops, cameras sweep fixed
// arcs, loot must all be taken, then the thief escapes through the exit door.
export const LEVEL_NAMES = ['GALERI MUSEUM', 'BRANKAS BANK', 'PENTHOUSE'];
export const LEVEL_SUBTITLES = [
  'Curi 4 mahakarya, lalu kabur lewat pintu timur.',
  'Bobol brankas: 5 bundel uang, 3 penjaga, kamera di mana-mana.',
  'Job terakhir: penthouse sang kolektor. Jangan sampai ketahuan.',
];

function wall(x, y, w, h) {
  return { x, y, w, h };
}

function guard(waypoints, pauseSeconds) {
  return { waypoints, pauseSeconds: pauseSeconds ?? 1.2 };
}

function camera(x, y, baseAngle, sweepRadians) {
  return { x, y, baseAngle, sweepRadians };
}

function loot(x, y, value, label) {
  return { x, y, value, label, taken: false };
}

export const LEVELS = [
  {
    name: LEVEL_NAMES[0],
    subtitle: LEVEL_SUBTITLES[0],
    playerStart: { x: 70, y: 640 },
    exit: { x: 1210, y: 330, w: 46, h: 90 },
    walls: [
      wall(0, 64, 1280, 10),
      wall(0, 700, 1280, 20),
      wall(0, 64, 10, 656),
      wall(1270, 64, 10, 656),
      wall(300, 150, 180, 26),
      wall(300, 150, 26, 220),
      wall(640, 420, 220, 26),
      wall(640, 420, 26, 200),
      wall(900, 150, 26, 220),
      wall(900, 330, 200, 26),
      wall(180, 480, 200, 26),
    ],
    guards: [
      guard([{ x: 560, y: 240 }, { x: 560, y: 560 }, { x: 1080, y: 560 }, { x: 1080, y: 240 }]),
      guard([{ x: 220, y: 200 }, { x: 220, y: 620 }]),
    ],
    cameras: [
      camera(640, 80, Math.PI / 2, 0.9),
      camera(1150, 700, -Math.PI / 2, 0.8),
    ],
    loot: [
      loot(390, 300, 400, 'Lukisan Senja'),
      loot(770, 250, 500, 'Patung Marmer'),
      loot(1010, 480, 450, 'Permata Biru'),
      loot(260, 620, 350, 'Topeng Emas'),
    ],
  },
  {
    name: LEVEL_NAMES[1],
    subtitle: LEVEL_SUBTITLES[1],
    playerStart: { x: 70, y: 140 },
    exit: { x: 1210, y: 600, w: 46, h: 90 },
    walls: [
      wall(0, 64, 1280, 10),
      wall(0, 700, 1280, 20),
      wall(0, 64, 10, 656),
      wall(1270, 64, 10, 656),
      wall(240, 200, 26, 260),
      wall(240, 200, 320, 26),
      wall(560, 330, 26, 280),
      wall(560, 330, 300, 26),
      wall(860, 140, 26, 260),
      wall(860, 400, 260, 26),
      wall(240, 560, 320, 26),
      wall(1000, 500, 26, 160),
    ],
    guards: [
      guard([{ x: 400, y: 300 }, { x: 400, y: 500 }, { x: 760, y: 500 }, { x: 760, y: 300 }]),
      guard([{ x: 180, y: 620 }, { x: 1000, y: 620 }]),
      guard([{ x: 980, y: 180 }, { x: 980, y: 330 }]),
    ],
    cameras: [
      camera(640, 80, Math.PI / 2, 1.0),
      camera(120, 700, -Math.PI / 2, 0.8),
      camera(1150, 80, Math.PI / 2, 0.9),
    ],
    loot: [
      loot(400, 140, 500, 'Bundel Dolar'),
      loot(700, 470, 600, 'Brankas Kecil'),
      loot(980, 300, 700, 'Batangan Emas'),
      loot(420, 640, 450, 'Koin Langka'),
      loot(1120, 180, 800, 'Berlian Vault'),
    ],
  },
  {
    name: LEVEL_NAMES[2],
    subtitle: LEVEL_SUBTITLES[2],
    playerStart: { x: 70, y: 640 },
    exit: { x: 70, y: 120, w: 46, h: 90 },
    walls: [
      wall(0, 64, 1280, 10),
      wall(0, 700, 1280, 20),
      wall(0, 64, 10, 656),
      wall(1270, 64, 10, 656),
      wall(280, 140, 200, 26),
      wall(280, 140, 26, 240),
      wall(620, 480, 240, 26),
      wall(620, 480, 26, 180),
      wall(940, 140, 26, 240),
      wall(940, 380, 220, 26),
      wall(200, 500, 220, 26),
      wall(980, 540, 200, 26),
    ],
    guards: [
      guard([{ x: 520, y: 250 }, { x: 520, y: 600 }, { x: 1100, y: 600 }, { x: 1100, y: 250 }]),
      guard([{ x: 200, y: 300 }, { x: 760, y: 300 }]),
      guard([{ x: 1150, y: 480 }, { x: 1150, y: 200 }]),
    ],
    cameras: [
      camera(640, 80, Math.PI / 2, 1.1),
      camera(1200, 700, -Math.PI / 2, 0.9),
    ],
    loot: [
      loot(380, 280, 900, 'Mahkota Velmora'),
      loot(760, 620, 600, 'Jam Saku Emas'),
      loot(1060, 280, 750, 'Kalung Rubi'),
      loot(300, 620, 500, 'Peti Perak'),
      loot(1150, 120, 1000, 'Telur Faberge'),
    ],
  },
];

export function levelLootTotal(level) {
  return level.loot.reduce((sum, item) => sum + item.value, 0);
}
