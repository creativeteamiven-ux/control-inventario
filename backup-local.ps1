# Backup local del proyecto (excluye node_modules y carpetas de build)
$proyecto = "Control de Inventario"
$fecha = Get-Date -Format "yyyy-MM-dd"
$carpetaBackup = "Control-de-Inventario-backup-temp"
$zipBackup = "Control-de-Inventario-backup-$fecha.zip"
$base = Split-Path -Parent $PSScriptRoot
Set-Location $base

if (Test-Path $carpetaBackup) { Remove-Item $carpetaBackup -Recurse -Force }
New-Item -ItemType Directory -Path $carpetaBackup | Out-Null

Write-Host "Copiando proyecto (sin node_modules, .git, dist, build)..."
robocopy $proyecto $carpetaBackup /E /XD node_modules .git dist build .next .turbo /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Comprimiendo en $zipBackup ..."
Compress-Archive -Path "$carpetaBackup\*" -DestinationPath $zipBackup -Force

Remove-Item $carpetaBackup -Recurse -Force
$tam = [math]::Round((Get-Item $zipBackup).Length / 1MB, 2)
Write-Host "Listo. Backup: $base\$zipBackup ($tam MB)"
