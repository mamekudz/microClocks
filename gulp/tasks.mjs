import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Log, LogKeyValue } from 'gulp-mu-gulp-api';
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

function stamp() {
	const now = new Date();
	const pad = (value) => String(value).padStart(2, '0');
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Schreibt ein ZIP des Teilprojekts nach `<target>/<projekt>/<projekt>-<zeit>.zip`.
 * @param {string} root
 * @param {{ project: string, target: string }} options
 */
export async function backupProject(root, { project, target }) {
	const definition = PROJECTS[project];
	if (!definition) throw new Error(`Unbekanntes Projekt: ${project}`);
	if (!target) throw new Error('Kein Zielordner angegeben.');
	const folder = join(target, project);
	mkdirSync(folder, { recursive: true });
	const file = join(folder, `${project}-${stamp()}.zip`);
	// Das Windows-tar (bsdtar) kann ZIP schreiben; ein tar aus Git for Windows im PATH nicht.
	const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
	const excludes = definition.exclude.flatMap((name) => ['--exclude', name]);
	await run(tar, ['-a', '-c', '-f', file, ...excludes, '-C', root, ...definition.paths]);
	const entries = capture(tar, ['-t', '-f', file], root).split('\n').filter(Boolean).length;
	if (!entries) throw new Error(`Das Archiv ist leer: ${file}`);
	LogKeyValue({
		title: `Sicherung ${definition.label}`,
		items: [
			{ key: 'Datei', value: file },
			{ key: 'Einträge', value: String(entries) },
			{ key: 'Größe', value: `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB` },
			{ key: 'Ausgelassen', value: definition.exclude.join(', ') || '-' },
		],
	});
}
