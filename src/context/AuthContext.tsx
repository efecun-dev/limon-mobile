import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, setAuthToken, setOnUnauthorizedHandler } from '../api/client';
import { authService } from '../api/services';
import { UserProfile } from '../types/api';

function decodeBase64(str: string): string {
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(
        atob(str)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    }
  } catch {}

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (
    let bc = 0, bs = 0, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeBase64(base64);
    const payload = JSON.parse(jsonStr);
    if (!payload.exp) return false;
    // 5 saniye tolerans payı ile kontrol
    return Date.now() >= payload.exp * 1000 - 5000;
  } catch {
    return false;
  }
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeBranchId: string;
  activeBranchName: string;
  setActiveBranch: (branchId: string, branchName: string) => void;
  login: (credentials: { username?: string; userId?: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('all');
  const [activeBranchName, setActiveBranchNameState] = useState<string>('Tüm Şubeler');
  const sessionExpiredAlertShown = useRef(false);

  const handleSessionExpired = useCallback(async () => {
    setUser(null);
    setToken(null);
    await setAuthToken(null);
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA]);
    } catch {}

    if (!sessionExpiredAlertShown.current) {
      sessionExpiredAlertShown.current = true;
      Alert.alert(
        'Oturum Süresi Doldu',
        'Oturumunuzun süresi dolduğu için giriş sayfasına yönlendirildiniz. Lütfen tekrar giriş yapın.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              sessionExpiredAlertShown.current = false;
            },
          },
        ]
      );
    }
  }, []);

  // API 401 yanıtları için dinleyiciyi bağla
  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      handleSessionExpired();
    });

    return () => {
      setOnUnauthorizedHandler(null);
    };
  }, [handleSessionExpired]);

  // İlk yüklemede saklanan oturumu doğrula
  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUser, storedBranch] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH),
        ]);

        if (storedToken && storedUser) {
          // Token süresi dolmuşsa doğrudan temizle ve giriş ekranında kal
          if (isTokenExpired(storedToken)) {
            console.warn('Saklanan token süresi dolmuş, oturum kapatılıyor.');
            await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA]);
            await setAuthToken(null);
          } else {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            await setAuthToken(storedToken);
          }
        }

        if (storedBranch) {
          const parsedBranch = JSON.parse(storedBranch);
          setActiveBranchIdState(parsedBranch.id || 'all');
          setActiveBranchNameState(parsedBranch.name || 'Tüm Şubeler');
        }
      } catch (err) {
        console.warn('Oturum bilgisi yüklenirken hata:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  // Düzenli aralıklarla (30 sn) ve uygulama ön plana geldiğinde token süresini denetle
  useEffect(() => {
    if (!token) return;

    const checkExpiration = () => {
      if (token && isTokenExpired(token)) {
        console.warn('Aktif token süresi doldu, oturum sonlandırılıyor.');
        handleSessionExpired();
      }
    };

    const interval = setInterval(checkExpiration, 30000);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkExpiration();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [token, handleSessionExpired]);

  const setActiveBranch = (branchId: string, branchName: string) => {
    setActiveBranchIdState(branchId);
    setActiveBranchNameState(branchName);
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH, JSON.stringify({ id: branchId, name: branchName })).catch(() => {});
  };

  const login = async (credentials: { username?: string; userId?: string; password: string }) => {
    try {
      const response = await authService.login(credentials);

      if (response.success && response.token && response.user) {
        sessionExpiredAlertShown.current = false;
        setToken(response.token);
        setUser(response.user);

        await setAuthToken(response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));

        // Eğer kullanıcının özel atanmış bir şubesi varsa onu aktif yap
        if (response.user.branchId && response.user.branch?.name) {
          setActiveBranch(response.user.branchId, response.user.branch.name);
        }

        return { success: true };
      }

      return {
        success: false,
        message: response.message || 'Kullanıcı adı veya şifre hatalı.',
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Giriş yapılırken sunucu hatası oluştu.';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {}
    setUser(null);
    setToken(null);
    await setAuthToken(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        activeBranchId,
        activeBranchName,
        setActiveBranch,
        login,
        logout,
        handleSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
