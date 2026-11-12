// microClocks — Projekttitel und Logo: microgulp.config.json
// Teilprojekte: bangle/ (Bangle.js), esp32/ (Waveshare ESP32-S3-Touch-AMOLED-2.06),
// pc/ (Unreal FlyClock3D), wallpaper/ (Wallpaper Engine). shared/ enthält die Zifferblätter für esp32/sim und wallpaper.
// Die Projektsteuerung "Uhr" (µControls, Katalog in gulp/clocks.mjs) wählt die Uhr für alle Tasks.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetParameter, Log, ReportProgress } from 'gulp-mu-gulp-api';
import { startNativeProgrammer } from './bangle/tools/native-program.mjs';
import { clockControl, currentClock } from './gulp/clocks.mjs';
import { flag, projectOptions } from './gulp/common.mjs';
import * as tasks from './gulp/tasks.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const clock = () => currentClock(root);
// Eigene Feld-Id pro Uhr, damit µGulp sich den Namen je Uhr merkt.
const nameFieldId = (entry) => 'name_' + entry.value.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);

export const µControls = [clockControl(root)];

// ---------------------------------------------------------------- Bangle.js

export async function programBangle() {
	const selected = clock();
	if (!selected.bangle) throw new Error(`Für „${selected.label}“ gibt es keine Bangle-Uhr.`);
	const message = await startNativeProgrammer({
		root,
		script: selected.bangle,
		name: String(GetParameter(nameFieldId(selected), '') ?? '').trim() || selected.title,
		install: flag(GetParameter('install', false)),
		previewOnly: flag(GetParameter('previewOnly', true)),
		start: flag(GetParameter('start', false)),
		onLog: (text) => Log(text),
		onProgress: (value, label) => ReportProgress(value, label),
	});

	Log(message);
}

programBangle.µDisplayName = "Program <clockLabel/> to Bangle<context=\"µDisplayName\"/>".i18xRegister();
programBangle.µDescription = "Native Bluetooth connection with preview, backup and read-back verification for the clock selected in the project controls.<context=\"µDescription\"/>".i18xRegister();
programBangle.µVisible = () => !!clock().bangle;
programBangle.µTooltip = "Preview only by default. Writing requires separate confirmation in the dashboard.<context=\"µTooltip\"/>".i18xRegister();
programBangle.µGroup = "Bangle.js<context=\"µGroup\"/>".i18xRegister();
programBangle.µOrder = 1000;
programBangle.µParameters = () => {
	const selected = clock();
	return {
	title: `${selected.label} auf die Bangle`,
	submitLabel: 'Weiter zur nativen Vorschau',
	fields: [
		{ id: 'previewOnly', type: 'boolean', label: 'Nur Vorschau (ohne Gerätezugriff)', default: true },
		{ id: 'start', type: 'boolean', label: 'Nach geprüfter Übertragung starten', description: 'Unterbricht die bisher laufende App.', default: false },
		...(selected.bangle ? [{
			id: nameFieldId(selected),
			type: 'text',
			label: 'Name auf der Uhr',
			description: `Skript: ${selected.bangle}`,
			default: selected.title,
		}] : []),
		{
			id: 'install',
			type: 'boolean',
			label: 'Als Uhr installieren',
			description: 'Aus: als devclock.app.js speichern; Standarduhr unverändert. Auch dies schreibt eine Datei.',
			default: false,
		},
	],
	};
};
programBangle.µAgent = {
	"schemaVersion": 1,
	"purpose": "Preview or transfer the Bangle script of the clock selected in the project control 'clock' to a Bangle, with backup and read-back verification.",
	"prerequisites": [
		"Project control 'clock' set to a clock with a Bangle script (gulp/clocks.mjs); gulp-mu-gulp-api and the local microGulp experimental API.",
		"For transfer: dashboard confirmations, Python device runtime, a Bangle advertising over BLE (not connected to a phone) and accessible BLE UART services."
	],
	"sideEffects": [
		"Preview performs no device access. Transfer first scans for Bangles and stores the chosen watch in .microgulp/native-device.json.",
		"Confirmed connection can interrupt running code.",
		"Confirmed transfer writes clock files; install can change app information and the default clock; start requests app execution."
	],
	"artifacts": [
		"Local backup.json and result.json in .microgulp/device-backups.",
		"Selected files on the watch after a confirmed transfer."
	],
	"limitations": [
		"CLI supports preview only; writing explicitly requires the µGulp dashboard.",
		"Uses local microGulp API/Python paths. Read-back verification does not verify the rendered clock display."
	],
	"repeatability": "No automatic retry; inspect the backup, result journal and device state after a failed transfer.",
	"cancellation": "Before connection confirmation no connection is made; after writes begin cancellation or radio failure has no automatic rollback."
};

