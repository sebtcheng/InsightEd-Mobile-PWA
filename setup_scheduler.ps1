$Action = New-ScheduledTaskAction -Execute "python.exe" -Argument "`"e:\OneDrive - Department of Education\001 DepEd Seb\InsightED\InsightEd-Mobile-PWA\advanced_fraud_detection.py`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

$TaskName = "InsightED_FraudDetection"

Register-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -TaskName $TaskName -Description "Runs InsightED Advanced Fraud Detection every 10 minutes." -Force

Write-Host "Task '$TaskName' created successfully. It will run every 10 minutes."
