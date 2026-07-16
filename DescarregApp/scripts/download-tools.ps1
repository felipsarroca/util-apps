$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$toolsDir = Join-Path $root "resources\bin\win"
$tempDir = Join-Path $root ".tools-temp"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
$denoZipUrl = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
$ffmpegZipUrl = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

$ytDlpPath = Join-Path $toolsDir "yt-dlp.exe"
$denoZipPath = Join-Path $tempDir "deno.zip"
$denoExtractDir = Join-Path $tempDir "deno"
$ffmpegZipPath = Join-Path $tempDir "ffmpeg-release-essentials.zip"
$ffmpegExtractDir = Join-Path $tempDir "ffmpeg"

Write-Host "Descarregant yt-dlp..."
& curl.exe -fL $ytDlpUrl -o $ytDlpPath
if ($LASTEXITCODE -ne 0) {
  throw "No s'ha pogut descarregar yt-dlp."
}

Write-Host "Descarregant Deno..."
& curl.exe -fL $denoZipUrl -o $denoZipPath
if ($LASTEXITCODE -ne 0) {
  throw "No s'ha pogut descarregar Deno."
}
Expand-Archive -LiteralPath $denoZipPath -DestinationPath $denoExtractDir -Force
Copy-Item -LiteralPath (Join-Path $denoExtractDir "deno.exe") -Destination (Join-Path $toolsDir "deno.exe") -Force

Write-Host "Descarregant FFmpeg..."
& curl.exe -fL $ffmpegZipUrl -o $ffmpegZipPath
if ($LASTEXITCODE -ne 0) {
  throw "No s'ha pogut descarregar FFmpeg."
}

if (Test-Path $ffmpegExtractDir) {
  Remove-Item -LiteralPath $ffmpegExtractDir -Recurse -Force
}

Expand-Archive -LiteralPath $ffmpegZipPath -DestinationPath $ffmpegExtractDir -Force

$ffmpegExe = Get-ChildItem -Path $ffmpegExtractDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
if (-not $ffmpegExe) {
  throw "No s'ha trobat ffmpeg.exe dins el paquet descarregat."
}

Copy-Item -LiteralPath $ffmpegExe.FullName -Destination (Join-Path $toolsDir "ffmpeg.exe") -Force

Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Host "Eines preparades a $toolsDir"
