#!/bin/bash

# 엄격한 오류 처리 모드
set -euo pipefail
IFS=$'\n\t'

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 상수 정의
MIN_NODE_VERSION="14.0.0"
MIN_JAVA_VERSION="11"
REQUIRED_SPACE_MB=1024  # 1GB

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

# 버전 비교 함수
version_compare() {
    if [ "$1" = "$2" ]; then
        return 0
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
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

# 디스크 공간 확인
check_disk_space() {
    local available_space
    if available_space=$(df -m . | awk 'NR==2 {print $4}'); then
        if [ "$available_space" -lt "$REQUIRED_SPACE_MB" ]; then
            log_error "빌드에 필요한 디스크 공간이 부족합니다. 최소 ${REQUIRED_SPACE_MB}MB 필요 (현재: ${available_space}MB)"
            return 1
        fi
    else
        log_warn "디스크 공간을 확인할 수 없습니다."
    fi
}

# 필수 도구 확인
check_requirements() {
    log_info "필수 도구 확인 중..."
    
    # Node.js 버전 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되어 있지 않습니다."
        log_error "https://nodejs.org 에서 설치해주세요."
        exit 1
    fi
    
    local node_version
    node_version=$(node -v | cut -d'v' -f2)
    if ! version_compare "$node_version" "$MIN_NODE_VERSION"; then
        log_error "Node.js 버전이 너무 낮습니다. 최소 $MIN_NODE_VERSION 이상이 필요합니다. (현재: $node_version)"
        exit 1
    fi

    # Java 확인
    if ! command -v java &> /dev/null; then
        log_error "Java가 설치되어 있지 않습니다."
        log_error "brew install openjdk@$MIN_JAVA_VERSION 로 설치해주세요."
        exit 1
    fi
    
    local java_version
    java_version=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    if [ "$java_version" -lt "$MIN_JAVA_VERSION" ]; then
        log_error "Java 버전이 너무 낮습니다. 최소 $MIN_JAVA_VERSION 이상이 필요합니다. (현재: $java_version)"
        exit 1
    fi

    # Android SDK 확인
    if [ -z "${ANDROID_HOME:-}" ]; then
        log_error "ANDROID_HOME 환경변수가 설정되어 있지 않습니다."
        log_error "~/.zshrc 또는 ~/.bash_profile에 다음을 추가해주세요:"
        log_error "export ANDROID_HOME=\$HOME/Library/Android/sdk"
        exit 1
    fi
    
    # 필수 Android SDK 도구 확인
    local required_tools=("platform-tools" "build-tools" "platforms")
    for tool in "${required_tools[@]}"; do
        if [ ! -d "$ANDROID_HOME/$tool" ]; then
            log_error "Android SDK $tool가 설치되어 있지 않습니다."
            log_error "Android Studio의 SDK Manager에서 설치해주세요."
            exit 1
        fi
    done
    
    # Gradle 확인
    if [ ! -f "android/gradlew" ]; then
        log_error "Gradle wrapper를 찾을 수 없습니다."
        log_error "프로젝트를 Expo에서 eject 했는지 확인해주세요:"
        log_error "expo eject"
        exit 1
    fi
    
    # 디스크 공간 확인
    check_disk_space
}

# 프로젝트 구조 검증
validate_project_structure() {
    log_info "프로젝트 구조 검증 중..."
    
    # 필수 파일 확인
    local required_files=(
        "package.json"
        "app.json"
        "babel.config.js"
        "android/build.gradle"
        "android/app/build.gradle"
        "android/settings.gradle"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "필수 파일이 없습니다: $file"
            log_error "프로젝트가 올바르게 설정되어 있는지 확인해주세요."
            return 1
        fi
    done
    
    # android/app/build.gradle 검증
    if ! grep -q "applicationId" "android/app/build.gradle"; then
        log_error "android/app/build.gradle에 applicationId가 설정되어 있지 않습니다."
        return 1
    fi
}

# 네트워크 연결 확인
check_network() {
    log_info "네트워크 연결 확인 중..."
    
    local urls=(
        "https://registry.npmjs.org"
        "https://jcenter.bintray.com"
        "https://dl.google.com/android/repository"
    )
    
    for url in "${urls[@]}"; do
        if ! curl --silent --head "$url" > /dev/null; then
            log_error "다음 URL에 접근할 수 없습니다: $url"
            log_error "네트워크 연결을 확인해주세요."
            return 1
        fi
    done
}

# 의존성 검증
validate_dependencies() {
    log_info "의존성 검증 중..."
    
    # package.json 의존성 확인
    if ! npm list --json --depth=0 > /dev/null 2>&1; then
        log_error "Node.js 의존성에 문제가 있습니다."
        log_error "다음 명령어로 node_modules를 재설치해보세요:"
        log_error "rm -rf node_modules && npm install"
        return 1
    fi
    
    # Android 의존성 확인
    if [ -f "android/gradlew" ]; then
        cd android
        if ! ./gradlew dependencies > /dev/null 2>&1; then
            log_error "Android 의존성에 문제가 있습니다."
            cd ..
            return 1
        fi
        cd ..
    fi
}

# 빌드 환경 정리
clean_build_environment() {
    log_info "빌드 환경 정리 중..."
    
    # 이전 빌드 파일 정리
    rm -rf android/app/build
    rm -rf android/build
    rm -rf android/.gradle
    
    # 임시 파일 정리
    find . -name ".DS_Store" -delete
    find . -name "*.log" -delete
    
    # Gradle 캐시 정리
    if [ -f "android/gradlew" ]; then
        cd android
        ./gradlew clean
        cd ..
    fi
}

# app.json 설정 업데이트
update_app_json() {
    log_info "app.json 설정 업데이트 중..."
    
    local app_json="app.json"
    if [ ! -f "$app_json" ]; then
        log_error "app.json 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    # 버전코드 증가
    local version_code
    version_code=$(jq -r '.expo.android.versionCode // 1' "$app_json")
    version_code=$((version_code + 1))
    
    # app.json 업데이트
    jq --arg vc "$version_code" '.expo.android.versionCode = ($vc|tonumber)' "$app_json" > "$app_json.tmp"
    mv "$app_json.tmp" "$app_json"
    
    log_info "Android 버전 코드가 $version_code(으)로 업데이트되었습니다."
}

# package.json 업데이트
update_package_json() {
    log_info "package.json 업데이트 중..."
    
    # 현재 버전 확인
    local current_version
    current_version=$(node -e "console.log(require('./package.json').version || '1.0.0')")
    
    echo "현재 버전: $current_version"
    echo -n "새 버전을 입력하세요 (현재: $current_version, 형식: X.Y.Z): "
    read -r version
    
    # 버전 형식 검증
    if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "잘못된 버전 형식입니다. X.Y.Z 형식으로 입력해주세요."
        exit 1
    fi
    
    # 버전 비교
    if ! version_compare "$version" "$current_version"; then
        log_error "새 버전($version)이 현재 버전($current_version)보다 낮거나 같습니다."
        exit 1
    fi
    
    # package.json 업데이트
    if ! npm version "$version" --no-git-tag-version; then
        log_error "package.json 버전 업데이트 실패"
        exit 1
    fi
}

# 키스토어 생성 및 검증
create_keystore() {
    log_info "키스토어 설정 중..."
    
    local keystore_path="android/app/upload-keystore.jks"
    
    if [ ! -f "$keystore_path" ]; then
        log_info "새 키스토어를 생성합니다..."
        
        # 키스토어 정보 입력
        echo -n "키스토어 비밀번호를 입력하세요 (최소 6자): "
        read -rs keystore_password
        echo
        
        if [ ${#keystore_password} -lt 6 ]; then
            log_error "비밀번호는 최소 6자 이상이어야 합니다."
            exit 1
        fi
        
        echo -n "비밀번호를 한 번 더 입력하세요: "
        read -rs keystore_password_confirm
        echo
        
        if [ "$keystore_password" != "$keystore_password_confirm" ]; then
            log_error "비밀번호가 일치하지 않습니다."
            exit 1
        fi
        
        # 개발자 정보 입력
        echo "개발자 정보를 입력하세요:"
        echo -n "이름 (CN): "
        read -r dev_name
        echo -n "조직 단위 (OU): "
        read -r dev_ou
        echo -n "회사명 (O): "
        read -r dev_o
        echo -n "도시 (L): "
        read -r dev_l
        echo -n "주/도 (S): "
        read -r dev_s
        echo -n "국가 코드 (C, 예: KR): "
        read -r dev_c
        
        # 키스토어 디렉토리 생성
        mkdir -p "$(dirname "$keystore_path")"
        
        # 키스토어 생성
        if ! keytool -genkeypair \
            -v \
            -keystore "$keystore_path" \
            -keyalg RSA \
            -keysize 2048 \
            -validity 10000 \
            -alias upload \
            -storepass "$keystore_password" \
            -keypass "$keystore_password" \
            -dname "CN=$dev_name, OU=$dev_ou, O=$dev_o, L=$dev_l, S=$dev_s, C=$dev_c"; then
            log_error "키스토어 생성 실패"
            rm -f "$keystore_path"
            exit 1
        fi
        
        log_info "키스토어가 성공적으로 생성되었습니다: $keystore_path"
        log_warn "키스토어 비밀번호를 안전한 곳에 보관하세요!"
    else
        log_warn "키스토어가 이미 존재합니다. 기존 키스토어를 사용합니다."
        log_warn "키스토어를 분실하면 Play Store 업데이트가 불가능합니다!"
    fi
}

# gradle.properties 업데이트
update_gradle_properties() {
    log_info "gradle.properties 업데이트 중..."
    
    local props_file="android/gradle.properties"
    
    # 키스토어 비밀번호 입력
    echo -n "키스토어 비밀번호를 입력하세요: "
    read -rs keystore_password
    echo
    
    # 기존 설정 백업
    if [ -f "$props_file" ]; then
        cp "$props_file" "${props_file}.backup"
    fi
    
    # gradle.properties 업데이트
    {
        echo "# Gradle 설정"
        echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8"
        echo "org.gradle.parallel=true"
        echo "org.gradle.daemon=true"
        echo "android.useAndroidX=true"
        echo "android.enableJetifier=true"
        echo
        echo "# 릴리즈 키스토어 설정"
        echo "UPLOAD_STORE_FILE=upload-keystore.jks"
        echo "UPLOAD_KEY_ALIAS=upload"
        echo "UPLOAD_STORE_PASSWORD=$keystore_password"
        echo "UPLOAD_KEY_PASSWORD=$keystore_password"
    } > "$props_file"
    
    log_info "gradle.properties가 업데이트되었습니다."
}

# ProGuard 설정 확인
check_proguard() {
    log_info "ProGuard 설정 확인 중..."
    
    local proguard_file="android/app/proguard-rules.pro"
    
    if [ ! -f "$proguard_file" ]; then
        log_warn "ProGuard 설정 파일이 없습니다. 기본 설정을 생성합니다..."
        
        cat > "$proguard_file" << 'EOL'
# React Native ProGuard 규칙
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Expo 규칙
-keep class expo.modules.** { *; }
-keep class com.facebook.react.** { *; }

# 앱 특정 규칙
-keepattributes *Annotation*
-keepclassmembers class * {
    @org.greenrobot.eventbus.Subscribe <methods>;
}
-keep enum org.greenrobot.eventbus.ThreadMode { *; }

# Firebase (선택적)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# 기타 일반적인 규칙
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
EOL
        
        log_info "ProGuard 설정이 생성되었습니다."
    fi
}

# AAB 빌드
build_aab() {
    log_info "AAB 빌드 시작..."
    
    # 빌드 전 정리
    log_info "이전 빌드 정리 중..."
    rm -rf android/app/build
    
    # 의존성 설치
    log_info "의존성 설치 중..."
    npm install
    
    # 안드로이드 빌드
    cd android
    
    # gradlew 실행 권한 부여
    chmod +x gradlew
    
    # 릴리즈 빌드
    log_info "릴리즈 빌드 생성 중..."
    if ! ./gradlew clean bundleRelease; then
        log_error "빌드 실패"
        exit 1
    fi
    
    cd ..
    
    local aab_path="android/app/build/outputs/bundle/release/app-release.aab"
    if [ ! -f "$aab_path" ]; then
        log_error "AAB 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    log_info "빌드 완료!"
    log_info "AAB 파일 위치: $aab_path"
    log_info "AAB 파일 크기: $(ls -lh "$aab_path" | awk '{print $5}')"
}

# 백업 생성
create_backup() {
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="build_backup_${timestamp}"
    
    log_info "중요 파일 백업 중..."
    mkdir -p "$backup_dir"
    
    # 중요 파일 백업
    local important_files=(
        "package.json"
        "app.json"
        "android/app/build.gradle"
        "android/app/upload-keystore.jks"
        "android/gradle.properties"
    )
    
    for file in "${important_files[@]}"; do
        if [ -f "$file" ]; then
            local dir_path
            dir_path=$(dirname "$backup_dir/$file")
            mkdir -p "$dir_path"
            cp "$file" "$backup_dir/$file"
        fi
    done
    
    log_info "백업이 생성되었습니다: $backup_dir"
}

# 자동 복구 시도
attempt_auto_fix() {
    local error_type="$1"
    log_info "문제 해결 시도 중: $error_type"
    
    case "$error_type" in
        "node_modules")
            log_info "node_modules 재설치 중..."
            rm -rf node_modules
            rm -f package-lock.json
            npm install
            ;;
        "gradle")
            log_info "Gradle 캐시 정리 중..."
            cd android
            ./gradlew clean
            rm -rf .gradle
            ./gradlew --refresh-dependencies
            cd ..
            ;;
        "metro")
            log_info "Metro 캐시 정리 중..."
            rm -rf $TMPDIR/metro-*
            rm -rf $TMPDIR/haste-map-*
            ;;
        *)
            log_error "알 수 없는 오류 유형: $error_type"
            return 1
            ;;
    esac
}

