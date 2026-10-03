<#
    .SYNOPSIS
        Bumps the version in projects/scuba-physics/package.json and the "version" field of
        projects/planner/src/manifest*.webmanifest (default + all localized variants).
        The manifest "id" is the stable PWA identity and is intentionally never changed here.
        Called by semantic-release via @semantic-release/exec during the prepare step.

    .PARAMETER Version
        The new version string (e.g. "0.1.38").
#>

param(
    [Parameter(Mandatory = $true)]
    [String]$Version
)

# Bump scuba-physics package.json
npm pkg set version=$Version --prefix projects/scuba-physics

# Bump version field in the default manifest and every localized variant
$manifestFiles = Get-ChildItem "projects/planner/src" -Filter "manifest*.webmanifest"

if ($manifestFiles.Count -eq 0) {
    Write-Error "No manifest files found!"
    exit 1
}

$failedFiles = @()
$updatedFiles = @()

foreach ($file in $manifestFiles) {
    try {
        # Parse JSON to validate and get current version
        $manifestContent = Get-Content $file.FullName -Raw | ConvertFrom-Json
        $oldVersion = $manifestContent.version

        # Update (or add) the version, the id stays untouched
        $manifestContent | Add-Member -NotePropertyName version -NotePropertyValue $Version -Force

        # Convert back to JSON with proper formatting (2-space indent for consistency)
        $jsonContent = $manifestContent | ConvertTo-Json -Depth 10

        # Write back with trailing newline
        Set-Content $file.FullName $jsonContent -Encoding UTF8

        Write-Host "✓ Updated $($file.Name): '$oldVersion' → '$Version'"
        $updatedFiles += $file.Name
    }
    catch {
        Write-Error "✗ Failed to update $($file.Name): $_"
        $failedFiles += $file.Name
    }
}

# CRITICAL: Verify that all manifest files have the same version and the same id (PWA requirement)
Write-Host "`nVerifying PWA manifest consistency..."
$allVersions = @()
foreach ($file in $manifestFiles) {
    $manifest = Get-Content $file.FullName | ConvertFrom-Json
    $allVersions += @{
        file = $file.Name
        id = $manifest.id
        version = $manifest.version
        lang = $manifest.lang
    }
}

$inconsistentFiles = $allVersions | Where-Object { $_.version -ne $Version }
if ($inconsistentFiles.Count -gt 0) {
    Write-Error "`n❌ Manifest files have inconsistent version values:"
    $allVersions | ForEach-Object { Write-Error "  $($_.file): version=$($_.version), lang=$($_.lang)" }
    exit 1
}

$expectedId = $allVersions[0].id
$inconsistentIds = $allVersions | Where-Object { [String]::IsNullOrEmpty($_.id) -or $_.id -ne $expectedId }
if ($inconsistentIds.Count -gt 0) {
    Write-Error "`n❌ Manifest files have missing or inconsistent id values (BREAKS PWA spec):"
    $allVersions | ForEach-Object { Write-Error "  $($_.file): id=$($_.id), lang=$($_.lang)" }
    exit 1
}

Write-Host "✓ All $($manifestFiles.Count) manifest files have consistent version='$Version' and id='$expectedId'"
Write-Host "  Languages: $($allVersions.lang -join ', ')"

if ($failedFiles.Count -gt 0) {
    Write-Error "`n❌ Failed to update the following files: $($failedFiles -join ', ')"
    exit 1
}
