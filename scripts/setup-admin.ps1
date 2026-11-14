# GastroSky: private LOCAL admin enrollment helper for Windows PowerShell.
# Run on the authorized business administrator's own computer, from the repository root:
#   powershell -NoProfile -File .\scripts\setup-admin.ps1
# Never put passwords, encryption keys or authenticator enrollment codes in GitHub.
$ErrorActionPreference = "Stop"
function Read-PrivateText([string]$Prompt) {
  $value = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $value.Dispose() }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found. Install Node.js before running this script."
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repoRoot
try {
  Write-Host "GastroSky private admin account preparation (nothing will be uploaded automatically)."
  $email = Read-Host "Admin email"
  $role = Read-Host "Role (owner/editor; leave blank for owner)"
  if ([string]::IsNullOrWhiteSpace($role)) { $role = 'owner' }
  if ($role -notin @('owner','editor')) { throw "Role must be owner or editor." }
  $password = Read-PrivateText "Strong admin password (input hidden)"
  $key = Read-PrivateText "Existing ADMIN_TOTP_KEY from your password manager (input hidden)"
  try {
    # Environment variables only exist for this PowerShell process and its Node child.
    # They are not saved to disk, a .env file or the GitHub repository.
    $env:ADMIN_SETUP_EMAIL = $email
    $env:ADMIN_SETUP_ROLE = $role
    $env:ADMIN_SETUP_PASSWORD = $password
    $env:ADMIN_TOTP_KEY = $key
    node scripts/provision-admin.mjs
    if ($LASTEXITCODE -ne 0) { throw "Local enrollment failed with exit code $LASTEXITCODE" }
  }
  finally {
    Remove-Item Env:ADMIN_SETUP_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_SETUP_ROLE -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_SETUP_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_TOTP_KEY -ErrorAction SilentlyContinue
    $password = $null
    $key = $null
  }
  Write-Host "Enrollment files are private and remain on THIS device. Do not commit or share them."
  Write-Host "Have the authorized owner import the SQL into the private D1 database and enroll the authenticator."
}
finally { Pop-Location }
