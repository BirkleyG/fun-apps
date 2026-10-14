@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Get Python 3.12 from https://www.python.org/downloads/ and tick "Add to PATH".
  pause & exit /b 1
)
if not exist .venv (
  echo First run: setting things up ^(a few minutes^)...
  py -3.12 -m venv .venv 2>nul || py -3.11 -m venv .venv 2>nul || py -3 -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
python -m app.server --open %*
pause
