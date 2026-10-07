import { apiClient } from './client';
import {
  BranchesApiResponse,
  OrdersApiResponse,
  StocksApiResponse,
  ClaimsApiResponse,
  BarcodeSearchResult,
  LoginApiResponse,
  UsersListApiResponse,
  HealthApiResponse,
  LevelsApiResponse,
} from '../types/api';

// ==========================================
// 1. KİMLİK DOĞRULAMA (AUTH) SERVİSLERİ
// ==========================================
export const authService = {
  // Kullanıcı Listesi (Hızlı Giriş Seçimi)
  async getUsers(): Promise<UsersListApiResponse> {
    const res = await apiClient.get<UsersListApiResponse>('/api/auth/users');
    return res.data;
  },

  // Giriş Yap (Username/UserId ve Şifre)
  async login(credentials: { username?: string; userId?: string; password: string }): Promise<LoginApiResponse> {
    const res = await apiClient.post<LoginApiResponse>('/api/auth/login', credentials);
    return res.data;
  },

  // Oturum Bilgisi
  async getMe(): Promise<{ success: boolean; user?: any }> {
    const res = await apiClient.get('/api/auth/me');
    return res.data;
  },

  // Çıkış
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Offline çıksın
    }
  },
};

// ==========================================
// 2. SİPARİŞLER SERVİSİ
// ==========================================
export const ordersService = {
  // Filtreli Sipariş Listesi
  async getOrders(params?: {
    storeId?: string;
    status?: string;
    orderNumber?: string;
    search?: string;
    page?: number;
    size?: number;
    fetchDays?: number;
  }): Promise<OrdersApiResponse> {
    const res = await apiClient.get<OrdersApiResponse>('/api/siparisler', { params });
    return res.data;
  },

  // Tüm Siparişlerin Toplu Özeti (Varsa)
  async getAllOrders(): Promise<OrdersApiResponse> {
    const res = await apiClient.get<OrdersApiResponse>('/api/siparisler/all');
    return res.data;
  },
};

// ==========================================
// 3. ŞUBELER SERVİSİ (AÇIK / KAPALI YÖNETİMİ)
// ==========================================
export const branchesService = {
  // Şube Listesi ve Durumları
  async getBranches(refresh: boolean = false): Promise<BranchesApiResponse> {
    const res = await apiClient.get<BranchesApiResponse>('/api/subeler', {
      params: { refresh: refresh ? 'true' : 'false' },
    });
    return res.data;
  },

  // Şube Durumu Güncelle (AÇ / KAPAT)
  async updateBranchStatus(storeId: number | string, workingStatus: 'OPEN' | 'CLOSED'): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.put('/api/subeler', {
      storeId,
      workingStatus,
    });
    return res.data;
  },
};

// ==========================================
// 4. STOKLAR & FİYAT SERVİSİ
// ==========================================
export const stocksService = {
  // Stok Matrisi Listesi
  async getStocks(params?: {
    storeId?: string;
    search?: string;
    barcode?: string;
    page?: number;
    size?: number;
    refresh?: boolean;
    all?: boolean;
  }): Promise<StocksApiResponse> {
    const res = await apiClient.get<StocksApiResponse>('/api/stoklar', {
      params: {
        ...params,
        refresh: params?.refresh ? 'true' : 'false',
        all: params?.all ? 'true' : 'false',
      },
    });
    return res.data;
  },

  // Fiyat ve Stok Güncelle (Trendyol Go API'ye gönderir)
  async updatePrice(items: Array<{
    barcode: string;
    storeId?: string | number;
    sellingPrice?: number;
    quantity?: number;
    onSale?: boolean;
  }>): Promise<{ success: boolean; batchRequestId?: string; message: string }> {
    const res = await apiClient.post('/api/fiyat-guncelle', { items });
    return res.data;
  },

  // Batch Güncelleme Durumunu Sorgula
  async checkBatchStatus(batchRequestId: string): Promise<any> {
    const res = await apiClient.get('/api/fiyat-guncelle', {
      params: { batchRequestId },
    });
    return res.data;
  },
};

// ==========================================
// 5. İADELER SERVİSİ
// ==========================================
export const claimsService = {
  // İade Talepleri Listesi
  async getClaims(claimItemStatus?: string): Promise<ClaimsApiResponse> {
    const res = await apiClient.get<ClaimsApiResponse>('/api/iadeler', {
      params: { claimItemStatus: claimItemStatus || undefined },
    });
    return res.data;
  },
};

// ==========================================
// 6. BARKOD ARAMA SERVİSİ
// ==========================================
export const barcodeService = {
  // Barkoddan Ürün Bilgisi ve Görsel Arama
  async searchBarcode(barcode: string): Promise<BarcodeSearchResult> {
    const res = await apiClient.get<BarcodeSearchResult>('/api/barkod-bul', {
      params: { barcode: barcode.trim() },
    });
    return res.data;
  },
};

// ==========================================
// 7. SEVİYELER & KOMİSYON SERVİSİ
// ==========================================
export const levelsService = {
  async getLevels(period?: string, refresh: boolean = false): Promise<LevelsApiResponse> {
    const res = await apiClient.get<LevelsApiResponse>('/api/seviyeler', {
      params: { period, refresh: refresh ? 'true' : 'false' },
    });
    return res.data;
  },
};

// ==========================================
// 8. MÜŞTERİ YORUMLARI SERVİSİ
// ==========================================
export const reviewsService = {
  async getReviews(storeIds: string): Promise<{ content: any[]; totalElements: number }> {
    const res = await apiClient.get('/api/reviews', {
      params: { storeIds },
    });
    return res.data;
  },
};

// ==========================================
// 9. CİRO & AY ANALİZİ SERVİSİ
// ==========================================
export const ciroService = {
  async getMonthOrders(year: number, month: number): Promise<{ content: any[]; totalElements?: number }> {
    const res = await apiClient.get('/api/siparisler/all', {
      params: { year, month, t: Date.now() },
    });
    return res.data;
  },
};

// ==========================================
// 10. ÜRÜN EKLEME SERVİSİ
// ==========================================
export const productsService = {
  async createProduct(payload: any): Promise<{ success: boolean; message: string; batchRequestId?: string }> {
    const res = await apiClient.post('/api/urun-ekle', payload);
    return res.data;
  },
};

// ==========================================
// 11. SİSTEM SAĞLIĞI & BAĞLANTI TESTİ SERVİSİ
// ==========================================
export const healthService = {
  async checkHealth(): Promise<HealthApiResponse> {
    const res = await apiClient.get<HealthApiResponse>('/api/health');
    return res.data;
  },
};
