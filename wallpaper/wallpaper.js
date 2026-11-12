import { createBuzz } from "../shared/faces/buzz.js";
import { createClack } from "../shared/faces/clack.js";
import { createFlies } from "../shared/faces/flies.js";
import { loadFloors } from "../shared/faces/floors.js";
import { PANEL_H, PANEL_W, setPanel } from "../shared/faces/glyphs.js";
import { createMarbles } from "../shared/faces/marbles.js";
import { loadOxydPainter } from "../shared/faces/oxyd.js";

// build.py ersetzt "../shared" durch ".", weil im Paket alles neben index.html liegt.
const ROOT = "../shared";
const FACES = ["flies", "marbles", "oxyd", "oxyd-large", "oxyd-floor"];
// Bewegt sich der Mauszeiger, gilt er so lange als Finger auf dem Glas.
const HOVER_MS = 1500;
// Wallpaper Engine meldet das Loslassen nicht immer. Ohne Mausereignis endet das Kippen von selbst.
const PRESS_MS = 3000;

const canvas = document.getElementById("glass");
const context = canvas.getContext("2d");
const buzz = createBuzz();
const clack = createClack();

const settings = {
	face: "flies",
	floor: "slate",
	size: 1,
	hover: true,
	sound: true,
	volume: 0.7
};

const input = {
	x: 0,
	y: 0,
	down: false,
	tiltX: 0,
	tiltY: 0,
	flickX: 0,
	flickY: 0
};

let ratio = 1;
let unit = 1;
let flySheet = null;
let painter = null;
let flies = null;
let marbles = null;
let floors = null;
let pressed = false;
let movedAt = -Infinity;
let paused = false;
let pointerX = 0;
let pointerY = 0;
let pointerTime = 0;
let trailX = 0;
let trailY = 0;

// Panel-Einheiten wie auf der Uhr. Bei Größe 100 % ist der Bildschirm 502 Einheiten hoch wie das Display.
async function layout() {
	ratio = Math.min(2, window.devicePixelRatio || 1);
	unit = window.innerHeight / 502 * settings.size;
	setPanel(window.innerWidth / unit, window.innerHeight / unit);
	canvas.width = Math.round(window.innerWidth * ratio);
	canvas.height = Math.round(window.innerHeight * ratio);

	if (flySheet) flies = createFlies(flySheet);
	marbles = createMarbles({ frame: "screen" });
	if (painter) marbles.setPainter(painter);
	applyFace();
	try {
		floors = await loadFloors(ratio * unit, `${ROOT}/assets/oxyd/floors`);
		floors.select(settings.floor);
	} catch (error) {
		console.error(error);
	}
}

function applyFace() {
	if (!marbles) return;
	const face = settings.face;
	marbles.setStyle(face === "flies" || face === "marbles" ? "plain" : face);
	marbles.setHitListener(face === "oxyd-floor" ? clack.hit : null);
	if (face !== "flies") buzz.setFlying(0);
}

function applySound() {
	const muted = !settings.sound || paused;
	buzz.setMuted(muted);
	clack.setMuted(muted);
	buzz.setVolume(settings.volume);
	clack.setVolume(settings.volume);
}

async function unlockAudio() {
	try {
		await Promise.all([buzz.unlock(), clack.unlock()]);
	} catch (error) {
		console.error(error);
	}
}

let last = performance.now();
let bank = 0;
let airborne = 0;

function frame(now) {
	requestAnimationFrame(frame);
	const step = Math.min(48, now - last);
	last = now;
	if (paused) return;
	if (pressed && now - movedAt > PRESS_MS) release();
	bank += step;
	input.down = pressed || (settings.hover && settings.face === "flies" && now - movedAt < HOVER_MS);
	const date = new Date();
	const flyFace = settings.face === "flies" && flies;
	let steps = 0;
	while (bank >= 16.67 && steps < 5) {
		if (flyFace) airborne = flies.update(input, date);
		else marbles.update(input, date);
		input.flickX = 0;
		input.flickY = 0;
		bank -= 16.67;
		steps++;
	}
	if (steps === 5) bank = 0;
	if (flyFace) buzz.setFlying(airborne);

	context.setTransform(ratio * unit, 0, 0, ratio * unit, 0, 0);
	drawBackground();
	if (flyFace) flies.draw(context);
	else marbles.draw(context);
}

