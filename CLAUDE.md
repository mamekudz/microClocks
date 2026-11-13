# microClocks

## Verbindliche Arbeitsregeln

Diese Datei gilt für das gesamte Repository: Bangle.js-Uhren, die Waveshare-ESP-Uhr, Web-Wallpaper und Unreal-Engine-Wallpaper für Wallpaper Engine (Steam). Die bestehende Schreibweise `CLAUDE.md` beibehalten; keine zweite Datei `claude.md` anlegen. Spezifische Regeln im jeweiligen Teilprojekt zusätzlich beachten. Direkte Benutzeraufträge haben Vorrang. Die folgenden Regeln ergänzen die technischen Projektnotizen weiter unten.

### Arbeitsweise und Projektgrenzen

- Vor Änderungen die betroffenen Quellen, Taskdefinitionen und lokalen Regeln lesen. Vorhandene Benutzeränderungen erhalten; keine sachfremden Bereinigungen oder Umformatierungen.
- Gemeinsame Web-Zifferblätter und Assets in `shared/` pflegen. Plattformanpassungen bleiben in `bangle/`, `esp32/`, `wallpaper/` beziehungsweise `pc/`. Eine Änderung an `shared/` immer hinsichtlich Simulator und Web-Wallpaper prüfen.
- Die ursprünglichen Projekte `C:\Projects\Bangle` und `C:\Projects\espClock` bleiben unverändert. Externe Referenzprojekte nicht als zusätzliches Änderungsziel behandeln.
- Generierte Dateien an ihrer Quelle ändern und über den vorhandenen Generator aktualisieren. Insbesondere `FliesClockNegative.js`, eingebettete Sprite-Blöcke, `dist/` und erzeugte Unreal-Assets nicht als unabhängige Quellen bearbeiten.
- Keine neuen Bibliotheken, Formatter, Buildsysteme oder Dokumentgeneratoren allein zur Vereinheitlichung einführen. Abhängigkeiten und Versionen nur aufgabenbezogen ändern.
- Build, Vorschau, Geräteübertragung, Deployment, Commit und Veröffentlichung sind getrennte Schritte. Einen Buildauftrag nicht als Auftrag zum Flashen, Deployen oder Veröffentlichen im Steam Workshop auslegen. Vorhandene Hardwarebestätigungen erhalten.

### Sprache, Syntax und Formatierung

- Antworten, Erläuterungen, Kommentare und Projektbeschreibungen grundsätzlich deutsch; technische Bezeichner sinnvoll englisch. Für lokalisierbare UI-Quelltexte gelten die en-US-Regeln im Abschnitt i18x.
- Textdateien als UTF-8 ohne BOM speichern. Umlaute sowie `µ` erhalten. Bestehende Zeilenenden respektieren; keine gemischten Zeilenenden, nachgestellten Leerzeichen oder unbeabsichtigten Komplettänderungen. Dateien mit einer abschließenden Leerzeile im Sinne eines finalen Zeilenumbruchs beenden.
- Der Stil der bearbeiteten Datei hat Vorrang. Bei neuen JS/MJS-Dateien Tabs zur Einrückung, Semikolons und den Stil des Nachbarmoduls verwenden; Anführungszeichen nicht ohne Anlass vereinheitlichen. Python mit vier Leerzeichen einrücken. Unreal-C++ folgt dem vorhandenen Unreal-Stil mit Tabs und Klammern auf eigenen Zeilen; Firmware-C++ dem Stil der bestehenden Firmware.
- Node- und Browsermodule als ESM behandeln (`type: module`). Keine Node-APIs in Browsermodule übernehmen. Bangle-Skripte bleiben für Espruino geeignete eigenständige Dateien; moderne Browser-/Node-Syntax und APIs nicht ungeprüft auf die Uhr übertragen.
- JSON ist strikt gültiges JSON: keine Kommentare, keine nachgestellten Kommas, keine doppelten Schlüssel. Vorhandene Schlüssel, IDs, Dateinamen und öffentliche Parameter nicht beiläufig umbenennen.
- Markdown mit nachvollziehbarer Überschriftenhierarchie, Leerzeilen vor Listen und Codeblöcken sowie Sprachkennung an Codeblöcken schreiben. Repository-interne Links relativ setzen und auf Existenz prüfen. Befehle so dokumentieren, dass die angegebene Shell sie ausführen kann.
- Kommentare erklären Gründe, Einschränkungen und nicht offensichtliches Verhalten. Keine veralteten Funktionsbeschreibungen oder auskommentierten Ersatzimplementierungen hinterlassen.

### Internationalisierung mit i18x

- Das vorhandene i18x-Verfahren weiterverwenden; kein paralleles Übersetzungssystem einführen. µGulp-Quelltexte für `µDisplayName`, `µDescription`, `µGroup` und lokalisierbare Bedienoberflächen sind en-US. `µAgent`-Metadaten ebenfalls en-US verfassen.
- Registrierbare UI-Texte mit passendem Kontext und `.i18xRegister()` versehen, beispielsweise `"Build<context=\"µDisplayName\"/>".i18xRegister()`. Existierende Kontexte wie `task parameter`, `form information`, `button text` und `task log` für entsprechende Texte wiederverwenden.
- Übersetzungen liegen unter `i18x/gulp/<locale>.json`. Der Schlüssel ist der vollständige Quelltext einschließlich Kontext. Bei neuen oder geänderten Texten mindestens `de-DE.json` aktualisieren und alle vorhandenen Sprachdateien auf betroffene Schlüssel prüfen. Fehlende Übersetzungen offen benennen; nicht durch deutsche Texte in anderen Sprachen kaschieren.
- Platzhalter wie `<clockLabel/>`, `<path/>` und `<version/>` in Übersetzungen exakt erhalten. Keine übersetzbaren Sätze aus Wortfragmenten zusammensetzen und keine dynamischen Werte in Übersetzungsschlüssel einbauen; die im Projekt vorhandene Platzhalterverarbeitung verwenden.
- Technische IDs, Pfade, Enum-Werte, Task-Exportnamen und gespeicherte Einstellungswerte bleiben sprachunabhängig. Nur die Anzeige übersetzen. Änderungen an Quelltextschlüsseln und den zugehörigen Übersetzungen zusammen durchführen.
- i18x-Aufrufe nur in Laufzeiten einsetzen, die das Verfahren bereitstellen. Für Bangle, Firmware, Browser und Unreal zuerst die jeweilige vorhandene Lokalisierung prüfen; µGulp-Erweiterungen nicht ungeprüft in diese Laufzeiten kopieren.

