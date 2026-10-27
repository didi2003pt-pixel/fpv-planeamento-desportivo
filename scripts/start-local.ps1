# Executar na raiz do projeto: powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker não foi encontrado. Instala o Docker Desktop e inicia-o."
}

docker compose version
if ($LASTEXITCODE -ne 0) { throw "Docker Compose não está disponível." }

if (-not (Test-Path ".env")) {
    Write-Host "Ainda não existe .env. Copia .env.example para .env e altera POSTGRES_PASSWORD antes de voltar a executar." -ForegroundColor Yellow
    exit 1
}

docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw "Falha ao construir/iniciar os containers. Executa: docker compose logs --tail=100" }

docker compose ps
Write-Host "Abre http://localhost:8080 (ou a porta APP_PORT configurada em .env)" -ForegroundColor Green
Write-Host "Executa .\scripts\check-local.ps1 para verificar a API." -ForegroundColor Cyan
