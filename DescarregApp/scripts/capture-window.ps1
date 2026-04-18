param(
  [string]$ProcessName = "DescarregApp",
  [string]$WindowTitle = "DescarregApp",
  [string]$Output = "docs\images\descarregapp-main.png"
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Capture {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$process = Get-Process $ProcessName | Where-Object { $_.MainWindowTitle -eq $WindowTitle } | Select-Object -First 1
if (-not $process) {
  throw "No s'ha trobat cap finestra amb el títol '$WindowTitle'."
}

[Win32Capture]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 600

$rect = New-Object RECT
[Win32Capture]::GetWindowRect($process.MainWindowHandle, [ref]$rect) | Out-Null

$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

if ($width -le 0 -or $height -le 0) {
  throw "La finestra trobada no té una mida vàlida."
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))

$outputPath = Join-Path (Get-Location) $Output
$outputDir = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Captura guardada a $outputPath"
