// Limon Panel ile Birebir Uyumlu Kurumsal Renk ve Tasarım Sistemi
export const colors = {
  // Zeminler
  background: '#F3F4F6',       // Panel bg-gray-100
  surface: '#FFFFFF',          // Panel bg-white
  surfaceSubtle: '#F9FAFB',    // Panel bg-gray-50
  surfaceMuted: '#E5E7EB',     // Panel bg-gray-200
  
  // Sınırlar (1px Keskin Kenarlıklar)
  border: '#E5E7EB',           // Panel border-gray-200
  borderStrong: '#D1D5DB',     // Panel border-gray-300
  borderDark: '#374151',       // Panel border-gray-700
  
  // Tipografi (Panel Tailwind Eşleşmesi)
  textPrimary: '#111827',      // Panel text-gray-900
  textSecondary: '#374151',    // Panel text-gray-700
  textMuted: '#6B7280',        // Panel text-gray-500
  textLight: '#9CA3AF',        // Panel text-gray-400
  textDisabled: '#9CA3AF',     // Devre dışı metinler
  textWhite: '#FFFFFF',
  
  // Panel Kurumsal Koyu Bar (Header & Aksiyonlar)
  headerDark: '#111827',       // Panel bg-gray-900
  headerDarkBorder: '#1F2937', // Panel border-gray-800
  primary: '#111827',
  primaryText: '#FFFFFF',

  // Limon Marka Sarı / Amber
  brandYellow: '#FACC15',      // Sarı Limon logosu
  brandAmber: '#D97706',
  
  // Panel Sipariş Durum Renkleri (STATUS_COLORS Birebir)
  statusCreated: '#3B82F6',     // Mavi - Yeni
  statusPicking: '#F59E0B',     // Amber - Toplanıyor
  statusInvoiced: '#A855F7',    // Mor - Faturalandı
  statusShipped: '#F97316',     // Turuncu - Yolda
  statusDelivered: '#10B981',   // Yeşil - Teslim Edildi
  statusCancelled: '#EF4444',   // Kırmızı - İptal
  statusUnSupplied: '#B91C1C',  // Koyu Kırmızı - Tedarik Edilemedi
  
  // Durum Renkleri
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Durum Zeminleri
  successBg: '#ECFDF5',
  warningBg: '#FFFBEB',
  dangerBg: '#FEF2F2',
  infoBg: '#EFF6FF',
};

export const typography = {
  h1: { fontSize: 20, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.3 },
  h2: { fontSize: 16, fontWeight: '700' as const, color: colors.textPrimary, letterSpacing: -0.2 },
  h3: { fontSize: 14, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  bodyMedium: { fontSize: 13, fontWeight: '600' as const, color: colors.textPrimary },
  caption: { fontSize: 11, fontWeight: '500' as const, color: colors.textMuted },
  tiny: { fontSize: 10, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  mono: { fontSize: 12, fontFamily: 'monospace', color: colors.textPrimary },
};

export const layout = {
  radiusSm: 3,     // Panel ile aynı keskin 3-4px köşeler
  radiusMd: 4,     // Panel kartları
  borderWidth: 1,  // Net 1px sınır
};
