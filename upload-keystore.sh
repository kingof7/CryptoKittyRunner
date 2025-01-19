#!/bin/bash

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 로깅 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 키스토어 정보
KEYSTORE_PATH="android/app/upload-keystore.jks"
KEY_ALIAS="upload"
KEYSTORE_PASSWORD=""
KEY_PASSWORD=""

# 키스토어 생성 함수
create_keystore() {
    # 이미 존재하는 키스토어 확인
    if [ -f "$KEYSTORE_PATH" ]; then
        log_warn "키스토어가 이미 존재합니다: $KEYSTORE_PATH"
        read -p "기존 키스토어를 덮어쓰시겠습니까? (y/N): " overwrite
        if [ "$overwrite" != "y" ]; then
            log_info "키스토어 생성을 취소합니다."
            return 0
        fi
    fi

    # 디렉토리 생성
    mkdir -p "$(dirname "$KEYSTORE_PATH")"

    # 키스토어 비밀번호 입력
    while [ -z "$KEYSTORE_PASSWORD" ]; do
        read -s -p "키스토어 비밀번호를 입력하세요 (최소 6자): " KEYSTORE_PASSWORD
        echo
        if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
            log_error "비밀번호는 최소 6자 이상이어야 합니다."
            KEYSTORE_PASSWORD=""
            continue
        fi
        read -s -p "키스토어 비밀번호를 다시 입력하세요: " KEYSTORE_PASSWORD_CONFIRM
        echo
        if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
            log_error "비밀번호가 일치하지 않습니다."
            KEYSTORE_PASSWORD=""
        fi
    done

    # 키 비밀번호 입력
    while [ -z "$KEY_PASSWORD" ]; do
        read -s -p "키 비밀번호를 입력하세요 (최소 6자): " KEY_PASSWORD
        echo
        if [ ${#KEY_PASSWORD} -lt 6 ]; then
            log_error "비밀번호는 최소 6자 이상이어야 합니다."
            KEY_PASSWORD=""
            continue
        fi
        read -s -p "키 비밀번호를 다시 입력하세요: " KEY_PASSWORD_CONFIRM
        echo
        if [ "$KEY_PASSWORD" != "$KEY_PASSWORD_CONFIRM" ]; then
            log_error "비밀번호가 일치하지 않습니다."
            KEY_PASSWORD=""
        fi
    done

    # 개발자 정보 입력
    read -p "이름을 입력하세요: " developer_name
    read -p "조직 단위를 입력하세요: " organizational_unit
    read -p "조직명을 입력하세요: " organization
    read -p "도시를 입력하세요: " city
    read -p "주/도를 입력하세요: " state
    read -p "국가 코드를 입력하세요 (예: KR): " country_code

    # 키스토어 생성
    log_info "키스토어 생성 중..."
    keytool -genkeypair \
        -v \
        -keystore "$KEYSTORE_PATH" \
        -alias "$KEY_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=$developer_name, OU=$organizational_unit, O=$organization, L=$city, ST=$state, C=$country_code" \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEY_PASSWORD"

    if [ $? -eq 0 ]; then
        log_info "키스토어가 성공적으로 생성되었습니다: $KEYSTORE_PATH"
        
        # gradle.properties 업데이트
        update_gradle_properties
        
        # 키스토어 정보 백업
        backup_keystore_info
    else
        log_error "키스토어 생성에 실패했습니다."
        return 1
    fi
}

# gradle.properties 업데이트
update_gradle_properties() {
    local properties_file="android/gradle.properties"
    
    log_info "gradle.properties 업데이트 중..."
    
    # 기존 설정 백업
    if [ -f "$properties_file" ]; then
        cp "$properties_file" "${properties_file}.backup"
    fi
    
    # 키스토어 설정 추가/업데이트
    {
        echo "MYAPP_UPLOAD_STORE_FILE=upload-keystore.jks"
        echo "MYAPP_UPLOAD_KEY_ALIAS=$KEY_ALIAS"
        echo "MYAPP_UPLOAD_STORE_PASSWORD=$KEYSTORE_PASSWORD"
        echo "MYAPP_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD"
    } >> "$properties_file"
    
    log_info "gradle.properties가 업데이트되었습니다."
}

# 키스토어 정보 백업
backup_keystore_info() {
    local backup_dir="keystore_backup_$(date +%Y%m%d_%H%M%S)"
    local info_file="$backup_dir/keystore_info.txt"
    
    log_info "키스토어 정보 백업 중..."
    
    mkdir -p "$backup_dir"
    cp "$KEYSTORE_PATH" "$backup_dir/"
    
    {
        echo "키스토어 정보"
        echo "생성일자: $(date)"
        echo "키스토어 경로: $KEYSTORE_PATH"
        echo "키 별칭: $KEY_ALIAS"
        echo "유효기간: 10000일"
        echo "주의: 이 파일은 안전한 곳에 보관하세요!"
    } > "$info_file"
    
    log_info "키스토어 정보가 백업되었습니다: $backup_dir"
    log_warn "중요: 키스토어 파일과 정보를 안전한 곳에 보관하세요!"
}

# 메인 함수
main() {
    log_info "Android 릴리즈 키스토어 생성 도구"
    
    # Java 확인
    if ! command -v java >/dev/null 2>&1; then
        log_error "Java가 설치되어 있지 않습니다."
        log_error "https://adoptopenjdk.net/ 에서 Java를 설치해주세요."
        exit 1
    fi
    
    # keytool 확인
    if ! command -v keytool >/dev/null 2>&1; then
        log_error "keytool을 찾을 수 없습니다."
        log_error "JDK가 올바르게 설치되어 있는지 확인해주세요."
        exit 1
    fi
    
    create_keystore
}

# 스크립트 실행
main
