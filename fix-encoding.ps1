$file = Join-Path $PSScriptRoot 'src\routes\admin\index.tsx'
$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# em-dash: â€" (C3 A2 E2 80 93) and variations
$text = $text -replace '\u00e2\u20ac\u201d', [string][char]8212
$text = $text -replace '\u00e2\u20ac\u201c', [string][char]8220
$text = $text -replace '\u00e2\u20ac\u2122', [string][char]8217
$text = $text -replace '\u00e2\u20ac\u02dc', [string][char]8216
$text = $text -replace '\u00e2\u2020\u2019', [string][char]8594
$text = $text -replace '\u00e2\u20ac\u00a6', [string][char]8230
$text = $text -replace '\u00c2\u00b7', [string][char]183
$text = $text -replace '\u00c3\u00a2\u20ac\u201d', [string][char]8212
$text = $text -replace '\u00c3\u00a2\u20ac\u02dc', [string][char]8216

[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done"
