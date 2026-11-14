# Private one-time owner password migration. Run from the extracted GastroSky repository.
# No changes to Windows execution policy; only execute a trusted repository script.
$ErrorActionPreference="Stop"
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {throw "Node.js is required."}
Push-Location $root
try {
  Write-Host "GastroSky password compatibility repair. Authenticator setup remains unchanged."
  $email=Read-Host "Existing admin email"
  $secret=Read-Host "Existing admin password (input hidden)" -AsSecureString
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }
  try {
    $env:ADMIN_SETUP_EMAIL=$email
    $env:ADMIN_SETUP_PASSWORD=$password
    node scripts/repair-admin-password.mjs
    if ($LASTEXITCODE -ne 0) {throw "Password repair file could not be created."}
  } finally {
    Remove-Item Env:ADMIN_SETUP_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_SETUP_PASSWORD -ErrorAction SilentlyContinue
    $password=$null
  }
} finally {Pop-Location}
