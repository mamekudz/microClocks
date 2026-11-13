import { createBuzz } from "../../shared/faces/buzz.js";
import { createClack } from "../../shared/faces/clack.js";
import { createFlies } from "../../shared/faces/flies.js";
import { loadFloors } from "../../shared/faces/floors.js";
import { PANEL_H, PANEL_W } from "../../shared/faces/glyphs.js";
import { createMarbles } from "../../shared/faces/marbles.js";
import { loadOxydPainter } from "../../shared/faces/oxyd.js";
import { loadI18x, translateDocument } from "../../shared/i18x.js";

const ROOT = "../../shared";
const HINTS = {
	flies: "Finger on the glass: not every fly dodges at once. They come back by detours. The buzzing starts as soon as a fly notices the finger.<context=\"sim hint\"/>",
	marbles: "Dragging tilts the glass. A quick flick shakes the marbles. Whatever the clock does not need rolls out.<context=\"sim hint\"/>",
	oxyd: "Oxyd marbles: the scratches sit on the glass ball and roll with it. Dragging tilts, a flick shakes.<context=\"sim hint\"/>",
	"oxyd-large": "Large Oxyd marbles: hours on top, minutes below. The scratches roll with them.<context=\"sim hint\"/>",
	"oxyd-floor": "Large Oxyd marbles on an Oxyd floor, with ball shadows. Impacts sound according to their force. The floor button or B switches the surface.<context=\"sim hint\"/>"
};

const canvas = document.getElementById("glass");
const context = canvas.getContext("2d");
const ratio = Math.min(2, window.devicePixelRatio || 1);
canvas.width = PANEL_W * ratio;
canvas.height = PANEL_H * ratio;
context.setTransform(ratio, 0, 0, ratio, 0, 0);

const caption = document.getElementById("caption");
const hint = document.getElementById("hint");
const soundButton = document.getElementById("sound");
const floorButton = document.getElementById("floor");
const faceButtons = [...document.querySelectorAll("[data-face]")];

const buzz = createBuzz();
const clack = createClack();
const marbles = createMarbles();
let flies = null;
let floors = null;
let face = "flies";
let muted = false;

const input = {
	x: PANEL_W / 2,
	y: PANEL_H / 2,
	down: false,
	tiltX: 0,
	tiltY: 0,
	flickX: 0,
	flickY: 0
};

let pointerX = 0;
let pointerY = 0;
let pointerTime = 0;
let trailX = 0;
let trailY = 0;

function pad(value) {
	return String(value).padStart(2, "0");
}

function setFace(next) {
	face = next;
	for (const button of faceButtons) {
		button.classList.toggle("is-on", button.dataset.face === face);
	}
	marbles.setStyle(face === "flies" || face === "marbles" ? "plain" : face);
	floorButton.hidden = face !== "oxyd-floor";
	marbles.setHitListener(face === "oxyd-floor" ? clack.hit : null);
	showFloor();
	hint.textContent = HINTS[face].i18xTrans();
	if (face !== "flies") buzz.setFlying(0);
}

function showFloor() {
	if (floors) floorButton.textContent = "Floor: <floor/><context=\"sim\"/>".i18xTrans({ floor: floors.name.i18xTrans() });
}

async function unlockAudio() {
	await Promise.all([buzz.unlock(), clack.unlock()]);
}

function setMuted(value) {
	muted = value;
	buzz.setMuted(muted);
	clack.setMuted(muted);
	soundButton.textContent = muted ? "Sound is off<context=\"sim\"/>".i18xTrans() : "Sound is on<context=\"sim\"/>".i18xTrans();
	soundButton.classList.toggle("is-on", !muted);
}

async function boot() {
	await loadI18x("../../i18x/web");
	translateDocument();
	const image = new Image();
	image.src = `${ROOT}/assets/fly/flyex.png`;
	await image.decode();
	flies = createFlies(image);
	loadOxydPainter(`${ROOT}/assets/oxyd`).then((painter) => marbles.setPainter(painter)).catch((error) => {
		console.error(error);
	});
	loadFloors(ratio, `${ROOT}/assets/oxyd/floors`).then((loaded) => {
		floors = loaded;
		showFloor();
	}).catch((error) => {
		console.error(error);
	});
	const requested = new URLSearchParams(location.search).get("face");
	setFace(faceButtons.some((button) => button.dataset.face === requested) ? requested : "flies");
	setMuted(false);
	clack.load(`${ROOT}/assets/oxyd/clack.wav`).catch((error) => {
		console.error(error);
	});
	try {
		await buzz.load(`${ROOT}/assets/fly/fly.sounds.wav`, `${ROOT}/assets/fly/fly.sounds.json`);
	} catch (error) {
		console.error(error);
		hint.textContent = "The buzz sound could not be loaded.<context=\"sim\"/>".i18xTrans();
	}
	requestAnimationFrame(frame);
}