export async function previewBangle() {
	await tasks.servePage(root, 'bangle/preview/flyclock.html');
}

previewBangle.µDisplayName = "Preview Bangle fly clock<context=\"µDisplayName\"/>".i18xRegister();
previewBangle.µDescription = "Run bangle/FlyClock.js in the browser on a 176 × 176 canvas that mimics the Bangle.js 2 display.<context=\"µDescription\"/>".i18xRegister();
previewBangle.µGroup = "Previews<context=\"µGroup\"/>".i18xRegister();
previewBangle.µVisible = () => clock().value === 'flies';
previewBangle.µOrder = 520;
previewBangle.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run a local no-cache HTTP server for the repository and open bangle/preview/flyclock.html in Cursor or the default browser.",
	"prerequisites": ["Port 8765 or any free local port."],
	"sideEffects": ["Listens on 127.0.0.1 until the task is cancelled; opens a browser tab. No watch access."],
	"artifacts": [],
	"limitations": ["Emulates only the Graphics and Bangle calls FlyClock.js uses; drawing speed and colours differ from the watch."],
	"repeatability": "Can be restarted at any time.",
	"cancellation": "Cancelling stops the server; the browser tab stays open without updates."
};

// ---------------------------------------------------------------- ESP32

export async function buildEsp32() {
	await tasks.buildEsp32Firmware(root, {
		upload: flag(GetParameter('upload', false)),
		port: String(GetParameter('port', '') ?? '').trim(),
	});
}

buildEsp32.µDisplayName = "Build ESP32 firmware<context=\"µDisplayName\"/>".i18xRegister();
buildEsp32.µDescription = "Compile the PlatformIO firmware for the Waveshare ESP32-S3-Touch-AMOLED-2.06 and optionally flash it over USB.<context=\"µDescription\"/>".i18xRegister();
buildEsp32.µGroup = "ESP32<context=\"µGroup\"/>".i18xRegister();
buildEsp32.µOrder = 1100;
buildEsp32.µParameters = {
	title: 'ESP32-Firmware bauen',
	fields: [
		{ id: 'upload', type: 'boolean', label: 'Nach dem Bauen auf das Board schreiben', description: 'Überschreibt die Firmware auf dem per USB verbundenen Board.', default: false },
		{ id: 'port', type: 'text', label: 'Serieller Port', description: 'Leer lassen für automatische Erkennung.', placeholder: 'COM5' },
	],
};
buildEsp32.µAgent = {
	"schemaVersion": 1,
	"purpose": "Compile esp32/firmware with PlatformIO and optionally upload it to the connected board.",
	"prerequisites": [
		"PlatformIO (pio on PATH or in ~/.platformio/penv) with the pioarduino platform referenced in platformio.ini.",
		"For upload: the board connected over USB; BOOT held during reset if the port is not detected."
	],
	"sideEffects": [
		"Writes build output to esp32/firmware/.pio and may download platform packages and libraries.",
		"Upload overwrites the firmware on the connected ESP32."
	],
	"artifacts": ["esp32/firmware/.pio/build/amoled206/firmware.bin"],
	"limitations": ["The firmware is a bring-up skeleton: display and RTC time only, no touch, IMU, audio or power management."],
	"repeatability": "Builds are incremental and can be repeated; repeated uploads overwrite the previous firmware.",
	"cancellation": "Cancelling during upload can leave the board without a valid application until it is flashed again."
};

