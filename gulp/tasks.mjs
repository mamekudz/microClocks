import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
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
	if (upload) Log('Firmware built and written to the board.<context="task log"/>');
	else Log('Firmware built: <file/><context="task log"/>', { file: 'esp32/firmware/.pio/build/amoled206/firmware.bin' });
}

/**
 * Liefert das Repository aus und öffnet `page` im Browser, bis der Task abgebrochen wird.
 * @param {string} root
 * @param {string} page Pfad relativ zum Repository, z. B. `esp32/sim/`
 */
export async function servePage(root, page) {
	const server = await serveStatic(root, SIM_PORT);
	const url = `http://127.0.0.1:${server.port}/${page}`;
	Log('<url/> is running. Cancel the task to stop the server.<context="task log"/>', { url });
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
		Log('Default face: <face/><context="task log"/>', { face });
	}
	if (!deploy) return;
	const projects = wallpaperEngineProjects();
	if (!existsSync(join(projects, '..'))) throw new Error(engineMissing(projects));
	const target = join(projects, 'microClocks');
	rmSync(target, { recursive: true, force: true });
	mkdirSync(target, { recursive: true });
	cpSync(dist, target, { recursive: true });
	Log('Installed in Wallpaper Engine: <folder/><context="task log"/>', { folder: target });
}

const engineMissing = (folder) => 'Wallpaper Engine not found: <folder/><context="task error"/>'.i18xTrans({ folder });

/** Frühere Projektordner (je Konfiguration ein Wallpaper, gemeinsames Programm in -app); werden beim Bauen entfernt. */
const RETIRED_UNREAL_WALLPAPERS = ['flies-sand', 'flies-grass', 'flies-road', 'flies-forest', 'marbles', 'glass', 'app', '3d'];

/**
 * Programm-Wallpaper; die Id ist auch der Programmname microClocks-<id>.exe, an dem FlyClock.cpp die Uhren wählt.
 * Titel und Beschreibung werden beim Bauen in die Sprache des Rechners übersetzt.
 */
const UNREAL_WALLPAPERS = [
	{
		id: 'flies',
		title: 'microClocks Flies 3D<context="wallpaper title"/>',
		description: 'Flies form the time (Unreal Engine). Ground, digit grid, view and volume are set in the button bar that appears when the mouse moves.<context="wallpaper description"/>',
	},
	{
		id: 'oxyd',
		title: 'microClocks Oxyd 3D<context="wallpaper title"/>',
		description: 'Oxyd stones or Oxyd glass marbles form the time (Unreal Engine). Stones or glass, ground, view and volume are set in the button bar that appears when the mouse moves.<context="wallpaper description"/>',
	},
];

/** Entfernt einen Ordner; Verzeichnisverbindungen darin werden nur gelöst, ihr Ziel bleibt. */
function removeFolder(folder) {
	if (!existsSync(folder)) return;
	for (const entry of readdirSync(folder)) {
		const path = join(folder, entry);
		// readdir meldet Verzeichnisverbindungen als Ordner, rmSync lehnt sie dann ab.
		if (lstatSync(path).isSymbolicLink()) rmdirSync(path);
	}
	rmSync(folder, { recursive: true, force: true });
}

/**
 * Entfernt einen Projektordner. Ein laufendes Wallpaper sperrt seinen Ordner (EPERM); mit `stopPrograms` werden die
 * microClocks-Programme beendet und das Entfernen wiederholt, weil Wallpaper Engine sie wieder starten kann.
 * @param {string} folder
 * @param {boolean} stopPrograms
 */
