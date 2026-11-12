import { clockSlots, PANEL_H, PANEL_W, peakCount, stackedSlots } from "./glyphs.js";

const RADIUS = 8;
const LARGE_RADIUS = 15;
// Annäherungsgeschwindigkeit in Pixeln pro Schritt, ab der ein Stoß klingt.
const MIN_HIT = 0.25;
const HIT_PAUSE = 5;
const COLORS = [
	["#f7fbff", "#8eb6ff", "#1c305f"],
	["#fff4e4", "#e2a84e", "#5a3812"],
	["#ffe8e6", "#e07068", "#4c1c1a"],
	["#e8fff1", "#54c484", "#143222"],
	["#f4e9ff", "#b184e2", "#2e1846"],
	["#fff9df", "#e2cc6a", "#3e3412"],
	["#e7fbff", "#62c4d4", "#12343c"],
	["#ffffff", "#c6c6c6", "#2a2a2a"]
];

function outsidePoint() {
	const margin = 36 + Math.random() * 70;
	const along = Math.random();
	switch (Math.floor(Math.random() * 4)) {
		case 0: return { x: along * PANEL_W, y: -margin };
		case 1: return { x: PANEL_W + margin, y: along * PANEL_H };
		case 2: return { x: along * PANEL_W, y: PANEL_H + margin };
		default: return { x: -margin, y: along * PANEL_H };
	}
}

