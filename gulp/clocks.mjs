import { join } from 'node:path';
import { GetProjectControl } from 'gulp-mu-gulp-api';
import { listClockScripts } from '../bangle/tools/program.mjs';

/**
 * Uhren über alle Plattformen. `title`: Name auf der Bangle, sonst aus dem Dateinamen. `bangle`: Skript, `web`: Zifferblatt in esp32/sim und wallpaper
 * (shared/faces), `pc`: Zifferblatt von run.ps1. Fehlt eine Plattform, gibt es die Uhr dort nicht.
 */
const CATALOG = [
	{ value: 'flies', label: 'FliesClock (White on Black)<context="clock name"/>', title: 'FliesClock (White on Black)', bangle: 'bangle/FliesClock.js', web: 'flies' },
	{ value: 'flies-negative', label: 'FliesClock (Black on White)<context="clock name"/>', title: 'FliesClock (Black on White)', bangle: 'bangle/FliesClockNegative.js' },
	// Die Unreal-Fliegen haben keine Farbvarianten, daher ein eigener Eintrag.
	{ value: 'flies-3d', label: 'FliesClock 3D', pc: 'flies' },
	{ value: 'marbles', label: 'Marbles<context="clock name"/>', bangle: 'bangle/MarbleClock.js', web: 'marbles', pc: 'marbles' },
	{ value: 'glass-marbles', label: 'Oxyd glass marbles<context="clock name"/>', pc: 'glass' },
	{ value: 'oxyd', label: 'Oxyd', bangle: 'bangle/OxydClock.js', web: 'oxyd' },
	{ value: 'oxyd-large', label: 'Oxyd large<context="clock name"/>', web: 'oxyd-large' },
	{ value: 'oxyd-floor', label: 'Oxyd floor<context="clock name"/>', web: 'oxyd-floor' },
	{ value: 'bahn', label: 'Railway clock<context="clock name"/>', bangle: 'bangle/BahnClock.js' },
	{ value: 'bahn-no-seconds', label: 'Railway clock without seconds<context="clock name"/>', bangle: 'bangle/BahnClockNoSecounds.js' },
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
	return [...CATALOG.map((clock) => ({ ...clock, label: clock.label.i18xTrans() })), ...extra]
		.map((clock) => clock.bangle ? { ...clock, title: clock.title ?? scriptTitle(clock.bangle) } : clock);
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
	const web = 'ESP32 simulator, wallpaper<context="project control"/>'.i18xTrans();
	const platforms = (clock) => [clock.bangle && 'Bangle', clock.web && web, clock.pc && 'PC'].filter(Boolean).join(', ');
	return {
		id: 'clock',
		type: 'select',
		label: 'Clock<context="project control"/>'.i18xTrans(),
		tooltip: 'Selects which clock the tasks start, build or transfer. Tasks for platforms without this clock are hidden.<context="project control"/>'.i18xTrans(),
		default: 'flies',
		options: listClocks(root).map((clock) => ({ value: clock.value, label: clock.label, tooltip: platforms(clock) })),
	};
}
