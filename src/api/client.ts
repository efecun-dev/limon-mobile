import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  SERVER_URL: '@limon_server_url',
  SERVER_KEY: '@limon_server_key',
  AUTH_TOKEN: '@limon_auth_token',
  USER_DATA: '@limon_user_data',
  ACTIVE_BRANCH: '@limon_active_branch',
};

// Varsayılan Sunucu Adresi (Yerel ağ ve VPS için dinamik)
export const DEFAULT_SERVER_URL = 'http://192.168.1.116:3001';
export const DEFAULT_SERVER_KEY = 'limon_sec_k98f234_main_server_key_2026';

let currentServerUrl = DEFAULT_SERVER_URL;
let currentToken: string | null = null;
let currentServerKey: string = DEFAULT_SERVER_KEY;

// Axios instance oluşturucu
export const apiClient: AxiosInstance = axios.create({
  baseURL: currentServerUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Limon-Client': 'Expo-Mobile',
    'X-Client-Version': '1.0.0',
  },
});

// Ayarları belleğe ve Axios'a yükle
export async function initializeApiClient(): Promise<{ serverUrl: string; token: string | null; serverKey: string }> {
  try {
    const [storedUrl, storedToken, storedKey] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL),
      AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.SERVER_KEY),
    ]);

    if (storedUrl) {
      currentServerUrl = storedUrl.replace(/\/+$/, ''); // Sondaki slash'ı temizle
    }
    if (storedToken) {
      currentToken = storedToken;
    }
    if (storedKey) {
      currentServerKey = storedKey;
    }

    apiClient.defaults.baseURL = currentServerUrl;
  } catch (error) {
    console.warn('API istemcisi başlatılırken depolama okuma hatası:', error);
  }

  return { serverUrl: currentServerUrl, token: currentToken, serverKey: currentServerKey };
}

// Dinamik Sunucu URL güncelleme (VPS IP değiştirildiğinde çağrılır)
export async function updateServerConfig(newUrl: string, newKey?: string) {
  const cleanUrl = newUrl.trim().replace(/\/+$/, '');
  currentServerUrl = cleanUrl;
  apiClient.defaults.baseURL = cleanUrl;
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);

  if (newKey !== undefined) {
    currentServerKey = newKey.trim();
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_KEY, currentServerKey);
  }
}

// Token güncelleme
export async function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }
}

// Request Interceptor: Her isteğe Token ve Server Key ekle
apiClient.interceptors.request.use(
  async (config) => {
    // Dinamik baseURL kontrolü
    if (!config.baseURL || config.baseURL === DEFAULT_SERVER_URL) {
      const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      if (storedUrl) {
        config.baseURL = storedUrl.replace(/\/+$/, '');
      }
    }

    // Token
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }

    // X-Server-Key
    if (currentServerKey) {
      config.headers['X-Server-Key'] = currentServerKey;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 kontrolü ve standart hata mesajı
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Oturum süresi dolmuş veya yetkisiz
      console.warn('Yetkisiz istek (401). Oturum kontrol edilmeli.');
    }
    return Promise.reject(error);
  }
);
