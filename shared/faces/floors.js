import { PANEL_H, PANEL_W } from "./glyphs.js";

// Atlas-Reihenfolge wie in den .tiles.png.json der Oxyd-Böden (64-px-Kacheln).
const ORDER = [
	[0, 0], [64, 0], [0, 64], [64, 64], [128, 0], [128, 64], [0, 128], [64, 128],
	[128, 128], [192, 0], [192, 64], [192, 128], [0, 192], [64, 192], [128, 192], [192, 192]
];

// Wie die Oxyd-Modelle ihre Kachel wählen: zufällig oder nach Feldposition.
const FLOORS = [
	{ id: "slate", name: "Schiefer", file: "slate.png", pick: () => Math.floor(Math.random() * 16) },
	{ id: "beech", name: "Buche", file: "beech.png", pick: (col, row) => (col % 4) + (row % 4) * 4 },
	{ id: "planks", name: "Dielen", file: "planks.png", pick: () => Math.floor(Math.random() * 8) }
];

const TILE = 48;

function loadImage(src) {
	const image = new Image();
	image.src = src;
	return image.decode().then(() => image);
}

export async function loadFloors(ratio, base = "../assets/oxyd/floors") {
	const images = await Promise.all(FLOORS.map((floor) => loadImage(`${base}/${floor.file}`)));
	const baked = FLOORS.map((floor, index) => bake(floor, images[index], ratio));
	let current = 0;

	return {
		get name() {
			return FLOORS[current].name;
		},
		next() {
			current = (current + 1) % FLOORS.length;
		},
		select(id) {
			const index = FLOORS.findIndex((floor) => floor.id === id);
			if (index >= 0) current = index;
		},
		draw(context) {
			context.drawImage(baked[current], 0, 0, PANEL_W, PANEL_H);
		}
	};
}

function bake(floor, image, ratio) {
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(PANEL_W * ratio);
	canvas.height = Math.round(PANEL_H * ratio);
	const context = canvas.getContext("2d");
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.imageSmoothingQuality = "high";
	const cols = Math.ceil(PANEL_W / TILE) + 1;
	const rows = Math.ceil(PANEL_H / TILE) + 1;
	const offsetX = (PANEL_W - cols * TILE) / 2;
	const offsetY = (PANEL_H - rows * TILE) / 2;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const [sx, sy] = ORDER[floor.pick(col, row)];
			context.drawImage(image, sx, sy, 64, 64, offsetX + col * TILE, offsetY + row * TILE, TILE, TILE);
		}
	}
	return canvas;
}