export async function startEsp32() {
	await tasks.servePage(root, `esp32/sim/?face=${clock().web}`);
}

startEsp32.µDisplayName = "ESP32 simulator: <clockLabel/><context=\"µDisplayName\"/>".i18xRegister();
startEsp32.µDescription = "Serve the browser simulator for the 410 × 502 AMOLED display without caching and open it with the selected clock.<context=\"µDescription\"/>".i18xRegister();
startEsp32.µGroup = "Previews<context=\"µGroup\"/>".i18xRegister();
startEsp32.µOrder = 500;
startEsp32.µVisible = () => !!clock().web;
startEsp32.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run a local no-cache HTTP server for the repository and open esp32/sim/?face=<face of the selected clock> in Cursor or the default browser.",
	"prerequisites": ["Port 8765 or any free local port."],
	"sideEffects": ["Listens on 127.0.0.1 until the task is cancelled; opens a browser tab."],
	"artifacts": [],
	"limitations": ["Simulates the watch faces in the browser; it does not run the ESP32 firmware."],
	"repeatability": "Can be restarted at any time; a busy port falls back to a random free port.",
	"cancellation": "Cancelling stops the server; the browser tab stays open without updates."
};

// ---------------------------------------------------------------- PC (Unreal)

export async function buildPc() {
	await tasks.runUnreal(root, ['-BuildOnly']);
}

buildPc.µDisplayName = "Build PC clock<context=\"µDisplayName\"/>".i18xRegister();
buildPc.µDescription = "Compile the Unreal project FlyClock3D with the newest installed Unreal Engine 5.<context=\"µDescription\"/>".i18xRegister();
buildPc.µGroup = "PC<context=\"µGroup\"/>".i18xRegister();
buildPc.µOrder = 1200;
buildPc.µAgent = {
	"schemaVersion": 1,
	"purpose": "Build the FlyClock3DEditor Win64 Development target via pc/FlyClock3D/run.ps1 -BuildOnly.",
	"prerequisites": ["Unreal Engine 5 under C:\\Program Files\\Epic Games and a matching Visual Studio toolchain."],
	"sideEffects": [
		"May update EngineAssociation in FlyClock3D.uproject to the newest installed engine.",
		"Writes Binaries and Intermediate in pc/FlyClock3D."
	],
	"artifacts": ["pc/FlyClock3D/Binaries/Win64"],
	"limitations": ["Does not import assets or start the clock."],
	"repeatability": "Incremental; can be repeated.",
	"cancellation": "Cancelling interrupts the Unreal build; the next build continues incrementally."
};

export async function startPc() {
	const selected = clock();
	if (!selected.pc) throw new Error(`Für „${selected.label}“ gibt es keine PC-Uhr.`);
	const switches = [];
	if (flag(GetParameter('setup', false))) switches.push('-Setup');
	if (selected.pc === 'marbles') switches.push('-marbles');
	if (flag(GetParameter('closeup', false))) switches.push('-closeup');
	await tasks.runUnreal(root, switches);
}

