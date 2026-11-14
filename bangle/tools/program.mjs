import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ide } from 'gulp-mu-gulp-api';

const PAGE_PATH = fileURLToPath(new URL('./flasher.html', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.microgulp', '.git', 'tools', 'assets', 'bangleapps']);
const MAX_COMMAND_BYTES = 420;
const DEV_FILE = 'devclock.app.js';

/**
 * Clock scripts below `dir`, newest first, as paths relative to `root`. Empty files are omitted.
 * @param {string} root
 * @param {string} [dir]
 * @returns {{ value: string, label: string }[]}
 */
export function listClockScripts(root, dir = root) {
	const found = [];
	const walk = (dir, depth) => {
		let entries = [];
		try { entries = readdirSync(dir, { withFileTypes: true }); }
		catch { return; }
		for (const entry of entries) {
			if (entry.name.startsWith('.')) continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (depth < 2 && !SKIP_DIRS.has(entry.name)) walk(full, depth + 1);
				continue;
			}
			if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.js')) continue;
			let size = 0;
			let mtime = 0;
			try {
				const stat = statSync(full);
				size = stat.size;
				mtime = stat.mtimeMs;
			} catch { continue; }
			if (size <= 0) continue;
			found.push({
				value: relative(root, full).split(sep).join('/'),
				mtime,
			});
		}
	};
	walk(dir, 0);
	found.sort((a, b) => b.mtime - a.mtime || a.value.localeCompare(b.value, 'de'));
	return found.map(({ value }) => ({ value, label: value }));
}

/**
 * @param {string} root
 * @param {string} script workspace-relative path
 * @returns {string} absolute path inside the project
 */
export function resolveScript(root, script) {
	if (typeof script !== 'string' || !script.trim()) throw new Error('No script selected.<context="task error"/>'.i18xTrans());
	const rootResolved = resolve(root);
	const full = resolve(rootResolved, script);
	const prefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep;
	if (full !== rootResolved && !full.startsWith(prefix)) {
		throw new Error('The script is outside the project.<context="task error"/>'.i18xTrans());
	}
	if (!full.toLowerCase().endsWith('.js')) throw new Error('Only .js files can go to the Bangle.<context="task error"/>'.i18xTrans());
	return full;
}

/**
 * Espruino speichert Quelltext als Bytes. Alles außerhalb von ASCII wird als
 * \\u-Escape geschickt, damit Länge und Inhalt auf der Uhr exakt stimmen.
 * @param {string} source
 * @returns {string}
 */
export function toDeviceSource(source) {
	let text = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	let out = '';
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		if ((code >= 0x20 && code <= 0x7e) || ch === '\n' || ch === '\t') out += ch;
		else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
		else {
			const value = code - 0x10000;
			out += '\\u' + (0xd800 + (value >> 10)).toString(16).padStart(4, '0');
			out += '\\u' + (0xdc00 + (value & 0x3ff)).toString(16).padStart(4, '0');
		}
	}
	return out;
}

/**
 * @param {string} relativePath
 * @param {string} [displayName]
 */
export function clockIdentity(relativePath, displayName) {
	const base = basename(relativePath).replace(/\.js$/i, '');
	let id = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
	if (!id) id = 'clock';
	const title = (displayName || '').trim() || base.replace(/[_-]+/g, ' ');
	return {
		id,
		title: title.slice(0, 40),
		appFile: `${id}.app.js`,
		infoFile: `${id}.info`,
	};
}

/**
 * @param {string} fileName
 * @param {string} chunk
 * @param {number} offset
 * @param {number} total
 */
function writeCommand(fileName, chunk, offset, total) {
	const args = [fileName, chunk, offset];
	if (offset === 0) args.push(total);
	return `require("Storage").write(${args.map((value) => JSON.stringify(value)).join(',')})`;
}

/**
 * Befehle, die der Tab der Reihe nach an die Uhr schickt.
 * Der letzte Befehl startet die Uhr neu und beendet die Bluetooth-Verbindung.
 * @param {string} source
 * @param {{ id: string, title: string, appFile: string, infoFile: string }} identity
 * @param {boolean} install
 */
