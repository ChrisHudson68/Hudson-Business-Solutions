$backupDir = ".\backups"
$volumeName = "Hudson Business Solutions_data"

if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = "$backupDir\Hudson Business Solutions_backup_$timestamp.tar.gz"

docker run --rm `
  -v ${volumeName}:/data `
  -v ${PWD}\backups:/backup `
  alpine `
  sh -c "tar czf /backup/Hudson Business Solutions_backup_$timestamp.tar.gz /data"

Write-Host "Backup created: $backupFile"