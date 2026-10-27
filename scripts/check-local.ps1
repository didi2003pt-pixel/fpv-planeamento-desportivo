# Executar na raiz do projeto: powershell -ExecutionPolicy Bypass -File .\scripts\check-local.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$port = "8080"
if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match '^APP_PORT=' } | Select-Object -First 1
    if ($line) { $port = ($line -split '=', 2)[1].Trim() }
}

Write-Host "Estado dos containers:" -ForegroundColor Cyan
docker compose ps
if ($LASTEXITCODE -ne 0) { throw "Não foi possível consultar Docker Compose." }

$uri = "http://localhost:$port/api/health"
Write-Host "A testar $uri"
$response = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 10
if ($response.status -ne "ok") { throw "A API respondeu mas não devolveu status=ok." }
Write-Host "API ligada. Abre http://localhost:$port" -ForegroundColor Green
