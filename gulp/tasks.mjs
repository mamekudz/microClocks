import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
 * @param {{ deploy: boolean, face?: string }} options `face`: Vorgabe für die Wallpaper-Eigenschaft "Zifferblatt"
 */
export async function buildWallpaper(root, { deploy, face }) {
	await run('python', [join(root, 'wallpaper', 'build.py')]);
	const dist = join(root, 'dist', 'wallpaper');
	if (face) {
		const file = join(dist, 'project.json');
		const project = JSON.parse(readFileSync(file, 'utf8'));
		project.general.properties.face.value = face;
		writeFileSync(file, JSON.stringify(project, null, '\t'));
		Log(`Zifferblatt-Vorgabe: ${face}`);
	}
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

/** Python der Bluetooth-Laufzeit, die bangle/tools/native-program.mjs für die Übertragung nutzt. */
const DEVICE_PYTHON = 'C:/Projects/microGulp/tmp/device-runtime/Scripts/python.exe';
const PLATFORMIO_INSTALLER = 'https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py';

/** Erste Ausgabezeile eines Befehls oder null, wenn er fehlt oder scheitert. */
function probe(command, args, cwd) {
	try {
		return capture(command, args, cwd).trim().split(/\r?\n/)[0] || 'ok';
	} catch {
		return null;
	}
}

/** @type {{ time: number, missing: string[] } | undefined} */
let setupCache;

/**
 * Schnelle Prüfung für die Hervorhebung des Einrichten-Tasks; läuft bei jedem Einlesen des Gulpfiles.
 * @param {string} root
 * @returns {string[]} fehlende Einrichtungen
 */
export function missingSetup(root) {
	if (setupCache && Date.now() - setupCache.time < 5000) return setupCache.missing;
	const missing = [];
	setupCache = { time: Date.now(), missing };
	if (!existsSync(join(root, 'node_modules', 'gulp-mu-gulp-api'))) missing.push('npm-Pakete');
	if (!probe('python', ['-c', 'import PIL'])) missing.push('Python mit Pillow');
	if (!existsSync(findPio()) && !probe('pio', ['--version'])) missing.push('PlatformIO');
	const epic = 'C:\\Program Files\\Epic Games';
	if (!existsSync(epic) || !readdirSync(epic).some((name) => /^UE_5\./.test(name))) missing.push('Unreal Engine 5');
	if (!existsSync(DEVICE_PYTHON)) missing.push('Bluetooth-Laufzeit');
	return missing;
}

/**
 * Prüft die Werkzeuge aller Teilprojekte und installiert auf Wunsch, was sich automatisch nachinstallieren lässt:
 * npm-Pakete, Pillow (Sprite-Generator) und PlatformIO. Unreal, Visual Studio, Wallpaper Engine und die
 * Bluetooth-Laufzeit werden nur geprüft.
 * @param {string} root
 * @param {{ install: boolean }} options
 */
export async function setup(root, { install }) {
	if (install) await run('npm', ['install'], { cwd: root, shell: true });

	let pillow = probe('python', ['-c', 'import PIL; print(PIL.__version__)']);
	if (!pillow && install && probe('python', ['--version'])) {
		await run('python', ['-m', 'pip', 'install', '--user', 'Pillow']);
		pillow = probe('python', ['-c', 'import PIL; print(PIL.__version__)']);
	}

	let pio = probe(findPio(), ['--version']);
	if (!pio && install && probe('python', ['--version'])) {
		const installer = join(tmpdir(), 'get-platformio.py');
		const response = await fetch(PLATFORMIO_INSTALLER);
		if (!response.ok) throw new Error(`PlatformIO-Installer nicht geladen (HTTP ${response.status}).`);
		writeFileSync(installer, Buffer.from(await response.arrayBuffer()));
		await run('python', [installer]);
		pio = probe(findPio(), ['--version']);
	}

	const epic = 'C:\\Program Files\\Epic Games';
	const unreal = existsSync(epic) ? readdirSync(epic).filter((name) => /^UE_5\./.test(name)).sort().pop() : undefined;
	const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
	const visualStudio = existsSync(vswhere)
		? probe(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'displayName'])
		: null;
	const engine = wallpaperEngineProjects();
	const bluetooth = existsSync(DEVICE_PYTHON) ? probe(DEVICE_PYTHON, ['-c', 'import bleak, serial; print("bleak", bleak.__version__ if hasattr(bleak, "__version__") else "")']) : null;

	const status = (value, missing) => value ? `✔ ${value === 'ok' ? 'vorhanden' : value}` : `✘ ${missing}`;
	const items = [
		{ key: 'Node.js / npm-Pakete', value: status(existsSync(join(root, 'node_modules', 'gulp-mu-gulp-api')) && process.version, 'npm install ausführen') },
		{ key: 'Python', value: status(probe('python', ['--version']), 'Python 3 installieren und in den PATH aufnehmen') },
		{ key: 'Pillow (Bangle-Sprites)', value: status(pillow, 'python -m pip install --user Pillow') },
		{ key: 'PlatformIO (ESP32)', value: status(pio, 'Einrichten mit „Fehlendes installieren“ oder PlatformIO-Erweiterung installieren') },
		{ key: 'Unreal Engine 5 (PC)', value: status(unreal, 'Über den Epic Games Launcher installieren') },
		{ key: 'Visual Studio C++ (PC)', value: status(visualStudio, 'Visual Studio mit „Desktopentwicklung mit C++“ installieren') },
		{ key: 'Wallpaper Engine', value: status(existsSync(join(engine, '..', '..')) && 'vorhanden', 'Über Steam installieren (nur für „Wallpaper bauen“ mit Installation)') },
		{ key: 'Bluetooth-Laufzeit (Bangle)', value: status(bluetooth, `${DEVICE_PYTHON} mit bleak und pyserial fehlt (Teil der µGulp-Entwicklungsumgebung)`) },
	];
	setupCache = undefined;
	LogKeyValue({ title: 'Einrichtung', items });
	const missing = items.filter((item) => item.value.startsWith('✘')).length;
	Log(missing ? `${missing} Voraussetzung(en) fehlen; siehe Hinweise oben.` : 'Alles eingerichtet.');
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