// frame "glass" hält die Murmeln im ovalen Uhrenglas, "screen" am Bildschirmrand.
export function createMarbles({ frame = "glass" } = {}) {
	const marbles = [];
	const pool = peakCount() * 2;
	for (let i = 0; i < pool; i++) {
		marbles.push({
			active: false,
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			target: null,
			slotId: null,
			exit: null,
			color: COLORS[i % COLORS.length],
			kind: i % 8,
			q: [0, 0, 0, 1],
			hitAt: -Infinity
		});
	}

	let stamp = "";
	let loose = 0;
	let wasLoose = false;
	let style = "plain";
	let painter = null;
	let onHit = null;
	let tick = 0;

	function update(input, date) {
		tick++;
		const key = `${date.getHours()}:${date.getMinutes()}`;
		const large = style === "oxyd-large" || style === "oxyd-floor";
		const slots = large ? stackedSlots(date) : clockSlots(date);
		const body = large ? LARGE_RADIUS : RADIUS;
		if (key !== stamp) {
			stamp = key;
			if (loose <= 0) syncStable(slots);
		}

		const flick = Math.hypot(input.flickX, input.flickY);
		const tilt = Math.hypot(input.tiltX, input.tiltY);
		if (flick > 4 || tilt > 0.2) loose = 42;
		if (loose > 0) loose--;
		if (wasLoose && loose === 0) syncNearest(slots);
		wasLoose = loose > 0;

		for (const marble of marbles) {
			if (!marble.active || !marble.target) continue;
			const magnet = marble.exit ? 0.0045 : loose > 0 ? 0.0002 : tilt > 0.16 ? 0.0006 : 0.0022;
			const dx = marble.target.x - marble.x;
			const dy = marble.target.y - marble.y;
			marble.vx += dx * magnet + input.tiltX + input.flickX * 0.07;
			marble.vy += dy * magnet + input.tiltY + input.flickY * 0.07;
			marble.vx *= 0.978;
			marble.vy *= 0.978;
		}

		for (let i = 0; i < marbles.length; i++) {
			if (!marbles[i].active) continue;
			for (let j = i + 1; j < marbles.length; j++) {
				if (!marbles[j].active) continue;
				const a = marbles[i];
				const b = marbles[j];
				const rel = collide(a, b, body * 2);
				// Ruhendes Aneinanderliegen erzeugt winzige Stöße, die stumm bleiben.
				if (!onHit || rel < MIN_HIT || tick - a.hitAt < HIT_PAUSE || tick - b.hitAt < HIT_PAUSE) continue;
				a.hitAt = tick;
				b.hitAt = tick;
				onHit(rel, (a.x + b.x) / 2);
			}
		}

		for (const marble of marbles) {
			if (!marble.active) continue;
			const fromX = marble.x;
			const fromY = marble.y;
			marble.x += marble.vx;
			marble.y += marble.vy;
			if (marble.exit) {
				spin(marble, body, marble.x - fromX, marble.y - fromY);
				const dx = marble.exit.x - marble.x;
				const dy = marble.exit.y - marble.y;
				const gone = marble.x < -12 || marble.y < -12
					|| marble.x > PANEL_W + 12 || marble.y > PANEL_H + 12;
				if (gone || dx * dx + dy * dy < 24 * 24) {
					marble.active = false;
					marble.exit = null;
					marble.slotId = null;
					marble.target = null;
					marble.vx = 0;
					marble.vy = 0;
				}
				continue;
			}
			if (frame === "screen") keepOnScreen(marble, body);
			else keepInside(marble);
			// Gedreht wird um die tatsächlich gerollte Strecke. An der Wand steht die Kugel still.
			spin(marble, body, marble.x - fromX, marble.y - fromY);
			const dx = marble.target.x - marble.x;
			const dy = marble.target.y - marble.y;
			if (loose === 0 && dx * dx + dy * dy < 16) {
				marble.vx *= 0.82;
				marble.vy *= 0.82;
			}
		}
	}

	function syncStable(slots) {
		const byId = new Map(slots.map((slot) => [slot.id, slot]));
		const taken = new Set();
		for (const marble of marbles) {
			if (!marble.active || !marble.slotId) continue;
			const slot = byId.get(marble.slotId);
			if (!slot) {
				startExit(marble);
				continue;
			}
			taken.add(slot.id);
			marble.target = slot;
			marble.exit = null;
		}
		for (const slot of slots) {
			if (taken.has(slot.id)) continue;
			const marble = marbles.find((item) => !item.active);
			if (marble) spawn(marble, slot);
		}
	}

	function syncNearest(slots) {
		const poolMarbles = marbles.filter((marble) => marble.active);
		for (const marble of poolMarbles) {
			marble.slotId = null;
			marble.exit = null;
		}
		const pairs = [];
		for (const slot of slots) {
			for (const marble of poolMarbles) {
				const dx = marble.x - slot.x;
				const dy = marble.y - slot.y;
				pairs.push({ d: dx * dx + dy * dy, slot, marble });
			}
		}
		pairs.sort((a, b) => a.d - b.d);
		const usedMarbles = new Set();
		const usedSlots = new Set();
		for (const pair of pairs) {
			if (usedMarbles.has(pair.marble) || usedSlots.has(pair.slot)) continue;
			usedMarbles.add(pair.marble);
			usedSlots.add(pair.slot);
			pair.marble.slotId = pair.slot.id;
			pair.marble.target = pair.slot;
			pair.marble.exit = null;
		}
		for (const marble of poolMarbles) {
			if (!marble.slotId) startExit(marble);
		}
		for (const slot of slots) {
			if (usedSlots.has(slot)) continue;
			const marble = marbles.find((item) => !item.active);
			if (marble) spawn(marble, slot);
		}
	}

	function spawn(marble, slot) {
		const start = outsidePoint();
		marble.active = true;
		marble.x = start.x;
		marble.y = start.y;
		marble.vx = 0;
		marble.vy = 0;
		marble.slotId = slot.id;
		marble.exit = null;
		marble.target = slot;
	}

	function startExit(marble) {
		const exit = outsidePoint();
		marble.slotId = null;
		marble.exit = exit;
		marble.target = exit;
		const ox = exit.x - marble.x;
		const oy = exit.y - marble.y;
		const len = Math.hypot(ox, oy) || 1;
		marble.vx += (ox / len) * 3.2;
		marble.vy += (oy / len) * 3.2;
	}

	function setStyle(next) {
		const value = next === "oxyd" || next === "oxyd-large" || next === "oxyd-floor" ? next : "plain";
		if (value === style) return;
		style = value;
		stamp = "";
	}

	function setPainter(next) {
		painter = next;
	}

	function draw(context) {
		const large = style === "oxyd-large" || style === "oxyd-floor";
		const oxyd = style !== "plain" && painter;
		const shadow = large ? LARGE_RADIUS : RADIUS;
		for (const marble of marbles) {
			if (!marble.active) continue;
			if (style === "oxyd-floor") {
				castShadow(context, marble, shadow);
				continue;
			}
			context.beginPath();
			context.ellipse(marble.x + 1, marble.y + 3, shadow * 0.85, shadow * 0.45, 0, 0, Math.PI * 2);
			context.fillStyle = "rgba(0,0,0,0.45)";
			context.fill();
		}
		if (oxyd) {
			for (const marble of marbles) {
				if (!marble.active) continue;
				painter.draw(context, marble, shadow * 2);
			}
			return;
		}
		for (const marble of marbles) {
			if (!marble.active) continue;
			const gradient = context.createRadialGradient(
				marble.x - RADIUS * 0.35,
				marble.y - RADIUS * 0.4,
				RADIUS * 0.15,
				marble.x,
				marble.y,
				RADIUS
			);
			gradient.addColorStop(0, marble.color[0]);
			gradient.addColorStop(0.45, marble.color[1]);
			gradient.addColorStop(1, marble.color[2]);
			context.beginPath();
			context.arc(marble.x, marble.y, RADIUS, 0, Math.PI * 2);
			context.fillStyle = gradient;
			context.fill();
		}
	}

	function setHitListener(listener) {
		onHit = listener;
	}

	return { update, draw, setStyle, setPainter, setHitListener, get items() { return marbles; } };
}

