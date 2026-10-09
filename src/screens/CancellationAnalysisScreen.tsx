import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Clipboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { ordersService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

export const getCancellationReason = (order: any): string | null => {
  if (!order) return null;
  if (order.cancelInfo?.reason) return order.cancelInfo.reason;
  if (order.cancelReason) return order.cancelReason;
  if (order.cancellationReason) return order.cancellationReason;
  if (order.cancelReasonDescription) return order.cancelReasonDescription;
  if (order.unSuppliedReason) return order.unSuppliedReason;
  if (order.packageCancelReason) return order.packageCancelReason;

  if (order.cancelInfo?.reasonType) {
    const typeMap: Record<string, string> = {
      CustomerRequest: 'Müşteri İptal Talebi',
      UnSupplied: 'Tedarik Problemi (Stok Yok)',
      Technical: 'Sistem / Ödeme Hatası',
      Carrier: 'Kurye / Taşıma Kaynaklı İptal',
      Store: 'Mağaza İptali',
      Fraud: 'Şüpheli İşlem',
      Timeout: 'Süre Aşımı İptali',
    };
    return typeMap[order.cancelInfo.reasonType] || order.cancelInfo.reasonType;
  }

  if (order.packageStatus === 'UnSupplied') {
    return 'Tedarik Problemi (Sipariş Hazırlanamadı)';
  }

  if (order.packageStatus === 'Cancelled') {
    return 'İptal Sebebi Belirtilmemiş';
  }

  return null;
};

interface CancelledProductRecord {
  barcode: string;
  name: string;
  totalCancelledOrders: number;
  unSuppliedOrders: number;
  customerCancelledOrders: number;
  otherCancelledOrders: number;
  totalLostRevenue: number;
  branches: Record<string, number>;
  reasons: Record<string, number>;
  lastCancelledDate: number;
}

const TIME_FILTERS = [
  { key: '7', label: '7 GÜN' },
  { key: '30', label: '30 GÜN' },
  { key: '90', label: '90 GÜN' },
  { key: 'all', label: 'TÜMÜ' },
];

export const CancellationAnalysisScreen: React.FC<{
  onOpenServerSettings?: () => void;
  onNavigateToStockProduct?: (barcode: string) => void;
}> = ({ onOpenServerSettings, onNavigateToStockProduct }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refTimestamp, setRefTimestamp] = useState<number>(() => Date.now());

  // Filtreler
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'7' | '30' | '90' | 'all'>('30');
  const [branchFilter, setBranchFilter] = useState('all');
  const [reasonTypeFilter, setReasonTypeFilter] = useState<'all' | 'unsupplied' | 'customer'>('all');
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<'unSuppliedOrders' | 'totalLostRevenue' | 'totalCancelledOrders'>('unSuppliedOrders');

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 90 günlük geçmiş siparişler
      const res = await ordersService.getOrders({ size: 500, fetchDays: 90 });
      const content = res?.content || (Array.isArray(res) ? res : []);
      setOrders(content);
      const now = new Date();
      setLastUpdated(now);
      setRefTimestamp(now.getTime());
    } catch (err: any) {
      console.error('İptal siparişleri çekilemedi:', err.message);
      setError(err.response?.data?.error || err.message || 'Siparişler sunucudan çekilemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCopyBarcode = (barcode: string) => {
    if (!barcode) return;
    Clipboard.setString(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1800);
  };

  // Zaman ve Şube Filtresi Uygulanmış Siparişler
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (branchFilter !== 'all' && String(o.storeId) !== branchFilter) return false;

      if (timeFilter !== 'all' && o.orderDate) {
        const days = Number(timeFilter);
        const cutoff = refTimestamp - days * 24 * 60 * 60 * 1000;
        if (o.orderDate < cutoff) return false;
      }

      return true;
    });
  }, [orders, branchFilter, timeFilter, refTimestamp]);

  // Kök Neden & Ürün İptal Analizi Motoru
  const { productList, reasonStats, kpiSummary } = useMemo(() => {
    const pMap: Record<string, CancelledProductRecord> = {};
    const reasonCounts: Record<string, number> = {};

    let totalOrdersCount = filteredOrders.length;
    let cancelledOrdersCount = 0;
    let unSuppliedOrdersCount = 0;
    let customerCancelledCount = 0;
    let totalLostGross = 0;

    filteredOrders.forEach((o) => {
      const isUnSupplied = o.packageStatus === 'UnSupplied';
      const isCancelled = o.packageStatus === 'Cancelled';
      const isFailed = isUnSupplied || isCancelled;

      if (isFailed) {
        cancelledOrdersCount++;
        totalLostGross += o.grossAmount || o.totalPrice || 0;

        const reasonText = getCancellationReason(o) || (isUnSupplied ? 'Tedarik Problemi (Stok Yok)' : 'İptal Edildi');
        reasonCounts[reasonText] = (reasonCounts[reasonText] || 0) + 1;

        if (isUnSupplied || reasonText.includes('Tedarik') || reasonText.includes('Stok') || reasonText.includes('Hazırlanamadı')) {
          unSuppliedOrdersCount++;
        } else if (reasonText.includes('Müşteri')) {
          customerCancelledCount++;
        }

        const sid = String(o.storeId || '');
        const orderTs = o.orderDate || 0;

        if (o.lines && Array.isArray(o.lines)) {
          o.lines.forEach((line: any) => {
            const rawBarcode = line.barcode?.trim() || '';
            const pName = line.product?.name || line.name || (rawBarcode ? `Ürün ${rawBarcode}` : 'İsimsiz Ürün');
            const bKey = rawBarcode || pName;

            const lineItemQty = line.items?.length || 1;
            const linePrice = (line.price || 0) * lineItemQty;

            if (!pMap[bKey]) {
              pMap[bKey] = {
                barcode: rawBarcode,
                name: pName,
                totalCancelledOrders: 0,
                unSuppliedOrders: 0,
                customerCancelledOrders: 0,
                otherCancelledOrders: 0,
                totalLostRevenue: 0,
                branches: {},
                reasons: {},
                lastCancelledDate: orderTs,
              };
            }

            pMap[bKey].totalCancelledOrders++;
            pMap[bKey].totalLostRevenue += linePrice;
            if (isUnSupplied) pMap[bKey].unSuppliedOrders++;
            else if (reasonText.includes('Müşteri')) pMap[bKey].customerCancelledOrders++;
            else pMap[bKey].otherCancelledOrders++;

            if (sid) {
              pMap[bKey].branches[sid] = (pMap[bKey].branches[sid] || 0) + 1;
            }
            pMap[bKey].reasons[reasonText] = (pMap[bKey].reasons[reasonText] || 0) + 1;

            if (orderTs > pMap[bKey].lastCancelledDate) {
              pMap[bKey].lastCancelledDate = orderTs;
            }
          });
        }
      }
    });

    // Filtreleme (Arama & İptal Tipi)
    let pArray = Object.values(pMap);

    if (reasonTypeFilter === 'unsupplied') {
      pArray = pArray.filter((p) => p.unSuppliedOrders > 0);
    } else if (reasonTypeFilter === 'customer') {
      pArray = pArray.filter((p) => p.customerCancelledOrders > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      pArray = pArray.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
    }

    // Sıralama
    pArray.sort((a, b) => {
      if (sortKey === 'unSuppliedOrders') return b.unSuppliedOrders - a.unSuppliedOrders;
      if (sortKey === 'totalLostRevenue') return b.totalLostRevenue - a.totalLostRevenue;
      return b.totalCancelledOrders - a.totalCancelledOrders;
    });

    const unSuppliedRate = totalOrdersCount > 0 ? (unSuppliedOrdersCount / totalOrdersCount) * 100 : 0;
    const cancelRate = totalOrdersCount > 0 ? (cancelledOrdersCount / totalOrdersCount) * 100 : 0;

    return {
      productList: pArray,
      reasonStats: Object.entries(reasonCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      kpiSummary: {
        totalOrders: totalOrdersCount,
        cancelledOrders: cancelledOrdersCount,
        unSuppliedOrders: unSuppliedOrdersCount,
        customerCancelled: customerCancelledCount,
        totalLostGross: Math.round(totalLostGross),
        unSuppliedRate,
        cancelRate,
      },
    };
  }, [filteredOrders, searchQuery, reasonTypeFilter, sortKey]);

  const renderProductItem = ({ item }: { item: CancelledProductRecord }) => {
    const isCopied = copiedBarcode === item.barcode;
    const topBranchEntries = Object.entries(item.branches).sort((a, b) => b[1] - a[1]);

    return (
      <Card style={styles.productCard}>
        <View style={styles.productCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>

            <View style={styles.barcodeRow}>
              {item.barcode ? (
                <>
                  <Text style={styles.barcodeText}>{item.barcode}</Text>
                  <TouchableOpacity
                    onPress={() => handleCopyBarcode(item.barcode)}
                    style={styles.copyBtn}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={isCopied ? 'check' : 'content-copy'}
                      size={11}
                      color={isCopied ? '#059669' : colors.textMuted}
                    />
                    <Text style={[styles.copyBtnText, isCopied && styles.copyBtnTextSuccess]}>
                      {isCopied ? 'Kopyalandı' : 'Kopyala'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.noBarcodeText}>Barkod Yok</Text>
              )}
            </View>
          </View>

          {/* Kayıp Ciro */}
          <View style={styles.lostRevBox}>
            <Text style={styles.lostRevLabel}>KAYIP CİRO</Text>
            <Text style={styles.lostRevVal}>{item.totalLostRevenue.toFixed(2)} ₺</Text>
          </View>
        </View>

        {/* İptal İstatistik Rozetleri */}
        <View style={styles.badgeRow}>
          <View style={styles.unSuppliedBadge}>
            <MaterialCommunityIcons name="alert-box" size={12} color="#DC2626" />
            <Text style={styles.unSuppliedBadgeText}>
              Tedarik Edilemedi: {item.unSuppliedOrders} Sipariş
            </Text>
          </View>

          <View style={styles.totalCancelBadge}>
            <Text style={styles.totalCancelBadgeText}>
              Toplam İptal: {item.totalCancelledOrders}
            </Text>
          </View>

          {onNavigateToStockProduct && item.barcode ? (
            <TouchableOpacity
              onPress={() => onNavigateToStockProduct(item.barcode)}
              style={styles.stockActionBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cube-scan" size={12} color={colors.textPrimary} />
              <Text style={styles.stockActionText}>Stokta Gör</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* İptalin Yaşandığı Şubeler */}
        {topBranchEntries.length > 0 && (
          <View style={styles.branchBadgesWrap}>
            <Text style={styles.branchBadgesLabel}>İptal Olan Şubeler:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchBadgesScroll}>
              {topBranchEntries.map(([bId, count]) => (
                <View key={bId} style={styles.branchPill}>
                  <Text style={styles.branchPillName}>{BRANCHES[bId] || `Şube ${bId}`}:</Text>
                  <Text style={styles.branchPillCount}>{count}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Koyu Strip & 4 KPI Özeti */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderTop}>
          <View style={styles.subHeaderTitleWrap}>
            <MaterialCommunityIcons name="close-circle-multiple-outline" size={14} color="#EF4444" />
            <Text style={styles.subHeaderTitle}>İPTAL & KÖK NEDEN ANALİZİ</Text>
          </View>
          <Text style={styles.subHeaderTime}>
            Son Güncelleme: {lastUpdated ? lastUpdated.toLocaleTimeString('tr-TR') : '--:--'}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>KAYIP CİRO</Text>
            <Text style={[styles.kpiVal, { color: '#EF4444' }]}>
              {kpiSummary.totalLostGross.toLocaleString('tr-TR')} ₺
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>İPTAL SİPARİŞ</Text>
            <Text style={styles.kpiVal}>{kpiSummary.cancelledOrders}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TEDARİK YOK</Text>
            <Text style={[styles.kpiVal, { color: '#F59E0B' }]}>{kpiSummary.unSuppliedOrders}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TEDARİK %</Text>
            <Text style={[styles.kpiVal, { color: kpiSummary.unSuppliedRate > 1.5 ? '#EF4444' : '#10B981' }]}>
              %{kpiSummary.unSuppliedRate.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Zaman Filtresi & Şube Seçimi */}
      <View style={styles.filtersRow}>
        <View style={styles.timeTabsRow}>
          {TIME_FILTERS.map((tf) => {
            const isActive = timeFilter === tf.key;
            return (
              <TouchableOpacity
                key={tf.key}
                onPress={() => setTimeFilter(tf.key as any)}
                style={[styles.timeTab, isActive && styles.timeTabActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeTabText, isActive && styles.timeTabTextActive]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Neden Filtresi (Tümü / Tedarik / Müşteri) */}
        <View style={styles.reasonTypeRow}>
          <TouchableOpacity
            onPress={() => setReasonTypeFilter('all')}
            style={[styles.reasonTypeBtn, reasonTypeFilter === 'all' && styles.reasonTypeBtnActive]}
          >
            <Text style={[styles.reasonTypeText, reasonTypeFilter === 'all' && styles.reasonTypeTextActive]}>
              Tümü
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReasonTypeFilter('unsupplied')}
            style={[styles.reasonTypeBtn, reasonTypeFilter === 'unsupplied' && styles.reasonTypeBtnActive]}
          >
            <Text style={[styles.reasonTypeText, reasonTypeFilter === 'unsupplied' && styles.reasonTypeTextActive]}>
              Tedarik Yok
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReasonTypeFilter('customer')}
            style={[styles.reasonTypeBtn, reasonTypeFilter === 'customer' && styles.reasonTypeBtnActive]}
          >
            <Text style={[styles.reasonTypeText, reasonTypeFilter === 'customer' && styles.reasonTypeTextActive]}>
              Müşteri İptali
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Arama Çubuğu */}
      <View style={styles.searchBarWrap}>
        <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="İptal edilen ürün adı veya barkod ara..."
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

      {/* 4. Sıralama Seçenekleri */}
      <View style={styles.sortBar}>
        <Text style={styles.sortBarLabel}>Sıralama:</Text>
        <TouchableOpacity
          onPress={() => setSortKey('unSuppliedOrders')}
          style={[styles.sortBtn, sortKey === 'unSuppliedOrders' && styles.sortBtnActive]}
        >
          <Text style={[styles.sortBtnText, sortKey === 'unSuppliedOrders' && styles.sortBtnTextActive]}>
            Tedarik Adedi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortKey('totalLostRevenue')}
          style={[styles.sortBtn, sortKey === 'totalLostRevenue' && styles.sortBtnActive]}
        >
          <Text style={[styles.sortBtnText, sortKey === 'totalLostRevenue' && styles.sortBtnTextActive]}>
            Kayıp Ciro
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortKey('totalCancelledOrders')}
          style={[styles.sortBtn, sortKey === 'totalCancelledOrders' && styles.sortBtnActive]}
        >
          <Text style={[styles.sortBtnText, sortKey === 'totalCancelledOrders' && styles.sortBtnTextActive]}>
            Toplam İptal
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. Liste Alanı */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>İptal siparişleri ve ürün verileri analiz ediliyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchOrders()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={productList}
          keyExtractor={(item) => item.barcode || item.name}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            /* Kök Neden Dağılımı Özeti */
            reasonStats.length > 0 ? (
              <Card style={styles.rootCausesCard}>
                <View style={styles.rootCausesHeader}>
                  <MaterialCommunityIcons name="chart-pie" size={14} color={colors.textPrimary} />
                  <Text style={styles.rootCausesTitle}>İPTAL KÖK NEDEN DAĞILIMI</Text>
                </View>

                {reasonStats.slice(0, 4).map((r) => {
                  const pct = kpiSummary.cancelledOrders > 0 ? (r.count / kpiSummary.cancelledOrders) * 100 : 0;
                  const isUnsupplied = r.name.includes('Tedarik') || r.name.includes('Stok');

                  return (
                    <View key={r.name} style={styles.reasonRow}>
                      <View style={styles.reasonLabelRow}>
                        <Text style={styles.reasonName} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text style={[styles.reasonCount, isUnsupplied && { color: '#EF4444' }]}>
                          {r.count} Sipariş (%{pct.toFixed(1)})
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.min(100, pct)}%` },
                            isUnsupplied && { backgroundColor: '#EF4444' },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="İptal Kaydı Yok"
              message="Seçilen dönem ve filtre kriterlerinde iptal edilen ürün bulunamadı."
            />
          }
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
  subHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subHeaderTitleWrap: {
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
  subHeaderTime: {
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
  filtersRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 6,
  },
  timeTabsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  timeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  timeTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  timeTabText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },
  timeTabTextActive: {
    color: '#FFFFFF',
  },
  reasonTypeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reasonTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  reasonTypeBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  reasonTypeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  reasonTypeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchBarWrap: {
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
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  sortBarLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sortBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  sortBtnActive: {
    backgroundColor: '#111827',
  },
  sortBtnText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  rootCausesCard: {
    padding: 10,
    marginBottom: 4,
  },
  rootCausesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  rootCausesTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  reasonRow: {
    marginBottom: 6,
  },
  reasonLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reasonName: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  reasonCount: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  productCard: {
    padding: 10,
  },
  productCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 16,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  barcodeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#6B7280',
  },
  noBarcodeText: {
    fontSize: 9,
    color: '#9CA3AF',
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
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#059669',
  },
  lostRevBox: {
    alignItems: 'flex-end',
  },
  lostRevLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.3,
  },
  lostRevVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  unSuppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  unSuppliedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  totalCancelBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  totalCancelBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
  },
  stockActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    marginLeft: 'auto',
  },
  stockActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  branchBadgesWrap: {
    marginTop: 6,
  },
  branchBadgesLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 3,
  },
  branchBadgesScroll: {
    flexDirection: 'row',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  branchPillName: {
    fontSize: 9,
    color: '#374151',
  },
  branchPillCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
});
