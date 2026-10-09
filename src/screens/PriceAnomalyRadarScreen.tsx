import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { stocksService } from '../api/services';
import { ProductStockItem } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';
import { PriceUpdateModal } from './PriceUpdateModal';

function extractProductItems(res: any): ProductStockItem[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.content)) return res.content;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.products)) return res.products;
  if (res.product && typeof res.product === 'object') return [res.product];
  return [];
}

export interface AnomalyItem {
  barcode: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  minBranchName: string;
  maxBranchName: string;
  priceDiff: number;
  diffPercent: number;
  avgPrice: number;
  branchPrices: {
    branchId: string;
    branchName: string;
    price: number | null;
    quantity: number | null;
    onSale: boolean;
    isMin: boolean;
    isMax: boolean;
  }[];
  undefinedCount: number;
  activeBranchCount: number;
  rawProduct: ProductStockItem;
}

export const PriceAnomalyRadarScreen: React.FC<{
  onOpenServerSettings?: () => void;
}> = ({ onOpenServerSettings }) => {
  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'missing'>('all');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const fetchStocks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await stocksService.getStocks({ all: true, size: 500, refresh: isRefresh });
      const items = extractProductItems(res);
      setProducts(items);
    } catch (err: any) {
      console.error('Fiyat anomali veri hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Stok verileri sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleCopyBarcode = (barcode: string) => {
    if (!barcode) return;
    Clipboard.setString(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1800);
  };

  const toggleExpand = (barcode: string) => {
    setExpandedItems((prev) => ({ ...prev, [barcode]: !prev[barcode] }));
  };

  // Anomali Hesaplama Motoru
  const { anomalies, stats } = useMemo(() => {
    const list: AnomalyItem[] = [];
    let criticalCount = 0;
    let missingPriceCount = 0;

    products.forEach((p) => {
      if (!p.stocks) return;

      const entries = Object.entries(p.stocks);
      if (entries.length === 0) return;

      const validPrices: { price: number; branchId: string; branchName: string }[] = [];
      let undefinedCount = 0;

      const branchPrices = Object.entries(BRANCHES).map(([bId, bName]) => {
        const info = p.stocks?.[bId];
        const price = info?.sellingPrice ?? null;
        const qty = info?.quantity ?? null;
        const onSale = info?.onSale ?? false;

        if (price !== null && price > 0) {
          validPrices.push({ price, branchId: bId, branchName: bName });
        } else {
          undefinedCount++;
        }

        return {
          branchId: bId,
          branchName: bName,
          price,
          quantity: qty,
          onSale,
          isMin: false,
          isMax: false,
        };
      });

      // En az 2 şubede fiyat tanımlıysa ve fiyat farkı varsa anomali tespit et
      if (validPrices.length >= 2) {
        const minObj = validPrices.reduce((prev, curr) => (curr.price < prev.price ? curr : prev), validPrices[0]);
        const maxObj = validPrices.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), validPrices[0]);

        const minPrice = minObj.price;
        const maxPrice = maxObj.price;
        const priceDiff = maxPrice - minPrice;
        const diffPercent = minPrice > 0 ? (priceDiff / minPrice) * 100 : 0;
        const avgPrice = validPrices.reduce((acc, curr) => acc + curr.price, 0) / validPrices.length;

        // Fiyat farkı %10 ve üzeri VEYA tanımsız fiyatlı şube varsa radar yakalasın
        if (diffPercent >= 10 || (undefinedCount > 0 && validPrices.length >= 1)) {
          if (diffPercent >= 25) criticalCount++;
          if (undefinedCount > 0) missingPriceCount++;

          // Min ve max şubeleri işaretle
          branchPrices.forEach((bp) => {
            if (bp.price === minPrice) bp.isMin = true;
            if (bp.price === maxPrice && priceDiff > 0) bp.isMax = true;
          });

          list.push({
            barcode: p.barcode,
            title: p.title,
            brand: p.brand,
            category: p.category,
            imageUrl: p.imageUrl,
            totalStock: p.totalStock,
            minPrice,
            maxPrice,
            minBranchName: minObj.branchName,
            maxBranchName: maxObj.branchName,
            priceDiff,
            diffPercent,
            avgPrice,
            branchPrices,
            undefinedCount,
            activeBranchCount: validPrices.length,
            rawProduct: p,
          });
        }
      }
    });

    // Filtreleme
    let filtered = list;
    if (filterType === 'critical') {
      filtered = filtered.filter((item) => item.diffPercent >= 25);
    } else if (filterType === 'missing') {
      filtered = filtered.filter((item) => item.undefinedCount > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (item) => item.title.toLowerCase().includes(q) || item.barcode.includes(q)
      );
    }

    // Fark yüzdesine göre sırala (en yüksek fark en üstte)
    filtered.sort((a, b) => b.diffPercent - a.diffPercent);

    return {
      anomalies: filtered,
      stats: {
        totalAnomalies: list.length,
        criticalCount,
        missingPriceCount,
      },
    };
  }, [products, filterType, searchQuery]);

  const renderItem = ({ item }: { item: AnomalyItem }) => {
    const isExpanded = !!expandedItems[item.barcode];
    const isCopied = copiedBarcode === item.barcode;
    const isHighDiff = item.diffPercent >= 25;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Ürün Görseli */}
          <View style={styles.imgBox}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.img} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.textMuted} />
            )}
          </View>

          {/* Başlık ve Barkod */}
          <View style={styles.infoCol}>
            <Text style={styles.titleText} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.barcodeRow}>
              <Text style={styles.barcodeText}>{item.barcode}</Text>
              <TouchableOpacity
                onPress={() => handleCopyBarcode(item.barcode)}
                style={styles.copyBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isCopied ? 'check' : 'content-copy'}
                  size={10}
                  color={isCopied ? '#059669' : colors.textMuted}
                />
                <Text style={[styles.copyBtnText, isCopied && { color: '#059669' }]}>
                  {isCopied ? 'Kopyalandı' : 'Kopyala'}
                </Text>
              </TouchableOpacity>
              {item.brand && <Text style={styles.brandText}>• {item.brand}</Text>}
            </View>
          </View>

          {/* Fark Rozeti */}
          <View style={[styles.diffBadge, isHighDiff ? styles.diffBadgeHigh : styles.diffBadgeNormal]}>
            <Text style={[styles.diffBadgeText, isHighDiff ? styles.diffTextHigh : styles.diffTextNormal]}>
              +%{item.diffPercent.toFixed(1)} FARK
            </Text>
          </View>
        </View>

        {/* Fiyat Aralık Şeridi */}
        <View style={styles.priceRow}>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>EN DÜŞÜK FİYAT</Text>
            <Text style={styles.minPriceVal}>{item.minPrice.toFixed(2)} ₺</Text>
            <Text style={styles.branchSubText} numberOfLines={1}>{item.minBranchName}</Text>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>ORTALAMA FİYAT</Text>
            <Text style={styles.avgPriceVal}>{item.avgPrice.toFixed(2)} ₺</Text>
            <Text style={styles.branchSubText}>{item.activeBranchCount} Şubede Aktif</Text>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>EN YÜKSEK FİYAT</Text>
            <Text style={styles.maxPriceVal}>{item.maxPrice.toFixed(2)} ₺</Text>
            <Text style={styles.branchSubText} numberOfLines={1}>{item.maxBranchName}</Text>
          </View>
        </View>

        {/* Aksiyon Butonları & Detay Açma */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => toggleExpand(item.barcode)}
            style={styles.expandBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.expandBtnText}>
              {isExpanded ? 'Şube Fiyatlarını Gizle' : '12 Şube Fiyat Dökümünü İncele'}
            </Text>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setEditingProduct(item.rawProduct)}
            style={styles.updateBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="currency-try" size={13} color="#FFFFFF" />
            <Text style={styles.updateBtnText}>Fiyatı Eşitle / Güncelle</Text>
          </TouchableOpacity>
        </View>

        {/* 12 Şube Fiyat Tablosu */}
        {isExpanded && (
          <View style={styles.branchTable}>
            {item.branchPrices.map((bp) => (
              <View key={bp.branchId} style={styles.branchRow}>
                <Text style={styles.branchNameCell} numberOfLines={1}>
                  {bp.branchName}
                </Text>
                <View style={styles.branchRightCell}>
                  {bp.price !== null ? (
                    <Text
                      style={[
                        styles.branchPriceCell,
                        bp.isMin && styles.minPriceCell,
                        bp.isMax && styles.maxPriceCell,
                      ]}
                    >
                      {bp.price.toFixed(2)} ₺
                      {bp.isMin ? ' (En Düşük)' : bp.isMax ? ' (En Yüksek)' : ''}
                    </Text>
                  ) : (
                    <Text style={styles.undefinedPriceCell}>Fiyat Tanımsız</Text>
                  )}
                  <View
                    style={[
                      styles.onSaleDot,
                      { backgroundColor: bp.onSale ? '#10B981' : '#EF4444' },
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
      {/* 1. Üst Sub-Header Strip */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderTitleRow}>
          <View style={styles.radarIconWrap}>
            <MaterialCommunityIcons name="radar" size={16} color="#F59E0B" />
            <Text style={styles.subHeaderTitle}>FİYAT ANOMALİ RADARI</Text>
          </View>
          <Text style={styles.subHeaderSubtitle}>12 Şube Arası Çelişki Tespiti</Text>
        </View>

        {/* 3 KPI Kutusu */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM ANOMALİ</Text>
            <Text style={styles.kpiVal}>{stats.totalAnomalies}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>KRİTİK UÇURUM (&gt;%25)</Text>
            <Text style={[styles.kpiVal, { color: '#EF4444' }]}>{stats.criticalCount}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>EKSİK FİYATLI</Text>
            <Text style={[styles.kpiVal, { color: '#F59E0B' }]}>{stats.missingPriceCount}</Text>
          </View>
        </View>
      </View>

      {/* 2. Filtre Tabları */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          onPress={() => setFilterType('all')}
          style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filterType === 'all' && styles.filterTabTextActive]}>
            TÜMÜ ({stats.totalAnomalies})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterType('critical')}
          style={[styles.filterTab, filterType === 'critical' && styles.filterTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filterType === 'critical' && styles.filterTabTextActive]}>
            KRİTİK UÇURUM ({stats.criticalCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterType('missing')}
          style={[styles.filterTab, filterType === 'missing' && styles.filterTabActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filterType === 'missing' && styles.filterTabTextActive]}>
            EKSİK ŞUBE FİYATI ({stats.missingPriceCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Arama Çubuğu */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün adı veya barkod ile filtrele..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
            <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4. Liste / Yükleniyor / Hata */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Tüm şubelerin fiyat matrisi taranıyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchStocks()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={anomalies}
          keyExtractor={(item) => item.barcode}
          renderItem={renderItem}
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
              title="Fiyat Anomalisi Bulunamadı"
              message="Taranan şubeler arasında belirlenen kriterlere uyan fiyat uçurumu veya eksik fiyat kaydı tespit edilmedi."
            />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  subHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radarIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subHeaderSubtitle: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: layout.radiusSm,
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  kpiVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  kpiDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#374151',
  },
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    fontWeight: '700',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
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
  },
  listContent: {
    padding: 10,
    paddingBottom: 40,
    gap: 8,
  },
  card: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  imgBox: {
    width: 48,
    height: 48,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 16,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
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
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#F9FAFB',
  },
  copyBtnText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '600',
  },
  brandText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  diffBadgeHigh: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  diffBadgeNormal: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  diffBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  diffTextHigh: {
    color: '#DC2626',
  },
  diffTextNormal: {
    color: '#D97706',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  priceBox: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  minPriceVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  avgPriceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  maxPriceVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  branchSubText: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  priceDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  expandBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  updateBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  branchTable: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
    padding: 6,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  branchNameCell: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  branchRightCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchPriceCell: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  minPriceCell: {
    color: '#059669',
  },
  maxPriceCell: {
    color: '#DC2626',
  },
  undefinedPriceCell: {
    fontSize: 9,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  onSaleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
