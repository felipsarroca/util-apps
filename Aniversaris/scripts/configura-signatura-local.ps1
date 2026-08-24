[CmdletBinding()]
param(
    [string]$StoreFile = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'AndroidKeys\aniversaris-upload.jks'),
    [string]$KeyAlias = 'aniversaris-upload'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$propertiesPath = Join-Path $projectRoot 'keystore.properties'

if (-not (Test-Path -LiteralPath $StoreFile -PathType Leaf)) {
    throw "No s'ha trobat la clau d'upload: $StoreFile"
}
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw "No s'ha trobat keytool. Comprova que JDK 17 sigui al PATH."
}

function ConvertFrom-Secret {
    param([Security.SecureString]$Value)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function ConvertTo-PropertyValue {
    param([string]$Value)
    if ($Value -match "[`r`n]") { throw 'Les contrasenyes no poden contenir salts de línia.' }
    return $Value.Replace('\', '\\').Replace('=', '\=').Replace(':', '\:').Replace('#', '\#').Replace('!', '\!')
}

Write-Host "Configuració local de la signatura d'Aniversaris" -ForegroundColor Cyan
$storePasswordSecure = Read-Host 'Contrasenya del magatzem de claus' -AsSecureString
$keyPasswordSecure = Read-Host 'Contrasenya de la clau' -AsSecureString
$storePassword = ConvertFrom-Secret $storePasswordSecure
$keyPassword = ConvertFrom-Secret $keyPasswordSecure

try {
    $env:ANIVERSARIS_STORE_PASSWORD_CHECK = $storePassword
    & keytool -list -keystore $StoreFile -storepass:env ANIVERSARIS_STORE_PASSWORD_CHECK -alias $KeyAlias *> $null
    if ($LASTEXITCODE -ne 0) { throw "La contrasenya, l'alias o el magatzem de claus no són vàlids." }

    $lines = @(
        'storeFile=' + (ConvertTo-PropertyValue ($StoreFile -replace '\\', '/')),
        'storePassword=' + (ConvertTo-PropertyValue $storePassword),
        'keyAlias=' + (ConvertTo-PropertyValue $KeyAlias),
        'keyPassword=' + (ConvertTo-PropertyValue $keyPassword)
    )
    $temporaryPath = "$propertiesPath.tmp"
    [IO.File]::WriteAllLines($temporaryPath, $lines, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporaryPath -Destination $propertiesPath -Force

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $propertiesPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No s'ha pogut restringir l'ACL de keystore.properties." }

    Write-Host 'Signatura configurada i protegida. Ja pots tancar aquesta finestra.' -ForegroundColor Green
}
finally {
    Remove-Item Env:ANIVERSARIS_STORE_PASSWORD_CHECK -ErrorAction SilentlyContinue
    $storePassword = $null
    $keyPassword = $null
}

Read-Host 'Prem Retorn per tancar'