function drawBackground() {
	if (settings.face === "oxyd-floor" && floors) {
		floors.draw(context);
		return;
	}
	context.fillStyle = "#000";
	context.fillRect(0, 0, PANEL_W, PANEL_H);
	const glow = context.createRadialGradient(PANEL_W / 2, PANEL_H * 0.14, 20, PANEL_W / 2, PANEL_H / 2, Math.max(PANEL_W, PANEL_H) * 0.72);
	glow.addColorStop(0, "rgba(255,255,255,0.05)");
	glow.addColorStop(1, "rgba(255,255,255,0)");
	context.fillStyle = glow;
	context.fillRect(0, 0, PANEL_W, PANEL_H);
}

function pointOf(event) {
	return { x: event.clientX / unit, y: event.clientY / unit };
}

window.addEventListener("pointerdown", (event) => {
	const point = pointOf(event);
	input.x = point.x;
	input.y = point.y;
	pressed = true;
	pointerX = point.x;
	pointerY = point.y;
	trailX = 0;
	trailY = 0;
	pointerTime = event.timeStamp;
	movedAt = performance.now();
	void unlockAudio();
});

window.addEventListener("pointermove", (event) => {
	const point = pointOf(event);
	input.x = point.x;
	input.y = point.y;
	movedAt = performance.now();
	if (pressed && event.buttons === 0) release();
	if (!pressed) return;
	const dt = Math.max(8, event.timeStamp - pointerTime);
	trailX = (point.x - pointerX) / dt;
	trailY = (point.y - pointerY) / dt;
	pointerX = point.x;
	pointerY = point.y;
	pointerTime = event.timeStamp;
	input.tiltX = (point.x - PANEL_W / 2) / PANEL_W * 0.42;
	input.tiltY = (point.y - PANEL_H / 2) / PANEL_H * 0.42;
});

function release() {
	pressed = false;
	input.tiltX = 0;
	input.tiltY = 0;
}

window.addEventListener("pointerup", () => {
	release();
	const speed = Math.hypot(trailX, trailY);
	if (speed > 0.7) {
		input.flickX = trailX * 18;
		input.flickY = trailY * 18;
	}
	trailX = 0;
	trailY = 0;
});

window.addEventListener("pointercancel", release);
window.addEventListener("blur", release);

// Im Browser zum Ausprobieren: 1 bis 5 wählen das Zifferblatt, B den Boden, M den Ton.
window.addEventListener("keydown", (event) => {
	const index = Number(event.key) - 1;
	if (index >= 0 && index < FACES.length) {
		settings.face = FACES[index];
		applyFace();
	}
	if ((event.key === "b" || event.key === "B") && floors) floors.next();
	if (event.key === "m" || event.key === "M") {
		settings.sound = !settings.sound;
		applySound();
	}
	void unlockAudio();
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(layout, 200);
});

// Zum Nachsehen in den Entwicklerwerkzeugen.
window.espClock = { get marbles() { return marbles; }, settings, input };

// Schnittstelle von Wallpaper Engine. Die Namen entsprechen den Eigenschaften in project.json.
window.wallpaperPropertyListener = {
	applyUserProperties(properties) {
		let relayout = false;
		if (properties.face && FACES.includes(properties.face.value)) {
			settings.face = properties.face.value;
			applyFace();
		}
		if (properties.floor) {
			settings.floor = properties.floor.value;
			if (floors) floors.select(settings.floor);
		}
		if (properties.size) {
			settings.size = properties.size.value / 100;
			relayout = true;
		}
		if (properties.hover) settings.hover = properties.hover.value;
		if (properties.sound) settings.sound = properties.sound.value;
		if (properties.volume) settings.volume = properties.volume.value / 100;
		applySound();
		if (relayout) void layout();
	},
	setPaused(isPaused) {
		paused = isPaused;
		applySound();
	}
};

async function boot() {
	const image = new Image();
	image.src = `${ROOT}/assets/fly/flyex.png`;
	await image.decode();
	flySheet = image;
	await layout();
	applySound();
	loadOxydPainter(`${ROOT}/assets/oxyd`).then((loaded) => {
		painter = loaded;
		marbles.setPainter(painter);
	}).catch((error) => console.error(error));
	clack.load(`${ROOT}/assets/oxyd/clack.wav`).catch((error) => console.error(error));
	buzz.load(`${ROOT}/assets/fly/fly.sounds.wav`, `${ROOT}/assets/fly/fly.sounds.json`).catch((error) => console.error(error));
	// Wallpaper Engine erlaubt Ton ohne Klick, im Browser kommt er mit der ersten Eingabe.
	void unlockAudio();
	requestAnimationFrame(frame);
}

boot().catch((error) => console.error(error));
