import { Platform } from 'react-native';
import KakaoLogin from '@react-native-seoul/kakao-login';

// 카카오 앱 키 설정
const KAKAO_NATIVE_APP_KEY = '657bc20b522ec27ef27fafed67ca525e';  // 네이티브 앱 키
const KAKAO_REST_API_KEY = '73b409e1c9c45a0bc98b9268731e32c0'; // REST API 키
const KAKAO_JS_APP_KEY = '8ee2179bca0021adf8c6282335052b58';  // JavaScript 키
const KAKAO_ADMIN_KEY = 'b1630e22152b4e0fadddc89ce0928636'; // Admin 키

// 리다이렉트 URI 설정
const REDIRECT_URI = 'http://localhost:8081/game';  // 콜백 URI

class KakaoLoginService {
  static async login() {
    console.log('현재 플랫폼:', Platform.OS);  // 플랫폼 체크 로그

    // window 객체가 있는지 확인하여 웹 환경 체크
    const isWeb = typeof window !== 'undefined';
    console.log('웹 환경 여부:', isWeb);

    if (isWeb) {
      // 현재 URL이 콜백 URL인지 확인
      if (window.location.pathname === '/oauth/callback/kakao') {
        // 인증 코드 확인
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('인증 코드를 받지 못했습니다.');
        }

        // 인증 코드를 액세스 토큰으로 교환
        try {
          const response = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: KAKAO_REST_API_KEY,
              redirect_uri: REDIRECT_URI,
              code: code,
            }).toString(),
          });

          if (!response.ok) {
            throw new Error('토큰 교환 실패');
          }

          const data = await response.json();
          const token = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          };

          // 토큰 저장
          localStorage.setItem('kakao_access_token', token.accessToken);
          localStorage.setItem('kakao_refresh_token', token.refreshToken);

          // React Navigation이 처리할 수 있도록 history API 사용
          window.history.replaceState(
            { type: 'kakao_login_success' },
            '',
            '/game'
          );

          // React Navigation 강제 새로고침
          window.dispatchEvent(new Event('popstate'));

          return token;
        } catch (error) {
          console.error('카카오 토큰 교환 실패:', error);
          throw error;
        }
      } else {
        // 카카오 로그인 페이지로 리다이렉트
        const loginUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
        console.log('카카오 로그인 URL:', loginUrl);

        // window.location.href 대신 window.location.assign 사용
        window.location.assign(loginUrl);
        // 또는 window.open 사용
        // window.open(loginUrl, '_self');

        return null;
      }
    }

    try {
      const token = await KakaoLogin.login();
      return token;
    } catch (error) {
      console.error('카카오 로그인 실패:', error);
      throw error;
    }
  }

  static async getProfile() {
    console.log('현재 플랫폼:', Platform.OS);  // 플랫폼 체크 로그

    // window 객체가 있는지 확인하여 웹 환경 체크
    const isWeb = typeof window !== 'undefined';
    console.log('웹 환경 여부:', isWeb);

    if (isWeb) {
      try {
        const token = await this.getAccessToken();
        if (!token) {
          throw new Error('액세스 토큰이 없습니다.');
        }

        const response = await fetch('https://kapi.kakao.com/v2/user/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('프로필 조회 실패');
        }

        const data = await response.json();
        return {
          id: data.id,
          email: data.kakao_account?.email,
          nickname: data.properties?.nickname,
          profileImageUrl: data.properties?.profile_image,
        };
      } catch (error) {
        console.error('카카오 프로필 가져오기 실패:', error);
        throw error;
      }
    }

    try {
      const profile = await KakaoLogin.getProfile();
      return profile;
    } catch (error) {
      console.error('카카오 프로필 가져오기 실패:', error);
      throw error;
    }
  }

  static async logout() {
    console.log('현재 플랫폼:', Platform.OS);  // 플랫폼 체크 로그

    // window 객체가 있는지 확인하여 웹 환경 체크
    const isWeb = typeof window !== 'undefined';
    console.log('웹 환경 여부:', isWeb);

    if (isWeb) {
      try {
        const token = await this.getAccessToken();
        if (!token) {
          return;
        }

        await fetch('https://kapi.kakao.com/v1/user/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // 로컬 스토리지에서 토큰 제거
        localStorage.removeItem('kakao_access_token');
        localStorage.removeItem('kakao_refresh_token');
      } catch (error) {
        console.error('카카오 로그아웃 실패:', error);
        throw error;
      }
    }

    try {
      await KakaoLogin.logout();
    } catch (error) {
      console.error('카카오 로그아웃 실패:', error);
      throw error;
    }
  }

  static async getAccessToken() {
    console.log('현재 플랫폼:', Platform.OS);  // 플랫폼 체크 로그

    // window 객체가 있는지 확인하여 웹 환경 체크
    const isWeb = typeof window !== 'undefined';
    console.log('웹 환경 여부:', isWeb);

    if (isWeb) {
      // localStorage에서 토큰 가져오기
      return localStorage.getItem('kakao_access_token');
    }

    try {
      const token = await KakaoLogin.getAccessToken();
      return token;
    } catch (error) {
      console.error('카카오 액세스 토큰 가져오기 실패:', error);
      throw error;
    }
  }

  static async refreshAccessToken() {
    console.log('현재 플랫폼:', Platform.OS);  // 플랫폼 체크 로그

    // window 객체가 있는지 확인하여 웹 환경 체크
    const isWeb = typeof window !== 'undefined';
    console.log('웹 환경 여부:', isWeb);

    if (isWeb) {
      try {
        const refreshToken = localStorage.getItem('kakao_refresh_token');
        if (!refreshToken) {
          throw new Error('리프레시 토큰이 없습니다.');
        }

        const response = await fetch('https://kauth.kakao.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: KAKAO_REST_API_KEY,
            refresh_token: refreshToken,
          }).toString(),
        });

        if (!response.ok) {
          throw new Error('토큰 갱신 실패');
        }

        const data = await response.json();
        localStorage.setItem('kakao_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('kakao_refresh_token', data.refresh_token);
        }

        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
        };
      } catch (error) {
        console.error('카카오 토큰 갱신 실패:', error);
        throw error;
      }
    }

    try {
      // 네이티브에서는 getAccessToken으로 토큰을 갱신
      const token = await KakaoLogin.getAccessToken();
      return {
        accessToken: token,
        refreshToken: token, // 네이티브에서는 refreshToken이 따로 없음
      };
    } catch (error) {
      console.error('카카오 액세스 토큰 갱신 실패:', error);
      throw error;
    }
  }
}

export default KakaoLoginService;
