import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Ide, Log } from 'gulp-mu-gulp-api';

/** Teilprojekte. `paths` sind relativ zum Repository und bestimmen Commit- und Sicherungsumfang. */
export const PROJECTS = {
	bangle: { label: 'Bangle.js', paths: ['bangle'] },
	esp32: { label: 'ESP32', paths: ['esp32', 'shared'] },
	pc: { label: 'PC (Unreal)', paths: ['pc'] },
	wallpaper: { label: 'Wallpaper Engine', paths: ['wallpaper', 'shared'] },
};

export const projectOptions = () => Object.entries(PROJECTS).map(([value, { label }]) => ({ value, label }));

/**
 * µGulp liefert Booleans, die Gulp-CLI Umgebungswerte als Zeichenkette.
 * @param {unknown} value
 */
export function flag(value) {
	return value === true || /^(1|true|yes|ja|on)$/i.test(String(value ?? ''));
}

/**
 * Startet ein Programm und reicht die Ausgabe durch. Wirft bei Exitcode ungleich 0.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean }} [options] `shell` für .cmd-Programme wie npm
 */
export function run(command, args, options = {}) {
	Log(`> ${[command, ...args].join(' ')}`);
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, shell: options.shell, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
		child.on('error', rejectRun);
		child.on('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(exitError(command, code))));
	});
}

/**
 * Startet ein Programm und liefert die Standardausgabe.
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
export function capture(command, args, cwd) {
	const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error((result.stderr || result.stdout || exitError(command, result.status)).trim());
	return result.stdout;
}

const exitError = (command, code) => '<command/> exited with code <code/>.<context="task error"/>'.i18xTrans({ command, code });

/** PlatformIO liegt meist nicht im PATH, sondern in der eigenen Python-Umgebung. */
export function findPio() {
	const local = join(homedir(), '.platformio', 'penv', 'Scripts', 'pio.exe');
	return existsSync(local) ? local : 'pio';
}

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.wav': 'audio/wav',
};

/**
 * Liefert `root` ohne Browser-Cache aus, damit geänderte Module sofort greifen.
 * Ist der Wunschport belegt, wird ein freier Port genommen.
 * @param {string} root
 * @param {number} port
 * @returns {Promise<{ port: number, close: () => void }>}
 */
export function serveStatic(root, port) {
	const base = resolve(root);
	const server = createServer((request, response) => {
		const url = new URL(request.url || '/', 'http://127.0.0.1');
		let file = normalize(join(base, decodeURIComponent(url.pathname)));
		if (file !== base && !file.startsWith(base + sep)) {
			response.writeHead(403).end();
			return;
		}
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
		if (!existsSync(file)) {
			response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
			return;
		}
		response.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
		createReadStream(file).pipe(response);
	});
	return new Promise((resolveServe, rejectServe) => {
		const listen = (wanted) => server.listen(wanted, '127.0.0.1');
		server.on('error', (error) => {
			if (error.code === 'EADDRINUSE' && server.listening === false && port !== 0) {
				port = 0;
				listen(0);
				return;
			}
			rejectServe(error);
		});
		server.on('listening', () => {
			const address = server.address();
			resolveServe({ port: typeof address === 'object' && address ? address.port : port, close: () => server.close() });
		});
		listen(port);
	});
}

/**
 * Öffnet die Seite als Tab in Cursor, sonst im Standardbrowser.
 * @param {string} url
 */
export async function openUrl(url) {
	const opened = await Ide.Vscode.ExecuteCommand('workbench.action.openBrowserEditor', { url, inactive: false });
	if (opened?.ok) return;
	// command-not-allowed: Freigabe in .vscode/settings.json (microgulp.ideCommandAllowlist) greift erst nach "Fenster neu laden".
	Log('No IDE tab (<code/>: <message/>), opening the default browser.<context="task log"/>', { code: opened?.code, message: opened?.message });
	spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

/** Hält den Task am Leben, bis er abgebrochen wird. */
export function untilCancelled(onStop) {
	return new Promise((resolveStop) => {
		const stop = () => {
			onStop?.();
			resolveStop();
		};
		process.once('SIGINT', stop);
		process.once('SIGTERM', stop);
	});
}
