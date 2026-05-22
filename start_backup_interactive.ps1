$source = "C:\Users\Emanuele\Agave"

# Chiedi all'utente il percorso di destinazione del backup
$dest = Read-Host "Inserisci la cartella di destinazione per il backup (default: C:\\backups\\AgaveBackup)"
if ([string]::IsNullOrWhiteSpace($dest)) {
    $dest = "C:\\backups\\AgaveBackup"
}

# Assicurati che la cartella esista
if (-not (Test-Path -Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

# Esegui il backup immediato
Write-Host "Avvio backup una tantum..."
& "$PSScriptRoot\backup.ps1" -destPath "$dest"

# Configura il task pianificato per esecuzioni automatiche future
$taskName      = "AgaveAutoBackup"
$intervalHours = 4   # modifica se desideri un intervallo diverso
$backupScript  = Join-Path $PSScriptRoot "backup.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File `"$backupScript`" -destPath `"$dest`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours $intervalHours) -RepetitionDuration ([TimeSpan]::MaxValue)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force -User "SYSTEM"
    Write-Host "Task pianificato '$taskName' creato per eseguire il backup ogni $intervalHours ore nella cartella '$dest'."
} catch {
    Write-Error "Impossibile registrare il task pianificato: $_"
}
