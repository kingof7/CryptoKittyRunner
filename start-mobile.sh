#!/bin/bash

# 셸 옵션 설정
set -euo pipefail
IFS=$'\n\t'

# 스크립트 경로 검증
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Error: 스크립트 경로를 확인할 수 없습니다."
    exit 1
fi

# 스크립트 실행 권한 확인
if [ ! -x "$SCRIPT_PATH" ]; then
    echo "Error: 스크립트 실행 권한이 없습니다. 다음 명령어로 권한을 추가해주세요:"
    echo "chmod +x $SCRIPT_PATH"
    exit 1
fi

# 전역 변수 선언
declare initial_dir=""
declare emulator_pid=""
declare -r MAX_WAIT_TIME=60
declare -r MIN_NODE_VERSION=16
declare -r MIN_RUBY_VERSION="2.7.0"
declare -r MIN_JAVA_VERSION=17
declare -r MIN_DISK_SPACE=1000000  # 1GB in KB
declare -r MIN_MEMORY=2000000      # 2GB in KB
declare -r REQUIRED_COMMANDS=(node npm ruby)
declare -r LOCKFILE="/tmp/start-mobile-$$.lock"
declare -r MAX_RETRIES=3
declare -r TIMEOUT=300  # 5 minutes
declare -r START_TIME=$(date +%s)

# 타임아웃 체크 함수
check_timeout() {
    local current_time
    current_time=$(date +%s)
    local elapsed=$((current_time - START_TIME))
    
    if [ "$elapsed" -gt "$TIMEOUT" ]; then
        error "스크립트 실행 시간이 ${TIMEOUT}초를 초과했습니다."
        return 1
    fi
    return 0
}

# 잠금 파일 생성
exec 200>"$LOCKFILE"
if ! flock -n 200; then
    echo "Error: 다른 인스턴스가 이미 실행 중입니다."
    exit 1
fi

# 인터럽트 시그널 처리
trap 'cleanup' INT TERM EXIT HUP QUIT

# 로그 레벨 설정
declare -r LOG_DEBUG=0
declare -r LOG_INFO=1
declare -r LOG_WARN=2
declare -r LOG_ERROR=3
declare LOG_LEVEL=$LOG_INFO

# 로그 출력 함수
log() {
    local level=$1
    local message=$2
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$level" -ge "$LOG_LEVEL" ]; then
        case $level in
            $LOG_DEBUG) echo "[$timestamp] DEBUG: $message" ;;
            $LOG_INFO)  echo "[$timestamp] INFO:  $message" ;;
            $LOG_WARN)  echo "[$timestamp] WARN:  $message" >&2 ;;
            $LOG_ERROR) echo "[$timestamp] ERROR: $message" >&2 ;;
        esac
    fi
}

# 디버그 로그
debug() { log $LOG_DEBUG "$1"; }
# 정보 로그
info() { log $LOG_INFO "$1"; }
# 경고 로그
warn() { log $LOG_WARN "$1"; }
# 에러 로그
error() { log $LOG_ERROR "$1"; }

