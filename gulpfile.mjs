// microClocks — Projekttitel und Logo: microgulp.config.json
// Teilprojekte: bangle/ (Bangle.js), esp32/ (Waveshare ESP32-S3-Touch-AMOLED-2.06),
// pc/ (Unreal FlyClock3D), wallpaper/ (Wallpaper Engine). shared/ enthält die Zifferblätter für esp32/sim und wallpaper.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetParameter, Log, ReportProgress } from 'gulp-mu-gulp-api';
import { listClockScripts } from './bangle/tools/program.mjs';
import { startNativeProgrammer } from './bangle/tools/native-program.mjs';
import { flag, projectOptions } from './gulp/common.mjs';
import * as tasks from './gulp/tasks.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const bangleScripts = () => listClockScripts(root, join(root, 'bangle'));

// ---------------------------------------------------------------- Bangle.js

export async function programBangle() {
	const script = GetParameter('script', bangleScripts()[0]?.value);
	if (!script) throw new Error('Im Ordner bangle liegt kein Uhr-Skript.');
	const message = await startNativeProgrammer({
		root,
		script,
		name: GetParameter('name', ''),
		install: flag(GetParameter('install', false)),
		previewOnly: flag(GetParameter('previewOnly', true)),
		start: flag(GetParameter('start', false)),
		onLog: (text) => Log(text),
		onProgress: (value, label) => ReportProgress(value, label),
	});

	Log(message);
}

programBangle.µDisplayName = "Program Bangle<context=\"µDisplayName\"/>".i18xRegister();
programBangle.µDescription = "Native Bluetooth connection with preview, backup and read-back verification.<context=\"µDescription\"/>".i18xRegister();
programBangle.µTooltip = "Preview only by default. Writing requires separate confirmation in the dashboard.<context=\"µTooltip\"/>".i18xRegister();
programBangle.µGroup = "Bangle.js<context=\"µGroup\"/>".i18xRegister();
programBangle.µOrder = 1000;
programBangle.µParameters = () => {
	const scripts = bangleScripts();
	return {
	title: 'Bangle programmieren',
	submitLabel: 'Weiter zur nativen Vorschau',
	fields: [
		{ id: 'previewOnly', type: 'boolean', label: 'Nur Vorschau (ohne Gerätezugriff)', default: true },
		{ id: 'start', type: 'boolean', label: 'Nach geprüfter Übertragung starten', description: 'Unterbricht die bisher laufende App.', default: false },
		{
			id: 'script',
			type: 'select',
			label: 'Skript',
			description: 'Diese Datei wird auf die Uhr geschrieben.',
			options: scripts,
			default: scripts[0]?.value,
			required: true,
		},
		{
			id: 'name',
			type: 'text',
			label: 'Name auf der Uhr',
			description: 'Leer lassen, dann wird der Dateiname verwendet.',
			placeholder: 'Bahn Uhr',
		},
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
	"purpose": "Preview a clock script from bangle/ or transfer it to the selected Bangle with backup and read-back verification.",
	"prerequisites": [
		"Clock script below bangle/, gulp-mu-gulp-api and the local microGulp experimental API.",
		"For transfer: dashboard confirmations, .microgulp/native-device.json, Python device runtime and accessible BLE UART services."
	],
	"sideEffects": [
		"Preview performs no device access. Confirmed connection can interrupt running code.",
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
	await tasks.servePage(root, 'esp32/sim/');
}

startEsp32.µDisplayName = "Start ESP32 simulator<context=\"µDisplayName\"/>".i18xRegister();
startEsp32.µDescription = "Serve the browser simulator for the 410 × 502 AMOLED watch face without caching and open it.<context=\"µDescription\"/>".i18xRegister();
startEsp32.µGroup = "ESP32<context=\"µGroup\"/>".i18xRegister();
startEsp32.µOrder = 1110;
startEsp32.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run a local no-cache HTTP server for the repository and open esp32/sim/ in Cursor or the default browser.",
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
	const switches = [];
	if (flag(GetParameter('setup', false))) switches.push('-Setup');
	if (GetParameter('face', 'flies') === 'marbles') switches.push('-marbles');
	if (flag(GetParameter('closeup', false))) switches.push('-closeup');
	await tasks.runUnreal(root, switches);
}

startPc.µDisplayName = "Start PC clock<context=\"µDisplayName\"/>".i18xRegister();
startPc.µDescription = "Build FlyClock3D, set up missing assets and start the clock in a 820 × 1004 window.<context=\"µDescription\"/>".i18xRegister();
startPc.µGroup = "PC<context=\"µGroup\"/>".i18xRegister();
startPc.µOrder = 1210;
startPc.µParameters = {
	title: 'PC-Uhr starten',
	fields: [
		{ id: 'face', type: 'select', label: 'Zifferblatt', options: [{ value: 'flies', label: 'Fliegen' }, { value: 'marbles', label: 'Oxyd-Murmeln' }], default: 'flies' },
		{ id: 'closeup', type: 'boolean', label: 'Nahansicht der Ziffern', default: false },
		{ id: 'setup', type: 'boolean', label: 'Assets neu einrichten', description: 'Materialien, Summton, Waldszene und Fliegenscan neu anlegen.', default: false },
	],
};
startPc.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run pc/FlyClock3D/run.ps1: build, fetch and import missing assets, then launch the clock window.",
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
	await tasks.buildWallpaper(root, { deploy: flag(GetParameter('deploy', true)) });
}

buildWallpaper.µDisplayName = "Build wallpaper<context=\"µDisplayName\"/>".i18xRegister();
buildWallpaper.µDescription = "Package the web wallpaper into dist/wallpaper and optionally install it into Wallpaper Engine.<context=\"µDescription\"/>".i18xRegister();
buildWallpaper.µGroup = "Wallpaper Engine<context=\"µGroup\"/>".i18xRegister();
buildWallpaper.µOrder = 1300;
buildWallpaper.µParameters = {
	title: 'Wallpaper bauen',
	fields: [
		{ id: 'deploy', type: 'boolean', label: 'In Wallpaper Engine installieren', description: 'Kopiert das Paket nach projects/myprojects/microClocks.', default: true },
	],
};
buildWallpaper.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run wallpaper/build.py to package wallpaper and shared faces into dist/wallpaper; optionally copy it to Wallpaper Engine myprojects.",
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
	await tasks.servePage(root, 'wallpaper/');
}

