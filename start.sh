#!/bin/bash

# Homebrew와 Node.js PATH 설정
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH"

# Node.js와 npm이 설치되어 있는지 확인
if ! command -v node &> /dev/null; then
    echo "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치해주세요."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "npm이 설치되어 있지 않습니다. Node.js를 다시 설치해주세요."
    exit 1
fi

# Expo CLI가 전역으로 설치되어 있는지 확인하고 없으면 설치
if ! command -v expo &> /dev/null; then
    echo "Expo CLI를 설치합니다..."
    npm install -g expo-cli
fi

# 의존성 패키지 설치
echo "필요한 패키지를 설치합니다..."
npm install

# 앱 실행
echo "CryptoKittyRunner를 시작합니다..."
npm start
