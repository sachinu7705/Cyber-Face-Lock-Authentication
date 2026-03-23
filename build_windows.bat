@echo off
echo Building CyberLock for Windows...

REM Install dependencies
pip install pyinstaller

REM Build the executable
pyinstaller cyberlock.spec --onefile --windowed

REM Create installer directory
mkdir dist\CyberLock
copy dist\CyberLock.exe dist\CyberLock\
xcopy templates dist\CyberLock\templates\ /E
xcopy static dist\CyberLock\static\ /E
xcopy models dist\CyberLock\models\ /E

echo Build complete! Check the dist\CyberLock folder
pause