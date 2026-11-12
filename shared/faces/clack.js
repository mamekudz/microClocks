import { PANEL_W } from "./glyphs.js";

// Glas-auf-Glas-Stoß aus den Oxyd-Basissounds (ngMaterial_Glass_Glass).
// Lautstärke und Helligkeit folgen der Stoßstärke, die Position bestimmt das Panorama.
const MAX_VOICES = 10;
const FULL_HIT = 4;

export function createClack() {
	const audio = new AudioContext();
	const master = audio.createGain();
	master.gain.value = 1;
	master.connect(audio.destination);

	let buffer = null;
	let muted = false;
	let voices = 0;

	async function load(url) {
		const response = await fetch(url, { cache: "reload" });
		if (!response.ok) throw new Error(`Stoßgeräusch fehlt (${response.status})`);
		buffer = await audio.decodeAudioData(await response.arrayBuffer());
	}

	function hit(speed, x) {
		if (!buffer || muted || audio.state !== "running" || voices >= MAX_VOICES) return;
		const strength = Math.min(1, speed / FULL_HIT);
		const now = audio.currentTime;
		const source = audio.createBufferSource();
		source.buffer = buffer;
		// Harte Stöße klingen etwas höher, sanfte dumpfer.
		source.playbackRate.value = 0.9 + strength * 0.15 + (Math.random() - 0.5) * 0.08;
		const tone = audio.createBiquadFilter();
		tone.type = "lowpass";
		tone.frequency.value = 1800 + strength * strength * 14000;
		const level = audio.createGain();
		level.gain.value = 0.04 + Math.pow(strength, 1.4) * 0.96;
		const pan = audio.createStereoPanner();
		pan.pan.value = Math.max(-1, Math.min(1, (x / PANEL_W - 0.5) * 1.2));
		source.connect(tone).connect(level).connect(pan).connect(master);
		voices++;
		source.onended = () => {
			voices--;
			source.disconnect();
		};
		source.start(now);
	}

	return {
		load,
		hit,
		async unlock() {
			if (audio.state === "suspended") await audio.resume();
		},
		setMuted(value) {
			muted = value;
		},
		setVolume(value) {
			master.gain.value = value;
		}
	};
}
