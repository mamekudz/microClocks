# microClocks

Sammelprojekt für Uhren auf vier Plattformen, zusammengeführt aus `c:\Projects\Bangle` und `c:\Projects\espClock` (die Originale bleiben unverändert erhalten). Ein gemeinsames Gulpfile übernimmt Build, Start, Vorschau, Git-Commit und Sicherung.

Antworten und Projekttexte sind deutsch; µGulp-Quelltexte (`µDisplayName`, `µDescription`, `µGroup`, `µAgent`) sind en-US.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `bangle/` | Uhren für Bangle.js 2 (Espruino): `BahnClock.js`, `BahnClockNoSecounds.js`, `MarbleClock.js`, `OxydClock.js`, `FlyClock.js`; Bildquellen in `MarbleClock/`, `OxydClock/` |
| `bangle/tools/` | `program.mjs` (Skriptliste), `native-program.mjs` (Bluetooth-Übertragung), `flasher.html`, `flysprites.py` (Sprite-Generator) |
| `bangle/preview/` | `flyclock.html`: Browser-Nachbildung des Bangle-Displays für `FlyClock.js` |
| `esp32/sim/` | Browser-Simulator der ESP32-Zifferblätter (410 × 502) |
| `esp32/firmware/` | PlatformIO-Firmware für Waveshare ESP32-S3-Touch-AMOLED-2.06 |
| `pc/FlyClock3D/` | Unreal-Engine-5-Projekt (Fliegen und Oxyd-Murmeln in 3D), Start über `run.ps1` |
| `wallpaper/` | Web-Wallpaper für Wallpaper Engine, gepackt von `build.py` nach `dist/wallpaper` |
| `shared/faces/`, `shared/assets/` | Gemeinsame Zifferblätter (JS-Module) und Assets für `esp32/sim` und `wallpaper` |
| `gulp/` | `common.mjs` (Projekte, Hilfsfunktionen), `tasks.mjs` (Implementierungen) |
| `i18x/gulp/` | Übersetzungen der µGulp-Texte (`de-DE.json` u. a.) |
| `.microgulp/` | µGulp-Einstellungen; `device-backups/` und `logs/` sind lokal |

Pfade zu `shared/`: `esp32/sim/sim.js` nutzt `ROOT = "../../shared"`, `wallpaper/wallpaper.js` nutzt `ROOT = "../shared"`. `wallpaper/build.py` schreibt Importe und `ROOT` beim Packen auf `.` um.

## Gulp-Tasks

Gulp läuft nur über µGulp (kein lokales `gulp`-Paket; `npx gulp …` scheitert mit „Local gulp not found“). Abhängigkeit: `gulp-mu-gulp-api` (`npm install`). Taskname = Exportname in `gulpfile.mjs`; die Implementierungen liegen als `tasks.*` in `gulp/tasks.mjs`.

| Task | Gruppe | Zweck |
|---|---|---|
| `programBangle` | Bangle.js | Uhr-Skript per Bluetooth auf die Uhr übertragen (Standard: nur Vorschau; Schreiben nur mit Bestätigung im Dashboard) |
| `startEsp32` | Vorschauen | ESP32-Simulator im Browser |
| `startWallpaper` | Vorschauen | Wallpaper-Quellen im Browser |
| `previewBangle` | Vorschauen | Bangle-Fliegenuhr im Browser |
| `buildEsp32` | ESP32 | Firmware bauen, optional `upload` und `port` |
| `buildPc` | PC | Unreal-Projekt bauen (`run.ps1 -BuildOnly`) |
| `startPc` | PC | Bauen, fehlende Assets einrichten und Uhr starten (`face`: flies/marbles, `closeup`, `setup`) |
| `buildWallpaper` | Wallpaper Engine | Paket nach `dist/wallpaper`, optional `deploy` nach `…/wallpaper_engine/projects/myprojects/microClocks` |
| `commitProject` | Git | `git add -A` und Commit nur für die Pfade eines Teilprojekts, Nachricht mit Projektname als Präfix; kein Push |
| `backup` | Wartung | Kopie nach `Z:\Projects\microClocks` (siehe unten) |

### Projektsteuerung „Uhr“

`export const µControls` im Gulpfile deklariert die Auswahl „Uhr“ (Id `clock`) in der µGulp-Steuerleiste; der Wert liegt in `.microgulp/project-controls.json`. Der Katalog steht in `gulp/clocks.mjs` (`CATALOG`): je Uhr optional `bangle` (Skript), `web` (Zifferblatt in `esp32/sim` und `wallpaper`: flies, marbles, oxyd, oxyd-large, oxyd-floor) und `pc` (flies oder marbles). Weitere Skripte unter `bangle/` erscheinen automatisch als eigene Uhr.

