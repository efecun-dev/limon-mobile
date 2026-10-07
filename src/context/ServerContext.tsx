import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiClient,
  STORAGE_KEYS,
  DEFAULT_SERVER_URL,
  DEFAULT_SERVER_KEY,
  updateServerConfig,
  initializeApiClient,
} from '../api/client';
import { healthService } from '../api/services';

interface ServerContextType {
  serverUrl: string;
  serverKey: string;
  isConnected: boolean | null;
  latencyMs: number | null;
  isChecking: boolean;
  saveConfig: (url: string, key: string) => Promise<boolean>;
  testConnection: (customUrl?: string, customKey?: string) => Promise<{ success: boolean; latency: number; error?: string }>;
}

const ServerContext = createContext<ServerContextType>({} as ServerContextType);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [serverKey, setServerKey] = useState<string>(DEFAULT_SERVER_KEY);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    async function loadConfig() {
      const cfg = await initializeApiClient();
      setServerUrl(cfg.serverUrl);
      setServerKey(cfg.serverKey);
      // İlk açılışta bağlantıyı dene
      testConnection(cfg.serverUrl, cfg.serverKey);
    }
    loadConfig();
  }, []);

  const testConnection = async (targetUrl?: string, targetKey?: string) => {
    setIsChecking(true);
    const start = Date.now();
    try {
      const urlToTest = (targetUrl || serverUrl).trim().replace(/\/+$/, '');
      const keyToTest = (targetKey || serverKey).trim();

      const response = await apiClient.get('/api/health', {
        baseURL: urlToTest,
        headers: {
          'X-Server-Key': keyToTest,
        },
        timeout: 7000,
      });

      const elapsed = Date.now() - start;
      const isHealthy =
        response.status === 200 &&
        (response.data?.status === 'healthy' ||
          response.data?.status === 'ok' ||
          response.data?.service);

      if (isHealthy) {
        setIsConnected(true);
        setLatencyMs(elapsed);
        setIsChecking(false);
        return { success: true, latency: elapsed };
      } else {
        setIsConnected(false);
        setLatencyMs(null);
        setIsChecking(false);
        return { success: false, latency: elapsed, error: 'Sunucu beklenmeyen durum döndürdü.' };
      }
    } catch (err: any) {
      const elapsed = Date.now() - start;
      setIsConnected(false);
      setLatencyMs(null);
      setIsChecking(false);
      return {
        success: false,
        latency: elapsed,
        error: err.response?.data?.message || err.message || 'Sunucuya bağlanılamadı.',
      };
    }
  };

  const saveConfig = async (newUrl: string, newKey: string): Promise<boolean> => {
    try {
      const cleanUrl = newUrl.trim().replace(/\/+$/, '');
      const cleanKey = newKey.trim();

      await updateServerConfig(cleanUrl, cleanKey);
      setServerUrl(cleanUrl);
      setServerKey(cleanKey);

      // Yeni adresle test et
      const testResult = await testConnection(cleanUrl, cleanKey);
      return testResult.success;
    } catch {
      return false;
    }
  };

  return (
    <ServerContext.Provider
      value={{
        serverUrl,
        serverKey,
        isConnected,
        latencyMs,
        isChecking,
        saveConfig,
        testConnection,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => useContext(ServerContext);
