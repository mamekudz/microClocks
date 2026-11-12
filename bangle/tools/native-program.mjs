// Local integration; experimental runtime is configured on this developer machine.
const ROOT = 'file:///C:/Projects/microGulp/';
export function ValidateUartServices(_services, _uart) {
	let service = _services.find((_service) => _service.uuid.toLowerCase() === _uart.service);
	if (service?.error === 'access-denied') throw new Error('Windows verweigert den Zugriff auf den vorhandenen UART-Dienst (ACCESS_DENIED). Die Bluetooth-Verbindung kann noch belegt oder gesperrt sein. Keine Übertragung.');
	if (!service?.characteristics.some((_char) => _char.uuid.toLowerCase() === _uart.write && _char.properties.includes('write')) || !service.characteristics.some((_char) => _char.uuid.toLowerCase() === _uart.notify && _char.properties.includes('notify'))) throw new Error('UART-Dienst oder benötigte Schreib-/Benachrichtigungsfunktion nicht verfügbar. Keine Übertragung.');
}
export async function startNativeProgrammer({ root, script, name = '', install = false, start = false, previewOnly = true }) {
	let api = await import(ROOT + 'gulp-mu-gulp-api/src/index.mjs');
	let progressValue = 0;
	const report = (_value, _label) => { progressValue = _value; api.ReportProgress(_value, _label); };
	report(0, 'Vorschau vorbereiten');
	let { PlanBangleUpload, UploadBangle } = await import(ROOT + 'gulp-mu-gulp-api/src/experimental/BangleUpload.mjs');
	let { BangleUart, BANGLE_UART } = await import(ROOT + 'gulp-mu-gulp-api/src/experimental/BangleUart.mjs');
	let plan = await PlanBangleUpload(root, script, { name, install, start });
	api.LogKeyValue({ title: 'Native Bangle-Vorschau', items: [
		{ key: 'Quelldatei', value: plan.script }, { key: 'Bytes / SHA-256', value: plan.bytes + ' / ' + plan.sha256 },
		{ key: 'Zieldateien', value: [plan.target, ...(plan.install ? [plan.info, 'setting.json (nur Uhr-Auswahl ändern)'] : [])].join(', ') },
		{ key: 'Standarduhr ändern', value: plan.install ? 'Ja' : 'Nein' }, { key: 'Nach Übertragung starten', value: plan.start ? 'Ja' : 'Nein' },
	] });
	if (previewOnly) {
		report(1, 'Vorschau fertig - ohne Gerätezugriff');
		return 'Vorschau fertig. Keine Verbindung und keine Daten auf die Uhr übertragen.';
	}
	if (!api.IsMicroGulp()) throw new Error('Übertragung nur aus dem Dashboard mit manueller Bestätigung.');
	let { readFile } = await import('node:fs/promises');
	let { join } = await import('node:path');
	let device = JSON.parse(await readFile(join(root, '.microgulp/native-device.json'), 'utf8'));
	if (device.transport !== 'ble' || !device.id || !device.name || !['public', 'random'].includes(device.addressType)) throw new Error('Keine gültige lokale Geräteauswahl.');
	report(0.03, 'Auf Bestätigung für Verbindung und Sicherung warten');
	let permission = await api.ShowConfirmMessage({ title: 'Programmierverbindung und Sicherung', presentation: 'webview',
		message: device.name + ': Verbindung öffnen und vorhandene Dateien sichern? Dafür werden Konsolenbefehle gesendet; laufender Code kann unterbrochen werden. Noch keine Speicherdateien überschreiben. Vor der Übertragung folgt eine zweite Bestätigung.' });
	if (permission?.button !== 'yes') {
		report(1, 'Abgebrochen - keine Verbindung zur Uhr');
		return 'Abgebrochen. Keine Verbindung zur Uhr.';
	}
	let keys = ['MICROGULP_EXPERIMENTAL_DEVICES', 'MICROGULP_DEVICE_PYTHON'], previous = keys.map((_key) => process.env[_key]);
	process.env.MICROGULP_EXPERIMENTAL_DEVICES = '1';
	process.env.MICROGULP_DEVICE_PYTHON = 'C:/Projects/microGulp/tmp/device-runtime/Scripts/python.exe';
	try {
		let result = await api.WithNativeDevices(async (_devices) => {
			report(0.06, 'Bluetooth-Verbindung öffnen');
			let services = await _devices.ConnectKnown(device);
			report(0.1, 'Bluetooth-Dienste prüfen');
			ValidateUartServices(services, BANGLE_UART);
			let uart = new BangleUart(_devices);
			try {
				report(0.12, 'Programmierkonsole vorbereiten');
				await uart.Open(); await uart.PrepareConsole();
				return await UploadBangle(uart, plan, { device, progress: (_value, _label) => report(0.15 + 0.8 * _value, _label), approve: async (_details) => {
					api.Log('Sicherung lokal geprüft: ' + _details.backupFile);
					let answer = await api.ShowConfirmMessage({ title: 'Dateien jetzt auf die Uhr schreiben?', presentation: 'webview', message:
						device.name + '\n' + plan.script + ' -> ' + plan.target + '\n' +
						(plan.install ? 'App-Informationen und Standarduhr werden geändert.' : 'Die Standarduhr bleibt unverändert; die Testdatei wird gespeichert.') + '\n' +
						(plan.start ? 'Die neue Uhr wird anschließend zum Start angefordert.' : 'Die neue Uhr wird nicht gestartet.') + '\n' +
						'Vorhandene Zieldateien: ' + (_details.overwrittenFiles.join(', ') || 'keine') + '\nSicherung: ' + _details.backupFile + '\nBei Funkabbruch keine automatische Wiederholung oder Rücknahme.' });
					return answer?.button === 'yes';
				} });
			} finally { report(progressValue, 'Verbindung schließen'); await uart.Close(); }
		});
		report(1, result.state === 'cancelled-before-storage-write' ? 'Abgebrochen - keine Dateien geschrieben' : 'Übertragung geprüft und Verbindung geschlossen');
		return result.state === 'cancelled-before-storage-write' ? 'Abgebrochen. Sicherung vorhanden, keine Speicherdateien geschrieben.' : 'Dateien übertragen und bytegenau zurückgelesen. ' + (plan.start ? 'Start angefordert; Anzeige auf der Uhr noch prüfen.' : 'Kein App-Start angefordert.') + '\nSicherung: ' + result.backupFile;
	} finally { keys.forEach((_key, _index) => { if (previous[_index] === undefined) delete process.env[_key]; else process.env[_key] = previous[_index]; }); }
}
