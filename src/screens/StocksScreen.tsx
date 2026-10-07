import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Image,
  Clipboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { stocksService } from '../api/services';
import { ProductStockItem, StocksApiResponse } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';
import { PriceUpdateModal } from './PriceUpdateModal';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';

const STOCK_FILTERS = [
  { key: 'all', label: 'TÜMÜ' },
  { key: 'in_stock', label: 'STOKTA' },
  { key: 'critical', label: 'KRİTİK' },
  { key: 'out_of_stock', label: 'TÜKENDİ' },
];

export const StocksScreen: React.FC<{
  onOpenServerSettings: () => void;
  onOpenBranchPicker: () => void;
}> = ({ onOpenServerSettings, onOpenBranchPicker }) => {
  const { activeBranchId, activeBranchName } = useAuth();
  const { serverUrl } = useServer();

  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(2171);
  const [globalStats, setGlobalStats] = useState({
    totalProducts: 2171,
    sumTotalStock: 340321,
    critical: 76,
    outOfStock: 579,
  });

  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleScannedBarcode = (barcode: string) => {
    setSearchQuery(barcode);
    setPage(0);
  };

  const handleCopyBarcode = (barcode: string) => {
    if (!barcode) return;
    Clipboard.setString(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => {
      setCopiedBarcode(null);
    }, 1500);
  };

  const toggleExpand = (id: string) => {
    setExpandedProducts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchStocks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params: any = {
        size: pageSize,
        page,
      };

      if (activeBranchId && activeBranchId !== 'all') {
        params.storeId = activeBranchId;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res: StocksApiResponse = await stocksService.getStocks(params);

      if (res && Array.isArray(res.content)) {
        let items = res.content;
        if (stockStatusFilter === 'critical') {
          items = items.filter((p) => p.totalStock > 0 && p.totalStock <= 5);
        } else if (stockStatusFilter === 'out_of_stock') {
          items = items.filter((p) => p.totalStock === 0);
        } else if (stockStatusFilter === 'in_stock') {
          items = items.filter((p) => p.totalStock > 5);
        }

        setProducts(items);
        setTotalElements(res.totalElements || items.length);
        setTotalPages(res.totalPages || 1);

        if (res.globalStats) {
          setGlobalStats(res.globalStats);
        }
        if (res.catalogTotal) {
          setCatalogTotal(res.catalogTotal);
        }
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Stok listesi hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Stok verileri sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId, searchQuery, stockStatusFilter, page, pageSize]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const renderProductItem = ({ item }: { item: ProductStockItem }) => {
    const isOutOfStock = item.totalStock === 0;
    const isCritical = item.totalStock > 0 && item.totalStock <= 5;
    const isCopied = copiedBarcode === item.barcode;
    const isExpanded = !!expandedProducts[item.id];

    return (
      <Card style={styles.productCard}>
        <View style={styles.cardMainRow}>
          {/* Ürün Görseli */}
          <View style={styles.imageBox}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productImg} resizeMode="cover" />
            ) : (
              <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.textMuted} />
            )}
          </View>

          {/* Ürün Bilgileri */}
          <View style={styles.infoCol}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Barkod ve Kopyalama */}
            <View style={styles.barcodeRow}>
              <Text style={styles.barcodeText}>{item.barcode}</Text>
              <TouchableOpacity
                onPress={() => handleCopyBarcode(item.barcode)}
                style={styles.copyBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isCopied ? 'check' : 'content-copy'}
                  size={12}
                  color={isCopied ? '#059669' : '#6B7280'}
                />
                <Text style={[styles.copyBtnText, isCopied && styles.copyBtnTextDone]}>
                  {isCopied ? 'Kopyalandı' : 'Kopyala'}
                </Text>
              </TouchableOpacity>
              {item.brand && <Text style={styles.brandText}>• {item.brand}</Text>}
            </View>

            {/* Stok ve Fiyat Rozetleri */}
            <View style={styles.stockStatusRow}>
              <View
                style={[
                  styles.stockBadge,
                  isOutOfStock
                    ? styles.badgeRed
                    : isCritical
                    ? styles.badgeAmber
                    : styles.badgeGreen,
                ]}
              >
                <Text
                  style={[
                    styles.stockBadgeText,
                    isOutOfStock
                      ? styles.textRed
                      : isCritical
                      ? styles.textAmber
                      : styles.textGreen,
                  ]}
                >
                  {isOutOfStock
                    ? 'TÜKENDİ'
                    : isCritical
                    ? `KRİTİK (${item.totalStock})`
                    : `STOK: ${item.totalStock}`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setEditingProduct(item)}
                style={styles.priceActionBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="currency-try" size={12} color="#FFFFFF" />
                <Text style={styles.priceActionText}>Fiyat Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Şube Bazlı Stok ve Fiyat Dökümü Toggle */}
        <TouchableOpacity
          onPress={() => toggleExpand(item.id)}
          style={styles.branchExpandHeader}
          activeOpacity={0.7}
        >
          <Text style={styles.branchExpandTitle}>
            ŞUBE BAZLI FİYAT & STOK DAĞILIMI
          </Text>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && item.stocks && (
          <View style={styles.branchList}>
            {Object.entries(item.stocks).map(([storeId, info]: [string, any]) => (
              <View key={storeId} style={styles.branchRow}>
                <Text style={styles.branchName} numberOfLines={1}>
                  {BRANCHES[storeId] || `Şube ${storeId}`}
                </Text>
                <View style={styles.branchValues}>
                  <Text style={styles.branchQty}>
                    {info.quantity !== null ? `${info.quantity} Adet` : '-'}
                  </Text>
                  <Text style={styles.branchPrice}>
                    {info.sellingPrice !== null ? `${info.sellingPrice.toFixed(2)} ₺` : '-'}
                  </Text>
                  <View
                    style={[
                      styles.onSaleDot,
                      { backgroundColor: info.onSale ? '#10B981' : '#EF4444' },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header & 4 KPI Kartı */}
      <View style={styles.subHeader}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM ÜRÜN</Text>
            <Text style={styles.kpiVal}>{catalogTotal.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM STOK</Text>
            <Text style={styles.kpiVal}>{globalStats.sumTotalStock.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>KRİTİK (&lt;5)</Text>
            <Text style={[styles.kpiVal, { color: '#F59E0B' }]}>{globalStats.critical}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>STOKTA YOK</Text>
            <Text style={[styles.kpiVal, { color: '#EF4444' }]}>{globalStats.outOfStock}</Text>
          </View>
        </View>
      </View>

      {/* 2. Arama & Şube Seçici */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün adı veya barkod ara..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => fetchStocks()}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={styles.searchCameraBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={15} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onOpenBranchPicker} style={styles.branchSelectBtn}>
          <MaterialCommunityIcons name="store-outline" size={14} color="#FFFFFF" />
          <Text style={styles.branchSelectBtnText} numberOfLines={1}>
            {activeBranchId && activeBranchId !== 'all' ? activeBranchName : 'Tüm Şubeler'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Stok Durumu Filtre Tabları */}
      <View style={styles.filterTabsRow}>
        {STOCK_FILTERS.map((f) => {
          const isActive = stockStatusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setStockStatusFilter(f.key)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. Liste / Yükleniyor / Hata */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Stok listesi yükleniyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchStocks()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id?.toString() || item.barcode}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStocks(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Ürün Bulunamadı"
              message="Arama veya filtre kriterlerine uyan stok kaydı bulunamadı."
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  disabled={page === 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textPrimary} />
                  <Text style={styles.pageBtnText}>Önceki</Text>
                </TouchableOpacity>

                <Text style={styles.pageInfoText}>
                  Sayfa {page + 1} / {totalPages}
                </Text>

                <TouchableOpacity
                  disabled={page >= totalPages - 1}
                  onPress={() => setPage((p) => p + 1)}
                  style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Sonraki</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Fiyat Güncelleme Modalı */}
      {editingProduct && (
        <PriceUpdateModal
          visible={!!editingProduct}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            fetchStocks(true);
          }}
        />
      )}

      {/* Kamera Barkod Tarayıcı Modalı */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedBarcode}
        title="STOK BARKODU TARA"
        subtitle="Barkodu hizalayarak ürünü anında bulun"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  subHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  kpiDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#374151',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 3,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  searchCameraBtn: {
    padding: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 3,
    maxWidth: 100,
  },
  branchSelectBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  filterTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterTabText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  productCard: {
    padding: 8,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 8,
  },
  imageBox: {
    width: 50,
    height: 50,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
  },
  productTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: 15,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  barcodeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#6B7280',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#F9FAFB',
  },
  copyBtnText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  copyBtnTextDone: {
    color: '#059669',
  },
  brandText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  stockStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  stockBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  stockBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  textGreen: {
    color: '#047857',
  },
  textAmber: {
    color: '#B45309',
  },
  textRed: {
    color: '#B91C1C',
  },
  priceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#111827',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  priceActionText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  branchExpandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 4,
  },
  branchExpandTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  branchList: {
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    borderRadius: 2,
    gap: 3,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  branchName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    flex: 1,
  },
  branchValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchQty: {
    fontSize: 9,
    color: '#6B7280',
  },
  branchPrice: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  onSaleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pageInfoText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
});