async function removeUnlocked(folder, stopPrograms) {
	for (let attempt = 1; ; attempt++) {
		try {
			removeFolder(folder);
			return;
		} catch (error) {
			if (!stopPrograms || attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
			const stopped = stopWallpaperPrograms();
			if (stopped.length) Log('Stopped running wallpaper: <programs/><context="task log"/>', { programs: stopped.join(', ') });
			else Log('Folder locked, retrying: <folder/><context="task log"/>', { folder });
			await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
		}
	}
}

/** Beendet laufende microClocks-<id>.exe und liefert die Namen der beendeten Programme. */
function stopWallpaperPrograms() {
	const stopped = [];
	for (const id of [...UNREAL_WALLPAPERS.map((wallpaper) => wallpaper.id), ...RETIRED_UNREAL_WALLPAPERS]) {
		const exe = `microClocks-${id}.exe`;
		const result = spawnSync('taskkill', ['/F', '/IM', exe], { encoding: 'utf8', windowsHide: true });
		if (result.status === 0) stopped.push(exe);
	}
	return stopped;
}

/**
 * Packt die Unreal-Uhr und legt die Wallpaper-Engine-Projekte microClocks-ue-flies und microClocks-ue-oxyd an, je mit
 * dem Programm im Projektordner. Programm-Wallpaper bekommen von Wallpaper Engine weder Argumente noch Einstellungen.
 * Am Programmnamen microClocks-<id>.exe (Hardlink auf das Shipping-Programm) erkennt FlyClock.cpp Wallpaper-Modus und
 * Uhren; den Rest stellt man über die Knopfleiste im Wallpaper ein. Vorschaubilder: pc/FlyClock3D/wallpaper-preview-<id>.jpg.
 * @param {string} root
 * @param {{ deploy: boolean }} options
 */
export async function buildUnrealWallpaper(root, { deploy }) {
	const dist = join(root, 'dist', 'wallpaper-ue');
	const build = join(dist, 'build');
	await runUnreal(root, ['-Package', build]);
	const packaged = join(build, 'Windows');
	const shippingName = 'FlyClock3D-Win64-Shipping.exe';
	if (!existsSync(join(packaged, 'FlyClock3D', 'Binaries', 'Win64', shippingName))) {
		throw new Error('Packaged program not found: <file/><context="task error"/>'.i18xTrans({ file: join(packaged, 'FlyClock3D', 'Binaries', 'Win64', shippingName) }));
	}

	const base = deploy ? wallpaperEngineProjects() : dist;
	if (deploy && !existsSync(join(base, '..'))) throw new Error(engineMissing(base));
	for (const id of RETIRED_UNREAL_WALLPAPERS) {
		const old = join(base, `microClocks-ue-${id}`);
		if (!existsSync(old)) continue;
		await removeUnlocked(old, deploy);
		Log('Removed former project folder: <folder/><context="task log"/>', { folder: old });
	}

	let first = '';
	for (const wallpaper of UNREAL_WALLPAPERS) {
		const folder = join(base, `microClocks-ue-${wallpaper.id}`);
		await removeUnlocked(folder, deploy);
		// Das erste Projekt bekommt eine Kopie, das zweite Hardlinks darauf statt weiterer 800 MB. Verlinkt wird nur
		// das Paket; project.json und preview.jpg geteilt, schriebe das zweite Projekt sie auch ins erste.
		if (first) for (const entry of readdirSync(packaged)) linkTree(join(first, entry), join(folder, entry));
		else cpSync(packaged, folder, { recursive: true });
		const binaries = join(folder, 'FlyClock3D', 'Binaries', 'Win64');
		const exe = `microClocks-${wallpaper.id}.exe`;
		for (const other of UNREAL_WALLPAPERS) rmSync(join(binaries, `microClocks-${other.id}.exe`), { force: true });
		linkSync(join(binaries, shippingName), join(binaries, exe));

		const preview = join(root, 'pc', 'FlyClock3D', `wallpaper-preview-${wallpaper.id}.jpg`);
		if (existsSync(preview)) cpSync(preview, join(folder, 'preview.jpg'));
		writeFileSync(join(folder, 'project.json'), JSON.stringify({
			title: wallpaper.title.i18xTrans(),
			description: wallpaper.description.i18xTrans(),
			file: `FlyClock3D/Binaries/Win64/${exe}`,
			...(existsSync(preview) ? { preview: 'preview.jpg' } : {}),
			type: 'application',
			tags: ['Relaxing'],
			visibility: 'private',
		}, null, '\t'));
		Log('Wallpaper project: <folder/><context="task log"/>', { folder });
		first ||= folder;
	}
}

/** Legt `target` als Hardlink auf die Datei bzw. als Ordnerbaum aus Hardlinks an; über Laufwerksgrenzen wird kopiert. */
function linkTree(source, target) {
	if (!lstatSync(source).isDirectory()) {
		try { linkSync(source, target); } catch { cpSync(source, target); }
		return;
	}
	mkdirSync(target, { recursive: true });
	for (const entry of readdirSync(source)) linkTree(join(source, entry), join(target, entry));
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
	if (!text) throw new Error('Please enter a commit message.<context="task error"/>'.i18xTrans());
	const definition = PROJECTS[project];
	if (project !== 'all' && !definition) throw new Error(unknownProject(project));
	const paths = definition ? definition.paths : ['.'];
	capture('git', ['rev-parse', '--is-inside-work-tree'], root);
	capture('git', ['add', '-A', '--', ...paths], root);
	const staged = capture('git', ['diff', '--cached', '--name-status', '--', ...paths], root).trim();
	if (!staged) {
		Log('No changes in <paths/>.<context="task log"/>', { paths: paths.join(', ') });
		return;
	}
	Log(staged);
	const subject = definition ? `${definition.label}: ${text}` : text;
	Log(capture('git', ['commit', '-m', subject, '--', ...paths], root).trim());
}

const unknownProject = (project) => 'Unknown project: <project/><context="task error"/>'.i18xTrans({ project });

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
	if (!existsSync(join(root, 'node_modules', 'gulp-mu-gulp-api'))) missing.push('npm packages<context="setup item"/>'.i18xTrans());
	if (!probe('python', ['-c', 'import PIL'])) missing.push('Python with Pillow<context="setup item"/>'.i18xTrans());
	if (!existsSync(findPio()) && !probe('pio', ['--version'])) missing.push('PlatformIO');
	const epic = 'C:\\Program Files\\Epic Games';
	if (!existsSync(epic) || !readdirSync(epic).some((name) => /^UE_5\./.test(name))) missing.push('Unreal Engine 5');
	if (!existsSync(DEVICE_PYTHON)) missing.push('Bluetooth runtime<context="setup item"/>'.i18xTrans());
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
		if (!response.ok) throw new Error('PlatformIO installer not downloaded (HTTP <status/>).<context="task error"/>'.i18xTrans({ status: response.status }));
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

	const present = 'present<context="setup status"/>'.i18xTrans();
	const status = (value, missing) => value ? `✔ ${value === 'ok' ? present : value}` : `✘ ${missing}`;
	const items = [
		{ key: 'Node.js / npm packages<context="setup item"/>'.i18xTrans(), value: status(existsSync(join(root, 'node_modules', 'gulp-mu-gulp-api')) && process.version, 'Run npm install<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Python', value: status(probe('python', ['--version']), 'Install Python 3 and add it to PATH<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Pillow (Bangle sprites)<context="setup item"/>'.i18xTrans(), value: status(pillow, 'python -m pip install --user Pillow') },
		{ key: 'PlatformIO (ESP32)', value: status(pio, 'Set up with "Install missing" or install the PlatformIO extension<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Unreal Engine 5 (PC)', value: status(unreal, 'Install with the Epic Games Launcher<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Visual Studio C++ (PC)', value: status(visualStudio, 'Install Visual Studio with "Desktop development with C++"<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Wallpaper Engine', value: status(existsSync(join(engine, '..', '..')) && 'ok', 'Install with Steam (only needed for "Build wallpaper" with installation)<context="setup hint"/>'.i18xTrans()) },
		{ key: 'Bluetooth runtime (Bangle)<context="setup item"/>'.i18xTrans(), value: status(bluetooth, '<python/> with bleak and pyserial is missing (part of the µGulp development environment)<context="setup hint"/>'.i18xTrans({ python: DEVICE_PYTHON })) },
	];
	setupCache = undefined;
	LogKeyValue({ title: 'Setup<context="task log"/>'.i18xTrans(), items });
	const missing = items.filter((item) => item.value.startsWith('✘')).length;
	if (missing) Log('<count/> prerequisite(s) missing; see the hints above.<context="task log"/>', { count: missing });
	else Log('Everything is set up.<context="task log"/>');
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
	if (!target) throw new Error('No target folder specified.<context="task error"/>'.i18xTrans());
	const definition = PROJECTS[project];
	if (project !== 'all' && !definition) throw new Error(unknownProject(project));
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
		if (code >= 8) throw new Error('robocopy reports errors (code <code/>) for <path/>.<context="task error"/>'.i18xTrans({ code, path }));
	}
	Log('Backed up to <folder/><context="task log"/>', { folder: target });
}