startPc.µDisplayName = "Start PC clock: <clockLabel/><context=\"µDisplayName\"/>".i18xRegister();
startPc.µDescription = "Build FlyClock3D, set up missing assets and start the selected clock in a 820 × 1004 window.<context=\"µDescription\"/>".i18xRegister();
startPc.µGroup = "PC<context=\"µGroup\"/>".i18xRegister();
startPc.µOrder = 1210;
startPc.µVisible = () => !!clock().pc;
startPc.µParameters = {
	title: 'PC-Uhr starten',
	fields: [
		{ id: 'closeup', type: 'boolean', label: 'Nahansicht der Ziffern', default: false },
		{ id: 'setup', type: 'boolean', label: 'Assets neu einrichten', description: 'Materialien, Summton, Waldszene und Fliegenscan neu anlegen.', default: false },
	],
};
startPc.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run pc/FlyClock3D/run.ps1 for the clock selected in the project control 'clock' (flies or marbles): build, fetch and import missing assets, then launch the clock window.",
	"prerequisites": ["Unreal Engine 5, Python for the asset download and network access when Import/polyhaven is missing."],
	"sideEffects": [
		"Builds the project, may copy StarterContent from the engine and download Poly Haven assets.",
		"Setup re-creates Unreal assets under pc/FlyClock3D/Content; launches UnrealEditor in game mode."
	],
	"artifacts": ["Imported assets under pc/FlyClock3D/Content and Import/polyhaven."],
	"limitations": ["Windows only; the clock window runs independently of the task after launch."],
	"repeatability": "Can be repeated; setup only runs when requested or when assets are missing.",
	"cancellation": "Cancelling stops build or setup; an already launched clock window keeps running."
};

// ---------------------------------------------------------------- Wallpaper Engine

export async function buildWallpaper() {
	await tasks.buildWallpaper(root, { deploy: flag(GetParameter('deploy', true)), face: clock().web });
}

buildWallpaper.µDisplayName = "Build wallpaper: <clockLabel/><context=\"µDisplayName\"/>".i18xRegister();
buildWallpaper.µDescription = "Package the web wallpaper with the selected clock as default face into dist/wallpaper and optionally install it into Wallpaper Engine.<context=\"µDescription\"/>".i18xRegister();
buildWallpaper.µGroup = "Wallpaper Engine<context=\"µGroup\"/>".i18xRegister();
buildWallpaper.µOrder = 1300;
buildWallpaper.µVisible = () => !!clock().web;
buildWallpaper.µParameters = {
	title: 'Wallpaper bauen',
	fields: [
		{ id: 'deploy', type: 'boolean', label: 'In Wallpaper Engine installieren', description: 'Kopiert das Paket nach projects/myprojects/microClocks.', default: true },
	],
};
buildWallpaper.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run wallpaper/build.py to package wallpaper and shared faces into dist/wallpaper, set the selected clock as default face in its project.json; optionally copy it to Wallpaper Engine myprojects.",
	"prerequisites": ["Python 3; for deploy a Steam installation with Wallpaper Engine."],
	"sideEffects": [
		"Deletes and re-creates dist/wallpaper.",
		"Deploy replaces steamapps/common/wallpaper_engine/projects/myprojects/microClocks."
	],
	"artifacts": ["dist/wallpaper", "Wallpaper Engine myprojects/microClocks"],
	"limitations": ["Does not publish to the Steam Workshop."],
	"repeatability": "Can be repeated; each run replaces the previous package.",
	"cancellation": "Cancelling can leave a partial dist/wallpaper or deploy folder; run again to repair."
};

export async function startWallpaper() {
	await tasks.servePage(root, `wallpaper/?face=${clock().web}`);
}

startWallpaper.µDisplayName = "Wallpaper preview: <clockLabel/><context=\"µDisplayName\"/>".i18xRegister();
startWallpaper.µDescription = "Serve the wallpaper sources without caching and open them in the browser with the selected clock.<context=\"µDescription\"/>".i18xRegister();
startWallpaper.µGroup = "Previews<context=\"µGroup\"/>".i18xRegister();
startWallpaper.µOrder = 510;
startWallpaper.µVisible = () => !!clock().web;
startWallpaper.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run a local no-cache HTTP server for the repository and open wallpaper/?face=<face of the selected clock> in Cursor or the default browser.",
	"prerequisites": ["Port 8765 or any free local port."],
	"sideEffects": ["Listens on 127.0.0.1 until the task is cancelled; opens a browser tab."],
	"artifacts": [],
	"limitations": ["Wallpaper Engine user properties are not available; defaults from wallpaper.js apply."],
	"repeatability": "Can be restarted at any time.",
	"cancellation": "Cancelling stops the server; the browser tab stays open without updates."
};

