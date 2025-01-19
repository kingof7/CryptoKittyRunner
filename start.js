const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// OS 타입 확인
const platform = os.platform();

// 스크립트 실행 함수
function runScript() {
    try {
        if (platform === 'win32') {
            // Windows
            const batPath = path.join(__dirname, 'start.bat');
            if (fs.existsSync(batPath)) {
                execSync(`"${batPath}"`, { stdio: 'inherit' });
            } else {
                console.error('start.bat 파일을 찾을 수 없습니다.');
            }
        } else if (platform === 'darwin') {
            // macOS
            console.log('실행 환경을 선택하세요:');
            console.log('1. Expo 개발 서버 (웹)');
            console.log('2. 모바일 (iOS/Android)');
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('선택 (1 또는 2): ', (choice) => {
                readline.close();
                
                if (choice === '1') {
                    const shPath = path.join(__dirname, 'start.sh');
                    if (fs.existsSync(shPath)) {
                        execSync(`chmod +x "${shPath}"`, { stdio: 'inherit' });
                        execSync(`"${shPath}"`, { stdio: 'inherit' });
                    } else {
                        console.error('start.sh 파일을 찾을 수 없습니다.');
                    }
                } else if (choice === '2') {
                    const mobilePath = path.join(__dirname, 'start-mobile.sh');
                    if (fs.existsSync(mobilePath)) {
                        execSync(`chmod +x "${mobilePath}"`, { stdio: 'inherit' });
                        execSync(`"${mobilePath}"`, { stdio: 'inherit' });
                    } else {
                        console.error('start-mobile.sh 파일을 찾을 수 없습니다.');
                    }
                } else {
                    console.error('잘못된 선택입니다. 1 또는 2를 선택해주세요.');
                }
            });
        } else if (platform === 'linux') {
            // Linux
            console.log('실행 환경을 선택하세요:');
            console.log('1. Expo 개발 서버 (웹)');
            console.log('2. Android');
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('선택 (1 또는 2): ', (choice) => {
                readline.close();
                
                if (choice === '1') {
                    const shPath = path.join(__dirname, 'start.sh');
                    if (fs.existsSync(shPath)) {
                        execSync(`chmod +x "${shPath}"`, { stdio: 'inherit' });
                        execSync(`"${shPath}"`, { stdio: 'inherit' });
                    } else {
                        console.error('start.sh 파일을 찾을 수 없습니다.');
                    }
                } else if (choice === '2') {
                    const mobilePath = path.join(__dirname, 'start-mobile.sh');
                    if (fs.existsSync(mobilePath)) {
                        execSync(`chmod +x "${mobilePath}"`, { stdio: 'inherit' });
                        execSync(`"${mobilePath}"`, { stdio: 'inherit' });
                    } else {
                        console.error('start-mobile.sh 파일을 찾을 수 없습니다.');
                    }
                } else {
                    console.error('잘못된 선택입니다. 1 또는 2를 선택해주세요.');
                }
            });
        } else {
            console.error('지원하지 않는 운영체제입니다.');
        }
    } catch (error) {
        console.error('스크립트 실행 중 오류가 발생했습니다:', error);
    }
}

// 스크립트 실행
runScript();
