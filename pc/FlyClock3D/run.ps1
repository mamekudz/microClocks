# Baut das Projekt, lädt und importiert bei Bedarf die Assets und startet die Uhr im Fenster 820 × 1004.
#   .\run.ps1            bauen und starten
#   .\run.ps1 -Setup     Materialien, Summton, Waldszene und Fliegenscan neu anlegen
#   .\run.ps1 -closeup   Nahansicht der Ziffern
#   .\run.ps1 -marbles   mit den Oxyd-Murmeln beginnen (Tab wechselt im Spiel)
#   .\run.ps1 -BuildOnly nur bauen, nicht starten
param([switch]$Setup, [switch]$BuildOnly)

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
if (-not (Test-Path (Join-Path $PSScriptRoot "Import\polyhaven\textures\oak_veneer_01"))) {
	python (Join-Path $PSScriptRoot "Scripts\fetch_assets.py")
	if ($LASTEXITCODE -ne 0) { throw "Download der Waldszene fehlgeschlagen ($LASTEXITCODE)" }
}

# Fehlt nur das Murmelbrett, werden auch nur die Murmelteile angelegt.
$forest = Test-Path (Join-Path $PSScriptRoot "Content\Forest\M_Ground.uasset")
$marbles = Test-Path (Join-Path $PSScriptRoot "Content\Marbles\M_Marble.uasset")
if ($Setup -or -not $forest -or -not $marbles) {
	$env:FLYCLOCK_SETUP = if ($Setup -or -not $forest) { "all" } else { "marbles" }
	$script = Join-Path $PSScriptRoot "Scripts\setup_assets.py"
	& "$engine\Binaries\Win64\UnrealEditor-Cmd.exe" $project -run=pythonscript "-script=$script" -unattended -nop4 -nosplash -stdout -FullStdOutLogOutput
	if ($LASTEXITCODE -ne 0) { throw "Einrichtung fehlgeschlagen ($LASTEXITCODE)" }
}

# Doppelte Panelauflösung, damit die 7 mm kleinen Fliegen genug Pixel bekommen. -closeup zeigt die Nahansicht.
& "$engine\Binaries\Win64\UnrealEditor.exe" $project -game -windowed -ResX=820 -ResY=1004 -nosplash @args
