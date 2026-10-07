import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, setAuthToken } from '../api/client';
import { authService } from '../api/services';
import { UserProfile } from '../types/api';

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
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('all');
  const [activeBranchName, setActiveBranchNameState] = useState<string>('Tüm Şubeler');

  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUser, storedBranch] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH),
        ]);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          await setAuthToken(storedToken);
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

  const setActiveBranch = (branchId: string, branchName: string) => {
    setActiveBranchIdState(branchId);
    setActiveBranchNameState(branchName);
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH, JSON.stringify({ id: branchId, name: branchName })).catch(() => {});
  };

  const login = async (credentials: { username?: string; userId?: string; password: string }) => {
    try {
      const response = await authService.login(credentials);

      if (response.success && response.token && response.user) {
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
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