startWallpaper.µDisplayName = "Preview wallpaper<context=\"µDisplayName\"/>".i18xRegister();
startWallpaper.µDescription = "Serve the wallpaper sources without caching and open them in the browser.<context=\"µDescription\"/>".i18xRegister();
startWallpaper.µGroup = "Wallpaper Engine<context=\"µGroup\"/>".i18xRegister();
startWallpaper.µOrder = 1310;
startWallpaper.µAgent = {
	"schemaVersion": 1,
	"purpose": "Run a local no-cache HTTP server for the repository and open wallpaper/ in Cursor or the default browser.",
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

// ---------------------------------------------------------------- Maintenance

export async function backupProject() {
	await tasks.backupProject(root, {
		project: GetParameter('project', 'bangle'),
		target: String(GetParameter('target', 'Z:\\Projects\\microClocks\\snapshots') ?? '').trim(),
	});
}

backupProject.µDisplayName = "Back up project<context=\"µDisplayName\"/>".i18xRegister();
backupProject.µDescription = "Write a time-stamped ZIP snapshot of one subproject, skipping regenerable build folders.<context=\"µDescription\"/>".i18xRegister();
backupProject.µGroup = "Maintenance<context=\"µGroup\"/>".i18xRegister();
backupProject.µOrder = 3010;
backupProject.µParameters = () => ({
	title: 'Projekt sichern',
	fields: [
		{ id: 'project', type: 'select', label: 'Projekt', options: projectOptions(), default: 'bangle', required: true },
		{ id: 'target', type: 'folder', label: 'Zielordner', description: 'Darin entsteht <projekt>/<projekt>-<zeit>.zip.', default: 'Z:\\Projects\\microClocks\\snapshots', required: true },
	],
});
backupProject.µAgent = {
	"schemaVersion": 1,
	"purpose": "Create <target>/<project>/<project>-<timestamp>.zip of the subproject paths with Windows tar.exe and check that it lists entries.",
	"prerequisites": ["Windows 10+ tar.exe (bsdtar) and a writable target folder."],
	"sideEffects": ["Creates the target folder if missing and writes one new ZIP file; existing snapshots are not touched."],
	"artifacts": ["<target>/<project>/<project>-<timestamp>.zip"],
	"limitations": [
		"Skips build output such as .pio and Unreal Intermediate, Saved, Binaries, DerivedDataCache, StarterContent and downloaded Poly Haven assets.",
		"Checks the archive listing only, not file hashes."
	],
	"repeatability": "Each run writes a new snapshot.",
	"cancellation": "Cancelling can leave an incomplete ZIP file in the target folder."
};

// µGulp setup: curated recipe tasks.
import BACKUP_NAS_Schedule from "./.microgulp/recipes/nas-backup/Schedule.cjs";
export async function BACKUP_NAS() {
	const { Run } = await import("./.microgulp/recipes/nas-backup/Run.mjs");
	return Run();
}
BACKUP_NAS.µDisplayName = "NAS backup<context=\"µDisplayName\"/>".i18xRegister();
BACKUP_NAS.µGroup = "Maintenance<context=\"µGroup\"/>".i18xRegister();
BACKUP_NAS.µOrder = 3000;
BACKUP_NAS.µExecutionConcurrency = false;
BACKUP_NAS.µSchedule = BACKUP_NAS_Schedule;
BACKUP_NAS.µDescription = "Configure NAS targets and the schedule, preview a backup or copy and verify files at selected destinations.<context=\"µDescription\"/>".i18xRegister();
BACKUP_NAS.µAgent = {
	"schemaVersion": 1,
	"purpose": "Manage NAS backup targets and scheduling, preview or create verified backups of the whole repository.",
	"prerequisites": [
		"Installed recipe dependencies and valid local recipe configuration.",
		"Dashboard for interactive execution; real backups require accessible target directories with matching .microgulp-target.json markers."
	],
	"sideEffects": [
		"Persists local target/schedule settings. Preview does not copy backup files.",
		"Real runs write verified fixed backups or snapshots and local history; fixed mode can replace an older backup."
	],
	"artifacts": [
		"Backups at selected configured destinations.",
		"Local schedule settings and .recipe-state history."
	],
	"limitations": [
		"The imported interactive Run wrapper requires the dashboard; it is not a standalone CLI backup command.",
		"Targets can fail independently; a completed target is not rolled back when another target fails."
	],
	"repeatability": "Depends on fixed/snapshot mode; review prior target results before retrying.",
	"cancellation": "Stopping can leave staging files or locks. Completed backups are not automatically rolled back."
};

// Gruppen: je Teilprojekt Build und Start, danach Git und Wartung.
// Export- und Tasknamen von programBangle und BACKUP_NAS bleiben kompatibel.
