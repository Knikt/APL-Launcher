# 05-build-overlay.ps1 — builds, signs and installs APL Overlay (overlay/ folder), then hands it the
# Home, Pause, Samsung TV Plus and Prime Video buttons.
#
#   .\scripts\05-build-overlay.ps1 -TvIp 192.168.1.50 -ProfileName APLPartner
#   .\scripts\05-build-overlay.ps1 -TvIp 192.168.1.50 -RemapOnly    (only hands the buttons over, once the remote is set up in Vetro)
#
# Needs a C# compiler on the PC (Visual Studio Build Tools) and the .NET 6 runtime.
# Without them, nothing is changed: Home stays with the launcher, only Control Center over a video is missing.
param(
    [Parameter(Mandatory = $true)][string]$TvIp,
    [string]$ProfileName = "APLauncher",
    [string]$TizenCli,
    [switch]$RemapOnly
)
. "$PSScriptRoot\lib.ps1"
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Base = "http://$TvIp`:8099"
$Out = Join-Path $Root "dist\overlay"

if ($RemapOnly) {
    # APL Overlay must already be on the screen
    $have = ''
    try { $have = Invoke-VetroExec $Base "pkgcmd -l 2>/dev/null | grep -c apl.launcher.overlay" } catch {}
    if (($have.Trim() -split '\s+')[-1] -in @('', '0')) {
        Send-Gui ("APL-RESULT fail " + (Tr "APL Overlay is not installed on the screen: install APL Launcher first." "APL Overlay n'est pas installé sur l'écran : installe d'abord APL Launcher."))
        exit 1
    }
} else {
$csc = Find-CSharpCompiler
$net6 = Find-Net6
if (-not $csc -or -not $net6) {
    Write-Host (Tr "        No C# compiler or .NET 6 on this PC: APL Overlay is not installed." "        Pas de compilateur C# ou de .NET 6 sur ce PC : APL Overlay n'est pas installé.") -ForegroundColor DarkYellow
    Write-Host (Tr "        Everything else works, Home stays with the launcher. To add it: Visual Studio Build Tools and the .NET 6 runtime." "        Tout le reste marche, Home reste au launcher. Pour l'ajouter : Visual Studio Build Tools et le runtime .NET 6.")
    return
}

# The screen's Tizen libraries: kept on the PC, never published
$refs = Join-Path $env:APPDATA "APL-Launcher\tizen-refs"
New-Item -ItemType Directory -Force -Path $refs | Out-Null
foreach ($dll in @("Tizen.dll", "Tizen.Log.dll", "Tizen.Applications.Common.dll", "Tizen.Applications.UI.dll", "Tizen.NUI.dll", "Tizen.Network.Bluetooth.dll")) {
    $file = Join-Path $refs $dll
    if (Test-Path $file) { continue }
    Write-Host (Tr "        Copying $dll from the screen…" "        Copie de $dll depuis l'écran…")
    $remote = "/usr/share/dotnet.tizen/framework/$dll"
    $size = [int64](Invoke-VetroExec $Base "stat -c %s '$remote'").Trim()
    $sha = ((Invoke-VetroExec $Base "sha256sum '$remote'") -split '\s+')[0]
    $ms = New-Object IO.MemoryStream
    for ($skip = 0; ($skip * 3000) -lt $size; $skip += 30) {
        $hex = (Invoke-VetroExec $Base "dd if='$remote' bs=3000 skip=$skip count=30 2>/dev/null | od -An -v -tx1 | tr -d ' \n'" 90) -replace '[^0-9a-fA-F]', ''
        $bytes = New-Object byte[] ($hex.Length / 2)
        for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }
        $ms.Write($bytes, 0, $bytes.Length)
    }
    [IO.File]::WriteAllBytes($file, $ms.ToArray())
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) {
        Remove-Item -Force $file
        throw (Tr "$dll arrived damaged. Run the installation again." "$dll est arrivé abîmé. Relance l'installation.")
    }
}

# Icons: the same paths as launcher/js/icons.js; fonts: the launcher's, if they are there
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
New-Item -ItemType Directory -Force -Path "$Out\bin", "$Out\shared\res", "$Out\res\icons", "$Out\res\fonts", "$Out\lib" | Out-Null
$js = [IO.File]::ReadAllText((Join-Path $Root "launcher\js\icons.js"))
$utf8 = New-Object Text.UTF8Encoding($false)
foreach ($m in [regex]::Matches($js, "(?m)^\s+(\w+):\s*'(<.+?)',?\s*$")) {
    $inner = $m.Groups[2].Value -replace 'currentColor', '#ffffff'
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + $inner + '</svg>'
    [IO.File]::WriteAllText("$Out\res\icons\$($m.Groups[1].Value).svg", $svg, $utf8)
}
Copy-Item (Join-Path $Root "overlay\icons\*.svg") "$Out\res\icons\" -Force
Copy-Item (Join-Path $Root "launcher\fonts\*.OTF") "$Out\res\fonts\" -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Root "launcher\images\settings-icon.png") "$Out\shared\res\APLOverlay.png" -ErrorAction SilentlyContinue