# 메트로 번들러 설정 확인
check_metro_config() {
    log_info "Metro 번들러 설정 확인 중..."
    
    # metro.config.js 확인
    if [ ! -f "metro.config.js" ]; then
        log_warn "metro.config.js가 없습니다. 기본 설정을 생성합니다..."
        cat > metro.config.js << 'EOL'
const { getDefaultConfig } = require('@expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  
  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
  };

  return config;
})();
EOL
    fi
}

# 리소스 최적화 검사
check_resources() {
    log_info "리소스 최적화 검사 중..."
    
    # 이미지 최적화 확인
    local image_count
    image_count=$(find android/app/src/main/res -type f \( -name "*.png" -o -name "*.jpg" \) | wc -l)
    if [ "$image_count" -gt 0 ]; then
        log_warn "최적화되지 않은 이미지가 $image_count개 발견되었습니다."
        log_info "이미지 최적화를 권장합니다."
    fi
    
    # APK 크기 예측
    local res_size
    res_size=$(du -sm android/app/src/main/res | cut -f1)
    if [ "$res_size" -gt 100 ]; then
        log_warn "리소스 크기가 100MB를 초과합니다. 최적화가 필요할 수 있습니다."
    fi
}

# 빌드 후 검증
validate_build_output() {
    log_info "빌드 출력 검증 중..."
    
    local aab_path="android/app/build/outputs/bundle/release/app-release.aab"
    
    # AAB 파일 존재 확인
    if [ ! -f "$aab_path" ]; then
        log_error "AAB 파일을 찾을 수 없습니다: $aab_path"
        return 1
    fi
    
    # AAB 파일 크기 확인
    local aab_size
    aab_size=$(ls -l "$aab_path" | awk '{print $5}')
    if [ "$aab_size" -gt 150000000 ]; then
        log_warn "AAB 파일이 150MB를 초과합니다. Play Store 제한에 주의하세요."
    fi
    
    # 서명 확인
    if ! jarsigner -verify -verbose -certs "$aab_path" > /dev/null 2>&1; then
        log_error "AAB 파일 서명이 올바르지 않습니다."
        return 1
    fi
}