### Dokumentquellen: `.src.md` und `.src.docx`

- Dateien mit `.src.md` beziehungsweise `.src.docx` sind bearbeitbare Dokumentquellen und gehören zur gepflegten Projektdokumentation. Nicht als temporäre Dateien behandeln oder durch Exportdateien ersetzen.
- Vor einer Dokumentänderung prüfen, welche Quelle und welcher Konvertierungsweg vorhanden sind. Inhaltliche Änderungen zuerst in der führenden Quelle vornehmen und daraus die betroffenen Ausgabeformate aktualisieren. Ableitungen nicht unabhängig auseinanderlaufen lassen.
- Für neue textorientierte Dokumente grundsätzlich `<name>.src.md` als führende Quelle verwenden. Ist eine Word-Vorlage oder ein bestehendes Word-Dokument maßgeblich, bleibt `<name>.src.docx` die führende Quelle. Sind beide vorhanden, die Richtung ausdrücklich dokumentieren; bei widersprüchlichen Inhalten ohne erkennbare führende Quelle nachfragen.
- Eine `.src.docx` muss eine echte Word-Datei sein; niemals Markdown umbenennen. Bei Word-Änderungen Formatvorlagen, Überschriften, Tabellen, Links und Seitenlayout erhalten. Erzeugte DOCX-/PDF-Ausgaben rendern und visuell kontrollieren.
- Dokumentquellen, Übersetzungsdateien und nicht reproduzierbare Assets versionieren und sichern. Reproduzierbare Exporte entsprechend der vorhandenen Repository-Regeln behandeln. Keine Quellen durch pauschale Ausschlüsse für `.md` oder `.docx` verlieren.
- Für jeden eingerichteten Dokumentablauf Quelle, Ausgaben, Werkzeug und Aufruf in der README festhalten. Aktuell ist kein `.src.md`-/`.src.docx`-Generator im Projekt nachgewiesen; keine automatische Synchronisierung behaupten. Kann eine Ausgabe nicht neu erzeugt werden, dies als offen melden.

### README und laufende Dokumentation

- `README.md` ist der Einstieg für Anwender und Entwickler; `CLAUDE.md` enthält Arbeitsregeln und technische Hinweise für Agenten. Bei Erstellung der README die vorhandenen Quellen auswerten und nur tatsächlich verfügbare Funktionen beschreiben.
- Die README beschreibt Projektzweck, die vier Plattformen, Ordnerstruktur, Voraussetzungen, Einrichtung, vorhandene Build-/Vorschau-Tasks, Bedienung, Ergebnisse und bekannte Einschränkungen. Gerätemodell und erforderliche Laufzeit klar nennen; Simulatorfunktionen nicht als bereits implementierte Firmwarefunktionen darstellen.
- Web- und Unreal-Wallpaper getrennt erklären: Start, Paketierung, lokale Installation in Wallpaper Engine und Eigenschaften. Lokales Deployment nicht mit Steam-Workshop-Veröffentlichung gleichsetzen; aktuelle Veröffentlichungsvoraussetzungen bei einem Veröffentlichungsauftrag prüfen.
- Änderungen an Einrichtung, Bedienung, Taskparametern, unterstützten Uhren, Ausgabeorten oder Einschränkungen zusammen mit der zugehörigen Dokumentation pflegen. Teilprojekt-READMEs nur bei eigenständigem Erklärungsbedarf anlegen und von der Haupt-README verlinken.
- Falls `README.src.md` oder `README.src.docx` eingeführt wird, deren führende Rolle und Erzeugung von `README.md` eindeutig festhalten. Bis dahin ist eine vorhandene `README.md` direkt zu pflegen. Keine doppelten, unabhängig gepflegten Fassungen erzeugen.
- Projektstand, getestete Eigenschaften und geplante Funktionen klar unterscheiden. Technische Notizen weiter unten bei betroffenen Änderungen gegen den tatsächlichen Code prüfen; ältere Beschreibungen sind kein Beleg für den aktuellen Implementierungsstand.

### Prüfung und Abschluss

- Vorhandene Projekt-Tasks gemäß `.cursor/rules/prefer-existing-project-tasks.mdc` bevorzugen. Fehlt eine µGulp-Anbindung, Definitionen statisch lesen und die Einschränkung nennen; keinen Projektcode allein zur Task-Erkennung ausführen.
- Prüfungen passend zum Umfang wählen: Syntax und JSON bei Quell-/Übersetzungsänderungen, betroffene Builds bei plattformspezifischem Code, Vorschau bei sichtbaren Änderungen. Dokumentationsänderungen benötigen keinen Firmware- oder Unreal-Build.
- Bei Uhren insbesondere Minuten-/Stundenwechsel, Tageswechsel, Timerbereinigung, Pause/Fortsetzen und Ressourcenverbrauch berücksichtigen. Auf Bangle zusätzlich Sperren, Entsperren und Fast Load; bei Wallpapers Größenänderungen, Eigenschaften und Tonzustand berücksichtigen.
- Simulator- und Browserprüfungen nicht als Gerätetest ausgeben. Nicht verfügbare Hardware, SDKs oder Laufzeittests ausdrücklich nennen. Nur tatsächlich ausgeführte Prüfungen als erfolgreich melden.
- Zum Abschluss knapp nennen: geänderte Dateien und Verhalten, durchgeführte Prüfungen sowie verbleibende Einschränkungen. Keine automatischen Commits oder Veröffentlichungen ohne entsprechenden Auftrag.