# 정리 함수
cleanup() {
    local exit_code=$?
    
    info "스크립트를 종료합니다..."
    
    # 실행 중인 에뮬레이터 종료
    if [ -n "${emulator_pid:-}" ]; then
        info "에뮬레이터를 종료합니다 (PID: $emulator_pid)..."
        if kill -0 "$emulator_pid" 2>/dev/null; then
            if kill "$emulator_pid" 2>/dev/null; then
                info "에뮬레이터가 정상적으로 종료되었습니다."
            else
                warn "에뮬레이터 종료에 실패했습니다."
            fi
        else
            debug "에뮬레이터가 이미 종료되었습니다."
        fi
    fi
    
    # adb 서버 종료
    if command -v adb &> /dev/null; then
        info "ADB 서버를 종료합니다..."
        adb kill-server 2>/dev/null || true
    fi
    
    # 원래 디렉토리로 복귀
    if [ -n "${initial_dir:-}" ] && [ -d "$initial_dir" ] && [ "$PWD" != "$initial_dir" ]; then
        info "원래 디렉토리로 복귀합니다..."
        cd "$initial_dir" 2>/dev/null || warn "원래 디렉토리로 복귀하지 못했습니다."
    fi
    
    # 임시 파일 정리
    if [ -n "${TMPDIR:-}" ] && [ -d "$TMPDIR" ]; then
        find "$TMPDIR" -type f -name "expo-*" -mmin +60 -delete 2>/dev/null || true
    fi

    # 잠금 파일 제거
    if [ -n "${LOCKFILE:-}" ] && [ -f "$LOCKFILE" ]; then
        rm -f "$LOCKFILE" 2>/dev/null || true
    fi
    
    exit $exit_code
}

# 명령어 실행 함수
run_with_retry() {
    local cmd="$1"
    local retries=0
    local result
    
    while [ "$retries" -lt "$MAX_RETRIES" ]; do
        if ! check_timeout; then
            error "실행 시간 초과"
            return 1
        fi
        
        if result=$(eval "$cmd" 2>&1); then
            echo "$result"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ "$retries" -lt "$MAX_RETRIES" ]; then
            warn "명령어 실행 실패. ${MAX_RETRIES}회 중 ${retries}번째 재시도..."
            sleep $((retries * 2))
        fi
    done
    
    error "명령어 실행이 $MAX_RETRIES회 실패했습니다: $cmd"
    error "마지막 오류: $result"
    return 1
}

# 버전 비교 함수
version_compare() {
    if [ "$1" = "$2" ]; then
        echo 0
        return
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [ -z "${ver2[i]:-}" ]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            echo 1
            return
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            echo -1
            return
        fi
    done
    echo 0
}

# 필수 명령어 확인
check_required_commands() {
    local missing_commands=()
    for cmd in "${REQUIRED_COMMANDS[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        error "다음 필수 명령어들을 찾을 수 없습니다: ${missing_commands[*]}"
        return 1
    fi
    
    return 0
}

# 디스크 공간 확인
check_disk_space() {
    local available_space
    
    if command -v df &> /dev/null; then
        available_space=$(df -k . | awk 'NR==2 {print $4}')
        if [ "$available_space" -lt "$MIN_DISK_SPACE" ]; then
            error "빌드를 위한 디스크 공간이 부족합니다. 최소 1GB 필요 (현재 가용: $((available_space/1024))MB)"
            return 1
        fi
    else
        warn "디스크 공간을 확인할 수 없습니다."
    fi
    
    return 0
}

# 메모리 확인
check_memory() {
    local available_memory
    
    if [ -f "/proc/meminfo" ]; then
        available_memory=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
        if [ "$available_memory" -lt "$MIN_MEMORY" ]; then
            error "빌드를 위한 메모리가 부족합니다. 최소 2GB 필요 (현재 가용: $((available_memory/1024))MB)"
            return 1
        fi
    else
        warn "메모리 상태를 확인할 수 없습니다."
    fi
    
    return 0
}

# iOS 관련 PATH 설정
setup_ios_env() {
    info "iOS 개발 환경을 설정합니다..."
    
    # Xcode.app 존재 확인
    if [ ! -d "/Applications/Xcode.app" ]; then
        error "Xcode가 설치되어 있지 않습니다. App Store에서 설치해주세요."
        return 1
    fi
    
    # xcode-select 설정 확인
    local xcode_path
    xcode_path=$(xcode-select -p 2>/dev/null) || {
        error "Xcode Command Line Tools가 설치되어 있지 않습니다."
        error "다음 명령어로 설치해주세요: xcode-select --install"
        return 1
    }
    
    # Xcode 라이센스 동의 확인
    if ! xcrun clang &>/dev/null; then
        error "Xcode 라이센스에 동의해주세요."
        error "다음 명령어를 실행해주세요: sudo xcodebuild -license accept"
        return 1
    fi
    
    # 시뮬레이터 SDK 확인
    if ! xcrun simctl list devices &>/dev/null; then
        error "iOS 시뮬레이터 SDK를 찾을 수 없습니다."
        error "Xcode에서 시뮬레이터를 설치해주세요: Xcode > Preferences > Components"
        return 1
    fi
    
    return 0
}

