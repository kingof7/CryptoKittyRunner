#!/bin/bash

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 스크립트가 있는 디렉토리로 이동
cd "$(dirname "$0")"

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Homebrew와 Node.js PATH 설정
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH"

# Node.js와 npm이 설치되어 있는지 확인
if ! command -v node &> /dev/null; then
    log_error "Node.js가 설치되어 있지 않습니다."
    log_info "https://nodejs.org 에서 Node.js를 설치해주세요."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm이 설치되어 있지 않습니다."
    log_info "Node.js를 다시 설치해주세요."
    exit 1
fi

# Expo CLI가 전역으로 설치되어 있는지 확인하고 없으면 설치
if ! command -v expo &> /dev/null; then
    log_info "Expo CLI를 설치합니다..."
    npm install -g expo-cli
fi

# 필요한 패키지 설치
log_info "필요한 패키지를 설치합니다..."
npm install

# 앱 시작
log_info "CryptoKittyRunner를 시작합니다..."
npm start