## Technische Projektnotizen

Sammelprojekt für Uhren auf vier Plattformen, zusammengeführt aus `c:\Projects\Bangle` und `c:\Projects\espClock` (die Originale bleiben unverändert erhalten). Ein gemeinsames Gulpfile übernimmt Build, Start, Vorschau, Git-Commit und Sicherung.

Antworten und Projekttexte sind deutsch; µGulp-Quelltexte (`µDisplayName`, `µDescription`, `µGroup`, `µAgent`) sind en-US.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `bangle/` | Uhren für Bangle.js 2 (Espruino): `BahnClock.js`, `BahnClockNoSecounds.js`, `MarbleClock.js`, `OxydClock.js`, `FliesClock.js`, `FliesClockNegative.js` (erzeugt); Bildquellen in `MarbleClock/`, `OxydClock/` |
| `bangle/tools/` | `program.mjs` (Skriptliste), `native-program.mjs` (Bluetooth-Übertragung), `flasher.html`, `flysprites.py` (Sprite-Generator) |
| `bangle/preview/` | `fliesclock.html`: Browser-Nachbildung des Bangle-Displays für `FliesClock.js` |
| `esp32/sim/` | Browser-Simulator der ESP32-Zifferblätter (410 × 502) |
| `esp32/firmware/` | PlatformIO-Firmware für Waveshare ESP32-S3-Touch-AMOLED-2.06 |
| `pc/FlyClock3D/` | Unreal-Engine-5-Projekt (Fliegen, Oxyd-Murmeln und Oxyd-Glasmurmeln in 3D), Start über `run.ps1` |
| `wallpaper/` | Web-Wallpaper für Wallpaper Engine, gepackt von `build.py` nach `dist/wallpaper` |
| `shared/faces/`, `shared/assets/` | Gemeinsame Zifferblätter (JS-Module) und Assets für `esp32/sim` und `wallpaper` |
| `gulp/` | `common.mjs` (Projekte, Hilfsfunktionen), `tasks.mjs` (Implementierungen) |
| `i18x/gulp/` | Übersetzungen der µGulp-Texte (`de-DE.json` u. a.) |
| `i18x/web/`, `i18x/wallpaper/` | Übersetzungen für Simulator und Bangle-Vorschau bzw. die Eigenschaften des Web-Wallpapers |
| `dev/media/` | Vorschauvideos und -animationen für die README; unkomprimierte Originale `*.original.*` sind ignoriert |
| `.microgulp/` | µGulp-Einstellungen; `device-backups/` und `logs/` sind lokal |

Pfade zu `shared/`: `esp32/sim/sim.js` nutzt `ROOT = "../../shared"`, `wallpaper/wallpaper.js` nutzt `ROOT = "../shared"`. `wallpaper/build.py` schreibt Importe und `ROOT` beim Packen auf `.` um.

## Gulp-Tasks

Gulp läuft nur über µGulp (kein lokales `gulp`-Paket; `npx gulp …` scheitert mit „Local gulp not found“). Abhängigkeit: `gulp-mu-gulp-api` (`npm install`). Taskname = Exportname in `gulpfile.mjs`; die Implementierungen liegen als `tasks.*` in `gulp/tasks.mjs`.

| Task | Gruppe | Zweck |
|---|---|---|
| `setup` | Einrichtung | Prüft Node, Python + Pillow, PlatformIO, Unreal 5, Visual Studio C++, Wallpaper Engine und Bluetooth-Laufzeit; mit `install` (Standard an) `npm install`, Pillow per pip und PlatformIO per `get-platformio.py`. Hervorgehoben (`µAttention`, Tooltip „Fehlt: …“), solange `missingSetup()` etwas findet |
| `programBangle` | Bangle.js | Uhr-Skript per Bluetooth auf die Uhr übertragen (Standard: nur Vorschau; Schreiben nur mit Bestätigung im Dashboard) |
| `startEsp32` | Vorschauen | ESP32-Simulator im Browser |
| `startWallpaper` | Vorschauen | Wallpaper-Quellen im Browser |
| `previewBangle` | Vorschauen | FliesClock oder ihr Negativ im Browser |
| `buildEsp32` | ESP32 | Firmware bauen, optional `upload` und `port` |
| `buildPc` | PC | Unreal-Projekt bauen (`run.ps1 -BuildOnly`) |
| `startPc` | PC | Bauen, fehlende Assets einrichten und die gewählte Uhr starten (`ground` nur bei FliesClock: sand/grass/road/forest, `closeup`, `setup`) |
| `buildWallpaper` | Wallpaper Engine | `engine` web: Paket nach `dist/wallpaper`; unreal: alle 3D-Fassungen als Programm-Wallpaper (siehe unten). Optional `deploy` nach `…/wallpaper_engine/projects/myprojects` |
| `commitProject` | Git | `git add -A` und Commit nur für die Pfade eines Teilprojekts, Nachricht mit Projektname als Präfix; kein Push |
| `backup` | Wartung | Kopie nach `Z:\Projects\microClocks` (siehe unten) |

### Projektsteuerung „Uhr“

`export const µControls` im Gulpfile deklariert die Auswahl „Uhr“ (Id `clock`) in der µGulp-Steuerleiste; der Wert liegt in `.microgulp/project-controls.json`. Der Katalog steht in `gulp/clocks.mjs` (`CATALOG`): je Uhr optional `bangle` (Skript), `web` (Zifferblatt in `esp32/sim` und `wallpaper`: flies, marbles, oxyd, oxyd-large, oxyd-floor) und `pc` (flies, marbles oder glass; „Oxyd-Glasmurmeln“ gibt es nur auf dem PC). Die Fliegen sind getrennt: „FliesClock (White on Black)“ (Bangle, Web), „FliesClock (Black on White)“ (Bangle) und „FliesClock 3D“ (`flies-3d`, nur PC/Unreal ohne Farbvarianten). Weitere Skripte unter `bangle/` erscheinen automatisch als eigene Uhr.