# Android 관련 PATH 설정
setup_android_env() {
    info "Android 개발 환경을 설정합니다..."
    
    # Android SDK 위치 설정
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    else
        error "Android SDK를 찾을 수 없습니다."
        error "Android Studio를 설치하고 SDK를 설치해주세요."
        return 1
    fi
    
    # Java 환경 확인
    if ! command -v java &>/dev/null; then
        error "Java가 설치되어 있지 않습니다."
        error "다음 명령어로 설치해주세요: brew install openjdk@$MIN_JAVA_VERSION"
        return 1
    }
    
    local java_version
    java_version=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
    if [ -z "$java_version" ]; then
        error "Java 버전을 확인할 수 없습니다."
        return 1
    }
    
    # Java 17 이상 확인
    local java_major_version
    java_major_version=$(echo "$java_version" | cut -d'.' -f1)
    if [ "$java_major_version" -lt "$MIN_JAVA_VERSION" ]; then
        error "Java $MIN_JAVA_VERSION 이상이 필요합니다. 현재 버전: $java_version"
        error "다음 명령어로 설치해주세요: brew install openjdk@$MIN_JAVA_VERSION"
        return 1
    fi
    
    # Android SDK 도구 확인
    local required_tools=("platform-tools" "emulator" "cmdline-tools")
    for tool in "${required_tools[@]}"; do
        if [ ! -d "$ANDROID_HOME/$tool" ]; then
            error "Android SDK $tool을 찾을 수 없습니다."
            error "Android Studio의 SDK Manager에서 설치해주세요."
            return 1
        fi
    done
    
    # PATH 업데이트
    export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
    
    # ADB 확인
    if ! command -v adb &>/dev/null; then
        error "adb를 찾을 수 없습니다."
        error "Android SDK platform-tools를 설치해주세요."
        return 1
    }
    
    # 에뮬레이터 확인
    if ! command -v emulator &>/dev/null; then
        error "Android 에뮬레이터를 찾을 수 없습니다."
        error "Android Studio의 SDK Manager에서 설치해주세요."
        return 1
    }
    
    return 0
}

# Node.js와 npm 체크
check_node() {
    info "Node.js 환경을 확인합니다..."
    
    # Node.js 버전 확인
    if ! command -v node &> /dev/null; then
        error "Node.js가 설치되어 있지 않습니다."
        error "다음 명령어로 설치해주세요: brew install node@$MIN_NODE_VERSION"
        return 1
    }

    local node_version
    node_version=$(node -v | sed 's/^v//') || {
        error "Node.js 버전을 확인할 수 없습니다."
        return 1
    }

    if ! [[ "$node_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error "Node.js 버전 형식이 잘못되었습니다: $node_version"
        return 1
    }

    local major_version
    major_version=$(echo "$node_version" | cut -d'.' -f1)
    if [ "$major_version" -lt "$MIN_NODE_VERSION" ]; then
        error "Node.js $MIN_NODE_VERSION 이상이 필요합니다. 현재 버전: $node_version"
        error "다음 명령어로 설치해주세요: brew install node@$MIN_NODE_VERSION"
        return 1
    }

    # npm 확인
    if ! command -v npm &> /dev/null; then
        error "npm이 설치되어 있지 않습니다."
        error "Node.js를 다시 설치해주세요: brew install node@$MIN_NODE_VERSION"
        return 1
    }

    local npm_version
    npm_version=$(npm -v) || {
        error "npm 버전을 확인할 수 없습니다."
        return 1
    }

    # npm 캐시 확인
    if ! npm config get cache &> /dev/null; then
        warn "npm 캐시 설정에 문제가 있습니다. 캐시를 재설정합니다..."
        if ! npm config set cache "$HOME/.npm" --global; then
            error "npm 캐시 설정에 실패했습니다."
            error "다음 명령어를 시도해보세요: npm cache clean --force"
            return 1
        fi
    }

    # npm 전역 설치 권한 확인
    if ! npm config get prefix &>/dev/null; then
        warn "npm 전역 설치 권한에 문제가 있습니다..."
        if ! mkdir -p "$HOME/.npm-global"; then
            error "npm 전역 설치 디렉토리 생성에 실패했습니다."
            return 1
        fi
        if ! npm config set prefix "$HOME/.npm-global"; then
            error "npm 전역 설치 경로 설정에 실패했습니다."
            return 1
        fi
        export PATH="$HOME/.npm-global/bin:$PATH"
    }

    info "Node.js 버전: $node_version (npm: $npm_version)"
    return 0
}

