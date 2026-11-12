import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Log } from 'gulp-mu-gulp-api';
import { PROJECTS, capture, findPio, openUrl, run, serveStatic, untilCancelled } from './common.mjs';

const SIM_PORT = 8765;

/**
 * @param {string} root
 * @param {{ upload: boolean, port?: string }} options
 */
export async function buildEsp32Firmware(root, { upload, port }) {
	const args = ['run', '-d', join(root, 'esp32', 'firmware')];
	if (upload) args.push('-t', 'upload');
	if (upload && port) args.push('--upload-port', port);
	await run(findPio(), args);
	Log(upload ? 'Firmware gebaut und auf das Board geschrieben.' : 'Firmware gebaut: esp32/firmware/.pio/build/amoled206/firmware.bin');
}

/**
 * Liefert das Repository aus und öffnet `page` im Browser, bis der Task abgebrochen wird.
 * @param {string} root
 * @param {string} page Pfad relativ zum Repository, z. B. `esp32/sim/`
 */
export async function servePage(root, page) {
	const server = await serveStatic(root, SIM_PORT);
	const url = `http://127.0.0.1:${server.port}/${page}`;
	Log(`${url} läuft. Task abbrechen, um den Server zu beenden.`);
	await openUrl(url);
	await untilCancelled(server.close);
}

function wallpaperEngineProjects() {
	let steam = 'C:\\Program Files (x86)\\Steam';
	try {
		const match = capture('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']).match(/SteamPath\s+REG_SZ\s+(.+)/);
		if (match) steam = match[1].trim();
	} catch { /* Standardpfad nehmen. */ }
	return join(steam, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects');
}

/**
 * @param {string} root
 * @param {{ deploy: boolean }} options
 */
export async function buildWallpaper(root, { deploy }) {
	await run('python', [join(root, 'wallpaper', 'build.py')]);
	const dist = join(root, 'dist', 'wallpaper');
	if (!deploy) return;
	const projects = wallpaperEngineProjects();
	if (!existsSync(join(projects, '..'))) throw new Error(`Wallpaper Engine nicht gefunden: ${projects}`);
	const target = join(projects, 'microClocks');
	rmSync(target, { recursive: true, force: true });
	mkdirSync(target, { recursive: true });
	cpSync(dist, target, { recursive: true });
	Log(`In Wallpaper Engine installiert: ${target}`);
}

/**
 * @param {string} root
 * @param {string[]} switches Schalter für run.ps1
 */
export async function runUnreal(root, switches) {
	const script = join(root, 'pc', 'FlyClock3D', 'run.ps1');
	await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...switches]);
}

/**
 * Committet nur die Pfade des gewählten Teilprojekts; andere vorgemerkte Änderungen bleiben unberührt.
 * @param {string} root
 * @param {{ project: string, message: string }} options
 */
export function commitProject(root, { project, message }) {
	const text = String(message ?? '').trim();
	if (!text) throw new Error('Bitte eine Commit-Nachricht angeben.');
	const definition = PROJECTS[project];
	if (project !== 'all' && !definition) throw new Error(`Unbekanntes Projekt: ${project}`);
	const paths = definition ? definition.paths : ['.'];
	capture('git', ['rev-parse', '--is-inside-work-tree'], root);
	capture('git', ['add', '-A', '--', ...paths], root);
	const staged = capture('git', ['diff', '--cached', '--name-status', '--', ...paths], root).trim();
	if (!staged) {
		Log(`Keine Änderungen in ${paths.join(', ')}.`);
		return;
	}
	Log(staged);
	const subject = definition ? `${definition.label}: ${text}` : text;
	Log(capture('git', ['commit', '-m', subject, '--', ...paths], root).trim());
}

/** Ordnernamen, deren Inhalt sich neu bauen oder herunterladen lässt. */
const REPRODUCIBLE = [
	'node_modules', 'dist', '.pio', '.vs', '.cache',
	'Intermediate', 'Saved', 'Binaries', 'DerivedDataCache', 'StarterContent', 'polyhaven', 'Downloads',
];

/**
 * Kopiert das Repository (oder ein Teilprojekt) nach `target`, ohne Reproduzierbares.
 * Am Ziel wird nichts gelöscht.
 * @param {string} root
 * @param {{ project: string, target: string }} options
 */
export async function backup(root, { project, target }) {
	if (!target) throw new Error('Kein Zielordner angegeben.');
	const definition = PROJECTS[project];
	if (project !== 'all' && !definition) throw new Error(`Unbekanntes Projekt: ${project}`);
	const paths = definition ? definition.paths : ['.'];
	const excludes = ['/XD', ...REPRODUCIBLE, join(root, '.microgulp', 'logs'), '/XF', 'fly_loop.wav'];
	for (const path of paths) {
		const from = join(root, path);
		const to = join(target, path);
		Log(`${from} -> ${to}`);
		const code = await new Promise((resolveCopy, rejectCopy) => {
			const child = spawn('robocopy', [from, to, '/E', '/R:2', '/W:5', '/NFL', '/NDL', '/NP', ...excludes], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
			child.on('error', rejectCopy);
			child.on('close', resolveCopy);
		});
		// robocopy: 0-7 Erfolg, ab 8 Fehler.
		if (code >= 8) throw new Error(`robocopy meldet Fehler (Code ${code}) für ${path}.`);
	}
	Log(`Gesichert nach ${target}`);
}