# Build
$args = @("/nologo", "/nostdlib+", "/target:exe", "/langversion:latest", "/nullable-", "/warn:1", "/out:`"$Out\bin\APLOverlay.dll`"")
$args += Get-ChildItem $net6.FullName -Filter *.dll | Where-Object { $_.Name -match '^(System|Microsoft|netstandard|mscorlib|WindowsBase)' -and $_.Name -notmatch 'Native|DiaSym' } | ForEach-Object { "/r:`"$($_.FullName)`"" }
$args += Get-ChildItem $refs -Filter *.dll | ForEach-Object { "/r:`"$($_.FullName)`"" }
$args += Get-ChildItem (Join-Path $Root "overlay") -Filter *.cs | ForEach-Object { "`"$($_.FullName)`"" }
$rsp = Join-Path $Root "dist\overlay.rsp"
$args -join "`n" | Set-Content -Encoding ASCII $rsp
& $csc "@$rsp"
if ($LASTEXITCODE -ne 0) { throw (Tr "the APL Overlay build failed" "la compilation d'APL Overlay a échoué") }
[IO.File]::WriteAllText("$Out\bin\APLOverlay.runtimeconfig.json", '{"runtimeOptions":{"tfm":"net6.0","rollForward":"LatestMajor","framework":{"name":"Microsoft.NETCore.App","version":"6.0.0"}}}')
Copy-Item (Join-Path $Root "overlay\tizen-manifest.xml") "$Out\tizen-manifest.xml"

# Signed package
$tpk = Join-Path $Root "dist\apl.launcher.overlay.tpk"
if (Test-Path $tpk) { Remove-Item -Force $tpk }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($tpk, 'Create')
Get-ChildItem $Out -Recurse -File | ForEach-Object {
    $name = $_.FullName.Substring($Out.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
}
$zip.CreateEntry("lib/") | Out-Null
$zip.Dispose()
$tizen = Find-Tizen $TizenCli
$r = Invoke-Native $tizen @('package', '--type', 'tpk', '--sign', $ProfileName, '--', $tpk)
if ($r.ExitCode -ne 0) { throw (Tr "signing APL Overlay failed: $($r.Output)" "la signature d'APL Overlay a échoué : $($r.Output)") }

# Upload and installation
$tmp = "/tmp/apl-overlay.tpk"
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tpk))
Invoke-VetroExec $Base ": > $tmp.b64" | Out-Null
for ($o = 0; $o -lt $b64.Length; $o += 48000) {
    Invoke-VetroExec $Base "printf '%s' '$($b64.Substring($o, [Math]::Min(48000, $b64.Length - $o)))' >> $tmp.b64" | Out-Null
}
$sum = Invoke-VetroExec $Base "base64 -d $tmp.b64 > $tmp && rm -f $tmp.b64 && sha256sum $tmp"
if ($sum -notmatch (Get-FileHash -LiteralPath $tpk -Algorithm SHA256).Hash.ToLowerInvariant()) { throw (Tr "APL Overlay arrived damaged on the screen." "APL Overlay est arrivé abîmé sur l'écran.") }
$res = Invoke-VetroExec $Base "app_launcher -k apl.launcher.overlay >/dev/null 2>&1; pkgcmd -i -t tpk -p $tmp 2>&1 | tail -2; rm -f $tmp; pkgcmd -l 2>/dev/null | grep -c apl.launcher.overlay" 120
if (($res.Trim() -split '\s+')[-1] -eq '0') { throw (Tr "the screen did not install APL Overlay: $res" "l'écran n'a pas installé APL Overlay : $res") }
Write-Host (Tr "        APL Overlay is installed." "        APL Overlay est installé.") -ForegroundColor Green
}

# The Home button goes to the overlay if it went to the launcher. If the overlay disappears, the launcher says which rules to change in Vetro (it never changes them).
try {
$cur = Invoke-RestMethod -Uri "$Base/remap" -TimeoutSec 15
$changed = $false
foreach ($rule in @($cur.rules)) {
    foreach ($a in @($rule.actions)) {
        if ($a.type -eq 'launch' -and $a.appId -eq 'APLauncher.Home') { $a.appId = 'apl.launcher.overlay'; $changed = $true }
    }
}
# Pause (244) = Control Center. Samsung TV Plus (560) = AquaPlay and Prime Video (221) = TizenTube, only if
# the app is installed: otherwise the button keeps its Samsung role. Restore removes them.
$rules = @($cur.rules)
$codes = @(244)
try {
    $installed = Invoke-VetroExec $Base "app_launcher -l 2>/dev/null | grep -o -E 'AquaPlay02.AquaPlay|xvvl3S1bvH.TizenBrewStandalone' | sort -u"
    if ($installed -match 'AquaPlay02') { $codes += 560 }
    if ($installed -match 'TizenBrewStandalone') { $codes += 221 }
} catch {}
foreach ($code in $codes) {
    if ($rules | Where-Object { $_.id -eq "physical_$code" }) { continue }
    $rules += [pscustomobject]@{ id = "physical_$code"; enabled = $true; trigger = @{ type = 'physical'; value = "$code" }; actions = @(@{ type = 'launch'; appId = 'apl.launcher.overlay' }) }
    $changed = $true
}
if ($changed) {
    Invoke-RestMethod -Uri "$Base/remap" -Method Post -ContentType 'application/json' -Body (@{ rules = $rules } | ConvertTo-Json -Depth 8) -TimeoutSec 15 | Out-Null
    $extra = @(); if ($codes -contains 560) { $extra += "TV Plus = AquaPlay" }; if ($codes -contains 221) { $extra += "Prime Video = TizenTube" }
    Write-Host ((Tr "        Remote: Home twice = open apps, Home held or Pause = Control Center" "        Télécommande : 2 fois Home = apps ouvertes, Home maintenu ou Pause = Centre de contrôle") + $(if ($extra) { ", " + ($extra -join ", ") } else { "" }) + ".") -ForegroundColor Green
}
} catch {
    if ($RemapOnly) { Send-Gui ("APL-RESULT fail " + (Tr "Vetro did not accept the buttons: " "Vetro n'a pas accepté les boutons : ") + $_.Exception.Message); exit 1 }
    throw
}
if ($RemapOnly) { Send-Gui "APL-RESULT ok" }