- Tasks lesen die Uhr mit `currentClock(root)` (über `GetProjectControl('clock')`).
- `µVisible` blendet Tasks aus, wenn es die Uhr auf der Plattform nicht gibt; `previewBangle` gibt es nur für „Fliegen“. `buildEsp32`, `buildPc`, `commitProject`, `backup` bleiben immer sichtbar.
- Anzeigenamen nutzen den Platzhalter `<clockLabel/>` (auch in `i18x/gulp/de-DE.json`).
- Simulator und Wallpaper werden mit `?face=…` geöffnet; `buildWallpaper` setzt das Zifferblatt als Vorgabe in `dist/wallpaper/project.json`.
- `programBangle` fragt nur noch den Namen auf der Uhr ab, mit eigener Feld-Id pro Uhr (`name_<uhr>`), damit µGulp ihn je Uhr merkt.

Die Vorschau-Tasks liefern das ganze Repository ohne Caching über `serveStatic` aus (Port 8765, sonst ein freier Port), öffnen die Seite und laufen bis zum Abbruch.

Teilprojekte (`gulp/common.mjs`, `PROJECTS`): `bangle` → `bangle`; `esp32` → `esp32`, `shared`; `pc` → `pc`; `wallpaper` → `wallpaper`, `shared`.

Parameter kommen über `GetParameter`; über die Gulp-CLI sind es Strings, darum Boolesche Werte immer über `flag()` lesen.

### Konventionen für Tasks

Siehe `.cursor/rules/prefer-existing-project-tasks.mdc`. Kurz:

- Vorhandene Tasks bevorzugen, möglichst wenige sichtbare Tasks, Varianten über Parameter.
- Jeder Task hat `µDisplayName`, `µDescription`, `µGroup`, `µOrder` und `µAgent` (`schemaVersion: 1`, `purpose`, `prerequisites`, `sideEffects`, `artifacts`, `limitations`, `repeatability`, `cancellation`). Texte mit `<context="…"/>` und `.i18xRegister()`; deutsche Übersetzung in `i18x/gulp/de-DE.json` ergänzen.
- `µAgent`-Angaben aus der Implementierung ableiten, nichts erfinden.
- Vor dem Überschreiben des Gulpfiles eine Kopie sichern.

## Sicherung

`backup` kopiert per `robocopy /E` alles, was sich nicht neu bauen oder herunterladen lässt, nach `Z:\Projects\microClocks` (Parameter `project`, `target`). Am Ziel wird nichts gelöscht.

Ausgelassen: `node_modules`, `dist`, `.pio`, `.vs`, `.cache`, `.microgulp/logs` sowie die Unreal-Ordner `Intermediate`, `Saved`, `Binaries`, `DerivedDataCache`, `StarterContent`, `polyhaven`, `Downloads` und die Datei `fly_loop.wav`. Robocopy-Exitcodes ab 8 gelten als Fehler.

Gewünscht ist ausdrücklich eine einfache Kopie, kein NAS-Rezept und keine ZIP-Archive.

## Bangle.js 2

- Display 176 × 176, 3-Bit-Farben (MIP). Uhren nutzen `Bangle.setUI({ mode: "clock", remove })` für Fast Load; der ganze Code steht in einem `{ … }`-Block.
- `programBangle` überträgt das Skript der gewählten Uhr (genau eine JS-Datei); die Uhr-Id ergibt sich aus dem Dateinamen, der Name auf der Uhr ist aus dem Dateinamen vorbelegt („FlyClock“ → „Fly Clock“).
- Bei der Übertragung sucht `bangle/tools/native-program.mjs` per Bluetooth nach Bangles, lässt eine wählen (die zuletzt benutzte ist vorausgewählt) und speichert sie in `.microgulp/native-device.json`. Erst danach folgen die Bestätigungen für Verbindung/Sicherung und fürs Schreiben. Die Uhr muss eingeschaltet und darf nicht mit Handy/Gadgetbridge verbunden sein. `listClockScripts` überspringt `tools`, `assets`, `node_modules`, `.microgulp`, `.git`.
- Espruino schläft automatisch, wenn kein Intervall läuft. Touch-Ereignisse kommen bei gesperrter Uhr nicht an.

### Fliegenuhr (`bangle/FlyClock.js`)

