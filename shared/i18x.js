// i18x für Browserseiten: "Text<context=\"…\"/>".i18xTrans({ name }) wie gulp-mu-gulp-api in Node.
// Übersetzungen liegen in <base>/<lid>.json mit dem vollständigen Quelltext samt Kontext als Schlüssel; fehlt ein
// Eintrag, gilt der en-US-Quelltext.

const CONTEXT = /<context="[^"]*"\/>/g;
const REGION = { en: "en-US", ja: "ja-JP", ko: "ko-KR", zh: "zh-CN" };

let table = {};
let lid = "en-US";

/** Sprachen in Wunschreihenfolge: ?lang=…, dann die des Browsers. */
function wishedLanguages() {
	const wished = [new URLSearchParams(location.search).get("lang"), ...(navigator.languages ?? [navigator.language])];
	const result = [];
	for (const entry of wished) {
		if (!entry) continue;
		const [language, region] = entry.split("-");
		const full = region ? `${language.toLowerCase()}-${region.toUpperCase()}` : REGION[language.toLowerCase()] ?? `${language.toLowerCase()}-${language.toUpperCase()}`;
		if (!result.includes(full)) result.push(full);
	}
	return result;
}

/**
 * Lädt die Übersetzung für die erste verfügbare Wunschsprache.
 * @param {string} base Ordner mit den <lid>.json, relativ zur Seite
 * @returns {Promise<string>} die gewählte Sprache
 */
export async function loadI18x(base) {
	for (const wanted of wishedLanguages()) {
		if (wanted === "en-US") break;
		try {
			const response = await fetch(`${base}/${wanted}.json`, { cache: "no-store" });
			if (!response.ok) continue;
			table = await response.json();
			lid = wanted;
			break;
		} catch {
			// Nächste Sprache versuchen.
		}
	}
	document.documentElement.lang = lid;
	return lid;
}

/**
 * @param {string} text Quelltext mit <context="…"/> und Platzhaltern <name/>
 * @param {Record<string, unknown>} [values]
 */
export function translate(text, values = {}) {
	const result = (table[text] || text).replace(CONTEXT, "");
	return result.replace(/<([A-Za-z_][\w-]*)\/>/g, (tag, name) => name in values ? String(values[name]) : tag);
}

/**
 * Übersetzt Elemente mit data-i18x="Kontext" (Textinhalt) und data-i18x-label="Kontext" (aria-label).
 * @param {ParentNode} [root]
 */
export function translateDocument(root = document) {
	for (const element of root.querySelectorAll("[data-i18x]")) {
		element.textContent = translate(`${element.textContent.trim()}<context="${element.dataset.i18x}"/>`);
	}
	for (const element of root.querySelectorAll("[data-i18x-label]")) {
		element.setAttribute("aria-label", translate(`${element.getAttribute("aria-label")}<context="${element.dataset.i18xLabel}"/>`));
	}
}

if (!String.prototype.i18xTrans) {
	Object.defineProperty(String.prototype, "i18xTrans", { value(values) { return translate(String(this), values); }, configurable: true });
	Object.defineProperty(String.prototype, "i18xRegister", { value() { return String(this); }, configurable: true });
}
