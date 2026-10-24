$ErrorActionPreference = 'Stop'
$webRoot = $PSScriptRoot
$baseUrl = 'http://127.0.0.1:8788'
$ready = $false
try { $status = Invoke-RestMethod -Uri "$baseUrl/api/status" -TimeoutSec 2; $ready = $null -ne $status.replyPort } catch {}
if (-not $ready) {
    $nodePath = 'C:\Program Files\nodejs\node.exe'
    Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $webRoot 'server.mjs') + '"') -WorkingDirectory $webRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $webRoot 'local-web.log') -RedirectStandardError (Join-Path $webRoot 'local-web-error.log')
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $status = Invoke-RestMethod -Uri "$baseUrl/api/status" -TimeoutSec 1; $ready = $null -ne $status.replyPort; if($ready){break} } catch {}
    }
}
if (-not $ready) { throw 'A 區本地 WEB 啟動失敗，請檢查 local-web-error.log。' }
Start-Process "$baseUrl/A_ZONE_OSC.html"