// Gemessen an S_THG gegen O_THG der Oxyd-Kugeln: Scheibe in Kugelgröße,
// 0,29 Radien nach rechts unten, flach bis 0,8 r, bei 1,05 r ausgelaufen.
function castShadow(context, marble, radius) {
	const x = marble.x + radius * 0.29;
	const y = marble.y + radius * 0.29;
	const reach = radius * 1.05;
	const gradient = context.createRadialGradient(x, y, 0, x, y, reach);
	gradient.addColorStop(0, "rgba(0,0,0,0.33)");
	gradient.addColorStop(0.76, "rgba(0,0,0,0.33)");
	gradient.addColorStop(0.85, "rgba(0,0,0,0.22)");
	gradient.addColorStop(0.9, "rgba(0,0,0,0.11)");
	gradient.addColorStop(1, "rgba(0,0,0,0)");
	context.beginPath();
	context.arc(x, y, reach, 0, Math.PI * 2);
	context.fillStyle = gradient;
	context.fill();
}

function spin(marble, radius, dx, dy) {
	const speed = Math.hypot(dx, dy);
	if (speed < 0.02) return;
	const angle = speed / radius;
	const s = Math.sin(angle * 0.5);
	const c = Math.cos(angle * 0.5);
	const ax = dy / speed * s;
	const az = -dx / speed * s;
	const x = marble.q[0];
	const y = marble.q[1];
	const z = marble.q[2];
	const w = marble.q[3];
	// Die Drehachse liegt in Weltkoordinaten (Boden), daher dq · q und nicht q · dq.
	const nx = c * x + ax * w - az * y;
	const ny = c * y + az * x - ax * z;
	const nz = c * z + az * w + ax * y;
	const nw = c * w - ax * x - az * z;
	const n = Math.hypot(nx, ny, nz, nw) || 1;
	marble.q[0] = nx / n;
	marble.q[1] = ny / n;
	marble.q[2] = nz / n;
	marble.q[3] = nw / n;
}

function collide(a, b, min) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dist = Math.hypot(dx, dy);
	if (dist >= min || dist < 0.0001) return 0;
	const nx = dx / dist;
	const ny = dy / dist;
	const overlap = (min - dist) / 2;
	a.x -= nx * overlap;
	a.y -= ny * overlap;
	b.x += nx * overlap;
	b.y += ny * overlap;
	const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
	if (rel <= 0) return 0;
	const impulse = rel * 0.72;
	a.vx -= impulse * nx;
	a.vy -= impulse * ny;
	b.vx += impulse * nx;
	b.vy += impulse * ny;
	const tx = -ny;
	const ty = nx;
	const tangent = ((a.vx - b.vx) * tx + (a.vy - b.vy) * ty) * 0.12;
	a.vx -= tangent * tx;
	a.vy -= tangent * ty;
	b.vx += tangent * tx;
	b.vy += tangent * ty;
	return rel;
}

// Am Bildschirmrand prallen die Murmeln ab wie an der Glaskante.
function keepOnScreen(marble, radius) {
	const bounce = (position, speed, min, max) => {
		if (position < min) return [min, speed < 0 ? speed * -0.4 : speed];
		if (position > max) return [max, speed > 0 ? speed * -0.4 : speed];
		return null;
	};
	const x = bounce(marble.x, marble.vx, radius, PANEL_W - radius);
	if (x) {
		[marble.x, marble.vx] = x;
		marble.vy *= 0.92;
	}
	const y = bounce(marble.y, marble.vy, radius, PANEL_H - radius);
	if (y) {
		[marble.y, marble.vy] = y;
		marble.vx *= 0.92;
	}
}

function keepInside(marble) {
	const cx = PANEL_W / 2;
	const cy = PANEL_H / 2;
	const rx = cx - 27;
	const ry = cy - 29;
	const nx = (marble.x - cx) / rx;
	const ny = (marble.y - cy) / ry;
	const outside = nx * nx + ny * ny;
	if (outside <= 1) return;
	const scale = 1 / Math.sqrt(outside);
	const hitX = cx + (marble.x - cx) * scale;
	const hitY = cy + (marble.y - cy) * scale;
	const normalX = (marble.x - cx) / rx;
	const normalY = (marble.y - cy) / ry;
	const length = Math.hypot(normalX, normalY) || 1;
	const ux = normalX / length;
	const uy = normalY / length;
	const speed = marble.vx * ux + marble.vy * uy;
	if (speed > 0) {
		marble.vx -= (1.4 * speed) * ux;
		marble.vy -= (1.4 * speed) * uy;
	}
	marble.vx *= 0.92;
	marble.vy *= 0.92;
	marble.x = hitX;
	marble.y = hitY;
}
