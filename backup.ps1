$source = $PSScriptRoot
# Destination can be supplied as a command‑line argument or entered interactively
if ($args.Count -ge 1) {
    $dest = $args[0]
} else {
    $dest = Read-Host "Enter backup destination folder (default: C:\backups\AgaveBackup)"
    if ([string]::IsNullOrWhiteSpace($dest)) {
        $dest = "C:\backups\AgaveBackup"
    }
}
# Ensure destination exists
if (-not (Test-Path -Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}
# Timestamp for backup folder
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $dest "backup_$timestamp"
# Copy files recursively
Copy-Item -Path $source -Destination $backupPath -Recurse -Force
Write-Host "Backup completed: $backupPath"