// ---------------------------------------------------------------- Git

export async function commitProject() {
	tasks.commitProject(root, { project: GetParameter('project', 'all'), message: GetParameter('message', '') });
}

commitProject.µDisplayName = "Git commit<context=\"µDisplayName\"/>".i18xRegister();
commitProject.µDescription = "Stage and commit only the files of the selected subproject.<context=\"µDescription\"/>".i18xRegister();
commitProject.µGroup = "Git<context=\"µGroup\"/>".i18xRegister();
commitProject.µOrder = 2000;
commitProject.µParameters = () => ({
	title: 'Git-Commit',
	fields: [
		{ id: 'project', type: 'select', label: 'Projekt', options: [{ value: 'all', label: 'Alles' }, ...projectOptions()], default: 'all', required: true },
		{ id: 'message', type: 'text', label: 'Commit-Nachricht', description: 'Bei einem Teilprojekt wird dessen Name vorangestellt.', required: true },
	],
});
commitProject.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run git add -A and git commit limited to the paths of one subproject (esp32 and wallpaper include shared/), or the whole repository.",
	"prerequisites": ["Git with user.name and user.email configured; the repository root is a Git work tree."],
	"sideEffects": ["Stages all changes in the selected paths and creates a local commit. Nothing is pushed."],
	"artifacts": ["A local Git commit."],
	"limitations": ["No push; does not split shared/ changes between esp32 and wallpaper."],
	"repeatability": "Repeating without new changes logs that there is nothing to commit.",
	"cancellation": "Cancelling after staging leaves the files staged without a commit."
};

// ---------------------------------------------------------------- Sicherung

export async function backup() {
	await tasks.backup(root, {
		project: GetParameter('project', 'all'),
		target: String(GetParameter('target', 'Z:\\Projects\\microClocks') ?? '').trim(),
	});
}

backup.µDisplayName = "Back up to Z:<context=\"µDisplayName\"/>".i18xRegister();
backup.µDescription = "Copy everything that cannot be rebuilt or downloaded to the backup drive.<context=\"µDescription\"/>".i18xRegister();
backup.µGroup = "Maintenance<context=\"µGroup\"/>".i18xRegister();
backup.µOrder = 3000;
backup.µParameters = () => ({
	title: 'Sichern',
	fields: [
		{ id: 'project', type: 'select', label: 'Projekt', options: [{ value: 'all', label: 'Alles' }, ...projectOptions()], default: 'all', required: true },
		{ id: 'target', type: 'folder', label: 'Zielordner', default: 'Z:\\Projects\\microClocks', required: true },
	],
});
backup.µAgent = {
	"schemaVersion": 1,
	"purpose": "Copy the repository or one subproject to the target folder with robocopy /E, skipping reproducible folders.",
	"prerequisites": ["Reachable, writable target folder (default Z:\\Projects\\microClocks)."],
	"sideEffects": ["Creates and overwrites files in the target folder; nothing is deleted there."],
	"artifacts": ["Copy of the sources including .git below the target folder."],
	"limitations": [
		"Skips node_modules, dist, .pio, .vs, .cache, .microgulp/logs and Unreal Intermediate, Saved, Binaries, DerivedDataCache, StarterContent, polyhaven, Downloads, fly_loop.wav.",
		"Files deleted locally stay in the backup."
	],
	"repeatability": "Repeatable; robocopy copies only changed files.",
	"cancellation": "Cancelling leaves a partial copy; the next run completes it."
};

