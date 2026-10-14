@echo off
setlocal
title Meeting Scribe installer
set "ZIP_URL=__ZIP_URL__"
set "APP=%LOCALAPPDATA%\MeetingScribe"

echo.
echo  Installing Meeting Scribe into:
echo    %APP%
echo.
if not exist "%APP%" mkdir "%APP%"

echo  Downloading...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing '%ZIP_URL%' -OutFile '%TEMP%\meeting-scribe.zip'; Expand-Archive -Force '%TEMP%\meeting-scribe.zip' '%APP%' } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo.
  echo  Download failed. Check your internet connection and try again.
  pause
  exit /b 1
)
del "%TEMP%\meeting-scribe.zip" >nul 2>nul

echo  Creating desktop shortcut...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Meeting Scribe.lnk'); $s.TargetPath='%APP%\start.bat'; $s.WorkingDirectory='%APP%'; $s.WindowStyle=7; $s.Save()"

echo  Linking the "Run" button on your Fun Apps page...
reg add "HKCU\Software\Classes\meetingscribe" /ve /d "URL:Meeting Scribe" /f >nul
reg add "HKCU\Software\Classes\meetingscribe" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\meetingscribe\shell\open\command" /ve /d "cmd.exe /c start \"\" /min \"%APP%\start.bat\"" /f >nul

echo.
echo  Installed. Starting Meeting Scribe ^(first start downloads components, a few minutes^)...
call "%APP%\start.bat"