- Ohne Ton. Ziffern auf einem ausgedünnten 3×5-Raster (`FONT`, 6 bis 8 Zellen pro Ziffer), eine Fliege pro Zelle. Stunden oben ohne führende Null, Minuten unten.
- Slot-Ids `Stelle:Zeile:Spalte`; bleibende Zellen behalten ihre Fliege, frei werdende Fliegen fliegen zur nächstgelegenen neuen Zelle, fehlende kommen vom Rand, überzählige fliegen hinaus.
- Die Fliegen landen 0,6 bis 1,8 Zellabstände neben ihrer Zelle (`LAND_MIN`, `LAND_MAX`, zufällige Richtung, im Display gehalten) und laufen das letzte Stück mit `WALK_SPEED` (1,2 px pro Frame) zu Fuß. Hinausfliegende Fliegen laufen nicht.
- Sitzende Fliegen bewegen sich nicht. Das 50-ms-Intervall läuft nur, solange eine Fliege fliegt oder läuft; danach schläft die Uhr bis zum nächsten Minutenwechsel (`setTimeout`) oder einer Berührung. Berührte Fliegen springen weg und kehren zurück. `FLY_WHEN_LOCKED = false` setzt sie bei gesperrter Uhr ohne Flug.
- Sprites: Originale aus `shared/assets/fly/flyex.png`, auf schwarzem Grund, 2 bpp mit Palette (transparent, Halo blau, Flügel weiß, Augen rot; Körper transparent). 8 Richtungen × 9 Posen (0 = sitzend mit eingeklappten Flügeln aus Frame 4, 1–3 = Flügelschlag, 4–8 = Laufen aus den Frames 5–9), je 22 × 22 Pixel, zusammen rund 8,7 KB als ArrayBuffer.
- Der Block zwischen `// <sprites>` und `// </sprites>` wird erzeugt, nicht von Hand bearbeiten: `python bangle/tools/flysprites.py` (braucht Pillow).
- Vorschau: Task `previewBangle` bzw. `bangle/preview/flyclock.html`. Sie bildet nur die benutzten Grafik- und Bangle-Aufrufe nach (`drawImage` mit Palette, `toColor`, `setBgColor`, `atob`, `E.toArrayBuffer`). Auf der echten Uhr noch nicht getestet.

## ESP32 (Waveshare ESP32-S3-Touch-AMOLED-2.06)

- Doku: https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-2.06. AMOLED 410 × 502 mit CO5300 über QSPI, Touch FT3168, RTC PCF85063 (I2C 0x51), PMU AXP2101, IMU QMI8658, Audio ES8311/ES7210. Pins in `esp32/firmware/include/board.h`.
- PlatformIO mit pioarduino 55.03.32 (Arduino-ESP32 3.3.2, nötig für Arduino_GFX/CO5300), GFX Library for Arduino 1.6.0, esptool 5.1.0, Env `amoled206`, Flash als 16 MB (`default_16MB.csv`), PSRAM `qio_opi`.
- Der CO5300 braucht einen Spaltenversatz von 22 Pixeln.
- `pio` wird über PATH oder `~/.platformio/penv/Scripts/pio.exe` gefunden (`findPio`).
- Die Firmware ist ein Grundgerüst: Display und RTC-Zeit, noch kein Touch, IMU, Audio oder Energieverwaltung. Die eigentlichen Zifferblätter gibt es bisher nur im Simulator (`esp32/sim`, Module aus `shared/faces`).

## PC (Unreal, `pc/FlyClock3D`)

- `run.ps1` nimmt die neueste Unreal-5-Installation unter `C:\Program Files\Epic Games`, setzt `EngineAssociation` passend, baut `FlyClock3DEditor Win64 Development` und startet die Uhr im Fenster 820 × 1004. Schalter: `-Setup`, `-BuildOnly`, `-closeup`, `-marbles` (Tab wechselt im Spiel).
- Fehlende Assets: StarterContent wird aus der Engine kopiert, die Waldszene per `Scripts/fetch_assets.py` von Poly Haven geladen, `Scripts/setup_assets.py` legt Materialien, Summton und Fliegenscan an.
- Im Repository liegt nur die schlanke Kopie ohne `Intermediate`, `Saved`, `Binaries`, `DerivedDataCache`.

## Wallpaper Engine

- `wallpaper/index.html` + `wallpaper.js` laden die Zifferblätter aus `shared/`. `build.py` kopiert Module und Assets nach `dist/wallpaper` und passt die Pfade an; `buildWallpaper` installiert optional nach `myprojects/microClocks` (Steam-Pfad aus der Registry).
- In der Browser-Vorschau fehlen die Wallpaper-Engine-Benutzereigenschaften; es gelten die Standardwerte aus `wallpaper.js`.

## Git

- Branch `main`, Autor Meinolf Amekudzi. Git LFS für `*.uasset`, `*.umap`, `*.psd`, `*.fbx`, `*.glb`, `*.blend` (`.gitattributes`).
- Commits pro Teilprojekt mit Präfix (z. B. `Bangle: …`), passend zu `commitProject`.

## Hinweise zur Umgebung

- Windows, PowerShell 5: `Set-Content -Encoding utf8NoBOM` gibt es nicht, und `Set-Content -Encoding UTF8` schreibt ein BOM. Für Dateien ohne BOM `[IO.File]::WriteAllText` nutzen; JS/MJS-Dateien dürfen kein BOM haben.
- Zum Testen ohne µGulp genügt ein statischer Server im Repository-Stamm, z. B. `python -m http.server 8799`, dann `http://localhost:8799/bangle/preview/flyclock.html`.
- Logik der Bangle-Uhren lässt sich in Node mit `vm` und nachgebildeten `g`/`Bangle`/Timern prüfen. Weil der Code in einem Block steht, Testzugriffe innerhalb des Blocks einhängen.
