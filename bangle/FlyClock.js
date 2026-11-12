// Fliegenuhr: Sieben-Segment-Ziffern, eine Fliege pro Segment. Stunden oben, Minuten unten.
// Sitzende Fliegen bewegen sich nicht. Ohne fliegende Fliege läuft kein Intervall,
// die Uhr schläft bis zum nächsten Minutenwechsel oder einer Berührung.
{
const W = g.getWidth();
const H = g.getHeight();
const DW = Math.round(W * 0.3);
const DH = Math.round(H * 0.36);
const GAP = Math.round(W * 0.12);
const ROW_GAP = Math.round(H * 0.1);
const LEN = Math.round(Math.min(DW, DH / 2) * 0.72);
const SPEED = LEN * 0.2;
const FRAME_MS = 50;
const SCARE = LEN * 2.5;
// Aus: Bei gesperrter Uhr springen die Fliegen ohne Flug auf ihre Plätze.
const FLY_WHEN_LOCKED = true;

// Segmentmitte relativ zur Ziffer (x, y) und Lage (0 waagrecht, 1 senkrecht).
const SEGMENTS = {
  a: [0.5, 0, 0], b: [1, 0.25, 1], c: [1, 0.75, 1], d: [0.5, 1, 0],
  e: [0, 0.75, 1], f: [0, 0.25, 1], g: [0.5, 0.5, 0]
};
const DIGITS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

let flies = [];
let slots = {};
let frameTimer;
let minuteTimer;

function wrap(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// Slot-Ids hängen an Stelle und Segment, damit bleibende Segmente ihre Fliege behalten.
function slotsFor(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const digits = [h >= 10 ? Math.floor(h / 10) : -1, h % 10, Math.floor(m / 10), m % 10];
  const x0 = (W - 2 * DW - GAP) / 2;
  const y0 = (H - 2 * DH - ROW_GAP) / 2;
  const result = {};
  digits.forEach((digit, i) => {
    if (digit < 0) return;
    const bx = x0 + (i % 2) * (DW + GAP);
    const by = y0 + (i >> 1) * (DH + ROW_GAP);
    DIGITS[digit].split("").forEach((name) => {
      const seg = SEGMENTS[name];
      result[i + name] = { x: bx + seg[0] * DW, y: by + seg[1] * DH, a: seg[2] * Math.PI / 2 };
    });
  });
  return result;
}

function outside() {
  const t = Math.random();
  const m = LEN * 2;
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
    if (len < LEN * 1.5) break;
    heading += wrap(Math.atan2(dy, dx) - heading) * 0.6 + (Math.random() - 0.5) * 1.2;
    const step = Math.min(len, LEN * (1 + Math.random()));
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

// Fliegen auf wegfallenden Segmenten fliegen zu neuen Segmenten, der Rest verlässt die Uhr.
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
      fly = { x: start.x, y: start.y, h: Math.atan2(next[id].y - start.y, next[id].x - start.x), flap: 0 };
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
  const slot = slots[fly.slot];
  fly.x = slot.x;
  fly.y = slot.y;
  // Längs ins Segment drehen, in die Richtung, die der Flugrichtung näher liegt.
  fly.h = Math.abs(wrap(slot.a - fly.h)) <= Math.PI / 2 ? slot.a : wrap(slot.a + Math.PI);
}

function step(fly) {
  const point = fly.route[0];
  const dx = point.x - fly.x;
  const dy = point.y - fly.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= SPEED) {
    fly.x = point.x;
    fly.y = point.y;
    fly.route.shift();
    if (!fly.route.length) land(fly);
    return;
  }
  fly.h += wrap(Math.atan2(dy, dx) - fly.h) * 0.5;
  fly.x += dx / dist * SPEED;
  fly.y += dy / dist * SPEED;
  fly.flap ^= 1;
}

function drawFly(fly) {
  const c = Math.cos(fly.h);
  const s = Math.sin(fly.h);
  const x = fly.x;
  const y = fly.y;
  const P = (lx, ly) => [x + (lx * c - ly * s) * LEN, y + (lx * s + ly * c) * LEN];
  const flying = !!fly.route;

  g.setColor(g.theme.fg);
  if (!flying) {
    [[0.3, 0.3], [0.05, 0.36], [-0.2, 0.32]].forEach((leg) => {
      const a = P(0.08, 0);
      g.drawLine(a[0], a[1], P(leg[0], leg[1])[0], P(leg[0], leg[1])[1]);
      g.drawLine(a[0], a[1], P(leg[0], -leg[1])[0], P(leg[0], -leg[1])[1]);
    });
  }
  const body = [];
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4;
    const p = P(-0.2 + Math.cos(t) * 0.28, Math.sin(t) * 0.17);
    body.push(p[0], p[1]);
  }
  g.fillPoly(body);
  const thorax = P(0.1, 0);
  g.fillCircle(thorax[0], thorax[1], Math.max(1, LEN * 0.14));
  const head = P(0.32, 0);
  g.fillCircle(head[0], head[1], Math.max(1, LEN * 0.1));
  g.setColor(1, 0, 0);
  [-0.07, 0.07].forEach((side) => {
    const eye = P(0.34, side);
    g.fillCircle(eye[0], eye[1], Math.max(1, LEN * 0.05));
  });

  const spread = flying ? (fly.flap ? 1.4 : 0.5) : 1;
  g.setColor(0, 0, 1);
  [-1, 1].forEach((side) => {
    const wing = [P(0.05, 0.04 * side), P(-0.35, 0.36 * spread * side), P(-0.58, 0.2 * spread * side), P(-0.2, 0.02 * side)];
    g.drawPoly([].concat(wing[0], wing[1], wing[2], wing[3]), true);
  });
}

function draw() {
  g.reset();
  g.clearRect(0, 0, W - 1, H - 1);
  flies.forEach(drawFly);
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
    flies.forEach((fly) => { if (fly.route) { fly.route = []; land(fly); } });
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

// Berührte Fliegen springen kurz weg und kehren auf ihr Segment zurück.
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
    const reach = LEN * (2 + Math.random() * 2);
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
g.clear();
sync();
scheduleMinute();
}
