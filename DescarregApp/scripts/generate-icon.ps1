$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assetsDir = Join-Path $root "assets"
$pngPath = Join-Path $assetsDir "icon.png"
$icoPath = Join-Path $assetsDir "icon.ico"

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle 8, 8, 240, 240
$outerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$outerRadius = 34
$outerPath.AddArc($rect.X, $rect.Y, $outerRadius, $outerRadius, 180, 90)
$outerPath.AddArc(($rect.Right - $outerRadius), $rect.Y, $outerRadius, $outerRadius, 270, 90)
$outerPath.AddArc(($rect.Right - $outerRadius), ($rect.Bottom - $outerRadius), $outerRadius, $outerRadius, 0, 90)
$outerPath.AddArc($rect.X, ($rect.Bottom - $outerRadius), $outerRadius, $outerRadius, 90, 90)
$outerPath.CloseFigure()
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 11, 122, 117),
  [System.Drawing.Color]::FromArgb(255, 45, 111, 150),
  45
)
$graphics.FillPath($brush, $outerPath)

$innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 255, 255, 255)), 10
$innerRect = New-Object System.Drawing.Rectangle 58, 58, 140, 140
$innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$innerRadius = 24
$innerPath.AddArc($innerRect.X, $innerRect.Y, $innerRadius, $innerRadius, 180, 90)
$innerPath.AddArc(($innerRect.Right - $innerRadius), $innerRect.Y, $innerRadius, $innerRadius, 270, 90)
$innerPath.AddArc(($innerRect.Right - $innerRadius), ($innerRect.Bottom - $innerRadius), $innerRadius, $innerRadius, 0, 90)
$innerPath.AddArc($innerRect.X, ($innerRect.Bottom - $innerRadius), $innerRadius, $innerRadius, 90, 90)
$innerPath.CloseFigure()
$graphics.DrawPath($innerPen, $innerPath)

$font = New-Object System.Drawing.Font "Segoe UI", 96, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("D", $font, $textBrush, (New-Object System.Drawing.RectangleF 8, 0, 240, 248), $format)

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$outerPath.Dispose()
$innerPen.Dispose()
$innerPath.Dispose()
$font.Dispose()
$textBrush.Dispose()
$format.Dispose()

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$header = New-Object System.Collections.Generic.List[byte]
$header.AddRange([byte[]](0, 0, 1, 0, 1, 0))
$header.Add(0)
$header.Add(0)
$header.Add(0)
$header.Add(0)
$header.AddRange([BitConverter]::GetBytes([UInt16]1))
$header.AddRange([BitConverter]::GetBytes([UInt16]32))
$header.AddRange([BitConverter]::GetBytes([UInt32]$pngBytes.Length))
$header.AddRange([BitConverter]::GetBytes([UInt32]22))

[System.IO.File]::WriteAllBytes($icoPath, ($header.ToArray() + $pngBytes))

Write-Host "Icona generada a $icoPath"
