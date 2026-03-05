# Script para reiniciar servidores SoundVault
# Ejecutar en PowerShell

Write-Host "Deteniendo procesos en puertos 3001 y 5173..." -ForegroundColor Yellow
$p3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$p5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in ($p3001 + $p5173 | Select-Object -Unique)) {
  if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2
Write-Host "Puertos liberados. Iniciando servidores..." -ForegroundColor Green
Write-Host ""
Write-Host "Abre DOS terminales y ejecuta:" -ForegroundColor Cyan
Write-Host "  Terminal 1: cd server && npm run dev" -ForegroundColor White
Write-Host "  Terminal 2: cd client && npm run dev" -ForegroundColor White
Write-Host ""
