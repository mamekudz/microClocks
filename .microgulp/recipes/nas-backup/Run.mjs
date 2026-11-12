import { fileURLToPath } from 'node:url';

export async function Run() {
	const api = await import('gulp-mu-gulp-api');
	if (!api.IsMicroGulp()) throw Error('Start this interactive backup task in the µGulp dashboard.');
	api.InstallStringExtensions();
	const { RunTask } = await import('./src/Task.mjs');
	// API 0.6.0 is published; newer hosts also provide scheduled run context.
	const taskApi = { ...api, GetTaskRunContext: api.GetTaskRunContext ?? (() => {
		try {
			const context = JSON.parse(process.env.MICROGULP_TASK_CONTEXT ?? '{}');
			return { reason: context?.reason === 'schedule' ? 'schedule' : 'manual' };
		} catch { return { reason: 'manual' }; }
	}) };
	return RunTask(fileURLToPath(new URL('./config.json', import.meta.url)), taskApi);
}
