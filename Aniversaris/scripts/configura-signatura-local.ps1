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
    $escaped = $Value.Replace('\', '\\').Replace('=', '\=').Replace(':', '\:').Replace('#', '\#').Replace('!', '\!')
    $builder = New-Object Text.StringBuilder
    foreach ($character in $escaped.ToCharArray()) {
        $codePoint = [int]$character
        if ($codePoint -lt 0x20 -or $codePoint -gt 0x7E) {
            [void]$builder.Append(('\u{0:x4}' -f $codePoint))
        }
        else {
            [void]$builder.Append($character)
        }
    }
    return $builder.ToString()
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
        ('storeFile=' + (ConvertTo-PropertyValue ($StoreFile -replace '\\', '/')))
        ('storePassword=' + (ConvertTo-PropertyValue $storePassword))
        ('keyAlias=' + (ConvertTo-PropertyValue $KeyAlias))
        ('keyPassword=' + (ConvertTo-PropertyValue $keyPassword))
    )
    $temporaryPath = "$propertiesPath.tmp"
    [IO.File]::WriteAllLines($temporaryPath, $lines, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporaryPath -Destination $propertiesPath -Force

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $propertiesPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $acl = Get-Acl -LiteralPath $propertiesPath
        $inheritedRules = @($acl.Access | Where-Object IsInherited)
        $broadRules = @($acl.Access | Where-Object {
            $_.IdentityReference.Value -match 'Everyone|Authenticated Users|Users$'
        })
        if ($inheritedRules.Count -gt 0 -or $broadRules.Count -gt 0) {
            throw "No s'ha pogut restringir l'ACL de keystore.properties."
        }
        Write-Warning "El sistema de fitxers no admet protegir l'herència, però el fitxer no té permisos heretats ni amplis."
    }

    Write-Host 'Signatura configurada i protegida. Ja pots tancar aquesta finestra.' -ForegroundColor Green
}
finally {
    Remove-Item Env:ANIVERSARIS_STORE_PASSWORD_CHECK -ErrorAction SilentlyContinue
    $storePassword = $null
    $keyPassword = $null
}

Read-Host 'Prem Retorn per tancar'
