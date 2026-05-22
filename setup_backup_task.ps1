# Backup script path (same directory)
$backupScript = Join-Path $PSScriptRoot "backup.ps1"

# Prompt user for destination (default if left blank)
$destInput = Read-Host "Enter backup destination folder (default: C:\\backups\\AgaveBackup)"
if ([string]::IsNullOrWhiteSpace($destInput)) {
    $destInput = "C:\\backups\\AgaveBackup"
}
# Ensure destination exists
if (-not (Test-Path -Path $destInput)) {
    New-Item -ItemType Directory -Path $destInput -Force | Out-Null
}

# Define task name (customizable)
$taskName = "AgaveAutoBackup"

# Define the trigger interval in hours (default 4 hours). Adjust as needed.
$intervalHours = 4

# Build the action: run PowerShell silently with the backup script and pass the destination as argument
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File `"$backupScript`" -destPath `"$destInput`""

# Create a trigger that starts now and repeats every $intervalHours hours indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours $intervalHours) -RepetitionDuration ([TimeSpan]::MaxValue)

# Register the task to run whether user is logged on or not, without storing password (requires admin)
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force -User "SYSTEM"
    Write-Host "Scheduled task '$taskName' created to run every $intervalHours hour(s) with destination '$destInput'."
} catch {
    Write-Error "Failed to register scheduled task: $_"
}
