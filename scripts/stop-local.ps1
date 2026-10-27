# Para os containers preservando os dados da base de dados.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker compose down
if ($LASTEXITCODE -ne 0) { throw "Não foi possível parar os containers." }
Write-Host "Containers parados. Volume de dados preservado." -ForegroundColor Green