# iOS 환경 체크
check_ios_env() {
    info "iOS 개발 환경을 확인합니다..."
    
    # Xcode 확인
    if ! xcode-select -p &> /dev/null; then
        error "Xcode Command Line Tools가 설치되어 있지 않습니다."
        error "다음 명령어로 설치해주세요: xcode-select --install"
        return 1
    }

    # CocoaPods 확인
    if ! command -v pod &> /dev/null; then
        info "CocoaPods를 설치합니다..."
        if ! sudo gem install cocoapods; then
            error "CocoaPods 설치에 실패했습니다."
            error "다음을 시도해보세요:"
            error "1. sudo gem update --system"
            error "2. sudo gem install cocoapods"
            return 1
        fi
    fi

    local pod_version
    pod_version=$(pod --version) || {
        error "CocoaPods 버전을 확인할 수 없습니다."
        return 1
    }
    
    # Ruby 버전 확인
    local ruby_version
    ruby_version=$(ruby -v | cut -d' ' -f2) || {
        error "Ruby 버전을 확인할 수 없습니다."
        return 1
    }
    
    if [ "$(version_compare "$ruby_version" "$MIN_RUBY_VERSION")" -lt 0 ]; then
        error "Ruby $MIN_RUBY_VERSION 이상이 필요합니다. 현재 버전: $ruby_version"
        error "다음 명령어로 설치해주세요: brew install ruby"
        return 1
    }
    
    info "CocoaPods 버전: $pod_version (Ruby: $ruby_version)"
    return 0
}

# 플랫폼 선택 메뉴
select_platform() {
    local selected=0
    while [ "$selected" -eq 0 ]; do
        clear
        echo "============================================"
        echo "          모바일 앱 실행 메뉴              "
        echo "============================================"
        echo "1) iOS 시뮬레이터에서 실행"
        echo "2) Android 에뮬레이터에서 실행"
        echo "3) 종료"
        echo "============================================"
        echo -n "선택해주세요 (1-3): "
        
        read -r choice
        case "$choice" in
            1|2)
                selected=1
                return "$choice"
                ;;
            3)
                info "프로그램을 종료합니다."
                exit 0
                ;;
            *)
                error "잘못된 선택입니다. 1-3 사이의 숫자를 선택해주세요."
                sleep 2
                ;;
        esac
    done
}