export function buildUpload(source, identity, install) {
	const deviceSource = toDeviceSource(source);
	if (!deviceSource.trim()) throw new Error('The script is empty.<context="task error"/>'.i18xTrans());
	const fileName = install ? identity.appFile : DEV_FILE;
	/** @type {{ line: string, final?: boolean }[]} */
	const commands = [{
		line: '(function(){if(typeof Bangle!="undefined"&&Bangle.removeAllListeners)Bangle.removeAllListeners();clearInterval();clearWatch();clearTimeout();})()',
	}];
	commands.push({ line: `require("Storage").erase(${JSON.stringify(fileName)})` });

	let offset = 0;
	while (offset < deviceSource.length) {
		let size = Math.min(160, deviceSource.length - offset);
		let line = '';
		for (;;) {
			const chunk = deviceSource.slice(offset, offset + size);
			const candidate = writeCommand(fileName, chunk, offset, deviceSource.length);
			if (Buffer.byteLength(`\x10${candidate}\n`, 'utf8') <= MAX_COMMAND_BYTES) {
				line = candidate;
				break;
			}
			if (size === 1) break;
			size = Math.max(1, Math.floor(size / 2));
		}
		if (!line) throw new Error('A piece of the script cannot be cut small enough.<context="task error"/>'.i18xTrans());
		commands.push({ line });
		offset += size;
	}

	if (install) {
		const info = JSON.stringify({
			id: identity.id,
			name: identity.title,
			src: identity.appFile,
			type: 'clock',
			version: '0.01',
		});
		commands.push({ line: `require("Storage").erase(${JSON.stringify(DEV_FILE)})` });
		commands.push({
			line: `require("Storage").write(${JSON.stringify(identity.infoFile)},${JSON.stringify(info)})`,
		});
		commands.push({
			line: `(function(){var s=require("Storage").readJSON("setting.json",1)||{};s.clock=${JSON.stringify(identity.appFile)};require("Storage").writeJSON("setting.json",s);})()`,
		});
		commands.push({ line: 'load()', final: true });
	} else {
		commands.push({ line: `load(${JSON.stringify(fileName)})`, final: true });
	}
	return { deviceSource, fileName, commands };
}

/**
 * Öffnet die Seite als Editor-Tab im Cursor-Browser.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function openCursorTab(url) {
	const opened = await Ide.Vscode.ExecuteCommand('workbench.action.openBrowserEditor', {
		url,
		inactive: false,
	});
	if (opened?.ok) return 'Cursor';
	if (opened?.code === 'command-not-allowed') {
		throw new Error('The Cursor browser is not enabled yet. Reload the window and start the task again.<context="task error"/>'.i18xTrans());
	}
	throw new Error(opened?.message || 'The tab in Cursor could not be opened.<context="task error"/>'.i18xTrans());
}

const written = (script) => '<script/> was written to the Bangle.<context="task log"/>'.i18xTrans({ script });
const nothingWritten = () => 'Browser tab closed. Nothing was written to the watch.<context="task log"/>'.i18xTrans();

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {number} [limit]
 * @returns {Promise<string>}
 */
function readBody(request, limit = 100_000) {
	return new Promise((resolveBody, rejectBody) => {
		const chunks = [];
		let size = 0;
		request.on('data', (chunk) => {
			size += chunk.length;
			if (size > limit) {
				rejectBody(new Error('Request too large.'));
				request.destroy();
				return;
			}
			chunks.push(chunk);
		});
		request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
		request.on('error', rejectBody);
	});
}

/**
 * @param {string} value
 */
function oneLine(value) {
	return String(value || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 300);
}

/**
 * Öffnet das Programmierfenster und wartet, bis es fertig ist oder geschlossen wird.
 * @param {{ root: string, script: string, name?: string, install?: boolean, open?: boolean, onLog?: (text: string) => void, onProgress?: (value: number, label?: string) => void }} options
 * @returns {Promise<string>}
 */
