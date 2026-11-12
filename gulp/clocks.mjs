import { join } from 'node:path';
import { GetProjectControl } from 'gulp-mu-gulp-api';
import { listClockScripts } from '../bangle/tools/program.mjs';

/**
 * Uhren über alle Plattformen. `bangle`: Skript, `web`: Zifferblatt in esp32/sim und wallpaper
 * (shared/faces), `pc`: Zifferblatt von run.ps1. Fehlt eine Plattform, gibt es die Uhr dort nicht.
 */
const CATALOG = [
	{ value: 'flies', label: 'Fliegen', bangle: 'bangle/FlyClock.js', web: 'flies', pc: 'flies' },
	{ value: 'marbles', label: 'Murmeln', bangle: 'bangle/MarbleClock.js', web: 'marbles', pc: 'marbles' },
	{ value: 'oxyd', label: 'Oxyd', bangle: 'bangle/OxydClock.js', web: 'oxyd' },
	{ value: 'oxyd-large', label: 'Oxyd groß', web: 'oxyd-large' },
	{ value: 'oxyd-floor', label: 'Oxyd Boden', web: 'oxyd-floor' },
	{ value: 'bahn', label: 'Bahnuhr', bangle: 'bangle/BahnClock.js' },
	{ value: 'bahn-no-seconds', label: 'Bahnuhr ohne Sekunden', bangle: 'bangle/BahnClockNoSecounds.js' },
];

const scriptTitle = (script) => script.replace(/^.*\//, '').replace(/\.js$/i, '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

/**
 * Katalog plus jedes weitere Skript unter bangle/ als eigene Uhr.
 * @param {string} root
 */
export function listClocks(root) {
	const known = new Set(CATALOG.map((clock) => clock.bangle).filter(Boolean));
	const extra = listClockScripts(root, join(root, 'bangle'))
		.filter(({ value }) => !known.has(value))
		.map(({ value }) => ({ value: 'bangle-' + value.replace(/^.*\//, '').replace(/\.js$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: scriptTitle(value), bangle: value }));
	return [...CATALOG, ...extra].map((clock) => clock.bangle ? { ...clock, title: scriptTitle(clock.bangle) } : clock);
}

/**
 * Die in der Projektsteuerung gewählte Uhr.
 * @param {string} root
 */
export function currentClock(root) {
	const clocks = listClocks(root);
	return clocks.find((clock) => clock.value === GetProjectControl('clock', 'flies')) ?? clocks[0];
}

/**
 * Deklaration für `µControls`.
 * @param {string} root
 */
export function clockControl(root) {
	const platforms = (clock) => [clock.bangle && 'Bangle', clock.web && 'ESP32-Simulator, Wallpaper', clock.pc && 'PC'].filter(Boolean).join(', ');
	return {
		id: 'clock',
		type: 'select',
		label: 'Uhr',
		tooltip: 'Bestimmt, welche Uhr die Tasks starten, bauen oder übertragen. Tasks für Plattformen ohne diese Uhr werden ausgeblendet.',
		default: 'flies',
		options: listClocks(root).map((clock) => ({ value: clock.value, label: clock.label, tooltip: platforms(clock) })),
	};
}