# Android 에뮬레이터 선택 메뉴
select_emulator() {
    local emulator_list
    emulator_list=$(emulator -list-avds) || {
        error "에뮬레이터 목록을 가져오는데 실패했습니다."
        return 1
    }
    
    if [ -z "$emulator_list" ]; then
        error "사용 가능한 Android 에뮬레이터가 없습니다."
        info "Android Studio를 실행하여 에뮬레이터를 생성해주세요."
        return 1
    }
    
    clear
    echo "============================================"
    echo "        Android 에뮬레이터 선택            "
    echo "============================================"
    local i=1
    local avds=()
    while IFS= read -r avd; do
        echo "$i) $avd"
        avds+=("$avd")
        i=$((i + 1))
    done <<< "$emulator_list"
    echo "$i) 취소"
    echo "============================================"
    echo -n "에뮬레이터를 선택해주세요 (1-$i): "
    
    local choice
    read -r choice
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$i" ]; then
        error "잘못된 선택입니다."
        return 1
    fi
    
    if [ "$choice" -eq "$i" ]; then
        info "작업을 취소합니다."
        exit 0
    fi
    
    echo "${avds[$((choice - 1))]}"
    return 0
}

# iOS 시뮬레이터 선택 메뉴
select_simulator() {
    local simulator_list
    simulator_list=$(xcrun simctl list devices available -j | jq -r '.devices | to_entries[] | select(.key | contains("iOS")) | .value[] | select(.isAvailable==true) | "\(.name) (\(.udid))"') || {
        error "시뮬레이터 목록을 가져오는데 실패했습니다."
        return 1
    }
    
    if [ -z "$simulator_list" ]; then
        error "사용 가능한 iOS 시뮬레이터가 없습니다."
        info "Xcode에서 시뮬레이터를 설치해주세요."
        return 1
    }
    
    clear
    echo "============================================"
    echo "          iOS 시뮬레이터 선택              "
    echo "============================================"
    local i=1
    local devices=()
    local udids=()
    while IFS= read -r device; do
        echo "$i) $device"
        devices+=("$device")
        udids+=("$(echo "$device" | sed -n 's/.*(\(.*\))/\1/p')")
        i=$((i + 1))
    done <<< "$simulator_list"
    echo "$i) 취소"
    echo "============================================"
    echo -n "시뮬레이터를 선택해주세요 (1-$i): "
    
    local choice
    read -r choice
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$i" ]; then
        error "잘못된 선택입니다."
        return 1
    fi
    
    if [ "$choice" -eq "$i" ]; then
        info "작업을 취소합니다."
        exit 0
    fi
    
    echo "${udids[$((choice - 1))]}"
    return 0
}

# 시스템 상태 체크
check_system_status() {
    info "시스템 상태를 확인합니다..."
    
    # 시스템 파일 접근 권한 확인
    if [ ! -w "/tmp" ]; then
        error "/tmp 디렉토리에 쓰기 권한이 없습니다."
        return 1
    fi
    
    # CPU 부하 확인
    local cpu_load
    if cpu_load=$(sysctl -n vm.loadavg 2>/dev/null | awk '{print $2}'); then
        if (( $(echo "$cpu_load > 4.0" | bc -l) )); then
            warn "시스템 부하가 높습니다 (부하: $cpu_load). 빌드 성능이 저하될 수 있습니다."
        fi
    fi
    
    # 디스크 공간 확인
    local available_space
    if available_space=$(df -k . | awk 'NR==2 {print $4}'); then
        if [ "$available_space" -lt "$MIN_DISK_SPACE" ]; then
            error "빌드를 위한 디스크 공간이 부족합니다. 최소 1GB 필요 (현재 가용: $((available_space/1024))MB)"
            return 1
        fi
    else
        warn "디스크 공간을 확인할 수 없습니다."
    fi
    
    # 메모리 확인
    local available_memory
    if [ -f "/proc/meminfo" ]; then
        available_memory=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
        if [ "$available_memory" -lt "$MIN_MEMORY" ]; then
            error "빌드를 위한 메모리가 부족합니다. 최소 2GB 필요 (현재 가용: $((available_memory/1024))MB)"
            return 1
        fi
    elif available_memory=$(sysctl -n hw.memsize 2>/dev/null); then
        local free_memory=$((available_memory/1024))
        if [ "$free_memory" -lt "$MIN_MEMORY" ]; then
            error "빌드를 위한 메모리가 부족합니다. 최소 2GB 필요 (현재 가용: $((free_memory/1024))MB)"
            return 1
        fi
    else
        warn "메모리 상태를 확인할 수 없습니다."
    fi

    # 네트워크 연결 확인
    if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        if ! ping -c 1 1.1.1.1 >/dev/null 2>&1; then
            error "인터넷 연결을 확인할 수 없습니다."
            return 1
        fi
    fi
    
    # 필수 디렉토리 권한 확인
    local required_dirs=("$HOME/.npm" "$HOME/.gradle" "$HOME/Library/Caches")
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            if ! mkdir -p "$dir" 2>/dev/null; then
                error "'$dir' 디렉토리를 생성할 수 없습니다."
                return 1
            fi
        elif [ ! -w "$dir" ]; then
            error "'$dir' 디렉토리에 쓰기 권한이 없습니다."
            return 1
        fi
    done
    
    return 0
}