export function startProgrammer(options) {
	const log = (text) => {
		if (typeof options.onLog === 'function') options.onLog(text);
		else console.log(text);
	};
	const progress = (value, label) => {
		if (typeof options.onProgress === 'function') options.onProgress(value, label);
	};
	const root = resolve(options.root);
	const scriptPath = resolveScript(root, options.script);
	const script = relative(root, scriptPath).split(sep).join('/');
	const source = readFileSync(scriptPath, 'utf8');
	const install = options.install !== false;
	const identity = clockIdentity(script, options.name);
	const upload = buildUpload(source, identity, install);
	const payload = JSON.stringify({
		script,
		title: identity.title,
		install,
		fileName: upload.fileName,
		bytes: Buffer.byteLength(source),
		commands: upload.commands,
	});

	return new Promise((resolveDone, rejectDone) => {
		let settled = false;
		let opened = false;
		let programmed = false;
		let lastError = '';
		let lastSeen = Date.now();

		const finish = (error, message) => {
			if (settled) return;
			settled = true;
			clearInterval(idleTimer);
			clearTimeout(maxTimer);
			setTimeout(() => {
				server.closeAllConnections?.();
				server.close();
			}, 40);
			if (error) rejectDone(error);
			else resolveDone(message);
		};

		const server = createServer(async (request, response) => {
			const url = new URL(request.url || '/', 'http://127.0.0.1');
			try {
				if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
					opened = true;
					lastSeen = Date.now();
					response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
					response.end(readFileSync(PAGE_PATH));
					return;
				}
				if (request.method === 'GET' && url.pathname === '/api/program') {
					lastSeen = Date.now();
					response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
					response.end(payload);
					return;
				}
				if (request.method === 'POST' && url.pathname === '/api/ping') {
					lastSeen = Date.now();
					response.writeHead(204);
					response.end();
					return;
				}
				if (request.method === 'POST' && url.pathname === '/api/log') {
					lastSeen = Date.now();
					const body = JSON.parse(await readBody(request) || '{}');
					const text = oneLine(body.text);
					if (text) log(text);
					response.writeHead(204);
					response.end();
					return;
				}
				if (request.method === 'POST' && url.pathname === '/api/progress') {
					lastSeen = Date.now();
					const body = JSON.parse(await readBody(request) || '{}');
					const value = Number(body.value);
					if (Number.isFinite(value)) progress(value, oneLine(body.label));
					response.writeHead(204);
					response.end();
					return;
				}
				if (request.method === 'POST' && url.pathname === '/api/result') {
					lastSeen = Date.now();
					const body = JSON.parse(await readBody(request) || '{}');
					const message = oneLine(body.message);
					response.writeHead(204);
					response.end();
					if (body.type === 'success') {
						programmed = true;
						progress(1, script);
						finish(null, message || written(script));
						return;
					}
					if (body.type === 'error') {
						lastError = message || 'The watch did not accept the script.<context="task error"/>'.i18xTrans();
						return;
					}
					if (programmed) finish(null, message || written(script));
					else if (lastError) finish(new Error(lastError));
					else finish(null, nothingWritten());
					return;
				}
				response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
				response.end('Not found');
			} catch (error) {
				response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
				response.end(error instanceof Error ? error.message : 'Invalid request');
			}
		});

		const idleTimer = setInterval(() => {
			if (!opened && Date.now() - lastSeen > 45_000) {
				finish(new Error('The browser tab did not open the page.<context="task error"/>'.i18xTrans()));
				return;
			}
			if (opened && Date.now() - lastSeen > 12_000) {
				if (programmed) finish(null, written(script));
				else if (lastError) finish(new Error(lastError));
				else finish(null, nothingWritten());
			}
		}, 2000);

		const maxTimer = setTimeout(() => {
			finish(new Error('Timeout. The programming window was open too long.<context="task error"/>'.i18xTrans()));
		}, 20 * 60 * 1000);

		server.on('error', (error) => finish(error));
		server.listen(0, '127.0.0.1', () => {
			try {
				const address = server.address();
				const port = address && typeof address === 'object' ? address.port : 0;
				const url = `http://127.0.0.1:${port}/`;
				log('<script/> (<bytes/> bytes, <steps/> steps)<context="task log"/>'.i18xTrans({ script, bytes: Buffer.byteLength(source), steps: upload.commands.length }));
				log(install
					? 'Installing as clock: <title/> (<file/>)<context="task log"/>'.i18xTrans({ title: identity.title, file: upload.fileName })
					: 'Test run: the previous clock comes back after a restart.<context="task log"/>'.i18xTrans());
				log(url);
				progress(0, script);
				if (options.open !== false) {
					openCursorTab(url).then(() => {
						log('Tab opened in Cursor. Tap "Connect and program" there.<context="task log"/>'.i18xTrans());
					}).catch((error) => {
						finish(error instanceof Error ? error : new Error(String(error)));
					});
				}
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
			}
		});
	});
}