- Tasks lesen die Uhr mit `currentClock(root)` (über `GetProjectControl('clock')`).
- `µVisible` blendet Tasks aus, wenn es die Uhr auf der Plattform nicht gibt; `previewBangle` gibt es nur für „FliesClock (White on Black)“ und „FliesClock (Black on White)“. `buildEsp32`, `buildPc`, `commitProject`, `backup` bleiben immer sichtbar.
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
- `programBangle` überträgt das Skript der gewählten Uhr (genau eine JS-Datei); die Uhr-Id ergibt sich aus dem Dateinamen, der Name auf der Uhr ist mit `title` aus `CATALOG` vorbelegt, sonst aus dem Dateinamen („BahnClock“ → „Bahn Clock“). Die beiden Fliegenuhren heißen „FliesClock (White on Black)“ (`FliesClock.js`) und „FliesClock (Black on White)“ (`FliesClockNegative.js`), in der Uhrauswahl wie auf der Uhr.
- Bei der Übertragung sucht `bangle/tools/native-program.mjs` per Bluetooth nach Bangles, lässt eine wählen (die zuletzt benutzte ist vorausgewählt) und speichert sie in `.microgulp/native-device.json`. Erst danach folgen die Bestätigungen für Verbindung/Sicherung und fürs Schreiben. Die Uhr muss eingeschaltet und darf nicht mit Handy/Gadgetbridge verbunden sein. `listClockScripts` überspringt `tools`, `assets`, `node_modules`, `.microgulp`, `.git`.
- Widgets ausblenden ohne `widget_utils` (das Modul ist bei Einzeldatei-Übertragung nicht sicher vorhanden; ein `try/catch` darum verschluckt den Fehler): `draw` durch eine leere Funktion und `area` durch `""` ersetzen, sonst zeichnet `Bangle.drawWidgets()` beim Entsperren (Licht an) Batterie- und BT-Anzeige samt Leistenhintergrund. Fast-Load-Uhren stellen beides in `remove` wieder her (`FliesClock.js`), Uhren ohne `remove` brauchen das nicht (`OxydClock.js`).
- Espruino schläft automatisch, wenn kein Intervall läuft. Touch-Ereignisse kommen bei gesperrter Uhr nicht an.

### FliesClock (`bangle/FliesClock.js`)

- Hieß bis November 2026 `FlyClock.js` (App-Id `flyclock`); eine so übertragene App bleibt auf der Uhr, bis man sie löscht.

- Ohne Ton. Ziffern auf einem ausgedünnten 3×5-Raster (`FONT`, 6 bis 8 Zellen pro Ziffer), eine Fliege pro Zelle. Stunden oben ohne führende Null, Minuten unten.
- Slot-Ids `Stelle:Zeile:Spalte`; bleibende Zellen behalten ihre Fliege, frei werdende Fliegen fliegen zur nächstgelegenen neuen Zelle, fehlende kommen vom Rand, überzählige fliegen hinaus.
- Die Fliegen landen 0,6 bis 1,8 Zellabstände neben ihrer Zelle (`LAND_MIN`, `LAND_MAX`, zufällige Richtung, im Display gehalten) und laufen das letzte Stück mit `WALK_SPEED` (1,2 px pro Frame) zu Fuß. Hinausfliegende Fliegen laufen nicht.
- Sitzende Fliegen bewegen sich nicht. Das 50-ms-Intervall läuft nur, solange eine Fliege fliegt oder läuft; danach schläft die Uhr bis zum nächsten Minutenwechsel (`setTimeout`) oder einer Berührung. Berührte Fliegen springen weg und kehren zurück. Heftiges Schütteln (3 Beschleunigungssprünge über 0,8 g innerhalb 1 s, `SHAKE_*`) schreckt alle Fliegen auf, danach 3 s Pause. Der `accel`-Listener weckt JS mit der Sensorrate (Standard 12,5 Hz), kostet also etwas Strom. Vorschau: Taste S schüttelt. `FLY_WHEN_LOCKED = false` setzt sie bei gesperrter Uhr ohne Flug.
- Sprites: Originale aus `shared/assets/fly/flyex.png`, auf schwarzem Grund, 2 bpp mit Palette (transparent, Halo blau, Flügel weiß, Augen rot; Körper transparent). 8 Richtungen × 9 Posen (0 = sitzend aus Frame 5, weil Frame 4 bis auf den Kopf gleich ist, dort aber einen ausgestreckten Rüssel und keine roten Augen hat, 1–3 = Flugbilder, 4–8 = Laufen aus den Frames 5–9; im Flug wechselt `FLAP` gespreizte und eingeklappte Flügel, weil sich die Flugbilder kaum unterscheiden), je 22 × 22 Pixel, zusammen rund 8,7 KB als ArrayBuffer.
- Der Block zwischen `// <sprites>` und `// </sprites>` wird erzeugt, nicht von Hand bearbeiten: `python bangle/tools/flysprites.py` (braucht Pillow).
- Negativ `bangle/FliesClockNegative.js` (Uhr „FliesClock (Black on White)“, `flies-negative`): weißer Grund, Körper schwarz, Flügel weiß, Augen rot, ohne Rand. `flysprites.py` erzeugt die Datei vollständig aus `FliesClock.js` (eigene Sprites mit Körper statt Rand als Palettenindex 1, eigener Block `// <colors>` mit `BG` und `PALETTE`). Nur `FliesClock.js` von Hand ändern, danach das Skript laufen lassen.
- Vorschau: Task `previewBangle` bzw. `bangle/preview/fliesclock.html` (`?script=FliesClockNegative.js` für das Negativ). Sie bildet nur die benutzten Grafik- und Bangle-Aufrufe nach (`drawImage` mit Palette, `toColor`, `setBgColor`, `atob`, `E.toArrayBuffer`). Auf der echten Uhr noch nicht getestet.

## ESP32 (Waveshare ESP32-S3-Touch-AMOLED-2.06)