# 메인 함수
main() {
    log_info "Android 릴리즈 빌드 프로세스 시작..."
    
    # 백업 생성
    create_backup
    
    # 프로젝트 구조 검증
    if ! validate_project_structure; then
        log_error "프로젝트 구조 검증 실패"
        exit 1
    fi
    
    # 네트워크 연결 확인
    if ! check_network; then
        log_error "네트워크 연결 확인 실패"
        exit 1
    fi
    
    # 필수 요구사항 확인
    if ! check_requirements; then
        log_error "필수 요구사항 확인 실패"
        exit 1
    fi
    
    # 의존성 검증
    if ! validate_dependencies; then
        log_warn "의존성 문제 발견, 자동 복구 시도..."
        if ! attempt_auto_fix "node_modules"; then
            log_error "의존성 복구 실패"
            exit 1
        fi
    fi
    
    # Metro 설정 확인
    if ! check_metro_config; then
        log_error "Metro 설정 확인 실패"
        exit 1
    fi
    
    # 빌드 환경 정리
    if ! clean_build_environment; then
        log_error "빌드 환경 정리 실패"
        exit 1
    fi
    
    # 리소스 검사
    check_resources
    
    # app.json 업데이트
    if ! update_app_json; then
        log_error "app.json 업데이트 실패"
        exit 1
    fi
    
    # package.json 업데이트
    if ! update_package_json; then
        log_error "package.json 업데이트 실패"
        exit 1
    fi
    
    # 키스토어 생성
    if ! create_keystore; then
        log_error "키스토어 생성 실패"
        exit 1
    fi
    
    # gradle.properties 업데이트
    if ! update_gradle_properties; then
        log_error "gradle.properties 업데이트 실패"
        exit 1
    fi
    
    # ProGuard 설정 확인
    if ! check_proguard; then
        log_error "ProGuard 설정 확인 실패"
        exit 1
    fi
    
    # AAB 빌드
    if ! build_aab; then
        log_error "AAB 빌드 실패"
        if ! attempt_auto_fix "gradle"; then
            log_error "Gradle 복구 실패"
            exit 1
        fi
        # 다시 시도
        if ! build_aab; then
            log_error "재시도 후에도 빌드 실패"
            exit 1
        fi
    fi
    
    # 빌드 출력 검증
    if ! validate_build_output; then
        log_error "빌드 출력 검증 실패"
        exit 1
    fi
    
    log_info "빌드 프로세스가 성공적으로 완료되었습니다!"
    log_info "다음 단계:"
    echo "1. Google Play Console (https://play.google.com/console)에 접속"
    echo "2. 새 앱 만들기 또는 기존 앱 선택"
    echo "3. 앱 정보 준비:"
    echo "   - 앱 이름"
    echo "   - 간단한 설명 (80자 이내)"
    echo "   - 자세한 설명 (4000자 이내)"
    echo "   - 앱 아이콘 (512x512 PNG)"
    echo "   - 피처 그래픽 (1024x500 PNG)"
    echo "   - 스크린샷 (최소 2장)"
    echo "   - 개인정보처리방침 URL"
    echo "4. AAB 파일 업로드: android/app/build/outputs/bundle/release/app-release.aab"
    echo "5. 앱 출시 단계 선택:"
    echo "   - 내부 테스트"
    echo "   - 비공개 테스트"
    echo "   - 공개 테스트"
    echo "   - 프로덕션"
    
    # 중요 알림
    log_warn "중요: 키스토어 파일(android/app/upload-keystore.jks)을 안전한 곳에 백업하세요!"
    log_warn "키스토어를 분실하면 앱 업데이트가 불가능합니다."
    log_info "백업 디렉토리를 확인하세요: build_backup_$(date +%Y%m%d_%H%M%S)"
}

# 스크립트 실행
main
