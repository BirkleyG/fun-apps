@echo off
setlocal
cd /d "%~dp0"
title Meeting Scribe

call :findpy
if not defined PY (
  echo.
  echo  Python 3.12 was not found. Installing it now ^(one time, ~1 minute^)...
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
  call :findpy
)
if not defined PY (
  echo.
  echo  Could not find or install Python automatically.
  echo  Please install Python 3.12 from https://www.python.org/downloads/ and run this again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo.
  echo  First run: setting things up. This takes a few minutes, only once...
  "%PY%" -m venv .venv
  if errorlevel 1 ( echo  Could not create the Python environment. & pause & exit /b 1 )
)
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt
if errorlevel 1 ( echo  Could not install requirements. Check your internet connection. & pause & exit /b 1 )

".venv\Scripts\python.exe" -m app.server --open %*
echo.
echo  Meeting Scribe has stopped.
pause
exit /b 0

:findpy
set "PY="
rem Prefer 3.12 / 3.11 (best package support), via the Windows "py" launcher
for %%V in (3.12 3.11 3.13 3.10) do if not defined PY (
  for /f "delims=" %%P in ('py -%%V -c "import sys;print(sys.executable)" 2^>nul') do set "PY=%%P"
)
rem ...or a fresh install that isn't on PATH yet
if not defined PY for %%D in ("%LOCALAPPDATA%\Programs\Python\Python312" "%ProgramFiles%\Python312" "%LOCALAPPDATA%\Programs\Python\Python311") do if not defined PY if exist "%%~D\python.exe" set "PY=%%~D\python.exe"
exit /b 0