- Doku: https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-2.06. AMOLED 410 × 502 mit CO5300 über QSPI, Touch FT3168, RTC PCF85063 (I2C 0x51), PMU AXP2101, IMU QMI8658, Audio ES8311/ES7210. Pins in `esp32/firmware/include/board.h`.
- PlatformIO mit pioarduino 55.03.32 (Arduino-ESP32 3.3.2, nötig für Arduino_GFX/CO5300), GFX Library for Arduino 1.6.0, esptool 5.1.0, Env `amoled206`, Flash als 16 MB (`default_16MB.csv`), PSRAM `qio_opi`.
- Der CO5300 braucht einen Spaltenversatz von 22 Pixeln.
- `pio` wird über PATH oder `~/.platformio/penv/Scripts/pio.exe` gefunden (`findPio`).
- Die Firmware ist ein Grundgerüst: Display und RTC-Zeit, noch kein Touch, IMU, Audio oder Energieverwaltung. Die eigentlichen Zifferblätter gibt es bisher nur im Simulator (`esp32/sim`, Module aus `shared/faces`).

## PC (Unreal, `pc/FlyClock3D`)

- `run.ps1` nimmt die neueste Unreal-5-Installation unter `C:\Program Files\Epic Games`, setzt `EngineAssociation` passend, baut `FlyClock3DEditor Win64 Development` und startet die Uhr im Fenster 820 × 1004. Schalter: `-Setup`, `-BuildOnly`, `-Package <Ordner>`, `-closeup`, `-marbles`, `-glass`, `-ground=<name>` (Tab wechselt im Spiel: Fliegen → Oxyd-Steine → Glasmurmeln; G wechselt den Untergrund).
- Fehlende Assets: StarterContent wird aus der Engine kopiert, die Waldszene per `Scripts/fetch_assets.py` von Poly Haven geladen, `Scripts/setup_assets.py` legt Materialien, Summton und Fliegenscan an. Fehlt `M_Marble` oder `M_GlassMarble`, legt `run.ps1` nur die Murmelteile neu an. Quellen für Summton und Murmeln liegen unter `shared/assets/fly` und `shared/assets/oxyd`.
- Glasmurmeln (`M_GlassMarble`, `make_glass_marbles` in `setup_assets.py`): nachgebaut nach dem Unity-Shader „Glass Fast“ (Ciconia) der Materialien `GlassMarble_*.mat` in `C:\Projects\Oxyd\dev\apps\unity\OxydVR_dev\Assets\Resources\3DModels\Materials\NGPlayerMarble`. Transluzent mit Beleuchtung pro Pixel, Grundfarbe = Glastönung (`_ColorGlass`, in `GlassColors` in `FlyClock.cpp`), Eigenleuchten 0,335 × Tönung, Deckkraft Fresnel \((1-N\cdot V)^{0{,}274}\) mit Untergrenze `MinOpacity` 0,25 (Abweichung von Unity, damit die Farbe auf dem Brett erkennbar bleibt), Kratzer-Normal-Map `shared/assets/oxyd/glass_scratches_normal.png` (Stärke 2, Kachelung 2), Brechung als Pixel-Normal-Offset 1,37, Rauheit 0,15, Specular 0,41.
- Im Repository liegt nur die schlanke Kopie ohne `Intermediate`, `Saved`, `Binaries`, `DerivedDataCache`.
- Die Uhr heißt sichtbar „FliesClock“ (Fenstertitel über `ProjectDisplayedTitle` in `Config/DefaultGame.ini`); Projekt, Modul und Target heißen intern weiter `FlyClock3D`, weil Assets auf `/Script/FlyClock3D` verweisen.
- Lesbarkeit der Fliegen-Ziffern (`FlyClock.cpp`, `FlyActor.cpp`): Kamera mit 54° Neigung (`CameraPitch`), Fliegen 1,2-fach (`FlyScale`), dunkle, fast durchsichtige Flügel, Nachbearbeitung mit Sättigung 0,75, Kontrast 1,2 und Belichtung −0,1. Kleine Requisiten (unter 40 cm), die in den Ziffernbereich plus 2,5 cm ragen, werden nach `BuildForest` entfernt.
- Untergründe (`GroundNames`/`GroundPaths` in `FlyClock.cpp`): forest (`/Game/Forest/M_Ground`, mit Waldrequisiten), sand (`sand_01`, 1,5 m), grass (`leafy_grass`, 2 m), road (`asphalt_06`, 3 m) als `/Game/Grounds/M_Ground_*` aus `GROUND_VARIANTS` in `setup_assets.py`. Gewählt nach mittlerer Helligkeit der Farbtextur (Wald 92–101, Sand 150, Gras 132, Straße 143 von 255; dunkler Asphalt wie `asphalt_02` mit 90 wäre schlechter als Wald). Auf den hellen Untergründen sind alle Waldrequisiten ausgeblendet (`UpdateProps`). Start mit `-ground=sand`, im Spiel wechselt G. Fehlende Untergründe werden übersprungen.
- `FLYCLOCK_SETUP` für `setup_assets.py`: `all` oder eine Liste aus `marbles`, `grounds`, `scan`, `flylook`, `buzz` (Summton `S_Buzz` aus `fly.sounds.wav`, Schleife auf Spitze 0,9 normalisiert, weil sie in der Aufnahme nur 0,04 erreicht und im Wallpaper kaum hörbar war); `run.ps1` legt nur fehlende Teile an (`flylook`, wenn `M_FlyScan.uasset` fehlt; `scan` schließt `flylook` ein).
- Fliegenmodell: Scan aus `Import/fly` (`BT643_fly.gltf`, mit Flügeln), importiert als `/Game/FlyClock/Scan/SM_Fly` und über diesen festen Pfad geladen. Die Suche über die Asset-Registry bleibt nur als Rückfall; im gepackten Spiel fand sie das Netz nicht, dann erscheint das Ersatzmodell aus Grundformen (Kugeln, fast durchsichtige Flügel). Fehlt `SM_Fly.uasset`, richtet `run.ps1` den Teil `scan` ein.
- Material des Scans `/Game/FlyClock/M_FlyScan` (`make_fly_scan_material`, Teil `flylook`): ersetzt die glTF-Standardinstanz, die mangels Angabe Metallic 1 hatte und das Modell fast schwarz zeigte. Farbtextur × `Brightness` 1,8, Metallic 0, Rauheit 0,55. `SM_Fly` ohne Nanite. Beine und Flügel bewegt World Position Offset (HLSL `MOTION_CODE` in `setup_assets.py`, Netzraum in cm: X seitlich, +X = linke Seite, Y nach vorn, Z hoch, Füße bei 0). Beine: jedes der sechs Beine ist aus `BT643_fly` als Linie Ansatz–Knie–Spitze vermessen (Konstanten `Hip`, `Knee`, `Tip`); ein Punkt außerhalb des Rumpf-Ellipsoids unter Z 1 gehört zum nächstgelegenen Bein und bewegt sich mit seinem Anteil an der Beinlänge. Eine einfache Seitenmaske erfasste die nach vorn zeigenden Vorderbeine nicht, und das schräg nach hinten stehende Mittelbein geriet in die falsche Gruppe. Dreifuß-Gang mit Anheben beim Vorschwingen, Ausschlag der Fußspitze ±`LEG_REACH` 0,9 Netzeinheiten. Flügel = Punkte über Z 1,0 und hinter Y 0,4 außerhalb des Hinterleib-Ellipsoids; im Flug stehen sie waagerecht um ihr Gelenk (±0,45, 0,22) abgespreizt und schlagen waagerecht (1,1 ± 0,7 rad, dabei gehoben ±0,35). Die Schlagphase springt je Bild um den goldenen Winkel, jedes Bild zeigt also eine andere Stelle des Bogens; ein sichtbarer langsamer Schlag (zuvor 7 Hz) wirkte wie ein Vogel. Ein reines Auf und Ab sieht man von oben nicht. Werte je Fliege über Custom Primitive Data aus `AFlyActor::ApplyPose`: 0 = Schrittphase, 1 = Laufen, 2 = Flügelschlagphase, 3 = Drehen, 4 = Flügel offen (0 bis 1, legt sich in gut 0,1 s an). Die Schrittphase folgt Weg und Drehbogen (`Stride` 17,3 passend zu `LEG_REACH` bei 4,8 Einheiten pro Netzeinheit, `FootRadius` 7), damit die Füße nicht rutschen; im Stand ruhen die Beine, beim Drehen schwingen die Seiten gegenläufig (`TurnInPlace` zählt als Schritt). Damit man das Laufen sieht, laufen die Fliegen langsamer (0,32 pro Schritt), landen 16 bis 30 Einheiten neben ihrem Platz und gehen im Stand öfter ein Stück (Schritt 0,3). Bei der normalen Ansicht ist eine Fliege nur etwa 25 Pixel groß, die Beine sieht man dort nur andeutungsweise; deutlich in der Nahansicht (`-closeup`). Die Ersatzflügel (Ebenen) sind beim Scan ausgeblendet. Den Eingang World Position Offset kennt `unreal.MaterialProperty` nicht; `UFlyClockEditorLibrary::ConnectWorldPositionOffset` (C++) verbindet ihn für das Python-Skript.
- Maus (`ReadCursor` in `FlyClock.cpp`): Der Zeiger wird direkt bei Windows gelesen (`GetCursorPos`, `GetAsyncKeyState`), weil das Wallpaper-Fenster nie den Fokus hat; er zählt nur über dem eigenen Fenster oder dem Desktop (Progman/WorkerW). Er scheucht Fliegen und schiebt Murmeln, solange er sich bewegt (bis 1,5 s danach, `PointerRest`) oder die linke Taste hält, nicht über der Knopfleiste.
- Knopfleiste (`DrawOverlay`, gezeichnet von `AFlyClockHUD`): erscheint bei Mausbewegung für 4 s (`OverlayLinger`) unten über der Taskleiste. Knöpfe: Uhr (Fliegen → Oxyd-Steine → Glasmurmeln), Boden, bei den Fliegen Ziffern (Raster 3×5, 4×7 oder 5×7, `Fonts` in `FlySwarm.cpp`; Taste D, Schalter `-digits=5x7`; gleicher Zellabstand, auch 5×7 passt in die Panelbreite), Drehen links/rechts, Flacher, Steiler, Näher, Weiter (gedrückt halten), Grundansicht, Ton, Platz 1–3 (Speicherplätze statt der Vorkonfigurationen von Wallpaper Engine: Klick ruft ab, 1 s Halten speichert Uhr, Boden, Ziffern, Ton und Ansicht als `Slot<n>` im Abschnitt des Wallpapers; über einem Platz erscheint ein Hinweis, die Knöpfe haben feste Breite, damit die Leiste beim Halten nicht rutscht). Die Wahl samt Ansicht je Zifferblatt landet in `GameUserSettings.ini`, Abschnitt = Programmname (`[microClocks-flies]`, `[microClocks-oxyd]`, sonst `[microClocks]`).
- Wallpaper-Modus: Beginnt der Programmname mit `microClocks`, lädt `BeginPlay` die gespeicherte Einstellung und hebt die Hochkant-Beschränkung der Kamera auf. `microClocks-flies.exe` zeigt nur die Fliegen (kein Uhr-Knopf), `microClocks-oxyd.exe` nur Oxyd-Steine und Glasmurmeln (Uhr-Knopf und Tab wechseln zwischen beiden, `EFaces`/`NextFace`); andere Namen zeigen alle Uhren. Hintergrund: Wallpaper Engine gibt Programm-Wallpapers weder Argumente noch Benutzereigenschaften noch Tastatur oder Mausrad, nur Mausposition und linke Taste. Eigene Eigenschaften zeigt es bei Programm-Wallpapers nicht an, nur „System-Farben“: ausprobiert im November 2026 mit `general.properties` (Combos im selben Format wie bei Web-Wallpapers) in `project.json` und nach Neustart; auch der Editor bietet dafür keine Eigenschaften an. Darum stellt man alles in der Knopfleiste ein. (Werte von Eigenschaften speichert Wallpaper Engine in seiner `config.json` unter `wproperties` → Programmpfad → Monitor.) Das Fenster hat als Wallpaper nie den Fokus; Unreal schaltet ohne Fokus standardmäßig stumm (`UnfocusedVolumeMultiplier=0.0` in `BaseEngine.ini`), darum steht in `Config/DefaultEngine.ini` unter `[Audio]` der Wert 1,0.
- Packen: `run.ps1 -Package <Ordner>` richtet Assets ein und ruft `RunUAT BuildCookRun` (Win64, Shipping, pak). Weil alles per Pfad geladen wird, stehen die Content-Ordner in `DirectoriesToAlwaysCook` (`Config/DefaultGame.ini`); `Config/DefaultGameUserSettings.ini` stellt auf Fenstermodus.

