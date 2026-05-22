param(
    [Parameter(Mandatory=$true)]
    [string]$FolderPath,   # es. C:\...\backup_temp\backup_20260522_235500
    [Parameter(Mandatory=$true)]
    [string]$ZipPath       # es. C:\...\backup_temp\backup.zip
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($FolderPath, $ZipPath)
Write-Host "ZIP creato: $ZipPath"
