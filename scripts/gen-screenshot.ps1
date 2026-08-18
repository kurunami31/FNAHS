param(
  [int]$Width = 1280,
  [int]$Height = 720,
  [string]$Out
)
Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap($Width, $Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'

# cream background
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#faf7ee'))

# navy header band
$navy = [System.Drawing.ColorTranslator]::FromHtml('#100e60')
$band = New-Object System.Drawing.SolidBrush($navy)
$g.FillRectangle($band, 0, 0, $Width, [int]($Height * 0.34))

# gold accent line under header
$gold = [System.Drawing.ColorTranslator]::FromHtml('#c09000')
$gp = New-Object System.Drawing.Pen($gold, 6)
$g.DrawLine($gp, 0, [int]($Height * 0.34) + 3, $Width, [int]($Height * 0.34) + 3)

# seal image in header, left
$seal = [System.Drawing.Image]::FromFile("$PSScriptRoot\..\public\FNAHS.png")
$size = [int]($Height * 0.26)
$g.DrawImage($seal, [int]($Width * 0.04), [int](($Height * 0.34 - $size) / 2), $size, $size)

# title text
$titleFont = New-Object System.Drawing.Font('Georgia', [float]($Height * 0.10), [System.Drawing.FontStyle]::Bold)
$creamBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffffff'))
$x = [int]($Width * 0.04) + $size + [int]($Width * 0.03)
$y = [int]($Height * 0.09)
$g.DrawString('FNAHS  PULSO', $titleFont, $creamBrush, $x, $y)

$subFont = New-Object System.Drawing.Font('Arial', [float]($Height * 0.035), [System.Drawing.FontStyle]::Regular)
$g.DrawString('Proactive & United Legion of Student nurses Organization', $subFont, $creamBrush, $x, [int]($Height * 0.22))

# body: three mock cards
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$cardPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#e4dfc9'), 1)
$n = 3
$cardW = [int]($Width * 0.26)
$cardH = [int]($Height * 0.34)
$gap = [int]($Width * 0.04)
$total = $n * $cardW + ($n - 1) * $gap
$startX = [int](($Width - $total) / 2)
$cardY = [int]($Height * 0.44)
$titles = @('CLINICAL BRIEFS', 'ON THE ROUNDS', 'YOUR TOOLS')
$bodyFont = New-Object System.Drawing.Font('Arial', [float]($Height * 0.02), [System.Drawing.FontStyle]::Regular)
$hdrFont = New-Object System.Drawing.Font('Arial', [float]($Height * 0.024), [System.Drawing.FontStyle]::Bold)
$ink = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#2b2840'))
for ($i = 0; $i -lt $n; $i++) {
  $cx = $startX + $i * ($cardW + $gap)
  $g.FillRectangle($cardBrush, $cx, $cardY, $cardW, $cardH)
  $g.DrawRectangle($cardPen, $cx, $cardY, $cardW, $cardH)
  $g.DrawString($titles[$i], $hdrFont, $ink, $cx + [int]($cardW * 0.06), $cardY + [int]($cardH * 0.06))
  # faux lines
  $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d8d4c0'))
  for ($l = 0; $l -lt 4; $l++) {
    $g.FillRectangle($lineBrush, $cx + [int]($cardW * 0.06), $cardY + [int]($cardH * 0.2) + $l * [int]($cardH * 0.17), [int]($cardW * 0.72), [int]($cardH * 0.05))
  }
}

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "saved $Out ($Width x $Height)"
