// 3×5 Ziffern. Jede gesetzte Zelle ist ein Landeplatz.
const DIGITS = {
	"0": ["111", "101", "101", "101", "111"],
	"1": ["010", "110", "010", "010", "111"],
	"2": ["111", "001", "111", "100", "111"],
	"3": ["111", "001", "111", "001", "111"],
	"4": ["101", "101", "111", "001", "001"],
	"5": ["111", "100", "111", "001", "111"],
	"6": ["111", "100", "111", "101", "111"],
	"7": ["111", "001", "010", "010", "010"],
	"8": ["111", "101", "111", "101", "111"],
	"9": ["111", "101", "111", "001", "111"],
	":": ["010", "010", "000", "010", "010"]
};

export let PANEL_W = 410;
export let PANEL_H = 502;

// Das Wallpaper dehnt die Fläche auf den ganzen Bildschirm, die Ziffern bleiben mittig.
export function setPanel(width, height) {
	PANEL_W = width;
	PANEL_H = height;
}

const MAIN_PITCH = 18;
const MAIN_GAP = 12;

function measure(chars, pitch, gap) {
	let w = 0;
	for (let i = 0; i < chars.length; i++) {
		w += DIGITS[chars[i]][0].length * pitch;
		if (i < chars.length - 1) w += gap;
	}
	return w;
}

function place(chars, x, y, pitch, gap, prefix, out) {
	let cursor = x;
	for (let i = 0; i < chars.length; i++) {
		const rows = DIGITS[chars[i]];
		for (let r = 0; r < rows.length; r++) {
			for (let c = 0; c < rows[r].length; c++) {
				if (rows[r][c] !== "1") continue;
				out.push({
					id: `${prefix}${i}:${r}:${c}`,
					x: cursor + c * pitch + pitch / 2,
					y: y + r * pitch + pitch / 2
				});
			}
		}
		cursor += rows[0].length * pitch + gap;
	}
}

// Stunde und Minute. Slot-Ids hängen an der Stelle im Zifferblatt, nicht an
// der Ziffer, damit bleibende Punkte ihre Fliege oder Murmel behalten.
export function clockSlots(date, pitch = MAIN_PITCH, gap = MAIN_GAP) {
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const main = [hh[0], hh[1], ":", mm[0], mm[1]];
	const mainW = measure(main, pitch, gap);
	const mainH = 5 * pitch;
	const y0 = (PANEL_H - mainH) / 2 - 8;
	const slots = [];
	place(main, (PANEL_W - mainW) / 2, y0, pitch, gap, "t", slots);
	return slots;
}

const STACK_PITCH = 36;
const STACK_GAP = 16;
const STACK_ROW = 22;

// Stunden oben, Minuten unten, ohne Doppelpunkt.
export function stackedSlots(date) {
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const rowW = measure([hh[0], hh[1]], STACK_PITCH, STACK_GAP);
	const rowH = 5 * STACK_PITCH;
	const totalH = rowH * 2 + STACK_ROW;
	const x = (PANEL_W - rowW) / 2;
	const y = (PANEL_H - totalH) / 2;
	const slots = [];
	place([hh[0], hh[1]], x, y, STACK_PITCH, STACK_GAP, "h", slots);
	place([mm[0], mm[1]], x, y + rowH + STACK_ROW, STACK_PITCH, STACK_GAP, "m", slots);
	return slots;
}

export function peakCount() {
	return clockSlots(new Date(2026, 0, 1, 8, 8, 8)).length;
}
