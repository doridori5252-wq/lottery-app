$taskName = "LottoAutoUpdate"
$batFile = "C:\Users\P S M\Desktop\lottery-app\scripts\weekly-update.bat"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At "21:00"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`""
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable -RunOnlyIfNetworkAvailable

$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Trigger $trigger -Action $action -Settings $settings -Principal $principal -Description "Korean Lotto weekly auto-update every Saturday 21:00" -Force

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "SUCCESS: '$taskName' registered - runs every Saturday at 21:00"
} else {
    Write-Host "FAILED: Could not register task"
}
