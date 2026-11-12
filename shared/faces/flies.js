import { clockSlots, PANEL_H, PANEL_W, peakCount } from "./glyphs.js";

// Wie in FlyEx: 0 = Norden, im Uhrzeigersinn. Gerade Richtungen nutzen die
// geraden Posen (Frames 0–9), ungerade die diagonalen (10–19).
const FLY_FRAMES = [1, 1, 2, 2, 2, 3, 3, 3, 2, 2, 2];
const WALK_FRAMES = [5, 6, 7, 5, 8, 9];
const FRAME = 30;
const DIR_X = [0, 1, 1, 1, 0, -1, -1, -1];
const DIR_Y = [-1, -1, 0, 1, 1, 1, 0, -1];

function directionOf(vx, vy, previous) {
	const ax = Math.abs(vx);
	const ay = Math.abs(vy);
	if (ax < 0.05 && ay < 0.05) return previous;
	if (ay > ax * 2) return vy < 0 ? 0 : 4;
	if (ax > ay * 2) return vx < 0 ? 6 : 2;
	if (vy < 0) return vx < 0 ? 7 : 1;
	return vx < 0 ? 5 : 3;
}

function dirVector(dir) {
	const x = DIR_X[dir];
	const y = DIR_Y[dir];
	const len = Math.hypot(x, y) || 1;
	return [x / len, y / len];
}

function beside(point, min, max) {
	const angle = Math.random() * Math.PI * 2;
	const dist = min + Math.random() * (max - min);
	return {
		x: point.x + Math.cos(angle) * dist,
		y: point.y + Math.sin(angle) * dist
	};
}

function clampLoose(point) {
	const margin = -24;
	return {
		x: Math.min(PANEL_W - margin, Math.max(margin, point.x)),
		y: Math.min(PANEL_H - margin, Math.max(margin, point.y))
	};
}

function wrapAngle(turn) {
	while (turn > Math.PI) turn -= Math.PI * 2;
	while (turn < -Math.PI) turn += Math.PI * 2;
	return turn;
}

// Kurze Sprünge, keiner länger als etwa 30 Pixel. Der letzte liegt auf dem Ziel.
function hopPath(from, toward, chaos, minSteps = 2) {
	const points = [];
	let x = from.x;
	let y = from.y;
	let heading = Math.atan2(toward.y - y, toward.x - x);
	const dist = Math.hypot(toward.x - from.x, toward.y - from.y);
	const steps = Math.max(minSteps, Math.min(8, Math.ceil(dist / 30)));
	for (let i = 0; i < steps; i++) {
		const sx = toward.x - x;
		const sy = toward.y - y;
		const len = Math.hypot(sx, sy);
		if (len < 16) {
			points.push({ x: toward.x, y: toward.y });
			break;
		}
		const aim = Math.atan2(sy, sx);
		heading += wrapAngle(aim - heading) * (0.5 + (1 - chaos) * 0.35);
		heading += (Math.random() - 0.5) * chaos * 1.5;
		const step = Math.min(16 + Math.random() * 12, len);
		x += Math.cos(heading) * step;
		y += Math.sin(heading) * step;
		points.push(clampLoose({ x, y }));
	}
	return points;
}

// Flucht: mehrere kurze Knicke nach außen, kein ferner Zielpunkt.
function fleePath(from, angle) {
	const points = [];
	let x = from.x;
	let y = from.y;
	let heading = angle;
	const steps = 5 + Math.floor(Math.random() * 2);
	for (let i = 0; i < steps; i++) {
		heading += (Math.random() - 0.5) * 2.2;
		heading += wrapAngle(angle - heading) * 0.22;
		const step = 14 + Math.random() * 10;
		x += Math.cos(heading) * step;
		y += Math.sin(heading) * step;
		points.push(clampLoose({ x, y }));
	}
	return points;
}

function outsidePoint() {
	const margin = 48 + Math.random() * 90;
	const along = Math.random();
	switch (Math.floor(Math.random() * 4)) {
		case 0: return { x: along * PANEL_W, y: -margin };
		case 1: return { x: PANEL_W + margin, y: along * PANEL_H };
		case 2: return { x: along * PANEL_W, y: PANEL_H + margin };
		default: return { x: -margin, y: along * PANEL_H };
	}
}

function keyOutBlack(image) {
	const canvas = document.createElement("canvas");
	canvas.width = image.width;
	canvas.height = image.height;
	const context = canvas.getContext("2d");
	context.drawImage(image, 0, 0);
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
	const data = pixels.data;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] < 16 && data[i + 1] < 16 && data[i + 2] < 16) data[i + 3] = 0;
	}
	context.putImageData(pixels, 0, 0);
	return canvas;
}

