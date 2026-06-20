# Validates .env for production — no Node.js required.

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Placeholder = "YOUR_RSA_PUBLIC_KEY_HERE"
$Required = @("DATABASE_URL", "REDIS_URL", "ELASTICSEARCH_NODE", "PASSPORT_PUBLIC_KEY")

if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Error "Missing .env and .env.example — cannot continue."
    }
    Copy-Item ".env.example" ".env"
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match '(?m)^NODE_ENV=') {
        $envContent = $envContent -replace '(?m)^NODE_ENV=.*', 'NODE_ENV=production'
    } else {
        $envContent += "`nNODE_ENV=production"
    }
    if ($envContent -match '(?m)^SWAGGER_ENABLED=') {
        $envContent = $envContent -replace '(?m)^SWAGGER_ENABLED=.*', 'SWAGGER_ENABLED=false'
    } else {
        $envContent += "`nSWAGGER_ENABLED=false"
    }
    Set-Content ".env" $envContent -NoNewline
    Write-Host "Created .env from .env.example at: $Root\.env"
    Write-Host "Set production values (especially PASSPORT_PUBLIC_KEY), then run this script again."
    exit 1
}

function Get-EnvValue {
    param([string]$Key)
    $line = Select-String -Path ".env" -Pattern "^$([regex]::Escape($Key))=" | Select-Object -Last 1
    if (-not $line) { return $null }
    $value = $line.Line.Substring($Key.Length + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
}

$failed = $false

foreach ($key in $Required) {
    $value = Get-EnvValue -Key $key
    if (-not $value) {
        Write-Host "Missing required variable: $key" -ForegroundColor Red
        $failed = $true
        continue
    }
    if ($key -eq "PASSPORT_PUBLIC_KEY" -and $value.Contains($Placeholder)) {
        Write-Host "PASSPORT_PUBLIC_KEY still contains the placeholder — set your Auth Service RSA public key." -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) { exit 1 }

$nodeEnv = Get-EnvValue -Key "NODE_ENV"
if ($nodeEnv -ne "production") {
    Write-Host 'Warning: NODE_ENV is not "production" in .env — the start script will export NODE_ENV=production.'
}

Write-Host "Production environment check passed."
