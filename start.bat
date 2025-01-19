@echo off
echo CryptoKittyRunner 시작하기...

:: Node.js와 npm이 설치되어 있는지 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치해주세요.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm이 설치되어 있지 않습니다. Node.js를 다시 설치해주세요.
    pause
    exit /b 1
)

:: Expo CLI가 전역으로 설치되어 있는지 확인하고 없으면 설치
where expo >nul 2>nul
if %errorlevel% neq 0 (
    echo Expo CLI를 설치합니다...
    call npm install -g expo-cli
)

:: 의존성 패키지 설치
echo 필요한 패키지를 설치합니다...
call npm install

:: 앱 실행
echo CryptoKittyRunner를 시작합니다...
call npm start

pause
