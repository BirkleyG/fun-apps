@echo off
cd /d "%~dp0"
call .venv\Scripts\activate.bat
pip install -r requirements-translate.txt
echo Done. Restart start.bat.
pause
