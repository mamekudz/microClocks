# Baut das Projekt, lädt und importiert bei Bedarf die Assets und startet die Uhr im Fenster 820 × 1004.
#   .\run.ps1            bauen und starten
#   .\run.ps1 -Setup     Materialien, Summton, Waldszene und Fliegenscan neu anlegen
#   .\run.ps1 -closeup   Nahansicht der Ziffern
#   .\run.ps1 -marbles   mit den Oxyd-Murmeln beginnen (Tab wechselt im Spiel)
#   .\run.ps1 -glass     mit den Oxyd-Glasmurmeln beginnen
#   .\run.ps1 -ground=sand  Untergrund forest, sand, grass oder road (G wechselt im Spiel)
#   .\run.ps1 -BuildOnly nur bauen, nicht starten
#   .\run.ps1 -Package <Ordner>  Assets einrichten und ein eigenständiges Shipping-Programm nach <Ordner> packen
param([switch]$Setup, [switch]$BuildOnly, [string]$Package)

$ErrorActionPreference = "Stop"
# Neueste installierte Unreal-5-Version nehmen und das Projekt darauf einstellen.
$latest = Get-ChildItem "C:\Program Files\Epic Games" -Directory -Filter "UE_5.*" |
	Sort-Object { [version]($_.Name -replace "^UE_", "") } | Select-Object -Last 1
if (-not $latest) { throw "Keine Unreal-5-Installation gefunden" }
$engine = Join-Path $latest.FullName "Engine"
$project = Join-Path $PSScriptRoot "FlyClock3D.uproject"
$version = $latest.Name -replace "^UE_", ""
$uproject = Get-Content $project -Raw | ConvertFrom-Json
if ($uproject.EngineAssociation -ne $version) {
	$uproject.EngineAssociation = $version
	$uproject | ConvertTo-Json -Depth 5 | Set-Content $project -Encoding UTF8
}
Write-Host "Unreal $version"

& "$engine\Build\BatchFiles\Build.bat" FlyClock3DEditor Win64 Development "-Project=$project" -WaitMutex -NoHotReload
if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen ($LASTEXITCODE)" }
if ($BuildOnly) { return }

$starter = Join-Path $PSScriptRoot "Content\StarterContent"
if (-not (Test-Path $starter)) {
	robocopy (Join-Path $latest.FullName "Samples\StarterContent\Content\StarterContent") $starter /E /NFL /NDL /NJH /NJS /NP | Out-Null
}
if (-not (Test-Path (Join-Path $PSScriptRoot "Import\polyhaven\textures\oak_veneer_01")) -or
	-not (Test-Path (Join-Path $PSScriptRoot "Import\polyhaven\textures\asphalt_06"))) {
	python (Join-Path $PSScriptRoot "Scripts\fetch_assets.py")
	if ($LASTEXITCODE -ne 0) { throw "Download der Waldszene fehlgeschlagen ($LASTEXITCODE)" }
}

# Fehlen nur Murmeln oder Untergründe, werden auch nur diese Teile angelegt.
$forest = Test-Path (Join-Path $PSScriptRoot "Content\Forest\M_Ground.uasset")
$marbles = (Test-Path (Join-Path $PSScriptRoot "Content\Marbles\M_Marble.uasset")) -and
	(Test-Path (Join-Path $PSScriptRoot "Content\Marbles\M_GlassMarble.uasset"))
$grounds = Test-Path (Join-Path $PSScriptRoot "Content\Grounds\M_Ground_Road.uasset")
# Der Fliegenscan liegt nur vor, wenn jemand ihn unter Import\fly abgelegt hat.
$scan = (Test-Path (Join-Path $PSScriptRoot "Content\FlyClock\Scan\SM_Fly.uasset")) -or
	-not (Test-Path (Join-Path $PSScriptRoot "Import\fly"))
# Material des Scans mit krabbelnden Beinen; ohne Scan nicht nötig.
$flylook = (Test-Path (Join-Path $PSScriptRoot "Content\FlyClock\M_FlyScan.uasset")) -or
	-not (Test-Path (Join-Path $PSScriptRoot "Import\fly"))
if ($Setup -or -not $forest -or -not $marbles -or -not $grounds -or -not $scan -or -not $flylook) {
	$parts = @()
	if (-not $marbles) { $parts += "marbles" }
	if (-not $grounds) { $parts += "grounds" }
	if (-not $scan) { $parts += "scan" }
	elseif (-not $flylook) { $parts += "flylook" }
	$env:FLYCLOCK_SETUP = if ($Setup -or -not $forest) { "all" } else { $parts -join "," }
	$script = Join-Path $PSScriptRoot "Scripts\setup_assets.py"
	& "$engine\Binaries\Win64\UnrealEditor-Cmd.exe" $project -run=pythonscript "-script=$script" -unattended -nop4 -nosplash -stdout -FullStdOutLogOutput
	if ($LASTEXITCODE -ne 0) { throw "Einrichtung fehlgeschlagen ($LASTEXITCODE)" }
}

if ($Package) {
	& "$engine\Build\BatchFiles\RunUAT.bat" BuildCookRun "-project=$project" -platform=Win64 -clientconfig=Shipping `
		-build -cook -stage -pak -archive "-archivedirectory=$Package" -nop4 -utf8output -unattended -nocompileeditor
	if ($LASTEXITCODE -ne 0) { throw "Packen fehlgeschlagen ($LASTEXITCODE)" }
	return
}

# Doppelte Panelauflösung, damit die 7 mm kleinen Fliegen genug Pixel bekommen. -closeup zeigt die Nahansicht.
& "$engine\Binaries\Win64\UnrealEditor.exe" $project -game -windowed -ResX=820 -ResY=1004 -nosplash @args
