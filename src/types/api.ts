// Trendyol Go Şube Bilgisi
export interface BranchItem {
  id: number | string;
  name: string;
  shortName?: string;
  status: "ACTIVE" | "PASSIVE" | string;
  workingStatus: "OPEN" | "CLOSED" | string;
  sellerWorkingStatus?: "OPEN" | "CLOSED" | string;
  averageDeliveryInterval?: string;
  minDeliveryTimeInMin?: number;
  maxDeliveryTimeInMin?: number;
  deliveryType?: string;
  scheduleType?: string;
  deliveryHours?: Array<{
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface BranchesApiResponse {
  stores: BranchItem[];
  totalCount: number;
  openCount: number;
  closedCount: number;
  updatedAt: string;
  error?: string;
}

// Trendyol Sipariş Bilgileri
export interface OrderItemLine {
  id?: string | number;
  amount: number;
  price: number;
  barcode: string;
  product?: {
    name: string;
    productSaleName?: string;
    brandName?: string;
    imageUrls?: string[];
    weight?: any;
  };
  items?: Array<{
    id: string | number;
    price: number;
    isCancelled?: boolean;
    discount?: number;
  }>;
}

export interface OrderPackage {
  id: string | number;
  orderId?: string | number;
  orderNumber: string | number;
  storeId: string | number;
  sellerId?: number;
  packageStatus: "Created" | "Picking" | "Shipped" | "Delivered" | "Cancelled" | string;
  deliveryModel?: string;
  eta?: string;
  orderDate: number;
  lastModifiedDate?: number;
  isCourierNearby?: boolean;
  totalPrice?: number;
  grossAmount?: number;
  totalDiscount?: number;
  totalCargo?: number;
  customer?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    note?: string;
    email?: string;
  };
  shipmentAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    city?: string;
    district?: string;
    neighborhood?: string;
    phone?: string;
    addressDescription?: string;
  };
  lines?: OrderItemLine[];
}

export interface OrdersApiResponse {
  content: OrderPackage[];
  totalElements: number;
  totalPages: number;
  page: number;
  size?: number;
  error?: string;
}

// Stok Matrisi
export interface ProductStockBranchInfo {
  quantity: number | null;
  onSale: boolean;
  sellingPrice: number | null;
}

export interface ProductStockItem {
  id: string;
  contentId?: string;
  barcode: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  stockCode: string | null;
  totalStock: number;
  stocks: Record<string, ProductStockBranchInfo>;
}

export interface StocksApiResponse {
  content: ProductStockItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  catalogTotal?: number;
  totalStores?: number;
  globalStats?: {
    totalProducts: number;
    sumTotalStock: number;
    critical: number;
    outOfStock: number;
  };
  error?: string;
}

// İade Talepleri
export interface ClaimItem {
  id: string;
  orderLineItemId: number;
  customerNote?: string;
  claimItemStatus: {
    name: string;
  };
  customerClaimItemReason?: {
    name: string;
    code: string;
  };
  resolved: boolean;
  imageUrls?: string[];
}

export interface ClaimRecord {
  id: string;
  orderNumber: string;
  customerFirstName?: string;
  customerLastName?: string;
  storeId?: string | number;
  claimDate: number;
  orderDate?: number;
  claimItems: ClaimItem[];
  orderDetails?: OrderPackage;
}

export interface ClaimsApiResponse {
  content: ClaimRecord[];
  totalElements: number;
  error?: string;
}

// Barkod Arama Sonucu
export interface BarcodeSearchResult {
  found: boolean;
  barcode: string;
  title?: string | null;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  source?: string;
  message?: string;
  error?: string;
}

// Kullanıcı & Oturum
export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CASHIER" | "USER" | string;
  branchId: string | null;
  branch?: {
    id: string;
    name: string;
  } | null;
}

export interface LoginApiResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
}

export interface UsersListApiResponse {
  success: boolean;
  users: UserProfile[];
  total: number;
  source?: string;
}

// Sistem Sağlığı
export interface HealthApiResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
  version: string;
  integrations?: {
    redis: string;
    trendyolApi: boolean;
    telegram: boolean;
    githubUpdateToken: boolean;
  };
  telemetry?: {
    environment: string;
    port: string;
    executionTimeMs: number;
  };
  error?: string;
}

// Seviyeler & Komisyon
export interface LevelStoreInfo {
  storeId: string;
  storeName: string;
  currentLevel: string;
  commissionPeriod: string;
  metrics?: Record<string, any>;
}

export interface LevelsApiResponse {
  marketPeriods: Array<any>;
  stores: LevelStoreInfo[];
  thresholds?: any;
  commissionMatrix?: any;
  lastSyncedAt?: string;
  isLive?: boolean;
}

// Müşteri Yorumları & Değerlendirmeler
export interface CustomerReviewItem {
  id: string | number;
  storeId?: string | number;
  storeName?: string;
  orderNumber?: string;
  rate: number;
  comment?: string;
  customerFirstName?: string;
  customerLastName?: string;
  createdDate: number | string;
  sellerAnswer?: {
    text: string;
    createdDate?: number | string;
  } | null;
}

export interface ReviewsApiResponse {
  content: CustomerReviewItem[];
  totalElements: number;
  totalPages?: number;
  error?: string;
}

// Ciro Analizi Tipleri
export interface CiroBranchMetric {
  branchId: string;
  branchName: string;
  totalCiro: number;
  totalOrders: number;
  avgOrderValue: number;
  dailyRevenue: Record<number, number>;
  previousMonthCiro?: number;
  growthRate?: number;
}

// Ürün Ekleme Payload
export interface CreateProductPayload {
  barcode: string;
  title: string;
  brandId?: number;
  brandName?: string;
  categoryId?: number;
  categoryName?: string;
  quantity?: number;
  sellingPrice: number;
  vatRate?: number;
  images?: string[];
  description?: string;
}