## Wallpaper Engine

- `wallpaper/index.html` + `wallpaper.js` laden die Zifferblätter aus `shared/`. `build.py` kopiert Module und Assets nach `dist/wallpaper` und passt die Pfade an; `buildWallpaper` installiert optional nach `myprojects/microClocks` (Steam-Pfad aus der Registry).
- In der Browser-Vorschau fehlen die Wallpaper-Engine-Benutzereigenschaften; es gelten die Standardwerte aus `wallpaper.js`.
- Unreal-Fassung (`buildUnrealWallpaper` in `gulp/tasks.mjs`, `engine: unreal`): packt `pc/FlyClock3D` nach `dist/wallpaper-ue/build/Windows` und legt zwei Projekte an (`UNREAL_WALLPAPERS`, unter `dist/wallpaper-ue` bzw. mit `deploy` unter `myprojects`): `microClocks-ue-flies` („microClocks Fliegen 3D“) mit einer Kopie des Pakets (rund 840 MB) und `microClocks-ue-oxyd` („microClocks Oxyd 3D“) aus Hardlinks darauf (`linkTree`, über Laufwerksgrenzen Kopien). Verlinkt werden nur die Einträge des Pakets, nicht `project.json` und `preview.jpg`: Geteilt schrieb das Oxyd-Projekt seine `project.json` auch ins Fliegen-Projekt, das dann auf die fehlende `microClocks-oxyd.exe` zeigte und schwarz blieb. In jedem liegen der Hardlink `FlyClock3D/Binaries/Win64/microClocks-<id>.exe` neben der Shipping-exe, `project.json` (`type: application`) und `preview.jpg` aus `pc/FlyClock3D/wallpaper-preview-<id>.jpg` (Bildschirmfotos der gepackten Uhr, 512 × 512). Keine Verzeichnisverbindung: Über `app` → `microClocks-ue-app` startete Wallpaper Engine nichts („Application shell execute failed with: 267“ in `wallpaper_engine/log.txt`). `readdirSync` meldet Verzeichnisverbindungen als Ordner, `rmSync` lehnt sie ab; `removeFolder` prüft darum mit `lstatSync` und löst sie mit `rmdirSync`. Die früheren Projekte `microClocks-ue-<id>` (flies-sand, flies-grass, flies-road, flies-forest, marbles, glass, app, 3d) entfernt der Task. Ein laufendes Wallpaper sperrt seinen Ordner (EPERM beim Installieren); der Task beendet dann die laufenden `microClocks-<id>.exe` per `taskkill` und versucht das Entfernen bis zu fünfmal (`removeUnlocked`). Für eine neue Programmfassung genügt es, das Wallpaper danach neu auszuwählen; bei geänderten Titeln, Vorschaubildern oder Projekten Wallpaper Engine ganz beenden (Taskleiste → Beenden) und neu starten, sonst bleiben alte Einträge in der Liste. Die Knopfleiste verkleinert sich, wenn sie breiter als das Bild wäre. Wallpaper Engine blendet Programm-Wallpapers standardmäßig aus: unter „Installiert“ → „Ergebnisse filtern“ den Typ „Anwendung“ einschalten. Programm-Wallpapers sind seit Wallpaper Engine 2.8.42 (Juni 2026) nicht mehr im Workshop, lokal aber erlaubt.
- Ton: Web-Fassung mit Eigenschaften `sound` und `volume`; Unreal-Fassung mit Summen und Klacken; der Ton-Knopf (Taste M) schaltet aus → leise → mittel → laut (0; 0,25; 0,5; 1 über `FApp::SetVolumeMultiplier`, `SetSoundLevel`), Vorgabe mittel, gespeichert als `Sound` (ältere Einstellung `Muted` wird übernommen).

