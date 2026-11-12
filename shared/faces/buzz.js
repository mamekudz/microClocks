// Ein Summton für alle fliegenden Fliegen. Die Lautstärke folgt der Anzahl
// in der Luft, nicht jeder Fliege eine eigene Stimme.
export function createBuzz() {
	const audio = new AudioContext();
	const gain = audio.createGain();
	gain.gain.value = 0;
	const master = audio.createGain();
	master.gain.value = 1;
	gain.connect(master).connect(audio.destination);

	let buffer = null;
	let source = null;
	let muted = false;
	let flying = 0;
	let startAt = 0;
	let loopStart = 0;
	let loopEnd = 0;
	let applied = -1;
	let stopAt = 0;

	async function load(wavUrl, jsonUrl) {
		const [wavResponse, meta] = await Promise.all([
			fetch(wavUrl, { cache: "reload" }),
			fetch(jsonUrl, { cache: "reload" }).then((response) => response.json())
		]);
		if (!wavResponse.ok) throw new Error(`Summton fehlt (${wavResponse.status})`);
		const decoded = await audio.decodeAudioData(await wavResponse.arrayBuffer());
		const loop = meta.sounds.fly1;
		buffer = decoded;
		startAt = loop[0];
		loopStart = loop[2];
		loopEnd = loop[3];
	}

	function halt() {
		const old = source;
		if (!old) return;
		source = null;
		old.onended = null;
		try { old.stop(); } catch { /* schon beendet */ }
		old.disconnect();
	}

	function ensure(now) {
		if (!buffer || source) return;
		source = audio.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		source.loopStart = loopStart;
		source.loopEnd = loopEnd;
		source.connect(gain);
		source.onended = () => {
			source = null;
			applied = -1;
		};
		// Mitten in der Schleife starten, damit das Summen sofort da ist.
		source.start(now, Math.max(startAt, loopStart));
	}

	function apply() {
		if (audio.state !== "running") return;
		// Die Flugschleife liegt im Original nur bei etwa 2 % Aussteuerung.
		const level = muted || flying <= 0 ? 0 : Math.min(12, 6 + flying * 0.3);
		const now = audio.currentTime;
		if (level === applied && (level === 0 || source)) {
			if (level === 0 && source && stopAt && now >= stopAt) halt();
			return;
		}
		gain.gain.cancelScheduledValues(now);
		if (level > 0) {
			stopAt = 0;
			// Beim Abheben sofort hörbar. Ein neuer Zielwert läuft kurz nach.
			if (applied <= 0 || !source) gain.gain.setValueAtTime(level, now);
			else {
				gain.gain.setValueAtTime(gain.gain.value, now);
				gain.gain.linearRampToValueAtTime(level, now + 0.04);
			}
			ensure(now);
			applied = level;
			return;
		}
		applied = 0;
		if (!source) return;
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(0, now + 0.08);
		stopAt = now + 0.1;
	}

	return {
		load,
		async unlock() {
			if (audio.state === "suspended") await audio.resume();
			apply();
		},
		setFlying(count) {
			flying = count;
			apply();
		},
		setMuted(value) {
			muted = value;
			apply();
		},
		setVolume(value) {
			master.gain.value = value;
		},
		get muted() {
			return muted;
		}
	};
}
