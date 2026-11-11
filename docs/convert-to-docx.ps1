# Converts docs/architecture.md to docs/architecture.docx using Microsoft Word COM.
# 1. Performs a small Markdown -> HTML conversion for the subset actually used in the file.
# 2. Opens the HTML in Word and saves it as .docx (wdFormatXMLDocument = 12).
# 3. Deletes the intermediate HTML file.

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mdPath    = Join-Path $scriptDir 'architecture.md'
$htmlPath  = Join-Path $scriptDir 'architecture.html'
$docxPath  = Join-Path $scriptDir 'architecture.docx'

if (-not (Test-Path $mdPath)) {
    throw "Source markdown not found: $mdPath"
}

function Convert-MarkdownToHtml {
    param([string[]]$Lines)

    $sb = New-Object System.Text.StringBuilder
    $null = $sb.AppendLine('<html><head><meta charset="utf-8"><title>Architecture</title>')
    $null = $sb.AppendLine('<style>')
    $null = $sb.AppendLine('body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }')
    $null = $sb.AppendLine('h1 { color: #0b6b2b; font-size: 22pt; }')
    $null = $sb.AppendLine('h2 { color: #0b6b2b; font-size: 15pt; margin-top: 18pt; }')
    $null = $sb.AppendLine('h3 { color: #1e8e3e; font-size: 12pt; }')
    $null = $sb.AppendLine('pre { font-family: Consolas, monospace; font-size: 10pt; background: #f4f4f4; padding: 8pt; border: 1pt solid #d0d0d0; }')
    $null = $sb.AppendLine('code { font-family: Consolas, monospace; font-size: 10pt; }')
    $null = $sb.AppendLine('hr { border: 0; border-top: 1pt solid #c0c0c0; margin: 12pt 0; }')
    $null = $sb.AppendLine('li { margin-bottom: 2pt; }')
    $null = $sb.AppendLine('</style></head><body>')

    $inCode = $false
    $inList = $false
    $paragraph = New-Object System.Text.StringBuilder

    function Flush-Paragraph {
        param([System.Text.StringBuilder]$Para, [System.Text.StringBuilder]$Out)
        if ($Para.Length -gt 0) {
            $null = $Out.AppendLine("<p>$($Para.ToString())</p>")
            $null = $Para.Clear()
        }
    }

    foreach ($raw in $Lines) {
        $line = $raw

        # Fenced code block toggle.
        if ($line -match '^```') {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            if ($inCode) {
                $null = $sb.AppendLine('</pre>')
                $inCode = $false
            } else {
                $null = $sb.AppendLine('<pre>')
                $inCode = $true
            }
            continue
        }

        if ($inCode) {
            $escaped = $line.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
            $null = $sb.AppendLine($escaped)
            continue
        }

        # Horizontal rule.
        if ($line.Trim() -eq '---') {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            $null = $sb.AppendLine('<hr>')
            continue
        }

        # Headings.
        if ($line -match '^###\s+(.*)$') {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            $null = $sb.AppendLine("<h3>$($Matches[1])</h3>")
            continue
        }
        if ($line -match '^##\s+(.*)$') {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            $null = $sb.AppendLine("<h2>$($Matches[1])</h2>")
            continue
        }
        if ($line -match '^#\s+(.*)$') {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            $null = $sb.AppendLine("<h1>$($Matches[1])</h1>")
            continue
        }

        # List item.
        if ($line -match '^\s*-\s+(.*)$') {
            Flush-Paragraph $paragraph $sb
            if (-not $inList) { $null = $sb.AppendLine('<ul>'); $inList = $true }
            $item = $Matches[1]
            # Inline code: `foo` -> <code>foo</code>.
            $item = [System.Text.RegularExpressions.Regex]::Replace($item, '`([^`]+)`', '<code>$1</code>')
            # Bold: **foo** -> <b>foo</b>.
            $item = [System.Text.RegularExpressions.Regex]::Replace($item, '\*\*([^*]+)\*\*', '<b>$1</b>')
            $null = $sb.AppendLine("<li>$item</li>")
            continue
        }

        # Blank line separates paragraphs.
        if ([string]::IsNullOrWhiteSpace($line)) {
            Flush-Paragraph $paragraph $sb
            if ($inList) { $null = $sb.AppendLine('</ul>'); $inList = $false }
            continue
        }

        # Plain content line - append to current paragraph, converting inline code / bold.
        $text = $line
        $text = [System.Text.RegularExpressions.Regex]::Replace($text, '`([^`]+)`', '<code>$1</code>')
        $text = [System.Text.RegularExpressions.Regex]::Replace($text, '\*\*([^*]+)\*\*', '<b>$1</b>')
        if ($paragraph.Length -gt 0) { $null = $paragraph.Append(' ') }
        $null = $paragraph.Append($text)
    }

    Flush-Paragraph $paragraph $sb
    if ($inList) { $null = $sb.AppendLine('</ul>') }
    if ($inCode) { $null = $sb.AppendLine('</pre>') }

    $null = $sb.AppendLine('</body></html>')
    return $sb.ToString()
}

Write-Host "Reading $mdPath"
$mdLines = Get-Content -LiteralPath $mdPath

Write-Host "Converting to HTML -> $htmlPath"
$html = Convert-MarkdownToHtml -Lines $mdLines
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

Write-Host "Launching Word COM to produce $docxPath"
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($htmlPath, $false, $true)   # ReadOnly = true
    # wdFormatXMLDocument = 12 (.docx)
    $doc.SaveAs2($docxPath, 12)
    $doc.Close($false)
    Write-Host "Saved: $docxPath"
}
finally {
    if ($word) { $word.Quit() | Out-Null }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Remove-Variable word -ErrorAction SilentlyContinue
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    if (Test-Path $htmlPath) { Remove-Item -LiteralPath $htmlPath -Force }
}