## Sprachen (i18x)

- Gulp (`gulpfile.mjs`, `gulp/*.mjs`, `bangle/tools/*.mjs`): Protokolle mit `Log('…<context="task log"/>', { werte })`, Fehler und Formulartexte mit `'…<context="…"/>'.i18xTrans()` (Kontexte `task parameter`, `button text`, `form information`, `task error`, `progress`, `project control`, `clock name`, `setup item`, `setup hint`). Formulare werden in Node übersetzt, darum sind `µParameters` Funktionen. Uhrnamen in `CATALOG` sind Quelltexte mit Kontext `clock name`; `listClocks` liefert sie übersetzt, also auch `<clockLabel/>`.
- Browser (`esp32/sim`, `bangle/preview`): `shared/i18x.js` stellt `"…".i18xTrans()` bereit und lädt `i18x/web/<lid>.json` nach `?lang=…` bzw. Browsersprache; Elemente mit `data-i18x="Kontext"` (Text) oder `data-i18x-label` (aria-label) übersetzt `translateDocument`. Bodennamen in `shared/faces/floors.js` sind Quelltexte (Kontext `floor`).
- Web-Wallpaper: `wallpaper/project.json` hat en-US-Texte; `build.py` ersetzt sie durch `ui_<eigenschaft>[_<wert>]` und erzeugt `general.localization` aus `i18x/wallpaper/<lid>.json`. Die Beschreibung (von Wallpaper Engine nicht übersetzt) kommt in der Sprache des Rechners (`MICROGULP_LANG`, sonst Windows).
- Unreal: `FlyI18x` (Modul `Json`) lädt `Content/i18x/<lid>.json` (Sprache aus `-lang=`, sonst `FPlatformMisc::GetDefaultLocale`, sonst passende Sprache ohne Region); gepackt über `DirectoriesToAlwaysStageAsNonUFS=(Path="i18x")`. Knopfleiste in `ButtonLabel`/`SlotLabel` mit Kontext `button bar`, Bodennamen mit `ground`. Die Titel und Beschreibungen der Unreal-Wallpaper-Projekte übersetzt `buildUnrealWallpaper` beim Bauen.
- Bangle: `BahnClockNoSecounds.js` nimmt Wochentag und Monat aus `require("locale")`. Andere Uhren haben keinen Text.
- Ohne i18x: Python-/PowerShell-Ausgaben (`setup_assets.py`, `run.ps1`, `flysprites.py`) sind deutsch, Firmware- und Unreal-Logs englisch. `bangle/tools/flasher.html` (Web-Bluetooth-Weg, von keinem Task mehr benutzt) ist unverändert deutsch.
- Prüfen fehlender Schlüssel: alle `'…<context="…"/>'`-Literale einer Datei mit der Tabelle vergleichen; die übrigen Sprachdateien in `i18x/gulp/` (es, fr, ja, ko, ru, zh) enthalten die neuen Schlüssel nicht.