let last = performance.now();
let bank = 0;
let airborne = 0;

function frame(now) {
	requestAnimationFrame(frame);
	const step = Math.min(48, now - last);
	last = now;
	bank += step;
	const date = new Date();
	let steps = 0;
	while (bank >= 16.67 && steps < 5) {
		if (face === "flies" && flies) airborne = flies.update(input, date);
		else marbles.update(input, date);
		input.flickX = 0;
		input.flickY = 0;
		bank -= 16.67;
		steps++;
	}
	if (steps === 5) bank = 0;
	if (face === "flies") buzz.setFlying(airborne);
	drawGlass();
	if (face === "flies" && flies) flies.draw(context);
	else marbles.draw(context);
	caption.textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function drawGlass() {
	context.clearRect(0, 0, PANEL_W, PANEL_H);
	if (face === "oxyd-floor" && floors) {
		floors.draw(context);
		return;
	}
	context.fillStyle = "#000";
	context.fillRect(0, 0, PANEL_W, PANEL_H);
	const glow = context.createRadialGradient(PANEL_W / 2, 70, 20, PANEL_W / 2, PANEL_H / 2, 360);
	glow.addColorStop(0, "rgba(255,255,255,0.05)");
	glow.addColorStop(1, "rgba(255,255,255,0)");
	context.fillStyle = glow;
	context.fillRect(0, 0, PANEL_W, PANEL_H);
}

function pointOf(event) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: (event.clientX - rect.left) * (PANEL_W / rect.width),
		y: (event.clientY - rect.top) * (PANEL_H / rect.height)
	};
}

canvas.addEventListener("pointerdown", async (event) => {
	canvas.setPointerCapture(event.pointerId);
	const point = pointOf(event);
	input.x = point.x;
	input.y = point.y;
	input.down = true;
	pointerX = point.x;
	pointerY = point.y;
	trailX = 0;
	trailY = 0;
	pointerTime = event.timeStamp;
	await unlockAudio();
});

canvas.addEventListener("pointermove", (event) => {
	const point = pointOf(event);
	input.x = point.x;
	input.y = point.y;
	if (!input.down) return;
	const dt = Math.max(8, event.timeStamp - pointerTime);
	trailX = (point.x - pointerX) / dt;
	trailY = (point.y - pointerY) / dt;
	pointerX = point.x;
	pointerY = point.y;
	pointerTime = event.timeStamp;
	input.tiltX = (point.x - PANEL_W / 2) / PANEL_W * 0.42;
	input.tiltY = (point.y - PANEL_H / 2) / PANEL_H * 0.42;
});

canvas.addEventListener("pointerup", (event) => {
	input.down = false;
	input.tiltX = 0;
	input.tiltY = 0;
	const speed = Math.hypot(trailX, trailY);
	if (speed > 0.7) {
		input.flickX = trailX * 18;
		input.flickY = trailY * 18;
	}
	trailX = 0;
	trailY = 0;
	void event;
});

canvas.addEventListener("pointercancel", () => {
	input.down = false;
	input.tiltX = 0;
	input.tiltY = 0;
});

for (const button of faceButtons) {
	button.addEventListener("click", async () => {
		await unlockAudio();
		setFace(button.dataset.face);
	});
}

function nextFloor() {
	if (!floors) return;
	floors.next();
	showFloor();
}

floorButton.addEventListener("click", nextFloor);

soundButton.addEventListener("click", async () => {
	await unlockAudio();
	setMuted(!muted);
});

window.addEventListener("keydown", (event) => {
	if (event.key === "1") setFace("flies");
	if (event.key === "2") setFace("marbles");
	if (event.key === "3") setFace("oxyd");
	if (event.key === "4") setFace("oxyd-large");
	if (event.key === "5") setFace("oxyd-floor");
	if ((event.key === "b" || event.key === "B") && face === "oxyd-floor") nextFloor();
	if (event.key === "m" || event.key === "M") setMuted(!muted);
	if (event.key === " " && face !== "flies") {
		input.flickX = (Math.random() - 0.5) * 28;
		input.flickY = (Math.random() - 0.5) * 28;
		event.preventDefault();
	}
});

boot().catch((error) => {
	console.error(error);
	hint.textContent = "The fly sprites could not be loaded.<context=\"sim\"/>".i18xTrans();
});
