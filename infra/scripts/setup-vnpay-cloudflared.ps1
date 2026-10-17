# Download a verified Windows portable executable; do not install or start a tunnel.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This portable setup supports Windows only.'
}

# Release and hashes: https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0
$version = '2026.10.0'
$architecture = if ($env:PROCESSOR_ARCHITEW6432) {
    $env:PROCESSOR_ARCHITEW6432
} else {
    $env:PROCESSOR_ARCHITECTURE
}
switch ($architecture) {
    'AMD64' {
        $asset = 'cloudflared-windows-amd64.exe'
        $expectedHash = '86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c'
    }
    'x86' {
        $asset = 'cloudflared-windows-386.exe'
        $expectedHash = '0630a8779e9823a1a3b091698b8e71874e0f7b205559219f52fdd301466b5546'
    }
    default { throw 'This setup supports Windows x64/x86. For other architectures, see Cloudflare downloads.' }
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$directory = Join-Path $projectRoot '.tmp/vnpay'
$executable = [IO.Path]::GetFullPath((Join-Path $directory 'cloudflared.exe'))
if (-not $executable.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Portable destination must remain inside the project.'
}

if (Test-Path -LiteralPath $executable) {
    if ((Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'Existing cloudflared.exe does not match the pinned release. It was left unchanged. Move it aside before retrying.'
    }
    Write-Host "Verified existing cloudflared $version; no download needed."
} else {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $download = Join-Path $directory ('cloudflared-' + [Guid]::NewGuid().ToString('N') + '.download')
    $previousTls = [Net.ServicePointManager]::SecurityProtocol
    $previousProgress = $ProgressPreference
    try {
        [Net.ServicePointManager]::SecurityProtocol = $previousTls -bor [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'
        Write-Host "Downloading cloudflared $version from Cloudflare's official GitHub release..."
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/download/$version/$asset" `
            -OutFile $download -UseBasicParsing -TimeoutSec 300
        if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expectedHash) {
            throw 'SHA-256 verification failed. The download will not be used.'
        }
        Move-Item -LiteralPath $download -Destination $executable
        Write-Host "Downloaded and verified cloudflared $version."
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $previousTls
        $ProgressPreference = $previousProgress
        if (Test-Path -LiteralPath $download) {
            Remove-Item -LiteralPath $download -Force
        }
    }
}

Write-Host 'No PATH, environment, ports or Windows service were changed.'
Write-Host 'From the project root (CMD or PowerShell):'
Write-Host '  .\.tmp\vnpay\cloudflared.exe --version'
Write-Host '  .\.tmp\vnpay\cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:RELAY_PORT'
Write-Host 'Replace RELAY_PORT with the port printed by vnpay-callback-relay.mjs.'
