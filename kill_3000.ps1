$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($process) {
    Write-Host "Killing process $process on port $port..."
    Stop-Process -Id $process -Force
    Write-Host "Process killed."
} else {
    Write-Host "No process found on port $port."
}
