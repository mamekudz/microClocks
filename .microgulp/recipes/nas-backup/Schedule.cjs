const fs = require('node:fs');
const path = require('node:path');

// Discovery reads local schedule settings only, never the source or NAS.
module.exports = function ReadSchedule() {
	try {
		const state = JSON.parse(fs.readFileSync(path.join(__dirname, '.microgulp/nas-backup-schedule.json'), 'utf8'));
		const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
		const active = config.targets.filter(target => target.enabled !== false).map(target => target.id);
		return state.enabled === true && state.targetIds?.some(id => active.includes(id)) && typeof state.cron === 'string' ? { cron: state.cron, autoStart: true } : false;
	} catch { return false; }
};
