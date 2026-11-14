import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Translate } from 'gulp-mu-gulp-api';

// App-Loader-Apps: Ordner unter bangle/bangleapps und das Uhrskript, aus dem app.js entsteht.
// Icons und Screenshots erzeugt bangle/tools/flysprites.py bzw. die Bangle-Vorschau; app.js wird nie dort abgelegt.
const APPS = { fliesclock: 'FliesClock.js', fliesclockneg: 'FliesClockNegative.js', oxydclock: 'OxydClock.js' };
const BANGLE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Kopiert die Apps nach `<target>/apps/<id>` einer BangleApps-Arbeitskopie (vorhandene Dateien werden überschrieben).
 * @param {string} target
 * @returns {string[]} geschriebene App-Ordner
 */
export function exportApps(target) {
	if (!existsSync(join(target, 'apps'))) throw new Error(Translate('<path/> is not a BangleApps checkout (apps folder missing).<context="task error"/>', { path: target }));
	const written = [];
	for (const [id, script] of Object.entries(APPS)) {
		const source = join(BANGLE, 'bangleapps', id);
		const folder = join(target, 'apps', id);
		mkdirSync(folder, { recursive: true });
		for (const file of readdirSync(source)) copyFileSync(join(source, file), join(folder, file));
		copyFileSync(join(BANGLE, script), join(folder, 'app.js'));
		written.push(folder);
	}
	return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const target = process.argv[2];
	if (!target) {
		console.error(Translate('Usage: node bangle/tools/bangleapps.mjs [BangleApps folder]<context="task error"/>'));
		process.exit(1);
	}
	for (const folder of exportApps(resolve(target))) console.log(Translate('Written: <path/><context="task log"/>', { path: folder }));
}