## README

`README.de-DE.src.md` ist die führende Quelle (deutsch). `README.md` = Sprachlinks, `## English` (Übersetzung, Unterabschnitte `###`) und `## Deutsch` (die Quelle ohne erste Zeile, Überschriften eine Ebene tiefer). Kein Generator im Repository: Änderungen erst in der Quelle, dann beide Teile in `README.md` von Hand nachziehen; der deutsche Teil muss der Quelle entsprechen.

## Versionen (`RELEASES.json`)

- `RELEASES.json` im Stamm nach dem Muster von BlueShift/esp2: `releases[]` mit `main`, `minor`, `revision`, `date` (`YYYY-MM-DD HH:MM`), `beta`, `info[]`; neueste Version oben. Texte en-US mit genau einem `<context="release info"/>`, Versionen, Pfade und Zahlen ohne Kontext.
- Übersetzungen in `i18x/gulp/releases/de-DE.json`, Schlüssel = Text ohne Kontext. Keine übersetzten Parallelfassungen von `RELEASES.json`.
- Git-Tag und GitHub-Release `v<main>.<minor>.<revision>`; Assets siehe Abschnitt Git. Erste Version: v0.1.0 (13.11.2026, beta). Es gibt keine µGulp-Tasks für Releases.

## Git

- Branch `main`, Autor Meinolf Amekudzi. Git LFS für `*.uasset`, `*.umap`, `*.psd`, `*.fbx`, `*.glb`, `*.blend` (`.gitattributes`).
- Commits pro Teilprojekt mit Präfix (z. B. `Bangle: …`), passend zu `commitProject`.
- Remote `origin`: https://github.com/mamekudz/microClocks (öffentlich). Lokale µGulp-Zustände (`native-device.json`, `parameters.json`, `project-controls.json`) und Gulpfile-Sicherungen `.microgulp/gulpfile.before-*.mjs` sind ignoriert. Nicht mit `git add -A -- .microgulp` stagen: Das nahm die mit `git rm --cached` entfernten Dateien wieder auf.
- GitHub Pages aus `main`, Stammordner (https://mamekudz.github.io/microClocks/): `index.html` (deutsch) bettet `esp32/sim/?face=…` und `bangle/preview/fliesclock.html?script=…` ein; die übrigen Bangle-Uhren öffnen im Espruino-Emulator über `https://www.espruino.com/ide/emulator.html?codeurl=<raw.githubusercontent-URL>&upload` (dort einmal „Bangle.js 2“ wählen; eine Vorwahl per URL gibt es nicht). `.nojekyll` muss bleiben. Pages liefert keine LFS-Dateien aus, die Seite darf also nur Nicht-LFS-Dateien nutzen. Neue Uhren oder Zifferblätter auch in `index.html` eintragen.
- Releases: Programm-Wallpapers sind nicht im Workshop erlaubt, darum ZIPs als Release-Assets (`microClocks-ue-flies.zip`, `microClocks-ue-oxyd.zip` aus `dist/wallpaper-ue/<id>`, `microClocks-web.zip` aus `dist/wallpaper`), gebaut mit „Wallpaper bauen“ ohne `deploy`. Titel und Beschreibung in `project.json` stehen in der Sprache des bauenden Rechners.
- Videos für `dev/media` mit ffmpeg aus `pip install --user imageio-ffmpeg` verkleinern: `-c:v libx264 -preset slower -crf 24 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k` (EffectDraft-Export 54 MB → 3,2 MB ohne sichtbaren Verlust; H.265 mit CRF 27 wäre 2 MB, spielt aber nicht in jedem Browser).

## Hinweise zur Umgebung

- Windows, PowerShell 5: `Set-Content -Encoding utf8NoBOM` gibt es nicht, und `Set-Content -Encoding UTF8` schreibt ein BOM. Für Dateien ohne BOM `[IO.File]::WriteAllText` nutzen; JS/MJS-Dateien dürfen kein BOM haben.
- Zum Testen ohne µGulp genügt ein statischer Server im Repository-Stamm, z. B. `python -m http.server 8799`, dann `http://localhost:8799/bangle/preview/fliesclock.html`.
- Logik der Bangle-Uhren lässt sich in Node mit `vm` und nachgebildeten `g`/`Bangle`/Timern prüfen. Weil der Code in einem Block steht, Testzugriffe innerhalb des Blocks einhängen.
