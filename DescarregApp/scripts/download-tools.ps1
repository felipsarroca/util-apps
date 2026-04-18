$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$toolsDir = Join-Path $root "resources\bin\win"
$tempDir = Join-Path $root ".tools-temp"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
$ffmpegZipUrl = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

$ytDlpPath = Join-Path $toolsDir "yt-dlp.exe"
$ffmpegZipPath = Join-Path $tempDir "ffmpeg-release-essentials.zip"
$ffmpegExtractDir = Join-Path $tempDir "ffmpeg"

Write-Host "Descarregant yt-dlp..."
& curl.exe -L $ytDlpUrl -o $ytDlpPath

Write-Host "Descarregant FFmpeg..."
& curl.exe -L $ffmpegZipUrl -o $ffmpegZipPath

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