# 프로세스 중복 실행 방지
check_duplicate_process() {
    local count
    count=$(pgrep -f "$(basename "$0")" | wc -l)
    if [ "$count" -gt 2 ]; then  # 현재 프로세스와 pgrep 자신을 고려
        error "이 스크립트가 이미 실행 중입니다."
        return 1
    fi
    return 0
}

# 메인 함수
main() {
    # 스크립트 시작 시간 기록
    local start_time
    start_time=$(date +%s)
    info "스크립트 실행을 시작합니다..."
    
    # 중복 실행 체크
    if ! check_duplicate_process; then
        exit 1
    fi

    # 시스템 상태 확인
    if ! check_system_status; then
        exit 1
    fi

    # 시스템 요구사항 확인
    info "시스템 요구사항을 확인합니다..."
    
    if ! check_required_commands; then
        exit 1
    fi
    
    # 시작 전 현재 디렉토리 저장
    initial_dir=$(pwd) || {
        error "현재 디렉토리를 확인할 수 없습니다."
        exit 1
    }
    
    # 프로젝트 디렉토리 검증
    if [ ! -f "package.json" ]; then
        error "package.json을 찾을 수 없습니다. 올바른 프로젝트 디렉토리인지 확인해주세요."
        error "현재 디렉토리: $PWD"
        exit 1
    fi
    
    # package.json 검증
    if ! jq . "package.json" >/dev/null 2>&1; then
        error "package.json 파일이 유효한 JSON 형식이 아닙니다."
        exit 1
    fi
    
    # expo 프로젝트 확인
    if ! grep -q '"expo":' "package.json"; then
        error "이 프로젝트는 Expo 프로젝트가 아닙니다."
        exit 1
    fi

    # 프로젝트 이름 추출
    local project_name
    project_name=$(node -e "console.log(require('./package.json').name || '')" 2>/dev/null)
    if [ -z "$project_name" ]; then
        warn "package.json에서 프로젝트 이름을 찾을 수 없습니다."
        project_name="expo-project"
    fi
    info "프로젝트: $project_name"

    # 실행 시간 체크
    if ! check_timeout; then
        exit 1
    fi

    # 공통 환경 체크
    if ! check_node; then
        exit 1
    fi

    # expo-cli 설치 확인
    if ! npm list -g expo-cli &> /dev/null; then
        info "expo-cli를 설치합니다..."
        if ! npm install -g expo-cli; then
            error "expo-cli 설치에 실패했습니다."
            exit 1
        fi
    fi

    # 의존성 패키지 설치
    info "필요한 패키지를 설치합니다..."
    if ! npm install; then
        error "패키지 설치에 실패했습니다. node_modules를 삭제하고 다시 시도해보세요:"
        error "rm -rf node_modules && npm install"
        exit 1
    fi

    # 플랫폼 선택
    local platform_choice
    if ! platform_choice=$(select_platform); then
        exit 1
    fi

    case $platform_choice in
        1)
            info "iOS 빌드를 시작합니다..."
            if ! setup_ios_env || ! check_ios_env; then
                error "iOS 환경 설정에 실패했습니다."
                exit 1
            fi
            
            if [ ! -d "ios" ]; then
                error "ios 디렉토리를 찾을 수 없습니다. 다음 명령어로 프로젝트를 eject 해주세요:"
                error "expo eject"
                exit 1
            fi
            
            if ! cd ios; then
                error "iOS 프로젝트 디렉토리로 이동할 수 없습니다."
                exit 1
            fi

            info "CocoaPods 의존성을 설치합니다..."
            if ! pod install; then
                error "CocoaPods 설치에 실패했습니다. 다음을 시도해보세요:"
                error "pod repo update && pod install"
                exit 1
            fi

            if ! cd ..; then
                error "프로젝트 루트 디렉토리로 이동할 수 없습니다."
                exit 1
            fi
            
            # 시뮬레이터 선택
            local simulator_udid
            if ! simulator_udid=$(select_simulator); then
                exit 1
            fi
            
            info "iOS 앱을 빌드하고 실행합니다..."
            if ! npx expo run:ios --device "$simulator_udid"; then
                error "iOS 빌드에 실패했습니다. 로그를 확인해주세요."
                exit 1
            fi
            ;;
        2)
            info "Android 빌드를 시작합니다..."
            if ! setup_android_env; then
                error "Android 환경 설정에 실패했습니다."
                exit 1
            fi
            
            if [ ! -d "android" ]; then
                error "android 디렉토리를 찾을 수 없습니다. 다음 명령어로 프로젝트를 eject 해주세요:"
                error "expo eject"
                exit 1
            fi
            
            # 에뮬레이터 선택
            local emulator_name
            if ! emulator_name=$(select_emulator); then
                exit 1
            fi
            
            # 에뮬레이터 시작
            info "에뮬레이터를 시작합니다: $emulator_name"
            emulator -avd "$emulator_name" &
            emulator_pid=$!
            
            # 에뮬레이터 부팅 대기
            info "에뮬레이터가 시작될 때까지 기다립니다..."
            local counter=0
            while ! adb shell getprop sys.boot_completed &> /dev/null; do
                sleep 1
                counter=$((counter + 1))
                if [ "$counter" -ge "$MAX_WAIT_TIME" ]; then
                    error "에뮬레이터 시작 시간이 초과되었습니다."
                    exit 1
                fi
                if ! kill -0 "$emulator_pid" 2>/dev/null; then
                    error "에뮬레이터 프로세스가 종료되었습니다."
                    exit 1
                fi
            done
            
            if ! cd android; then
                error "Android 프로젝트 디렉토리로 이동할 수 없습니다."
                exit 1
            fi

            if [ -f "./gradlew" ]; then
                info "Gradle 빌드를 초기화합니다..."
                chmod +x ./gradlew
                if ! ./gradlew clean; then
                    error "Gradle clean에 실패했습니다. 다음을 시도해보세요:"
                    error "./gradlew --stop && ./gradlew clean"
                    exit 1
                fi
            else
                error "Gradle wrapper를 찾을 수 없습니다. 다음 명령어로 재생성해주세요:"
                error "gradle wrapper"
                exit 1
            fi

            if ! cd ..; then
                error "프로젝트 루트 디렉토리로 이동할 수 없습니다."
                exit 1
            fi
            
            info "Android 앱을 빌드하고 실행합니다..."
            if ! npx expo run:android; then
                error "Android 빌드에 실패했습니다. 로그를 확인해주세요."
                exit 1
            fi
            ;;
    esac

    info "빌드가 완료되었습니다!"
}

# 스크립트 실행
main
