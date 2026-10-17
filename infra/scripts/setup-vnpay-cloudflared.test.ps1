# Offline tests; mock downloads/hashes in a disposable project, never use the real portable executable.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Run these tests with Windows PowerShell.'
}
# Import before mocks so module autoloading cannot replace the mocked Get-FileHash function.
Import-Module Microsoft.PowerShell.Utility

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$testRoot = Join-Path $workspace ('.tmp/cloudflared-setup-test-' + [Guid]::NewGuid().ToString('N'))
if (-not [IO.Path]::GetFullPath($testRoot).StartsWith($workspace + '\.tmp\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test workspace must remain inside the project .tmp directory.'
}
$scriptDirectory = Join-Path $testRoot 'infra/scripts'
New-Item -ItemType Directory -Path $scriptDirectory -Force | Out-Null
$setup = Join-Path $scriptDirectory 'setup-vnpay-cloudflared.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'setup-vnpay-cloudflared.ps1') -Destination $setup
$portable = Join-Path $testRoot '.tmp/vnpay/cloudflared.exe'
$originalArchitecture = $env:PROCESSOR_ARCHITECTURE
$originalNativeArchitecture = $env:PROCESSOR_ARCHITEW6432
$env:PROCESSOR_ARCHITECTURE = 'AMD64'
$env:PROCESSOR_ARCHITEW6432 = 'AMD64'
$mockState = @{ calls = 0; mode = 'valid' }

function Assert([bool] $condition, [string] $message) {
    if (-not $condition) { throw $message }
}

function Invoke-WebRequest {
    param($Uri, $OutFile, [switch] $UseBasicParsing, $TimeoutSec)
    Assert ($Uri -eq 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.0/cloudflared-windows-amd64.exe') 'Unexpected download source.'
    Assert ($TimeoutSec -eq 300) 'Download must have a timeout.'
    $mockState.calls++
    [IO.File]::WriteAllText($OutFile, $mockState.mode)
    if ($mockState.mode -eq 'network-error') { throw 'Simulated network error.' }
}

function Get-FileHash {
    param($LiteralPath, $Algorithm)
    Assert ($Algorithm -eq 'SHA256') 'SHA-256 must be checked before using a file.'
    $hash = if ([IO.File]::ReadAllText($LiteralPath) -eq 'valid') {
        '86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c'
    } else { '0' * 64 }
    return [pscustomobject]@{ Hash = $hash }
}

function RunSetup {
    & $setup *> $null
}

function ExpectFailure([string] $message) {
    $failure = $null
    try { RunSetup } catch { $failure = $_.Exception.Message }
    Assert ($failure -and $failure.Contains($message)) "Expected failure containing: $message"
}

function AssertNoPartialDownload {
    $files = @(Get-ChildItem -LiteralPath (Split-Path -Parent $portable) -Filter '*.download')
    Assert ($files.Count -eq 0) 'Partial download was not cleaned up.'
}

try {
    RunSetup
    Assert (Test-Path -LiteralPath $portable) 'Verified download was not installed.'
    Assert ($mockState.calls -eq 1) 'Fresh setup must download once.'
    AssertNoPartialDownload
    Write-Host 'PASS: verified download is placed in project .tmp.'

    RunSetup
    Assert ($mockState.calls -eq 1) 'Cached setup must not download again.'
    Write-Host 'PASS: verified cached executable is reused offline.'

    [IO.File]::WriteAllText($portable, 'existing-unverified-file')
    ExpectFailure 'left unchanged'
    Assert ([IO.File]::ReadAllText($portable) -eq 'existing-unverified-file') 'Existing file was overwritten.'
    Assert ($mockState.calls -eq 1) 'Mismatched existing file must not trigger download.'
    Write-Host 'PASS: mismatched existing executable is preserved.'

    Remove-Item -LiteralPath $portable
    $mockState.mode = 'invalid'
    ExpectFailure 'SHA-256 verification failed'
    Assert (-not (Test-Path -LiteralPath $portable)) 'Unverified download was installed.'
    AssertNoPartialDownload
    Write-Host 'PASS: incorrect checksum blocks installation and cleans partial download.'

    $mockState.mode = 'network-error'
    ExpectFailure 'Simulated network error'
    Assert (-not (Test-Path -LiteralPath $portable)) 'Failed download was installed.'
    AssertNoPartialDownload
    Write-Host 'PASS: failed network request cleans partial download.'
    Write-Host 'All 5 portable setup checks passed (offline mocks).'
} finally {
    $env:PROCESSOR_ARCHITECTURE = $originalArchitecture
    $env:PROCESSOR_ARCHITEW6432 = $originalNativeArchitecture
    $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).Path
    if (-not $resolvedTestRoot.StartsWith($workspace + '\.tmp\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to remove a test directory outside project .tmp.'
    }
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
