# Revisa si la sesión actual de PowerShell tiene variables de entorno que pisan el .env.
# Docker Compose da prioridad a las variables de la terminal sobre el .env: si alguna difiere,
# los contenedores reciben otro valor (así se rompió SQL Server el 12 de noviembre de 2026).
# Compara por hash SHA-256 y muestra SOLO NOMBRES, nunca valores.
#
# Uso (desde la raíz del proyecto, antes de docker compose up):
#   powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1
# Código de salida: 0 si no hay diferencias, 1 si alguna variable difiere, 2 si no hay .env.
param([string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'))

$ErrorActionPreference = 'Stop'
$Prefixes = @('MSSQL_', 'SQLSERVER_', 'MYSQL_', 'POSTGRES_', 'MONGO_', 'FIREBASE_', 'WOMPI_', 'GDRIVE_', 'VITE_')
$Exact = @('JWT_SECRET', 'API_FOOTBALL_KEY', 'DEMO_PASSWORD', 'ADMIN_PASSWORD')

function Test-Watched([string]$Name) {
  if ($Exact -contains $Name) { return $true }
  foreach ($p in $Prefixes) { if ($Name.StartsWith($p)) { return $true } }
  return $false
}

# Normaliza igual los dos lados: quita comillas que envuelven el valor, convierte \n literal
# en salto de línea y unifica CRLF. Así FIREBASE_PRIVATE_KEY no da falsos positivos.
function Get-Normalized([string]$Value) {
  if ($null -eq $Value) { return '' }
  $v = $Value.Trim()
  if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) {
    $v = $v.Substring(1, $v.Length - 2)
  }
  $v = $v.Replace('\n', "`n").Replace("`r`n", "`n")
  return $v.Trim()
}

function Get-Hash([string]$Value, [string]$Name) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $normalized = Get-Normalized $Value
    # En una llave PEM los saltos de línea no cambian la llave. Docker Compose puede dejar
    # "\n" literal y salto real a la vez: se comparan sin saltos para no dar falsos positivos.
    if ($Name -eq 'FIREBASE_PRIVATE_KEY') { $normalized = $normalized -replace "\s", '' }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
    return [System.BitConverter]::ToString($sha.ComputeHash($bytes))
  } finally { $sha.Dispose() }
}

if (-not (Test-Path $EnvFile)) {
  Write-Host "No se encontro el archivo .env en $EnvFile" -ForegroundColor Red
  exit 2
}

# Lee el .env: KEY=VALOR por línea, sin comentarios. El valor se toma completo (un # dentro
# del valor no es comentario, igual que en Docker Compose).
$fromFile = @{}
foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path $EnvFile))) {
  if ($line -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') { $fromFile[$Matches[1]] = $Matches[2] }
}

$different = @(); $same = @(); $extra = @()
foreach ($item in Get-ChildItem Env:) {
  $name = $item.Name.ToUpperInvariant()
  if (-not (Test-Watched $name)) { continue }
  if ($fromFile.ContainsKey($name)) {
    if ((Get-Hash $item.Value $name) -eq (Get-Hash $fromFile[$name] $name)) { $same += $name } else { $different += $name }
  } else {
    $extra += $name
  }
}

Write-Host "Archivo comparado: $EnvFile ($($fromFile.Count) variables)"
if ($same.Count -gt 0) {
  Write-Host "Definidas en esta terminal con el MISMO valor que el .env (no causan problemas): $($same -join ', ')" -ForegroundColor Yellow
}
if ($extra.Count -gt 0) {
  Write-Host "Definidas en esta terminal y ausentes del .env (revisalas): $($extra -join ', ')" -ForegroundColor Yellow
}
if ($different.Count -eq 0) {
  Write-Host 'OK: ninguna variable de la terminal pisa el .env con otro valor.' -ForegroundColor Green
  exit 0
}

Write-Host "ATENCION: estas variables de la terminal tienen un valor DISTINTO al del .env y Docker Compose las usaria:" -ForegroundColor Red
foreach ($n in $different) { Write-Host "  - $n" -ForegroundColor Red }
Write-Host ''
Write-Host 'Quitalas de esta terminal antes de docker compose up:'
foreach ($n in $different) { Write-Host "  Remove-Item Env:$n" }
Write-Host 'O cierra esta terminal y abre una nueva. En VS Code, revisa "python.terminal.useEnvFile" en .vscode/settings.json.'
exit 1
