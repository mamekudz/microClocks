import { Translate } from 'gulp-mu-gulp-api';

// Local integration; experimental runtime is configured on this developer machine.
const ROOT = 'file:///C:/Projects/microGulp/';
export function ValidateUartServices(_services, _uart) {
	let service = _services.find((_service) => _service.uuid.toLowerCase() === _uart.service);
	if (service?.error === 'access-denied') throw new Error(Translate('Windows denies access to the existing UART service (ACCESS_DENIED). The Bluetooth connection may still be in use or locked. Nothing transferred.<context="task error"/>'));
	if (!service?.characteristics.some((_char) => _char.uuid.toLowerCase() === _uart.write && _char.properties.includes('write')) || !service.characteristics.some((_char) => _char.uuid.toLowerCase() === _uart.notify && _char.properties.includes('notify'))) throw new Error(Translate('UART service or required write/notify characteristic not available. Nothing transferred.<context="task error"/>'));
}
export async function startNativeProgrammer({ root, script, name = '', install = false, start = false, previewOnly = true }) {
	let api = await import(ROOT + 'gulp-mu-gulp-api/src/index.mjs');
	let progressValue = 0;
	const report = (_value, _label) => { progressValue = _value; api.ReportProgress(_value, Translate(_label)); };
	const yesNo = (_value) => Translate(_value ? 'Yes<context="task log"/>' : 'No<context="task log"/>');
	report(0, 'Preparing preview<context="progress"/>');
	let { PlanBangleUpload, UploadBangle } = await import(ROOT + 'gulp-mu-gulp-api/src/experimental/BangleUpload.mjs');
	let { BangleUart, BANGLE_UART } = await import(ROOT + 'gulp-mu-gulp-api/src/experimental/BangleUart.mjs');
	let plan = await PlanBangleUpload(root, script, { name, install, start });
	api.LogKeyValue({ title: Translate('Native Bangle preview<context="task log"/>'), items: [
		{ key: Translate('Source file<context="task log"/>'), value: plan.script }, { key: 'Bytes / SHA-256', value: plan.bytes + ' / ' + plan.sha256 },
		{ key: Translate('Target files<context="task log"/>'), value: [plan.target, ...(plan.install ? [plan.info, Translate('setting.json (only the clock selection changes)<context="task log"/>')] : [])].join(', ') },
		{ key: Translate('Change default clock<context="task log"/>'), value: yesNo(plan.install) }, { key: Translate('Start after transfer<context="task log"/>'), value: yesNo(plan.start) },
	] });
	if (previewOnly) {
		report(1, 'Preview done - no device access<context="progress"/>');
		return Translate('Preview done. No connection made and no data transferred to the watch.<context="task log"/>');
	}
	if (!api.IsMicroGulp()) throw new Error(Translate('Transfer only from the dashboard with manual confirmation.<context="task error"/>'));
	let { readFile, writeFile } = await import('node:fs/promises');
	let { join } = await import('node:path');
	let deviceFile = join(root, '.microgulp/native-device.json');
	let known = null;
	try { known = JSON.parse(await readFile(deviceFile, 'utf8')); } catch { /* Noch keine Uhr gewählt. */ }
	let device;
	let keys = ['MICROGULP_EXPERIMENTAL_DEVICES', 'MICROGULP_DEVICE_PYTHON'], previous = keys.map((_key) => process.env[_key]);
	process.env.MICROGULP_EXPERIMENTAL_DEVICES = '1';
	process.env.MICROGULP_DEVICE_PYTHON = 'C:/Projects/microGulp/tmp/device-runtime/Scripts/python.exe';
	try {
		let result = await api.WithNativeDevices(async (_devices) => {
			// Suchen sendet nichts an die Uhr; verbunden wird erst nach der Bestätigung.
			report(0.02, 'Searching for Bangles<context="progress"/>');
			let found = (await _devices.Scan({ seconds: 6 }))
				.filter((_found) => /bangle/i.test(_found.name) && ['public', 'random'].includes(_found.addressType))
				.sort((_a, _b) => (_b.rssi ?? -999) - (_a.rssi ?? -999));
			if (!found.length) throw new Error(Translate('No Bangle found. Switch the watch on, bring it into range and disconnect it from the phone or Gadgetbridge.<context="task error"/>'));
			let answer = await api.RequestForm({
				title: Translate('Choose watch<context="task parameter"/>'),
				submitLabel: Translate('Continue<context="button text"/>'),
				cancelable: true,
				fields: [{
					id: 'device',
					type: 'select',
					label: 'Bangle',
					options: found.map((_found) => ({ value: _found.id, label: _found.name + ' (' + _found.id + ', ' + _found.rssi + ' dBm)' })),
					default: found.some((_found) => _found.id === known?.id) ? known.id : found[0].id,
					required: true,
				}],
			});
			let chosen = answer && found.find((_found) => _found.id === answer.device);
			if (!chosen) return { state: 'cancelled-before-connect' };
			device = { transport: 'ble', id: chosen.id, name: chosen.name, addressType: chosen.addressType };
			await writeFile(deviceFile, JSON.stringify(device));
			report(0.04, 'Waiting for confirmation of connection and backup<context="progress"/>');
			let permission = await api.ShowConfirmMessage({ title: Translate('Programming connection and backup<context="form information"/>'), presentation: 'webview',
				message: Translate('<device/>: open the connection and back up existing files? This sends console commands; running code may be interrupted. No storage files are overwritten yet. A second confirmation follows before the transfer.<context="form information"/>', { device: device.name }) });
			if (permission?.button !== 'yes') return { state: 'cancelled-before-connect' };
			report(0.06, 'Opening Bluetooth connection<context="progress"/>');
			let services = await _devices.Connect(device);
			report(0.1, 'Checking Bluetooth services<context="progress"/>');
			ValidateUartServices(services, BANGLE_UART);
			let uart = new BangleUart(_devices);
			try {
				report(0.12, 'Preparing programming console<context="progress"/>');
				await uart.Open(); await uart.PrepareConsole();
				return await UploadBangle(uart, plan, { device, progress: (_value, _label) => report(0.15 + 0.8 * _value, _label), approve: async (_details) => {
					api.Log(Translate('Backup checked locally: <file/><context="task log"/>', { file: _details.backupFile }));
					let answer = await api.ShowConfirmMessage({ title: Translate('Write the files to the watch now?<context="form information"/>'), presentation: 'webview', message:
						device.name + '\n' + plan.script + ' -> ' + plan.target + '\n' +
						Translate(plan.install ? 'App information and the default clock will be changed.<context="form information"/>' : 'The default clock stays unchanged; the test file is saved.<context="form information"/>') + '\n' +
						Translate(plan.start ? 'The new clock will then be requested to start.<context="form information"/>' : 'The new clock will not be started.<context="form information"/>') + '\n' +
						Translate('Existing target files: <files/><context="form information"/>', { files: _details.overwrittenFiles.join(', ') || Translate('none<context="form information"/>') }) + '\n' +
						Translate('Backup: <file/><context="form information"/>', { file: _details.backupFile }) + '\n' +
						Translate('No automatic retry or rollback if the radio connection drops.<context="form information"/>') });
					return answer?.button === 'yes';
				} });
			} finally { report(progressValue, 'Closing connection<context="progress"/>'); await uart.Close(); }
		});
		if (result.state === 'cancelled-before-connect') {
			report(1, 'Cancelled - no connection to the watch<context="progress"/>');
			return Translate('Cancelled. No connection to the watch.<context="task log"/>');
		}
		if (result.state === 'cancelled-before-storage-write') {
			report(1, 'Cancelled - no files written<context="progress"/>');
			return Translate('Cancelled. Backup exists, no storage files written.<context="task log"/>');
		}
		report(1, 'Transfer verified and connection closed<context="progress"/>');
		return Translate('Files transferred and read back byte for byte.<context="task log"/>') + ' ' +
			Translate(plan.start ? 'Start requested; check the display on the watch.<context="task log"/>' : 'No app start requested.<context="task log"/>') + '\n' +
			Translate('Backup: <file/><context="task log"/>', { file: result.backupFile });
	} finally { keys.forEach((_key, _index) => { if (previous[_index] === undefined) delete process.env[_key]; else process.env[_key] = previous[_index]; }); }
}
