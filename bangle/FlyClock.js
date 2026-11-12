// Fliegenuhr: 3×5-Ziffern mit ausgedünnten Zellen, eine Fliege pro Zelle. Stunden oben, Minuten unten.
// Sitzende Fliegen bewegen sich nicht. Ohne fliegende Fliege läuft kein Intervall,
// die Uhr schläft bis zum nächsten Minutenwechsel oder einer Berührung.
{
// <sprites> erzeugt von bangle/tools/flysprites.py aus shared/assets/fly/flyex.png
const SPRITE_SIZE = 22;
// [Pose][Richtung]: Pose 0 sitzt, 1–3 Flügelschlag; Richtung 0 = Norden, im Uhrzeigersinn.
const SPRITES = [
  ["AAAAAAAAAAAAAAAAAVFQAAAAEVEAAAABQFAAAAVTMVQAAEEAEEAABUAAVAAAFCIFAAAFKioUAAFKoqhQABCoCoEAASqAqhAAFCACBQAAUAABQAAEVAVEAABUVUVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAABVFQAAAVQVEAAAUAEBUAAEqoMBAABKqgxQAAUqoAQABUAAoVAAQQAKgQAFUACoEAABAAqFAAAUAKhAAABQAoQAAAFUQUAAAAEVUAAAABEAAAAAAVAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAABVAAAAAVQUVAAAESBUQAABQqFEAAAEqoFVAAFCqAEQABACoMUAAQAAAEAAEAKgxQABQqgBEAAEqoFVAAFCoUQAABEgVEAAAVQUVAAAAFUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAVAAAAAAEQAAAAABFVAAAAFUQUAAAFAChAAAFACoQAABAAqFAAVQAKgQAEEACoEABUAAoVAABSqgBAAASqoMUAAEqoMBAABQAQFQAAFUFRAAAABVFQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFRVRUAABFQFRAAAUAABQAAUIAIFAAEqgKoQABCoCoEAAUqiqFAABSoqFAAAFCIFAAAFQABUAABBABBAAAVTMVQAAAFAUAAAABFRAAAAAVFQAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAABEAAAABVRAAAABQRVAAAASgAUAAAEqABQAAFKgAEAABCoABVAAQqAAQQAFSgABUAAQCqhQAAUwqqEAAEDCqhAABUBABQAABFQVQAAAVFUAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVAAAAFRQVQAABFQhEAAARSoFAAFVCqhAABEAqgUAAUwqABAABAAAAQABTCoAEAARAKoFAAFVCqhAAABFKgUAAARUIRAAAFRQVQAAAAFUAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVFUAAAAEVBVAAAVAQAUAAEDCqhAABTCqoQAAEAqoUAAFSgABUABCoABBAAQqAAVQAFKgAEAAASoAFAAAEoAFAAABQRVAAAAFVEAAAAAARAAAAAAFQAAAAAAAAAAAAAAAAAA=="],
  ["AAAAAAAAAAAAAAAAAVFQAAAAEVEAAAFVQFVQAFATMQFABCgACgQASqgKqEAEqqKqhABCqAqgQAVAAABUABBAAEEAAVQABVAAAQAAEAAAUQARQAAEVAVEAABUVUVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAFVAAAAAFAUAAAAFKhAAAABKoVQAAAUqFEAAAFKoBUAABAqMBAAAVCgxQAAVQAAVQBUAAKgFAQQACqoQFUAAKqEABAAAqhAAUAFAhQABQBRRQAAFUVVQAAAEUAAAAABEAAAAAAVAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAFVQAAAAVAFAAAVESgQAAEVCqEAABQUqhAAAFAKhVAAFACoEQABAAIMUAAQAAAEAAEAAgxQABQAqBEAAFAKhVAAFBSqEAABFQqhAAAVESgQAAABUAUAAAABVUAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAVAAAAAAEQAAAAABFAAAAAFUVVQAAFAFFFAAFABQIUABAAAqhAVQAAqoQEEAAqqEBUAAKgFABVAABVAAFQoMUAABAqMBAAAUqgFQAAFKhRAAABKoVQAAAUqEAAAABQFAAAAAFVAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFRVRUAABFQFRAAAUQARQAABAAAQAAFUAAVQABBAAEEABUAAAFQAQqgKoEAEqqKqhABKqAqoQAQoAAoEAFATMQFAAVVAVVAAABFRAAAAAVFQAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAABEAAAAABRAAAAVVRVAAAUUUAUAAUgFABQAEqgAAEABKqAABVASqoAAQQFAqAABUAVQAAVQAAUwoFQAAEDKgEAABUCqFAAABFKhQAAAVSqEAAAAEqFAAAABQFAAAAAFVAAA==", "AAAAAAAAAAAAAAAAAAAAAAABVUAAAABQBUAAAAQoRFQAAEqgVEAABKoUFAAFUqAFAABEKgAUAAUwgABAABAAAAQABTCAAEAARCoAFAAFUqAFAAAEqhQUAABKoFRAAAQoRFQAAFAFQAAAAVVAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAFVAAAAAFAUAAAABKhQAAAVSqEAAAEUqFAAAVAqhQAAEDKgEAABTCgVAAFUAAFUAFAqAABUBKqgABBASqgAAVQEqgAAEABSAUAFAAFFFAFAAAVVRVAAAAAFEAAAAAARAAAAAAFQAAAAAAAAAAAAAAAAAA=="],
  ["AAAAAAAAAAAAAAAAAVFQAAAAEVEAAAVVQFVUAUATMQBQEKgACoEBKqgKqhASqqKqoQEKqAqoEBQAAAAFAFBAAEFAAVQABVAAAQAAEAAAUQARQAAEVAVEAABUVUVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAVQAAAAAUFAAAAAUoUAAAAEqhVQAABKqFEAAASqgBUAAFCqMBAAAVKgxQAAVQAAUABUAAKBQAQQACqFAFUAAKoUABAACqhAAUAFKoQABQBSoUAAFUVAUAAAEUVUAAABEAAAAAAVAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAVVAAAAAUAUAAAAUKBAAAVEKoQAAEVCqEAABQUqhAAAFAKhVAAFACoEQABAAIMUAAQAAAEAAEAAgxQABQAqBEAAFAKhVAAFBSqEAABFQqhAAAVEKoQAAABQoEAAAAFAFAAAAAVVAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAVAAAAAAEQAAAAABFFVAAAFUVAUAAFAFKhQAFABSqEABAACqhAVQACqhQEEAAqhQBUAAKBQABVAABQAAFQoMUAAFCqMBAABKqAFQAASqhRAAAEqhVQAABShQAAAAFBQAAAAAVQAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFRVRUAABFQFRAAAUQARQAABAAAQAAFUAAVQAFBAAEFAFAAAAAUBCqgKqBASqqKqoQEqqAqqEBCoAAqBAUATMQBQBVVAVVQAABFRAAAAAVFQAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAABEAAABVRRAAABQFRVAABSoUAUAASqFABQAEqoAAEABSqAABVAFKoAAQQAUKAABUABQAAVQAAUwqFQAAEDKoFAABUAqoQAABFKqEAAAVUqhAAAABShQAAAAFBQAAAAAVQAA==", "AAAAAAAAAAAAAAAAFVQAAAAFAFAAAABCgUAAAASqBFQAAEqgVEAABKoUFAAFUqAFAABEKgAUAAUwgABAABAAAAQABTCAAEAARCoAFAAFUqAFAAAEqhQUAABKoFRAAASqBFQAAEKBQAAABQBQAAAAFVQAAAAAAAAAAA==", "AAAAAAAAAAAVQAAAAAUFAAAAAUoUAAAVUqhAAAEUqoQAAVAKqEAAEDKoFAABTCgVAAAUAAFUAAUKAABUAUqgABBAUqoAAVQEqoAAEABKoUAFAAUqFAFAABQFRVAAAFVFEAAAAAARAAAAAAFQAAAAAAAAAAAAAAAAAA=="],
  ["AAAAAAAAAAAAAAAAAVFQAAAAEVEAAAABQFAAABVTMVUABQAAABQAQqgKoEAEqqKqhABKqAqoQAQoAAoEAFAAAAFAAVQABVAAAQAAEAAAUQARQAAEVAVEAABUVUVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAFQAAAAAFFQAAAAFIFFQAABKoVEAAASqgBUAAEqqMBAABQKgxQAAVQAAQABUAAKFAAQQACoUAFUAAqhAABAACoUAAUAEqhAABQBKhQAAFUUBQAAAEVVQAAABEAAAAAAVAAAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAVVAAAAAUAUAAAVEKBAAAEVKoQAABQSqEAAAFAKhVAAFACoEQABAAIMUAAQAAAEAAEAAgxQABQAqBEAAFAKhVAAFBKoQAABFSqEAAAVEKBAAAABQBQAAAAFVQAAAAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAVAAAAAAEQAAAAABFVUAAAFUUBQAAFAEqFAAFABKoQABAACoUAVQACqEAEEAAqFABUAAKFAABVAABAAAUCoMUAAEqqMBAABKqAFQAASqFRAAAFIFFQAAAUVAAAAABUAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFRVRUAABFQFRAAAUQARQAABAAAQAAFUAAVQAFAAAAFABCgACgQASqgKqEAEqqKqhABCqAqgQAUAAAAUABVTMVUAAAFAUAAAABFRAAAAAVFQAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAABEAAAAVVRAAAAUBRVAAAUqEAUAAEqhABQABSoAAEAAEqgABVABSoAAQQAFKAABUAAQAAVQAAUwqAUAAEDKqhAABUAqoQAABFSqEAAAVFCFAAAAAVFAAAAAAVAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAVVAAAAAUAUAAAAEKBFQAABKoVEAAASqEFAAFUqAFAABEKgAUAAUwgABAABAAAAQABTCAAEAARCoAFAAFUqAFAAABKoQUAAASqFRAAAEKBFQAABQBQAAAAFVQAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAABUAAAAAFRQAAAVFCFAAAEVKoQAAVAKqEAAEDKqhAABTCoBQAAEAAFUAAFKAABUAFKgABBABKoAAVQBSoAAEAASqEAFAAFKhAFAAAUBRVAAABVVEAAAAAARAAAAAAFQAAAAAAAAAAAAAAAAAA=="]
];
// </sprites>

const W = g.getWidth();
const H = g.getHeight();
const PITCH = Math.floor(Math.min(W / 7.5, H / 10.6));
const ROW_GAP = Math.round(PITCH / 2);
const HALF = SPRITE_SIZE >> 1;
const HOP = PITCH * 1.6;
const SPEED = PITCH * 0.3;
const SCARE = PITCH * 2.5;
const FRAME_MS = 50;
// Aus: Bei gesperrter Uhr springen die Fliegen ohne Flug auf ihre Plätze.
const FLY_WHEN_LOCKED = true;

// 3×5-Raster, auf möglichst wenige Zellen ausgedünnt.
const FONT = [
  ["010", "101", "101", "101", "010"],
  ["010", "110", "010", "010", "010"],
  ["110", "001", "010", "100", "111"],
  ["110", "001", "010", "001", "110"],
  ["100", "101", "111", "001", "001"],
  ["111", "100", "110", "001", "110"],
  ["011", "100", "110", "101", "010"],
  ["111", "001", "010", "010", "010"],
  ["010", "101", "010", "101", "010"],
  ["010", "101", "011", "001", "110"]
];
// Flügelschlag wie im Simulator: Posen 1–3.
const FLAP = [1, 1, 2, 2, 2, 3, 3, 3, 2, 2, 2];

const PALETTE = new Uint16Array([0, g.toColor(0, 0, 1), g.toColor(1, 1, 1), g.toColor(1, 0, 0)]);
const IMAGES = SPRITES.map((row) => row.map((data) => ({
  width: SPRITE_SIZE, height: SPRITE_SIZE, bpp: 2, transparent: 0, palette: PALETTE, buffer: E.toArrayBuffer(atob(data))
})));

let flies = [];
let slots = {};
let frameTimer;
let minuteTimer;

function wrap(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// 0 = Norden, im Uhrzeigersinn.
function directionOf(vx, vy, previous) {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  if (ax < 0.05 && ay < 0.05) return previous;
  if (ay > ax * 2) return vy < 0 ? 0 : 4;
  if (ax > ay * 2) return vx < 0 ? 6 : 2;
  if (vy < 0) return vx < 0 ? 7 : 1;
  return vx < 0 ? 5 : 3;
}

// Slot-Ids hängen an Stelle und Zelle, damit bleibende Zellen ihre Fliege behalten.
function slotsFor(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const digits = [h >= 10 ? Math.floor(h / 10) : -1, h % 10, Math.floor(m / 10), m % 10];
  const x0 = (W - 7 * PITCH) / 2 + PITCH / 2;
  const y0 = (H - 10 * PITCH - ROW_GAP) / 2 + PITCH / 2;
  const result = {};
  digits.forEach((digit, i) => {
    if (digit < 0) return;
    const bx = x0 + (i % 2) * 4 * PITCH;
    const by = y0 + (i >> 1) * (5 * PITCH + ROW_GAP);
    FONT[digit].forEach((row, r) => {
      for (let c = 0; c < 3; c++) {
        if (row[c] === "1") result[i + ":" + r + ":" + c] = { x: bx + c * PITCH, y: by + r * PITCH };
      }
    });
  });
  return result;
}

function outside() {
  const t = Math.random();
  const m = SPRITE_SIZE;
  switch (Math.floor(Math.random() * 4)) {
    case 0: return { x: t * W, y: -m };
    case 1: return { x: W + m, y: t * H };
    case 2: return { x: t * W, y: H + m };
    default: return { x: -m, y: t * H };
  }
}

// Kurze Sprünge mit Richtungsrauschen; der letzte Punkt liegt genau auf dem Ziel.
function route(from, to) {
  const points = [];
  let x = from.x;
  let y = from.y;
  let heading = Math.atan2(to.y - y, to.x - x);
  for (let i = 0; i < 8; i++) {
    const dx = to.x - x;
    const dy = to.y - y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < HOP * 1.5) break;
    heading += wrap(Math.atan2(dy, dx) - heading) * 0.6 + (Math.random() - 0.5) * 1.2;
    const step = Math.min(len, HOP * (1 + Math.random()));
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    points.push({ x: x, y: y });
  }
  points.push({ x: to.x, y: to.y });
  return points;
}

function takeNearest(list, target) {
  let best = -1;
  let bestDist = Infinity;
  list.forEach((fly, i) => {
    const d = (fly.x - target.x) * (fly.x - target.x) + (fly.y - target.y) * (fly.y - target.y);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best < 0 ? undefined : list.splice(best, 1)[0];
}

// Fliegen auf wegfallenden Zellen fliegen zu neuen Zellen, der Rest verlässt die Uhr.
function sync() {
  const next = slotsFor(new Date());
  const free = [];
  const taken = {};
  flies.forEach((fly) => {
    if (fly.slot && !next[fly.slot]) { fly.slot = undefined; free.push(fly); }
    else if (fly.slot) taken[fly.slot] = true;
  });
  for (const id in next) {
    if (taken[id]) continue;
    let fly = takeNearest(free, next[id]);
    if (!fly) {
      const start = outside();
      fly = { x: start.x, y: start.y, dir: directionOf(next[id].x - start.x, next[id].y - start.y, 0), anim: Math.floor(Math.random() * FLAP.length) };
      flies.push(fly);
    }
    fly.slot = id;
    fly.exit = false;
    fly.route = route(fly, next[id]);
  }
  free.forEach((fly) => {
    fly.exit = true;
    fly.route = route(fly, outside());
  });
  slots = next;
  animate();
}

function land(fly) {
  fly.route = undefined;
  if (fly.exit) {
    fly.gone = true;
    return;
  }
  fly.x = slots[fly.slot].x;
  fly.y = slots[fly.slot].y;
}

function step(fly) {
  const point = fly.route[0];
  const dx = point.x - fly.x;
  const dy = point.y - fly.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  fly.anim++;
  if (dist <= SPEED) {
    fly.x = point.x;
    fly.y = point.y;
    fly.route.shift();
    if (!fly.route.length) land(fly);
    return;
  }
  fly.x += dx / dist * SPEED;
  fly.y += dy / dist * SPEED;
  fly.dir = directionOf(dx, dy, fly.dir);
}

function draw() {
  g.reset();
  g.setBgColor(0, 0, 0);
  g.clearRect(0, 0, W - 1, H - 1);
  flies.forEach((fly) => {
    const pose = fly.route ? FLAP[fly.anim % FLAP.length] : 0;
    g.drawImage(IMAGES[pose][fly.dir], Math.round(fly.x) - HALF, Math.round(fly.y) - HALF);
  });
}

function tick() {
  let moving = 0;
  flies.forEach((fly) => {
    if (!fly.route) return;
    step(fly);
    if (fly.route) moving++;
  });
  flies = flies.filter((fly) => !fly.gone);
  draw();
  if (!moving && frameTimer) {
    clearInterval(frameTimer);
    frameTimer = undefined;
  }
}

function animate() {
  if (!FLY_WHEN_LOCKED && Bangle.isLocked()) {
    flies.forEach((fly) => { if (fly.route) land(fly); });
    flies = flies.filter((fly) => !fly.gone);
    draw();
    return;
  }
  if (!frameTimer) frameTimer = setInterval(tick, FRAME_MS);
}

function scheduleMinute() {
  minuteTimer = setTimeout(() => {
    minuteTimer = undefined;
    sync();
    scheduleMinute();
  }, 60000 - (Date.now() % 60000) + 20);
}

// Berührte Fliegen springen kurz weg und kehren auf ihre Zelle zurück.
function onTouch(button, xy) {
  if (!xy) return;
  let scared = false;
  flies.forEach((fly) => {
    if (fly.exit || !fly.slot) return;
    const dx = fly.x - xy.x;
    const dy = fly.y - xy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > SCARE) return;
    const away = (dist < 1 ? Math.random() * 2 * Math.PI : Math.atan2(dy, dx)) + (Math.random() - 0.5);
    const reach = PITCH * (2 + Math.random() * 2);
    const flee = { x: fly.x + Math.cos(away) * reach, y: fly.y + Math.sin(away) * reach };
    fly.route = [flee].concat(route(flee, slots[fly.slot]));
    scared = true;
  });
  if (scared) animate();
}

Bangle.setUI({
  mode: "clock",
  remove: () => {
    if (frameTimer) clearInterval(frameTimer);
    if (minuteTimer) clearTimeout(minuteTimer);
    frameTimer = undefined;
    minuteTimer = undefined;
    Bangle.removeListener("touch", onTouch);
    try { require("widget_utils").show(); } catch (e) { }
  }
});
Bangle.on("touch", onTouch);
Bangle.loadWidgets();
try { require("widget_utils").hide(); } catch (e) { }
g.setBgColor(0, 0, 0);
g.clear();
sync();
scheduleMinute();
}
