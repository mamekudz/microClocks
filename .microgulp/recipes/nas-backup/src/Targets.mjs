import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ValidateConfig, Fail } from './Config.mjs';
import { PathsOverlap } from './Inventory.mjs';

/** Reconcile saved schedules with configured active targets, including legacy configs. */
export function ActiveSchedule(_config, _schedule) {
	let active = new Set(_config.targets.filter(target => target.enabled !== false).map(target => target.id));
	let targetIds = (_schedule.targetIds ?? _config.targets.filter(target => target.selected).map(target => target.id)).filter(id => active.has(id));
	return { ..._schedule, targetIds, enabled: _schedule.enabled && targetIds.length > 0 };
}

/** Only local configuration changes. Removing a target never touches its directory. */
export async function ManageTargets(_file, _api) {
	let original = fs.readFileSync(_file, 'utf8'), config = ValidateConfig(JSON.parse(original));
	let values = await _api.RequestForm({
		title: 'Manage NAS targets<context="task parameter"/>'.i18xRegister(),
		information: { message: 'Removing a target only removes its configuration. Existing backups remain untouched. New targets need a matching .microgulp-target.json marker before a backup can run.<context="form information"/>'.i18xRegister() },
		cancelable: true, submitLabel: 'Save targets<context="button text"/>'.i18xRegister(),
		fields: [
			...config.targets.flatMap(target => [
				{ id: 'enabled-' + target.id, type: 'boolean', label: 'Target enabled<context="task parameter"/>'.i18xRegister(), description: target.label + ' (' + target.id + ') - ' + target.path, default: target.enabled !== false, remember: false },
				{ id: 'remove-' + target.id, type: 'boolean', label: 'Remove target from configuration<context="task parameter"/>'.i18xRegister(), description: target.label + ' (' + target.id + ')', default: false, remember: false },
			]),
			{ id: 'newId', type: 'text', label: 'New target ID (lowercase letters, digits, hyphen)<context="task parameter"/>'.i18xRegister(), default: '', remember: false },
			{ id: 'newLabel', type: 'text', label: 'New target name<context="task parameter"/>'.i18xRegister(), default: '', remember: false },
			{ id: 'newPath', type: 'folder', label: 'New target folder (absolute path)<context="task parameter"/>'.i18xRegister(), default: '', remember: false },
			{ id: 'newEnabled', type: 'boolean', label: 'Enable new target<context="task parameter"/>'.i18xRegister(), default: true, remember: false },
		],
	});
	if (values == null || values.cancelled === true) return { cancelled: true };
	let targets = config.targets.filter(target => values['remove-' + target.id] !== true).map(target => {
		let enabled = values['enabled-' + target.id];
		if (typeof enabled !== 'boolean') Fail('CONFIG_TARGET', target.id);
		return { ...target, enabled };
	});
	if ([values.newId, values.newLabel, values.newPath].some(value => String(value ?? '').trim())) {
		if (typeof values.newEnabled !== 'boolean') Fail('CONFIG_TARGET');
		targets.push({ id: String(values.newId ?? '').trim(), label: String(values.newLabel ?? '').trim(), path: String(values.newPath ?? '').trim(), selected: true, enabled: values.newEnabled });
	}
	let next = { ...config, targets };
	if (next.schedule) next.schedule = ActiveSchedule(next, next.schedule);
	ValidateConfig(next);
	let source = path.resolve(path.dirname(_file), config.source);
	for (let [index, target] of targets.entries()) {
		if (path.resolve(target.path) === path.parse(path.resolve(target.path)).root || PathsOverlap(source, target.path)) Fail('TARGET_OVERLAP', target.id);
		if (targets.slice(index + 1).some(other => PathsOverlap(target.path, other.path))) Fail('TARGET_OVERLAP', target.id);
	}
	if (fs.readFileSync(_file, 'utf8') !== original) Fail('CONFIG_CHANGED');
	let backup = _file + '.backup-' + randomUUID();
	fs.writeFileSync(backup, original, { flag: 'wx', mode: 0o600 });
	let temp = _file + '.tmp-' + randomUUID();
	try { fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, _file); }
	finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
	_api.NotifyTasksChanged();
	_api.Log('NAS targets saved. Existing backup files were not changed. Configuration backup: <file/><context="task log"/>', { file: backup });
	return { targetsUpdated: true, backup };
}