function makeFly() {
	return {
		active: false,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		slotId: null,
		goal: null,
		exit: null,
		flee: null,
		land: null,
		mode: "off",
		dir: 0,
		frame: 0,
		anim: 0,
		phase: Math.random() * Math.PI * 2,
		idle: null,
		route: null,
		nerve: Math.random(),
		alarmed: false,
		hesitate: 0,
		leaving: false
	};
}

export function createFlies(image) {
	const sheet = keyOutBlack(image);
	const flies = [];
	const pool = peakCount() * 2;
	for (let i = 0; i < pool; i++) flies.push(makeFly());

	let stamp = "";

	function update(input, date) {
		const key = `${date.getHours()}:${date.getMinutes()}`;
		if (key !== stamp) {
			stamp = key;
			sync(clockSlots(date));
		}

		const finger = input.down ? input : null;
		let flying = 0;
		for (const fly of flies) {
			if (!fly.active) continue;
			if (fly.exit) {
				stepExit(fly);
			} else {
				if (finger) scare(fly, finger);
				if (fly.mode === "idle" && !fly.flee) stepIdle(fly);
				else stepMove(fly);
			}
			if (fly.active && (fly.mode === "fly" || (finger && fly.alarmed))) flying++;
		}
		return flying;
	}

	function sync(slots) {
		const byId = new Map(slots.map((slot) => [slot.id, slot]));
		const taken = new Set();
		for (const fly of flies) {
			if (!fly.active || !fly.slotId) continue;
			const slot = byId.get(fly.slotId);
			if (!slot) {
				startExit(fly);
				continue;
			}
			taken.add(slot.id);
			fly.goal = slot;
			if (fly.mode === "idle" && fly.idle?.originX != null) {
				fly.idle.originX = slot.x;
				fly.idle.originY = slot.y;
			}
		}
		for (const slot of slots) {
			if (taken.has(slot.id)) continue;
			const fly = flies.find((item) => !item.active);
			if (fly) spawn(fly, slot);
		}
	}

	function spawn(fly, slot) {
		const start = outsidePoint();
		fly.active = true;
		fly.x = start.x;
		fly.y = start.y;
		fly.vx = 0;
		fly.vy = 0;
		fly.slotId = slot.id;
		fly.goal = slot;
		fly.exit = null;
		fly.flee = null;
		fly.idle = null;
		fly.leaving = false;
		fly.alarmed = false;
		fly.hesitate = 0;
		fly.land = null;
		fly.route = hopPath(start, slot, 0.45);
		fly.mode = "fly";
		fly.dir = directionOf(slot.x - start.x, slot.y - start.y, 0);
		fly.frame = 1;
		fly.anim = Math.random() * 8;
	}

	function startExit(fly) {
		fly.slotId = null;
		fly.goal = null;
		fly.flee = null;
		fly.land = null;
		fly.idle = null;
		fly.route = null;
		fly.leaving = false;
		fly.alarmed = false;
		fly.hesitate = 0;
		fly.exit = outsidePoint();
		fly.mode = "fly";
	}

	function scare(fly, finger) {
		const fx = fly.x - finger.x;
		const fy = fly.y - finger.y;
		const dist = Math.hypot(fx, fy);
		if (dist > 76) {
			fly.alarmed = false;
			fly.hesitate = 0;
			return;
		}
		if (fly.leaving) return;
		if (!fly.alarmed) {
			const closeness = 1 - dist / 76;
			fly.alarmed = true;
			fly.hesitate = Math.round((1 - closeness) * (6 + fly.nerve * 26) + fly.nerve * 32);
		}
		if (fly.hesitate > 0) {
			fly.hesitate--;
			return;
		}
		fly.alarmed = false;
		const angle = dist < 1
			? Math.random() * Math.PI * 2
			: Math.atan2(fy, fx) + (Math.random() - 0.5) * 0.9;
		fly.leaving = true;
		fly.land = null;
		fly.flee = null;
		fly.route = fleePath(fly, angle);
		fly.idle = null;
		fly.mode = "fly";
	}

	function stepMove(fly) {
		if (fly.route && fly.route.length) {
			const point = fly.route[0];
			const rdx = point.x - fly.x;
			const rdy = point.y - fly.y;
			const routeDist = Math.hypot(rdx, rdy) || 0.0001;
			fly.hop = (fly.hop || 0) + 1;
			if (routeDist < 10 || fly.hop > 40) {
				fly.hop = 0;
				fly.route.shift();
				if (fly.route.length) return;
				fly.route = null;
				if (fly.leaving && fly.goal) {
					fly.leaving = false;
					fly.route = hopPath(fly, fly.goal, 0.45, 2);
					return;
				}
				fly.leaving = false;
				if (fly.goal && Math.hypot(fly.goal.x - fly.x, fly.goal.y - fly.y) < 20) {
					settle(fly);
					return;
				}
				if (fly.goal) {
					fly.land = beside(fly.goal, 12, 22);
					fly.mode = "fly";
				}
			} else {
				steerFly(fly, rdx, rdy, routeDist, Math.min(1.15, 0.35 + routeDist * 0.05));
				return;
			}
		}
		const exact = fly.flee || fly.goal;
		if (!exact) return;
		let steer = exact;
		if (fly.mode !== "walk" && fly.land) {
			const landDist = Math.hypot(fly.land.x - fly.x, fly.land.y - fly.y);
			if (landDist < 26) fly.mode = "walk";
			else steer = fly.land;
		}
		const dx = steer.x - fly.x;
		const dy = steer.y - fly.y;
		const dist = Math.hypot(dx, dy) || 0.0001;
		const walking = fly.mode === "walk";
		const cruise = dist > 90 ? 2.6 : 2.1;
		const speed = walking ? 0.72 : Math.min(cruise, 0.4 + dist * 0.07);
		const gain = dist < 36 ? 0.5 : 0.2;
		fly.vx += ((dx / dist) * speed - fly.vx) * (walking ? 0.35 : gain);
		fly.vy += ((dy / dist) * speed - fly.vy) * (walking ? 0.35 : gain);
		if (!walking && dist > 80) {
			fly.phase += 0.2;
			const wobble = Math.sin(fly.phase) * 0.16;
			fly.vx += (-dy / dist) * wobble;
			fly.vy += (dx / dist) * wobble;
		}
		if (walking && dist < 12) {
			fly.vx *= 0.72;
			fly.vy *= 0.72;
		}
		fly.x += fly.vx;
		fly.y += fly.vy;
		separate(fly);
		fly.dir = directionOf(fly.vx, fly.vy, fly.dir);
		fly.anim += walking ? 0.32 : 0.55;
		const sequence = walking ? WALK_FRAMES : FLY_FRAMES;
		fly.frame = sequence[Math.floor(fly.anim) % sequence.length];
		if (!walking) fly.mode = "fly";

		const goalDist = Math.hypot(exact.x - fly.x, exact.y - fly.y);
		if (!walking && fly.flee && goalDist < 8) arriveFlee(fly);
		else if (walking && fly.flee && goalDist < 5) arriveFlee(fly);
		else if (walking && !fly.flee && fly.goal && goalDist < 2) settle(fly);
	}

	function steerFly(fly, dx, dy, dist, speed) {
		const gain = dist < 36 ? 0.5 : 0.22;
		fly.vx += ((dx / dist) * speed - fly.vx) * gain;
		fly.vy += ((dy / dist) * speed - fly.vy) * gain;
		if (dist > 70) {
			fly.phase += 0.16;
			const wobble = Math.sin(fly.phase) * 0.08;
			fly.vx += (-dy / dist) * wobble;
			fly.vy += (dx / dist) * wobble;
		}
		fly.x += fly.vx;
		fly.y += fly.vy;
		if (dist > 30) separate(fly);
		fly.dir = directionOf(fly.vx, fly.vy, fly.dir);
		fly.anim += 0.42;
		fly.frame = FLY_FRAMES[Math.floor(fly.anim) % FLY_FRAMES.length];
		fly.mode = "fly";
	}

	function arriveFlee(fly) {
		fly.flee = null;
		fly.vx *= 0.5;
		fly.vy *= 0.5;
		fly.mode = "fly";
		fly.land = null;
		fly.route = fly.goal ? hopPath(fly, fly.goal, 0.4, 2) : null;
	}

	function settle(fly) {
		fly.x = fly.goal.x;
		fly.y = fly.goal.y;
		fly.vx = 0;
		fly.vy = 0;
		fly.land = null;
		fly.flee = null;
		fly.route = null;
		fly.leaving = false;
		fly.mode = "idle";
		beginIdle(fly);
	}

	function beginIdle(fly) {
		const roll = Math.random();
		if (roll < 0.4) {
			fly.idle = { kind: "stand", left: 140 + Math.random() * 220 };
			fly.frame = 0;
		} else if (roll < 0.65) {
			fly.idle = { kind: "proboscis", left: 80 + Math.random() * 100, tick: 0 };
		} else if (roll < 0.85) {
			fly.idle = {
				kind: "turn",
				left: 36 + Math.random() * 30,
				steps: 1 + (Math.random() < 0.5 ? 1 : 0),
				dirStep: Math.random() < 0.5 ? -1 : 1,
				pause: 16
			};
			fly.frame = 0;
		} else {
			fly.idle = {
				kind: "pace",
				phase: "out",
				left: 14 + Math.random() * 10,
				dir: fly.dir,
				originX: fly.goal.x,
				originY: fly.goal.y
			};
		}
	}

	function stepIdle(fly) {
		const idle = fly.idle;
		if (!idle) {
			beginIdle(fly);
			return;
		}
		fly.vx = 0;
		fly.vy = 0;
		if (idle.kind === "stand") {
			fly.frame = 0;
			fly.x = fly.goal.x;
			fly.y = fly.goal.y;
			if (--idle.left <= 0) beginIdle(fly);
			return;
		}
		if (idle.kind === "proboscis") {
			idle.tick++;
			fly.frame = Math.floor(idle.tick / 9) % 2 === 0 ? 0 : 4;
			fly.x = fly.goal.x;
			fly.y = fly.goal.y;
			if (--idle.left <= 0) beginIdle(fly);
			return;
		}
		if (idle.kind === "turn") {
			fly.frame = 0;
			fly.x = fly.goal.x;
			fly.y = fly.goal.y;
			if (--idle.pause <= 0 && idle.steps > 0) {
				fly.dir = (fly.dir + idle.dirStep) & 7;
				idle.steps--;
				idle.pause = 18;
			}
			if (--idle.left <= 0) beginIdle(fly);
			return;
		}
		const [dx, dy] = dirVector(fly.dir);
		const step = 0.55;
		fly.anim += 0.3;
		fly.frame = WALK_FRAMES[Math.floor(fly.anim) % WALK_FRAMES.length];
		if (idle.phase === "out") {
			fly.x += dx * step;
			fly.y += dy * step;
			if (--idle.left <= 0) {
				idle.phase = "back";
				fly.dir = (fly.dir + 4) & 7;
			}
			return;
		}
		const backX = idle.originX - fly.x;
		const backY = idle.originY - fly.y;
		const back = Math.hypot(backX, backY);
		if (back < 0.6) {
			fly.x = idle.originX;
			fly.y = idle.originY;
			fly.dir = idle.dir;
			beginIdle(fly);
			return;
		}
		fly.x += (backX / back) * step;
		fly.y += (backY / back) * step;
		fly.dir = directionOf(backX, backY, fly.dir);
	}

	function stepExit(fly) {
		const dx = fly.exit.x - fly.x;
		const dy = fly.exit.y - fly.y;
		const dist = Math.hypot(dx, dy) || 0.0001;
		fly.vx += ((dx / dist) * 3.5 - fly.vx) * 0.16;
		fly.vy += ((dy / dist) * 3.5 - fly.vy) * 0.16;
		fly.phase += 0.2;
		const wobble = Math.sin(fly.phase) * 0.15;
		fly.vx += (-dy / dist) * wobble;
		fly.vy += (dx / dist) * wobble;
		fly.x += fly.vx;
		fly.y += fly.vy;
		fly.dir = directionOf(fly.vx, fly.vy, fly.dir);
		fly.anim += 0.55;
		fly.frame = FLY_FRAMES[Math.floor(fly.anim) % FLY_FRAMES.length];
		fly.mode = "fly";
		if (dist < 16) {
			fly.active = false;
			fly.exit = null;
			fly.mode = "off";
			fly.vx = 0;
			fly.vy = 0;
		}
	}

	function separate(fly) {
		if (fly.goal && !fly.flee && Math.hypot(fly.goal.x - fly.x, fly.goal.y - fly.y) < 10) return;
		for (const other of flies) {
			if (!other.active || other === fly || other.mode === "idle") continue;
			const dx = fly.x - other.x;
			const dy = fly.y - other.y;
			const dist = Math.hypot(dx, dy);
			if (dist >= 12 || dist < 0.001) continue;
			const push = (12 - dist) * 0.08;
			fly.x += (dx / dist) * push;
			fly.y += (dy / dist) * push;
		}
	}

	function draw(context) {
		for (const fly of flies) {
			if (!fly.active) continue;
			const diagonal = fly.dir % 2 === 1;
			const index = (diagonal ? 10 : 0) + fly.frame;
			const turn = Math.floor(fly.dir / 2) * (Math.PI / 2);
			context.save();
			context.translate(fly.x, fly.y);
			context.rotate(turn);
			context.drawImage(sheet, index * FRAME, 0, FRAME, FRAME, -14, -14, 28, 28);
			context.restore();
		}
	}

	return { update, draw };
}
