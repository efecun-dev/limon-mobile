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
  Image,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { ordersService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

// ─── İptal Sebebi Çözümleme Fonksiyonu ──────────────────────────────────────────
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
      UnSupplied: 'Tedarik Problemi (Stok/Ürün Yok)',
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

// SADECE ve SADECE Mağaza / Tedarik kaynaklı iptal kontrolü (Müşteri ve kurye iptalleri KESİNLİKLE elenir)
export const isStoreSupplyCancel = (order: any): boolean => {
  if (order.packageStatus === 'UnSupplied') return true;

  const ci = order.cancelInfo || {};
  const rType = (ci.reasonType || '').toLowerCase();
  const agent = (ci.agentName || '').toLowerCase();
  const r = (ci.reason || getCancellationReason(order) || '').toLowerCase();

  // Müşteri, ödeme veya kurye kaynaklı olanları KESİNLİKLE hariç tut:
  if (rType === 'customerrequest' || agent === 'customer' || rType === 'carrier') {
    return false;
  }
  if (
    r.includes('müşteri') ||
    r.includes('ödeme hatası') ||
    r.includes('debit') ||
    r.includes('yanlış/eksik ürün ekleme') ||
    r.includes('yanlış/eksik') ||
    r.includes('adres') ||
    r.includes('not eklenmeyi') ||
    r.includes('eta') ||
    r.includes('kurye') ||
    r.includes('vazgeçti')
  ) {
    return false;
  }

  // Bizden / Mağazadan kaynaklı pozitif kriterler:
  if (rType === 'unsupplied' || rType === 'store') return true;
  return (
    r.includes('tedarik') ||
    r.includes('stok') ||
    r.includes('hazırlanamıyor') ||
    r.includes('hazırlanamadı') ||
    r.includes('personel') ||
    r.includes('fiyat hatası') ||
    r.includes('açıklama/fiyat') ||
    r.includes('sipariş karışıklığı')
  );
};

export interface UnsuppliedProductRecord {
  barcode: string;
  name: string;
  imageUrl?: string;
  orderCount: number; // Kaç farklı siparişte tedarik edilemedi
  itemCount: number; // Toplam kaç adet tedarik edilemedi
  lostRevenue: number; // Kaçırılan toplam ciro (adet * birim fiyat)
  branches: Record<string, number>; // Şube dağılımı
  sampleOrders: string[]; // Örnek sipariş numaraları
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

  // Filtreler & Sıralama
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'7' | '30' | '90' | 'all'>('30');
  const [branchFilter, setBranchFilter] = useState('all');
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<'orderCount' | 'lostRevenue' | 'itemCount'>('orderCount');

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 120 günlük geçmiş siparişler
      const res = await ordersService.getOrders({ size: 1000, fetchDays: 120 });
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

  // Sadece Tedarik Edilemeyen Ürünleri Analiz Eden Motor (Panel 0.1.31 ile %100 Uyumlu)
  const { productStats, generalStats } = useMemo(() => {
    const pMap: Record<string, UnsuppliedProductRecord> = {};

    let unSuppliedOrdersCount = 0;
    let totalLostRevenue = 0;
    let totalLostItemCount = 0;

    filteredOrders.forEach((o) => {
      // SADECE TEDARİK EDİLEMEYEN / STOK PROBLEMLİ SİPARİŞLER
      const isSupplyFail = isStoreSupplyCancel(o);
      if (!isSupplyFail) return;

      unSuppliedOrdersCount++;

      const lines = o.lines || [];
      const unsuppliedLines: Array<{ line: any; cCount: number }> = [];
      const inStockLines: any[] = [];

      lines.forEach((l: any) => {
        const cItems = l.items?.filter((it: any) => it.isCancelled)?.length || 0;
        const isLineUnsupplied = Boolean(l.causedCancel || l.isCancelled || l.unsupplied || cItems > 0);
        if (isLineUnsupplied) {
          unsuppliedLines.push({
            line: l,
            cCount: cItems > 0 ? cItems : l.items?.length || l.quantity || 1,
          });
        } else {
          inStockLines.push(l);
        }
      });

      let targetLines: Array<{ line: any; cCount: number }> = [];

      // 1. Ayrıştırılmış Satırlar: Siparişte belirli satırlar tedarik edilemedi işaretli ise SADECE onlar suçludur!
      if (unsuppliedLines.length > 0 && inStockLines.length > 0) {
        targetLines = unsuppliedLines;
      }
      // 2. Tek Ürünlü Siparişler:
      else if (lines.length === 1) {
        targetLines = [
          {
            line: lines[0],
            cCount: lines[0].items?.length || lines[0].quantity || 1,
          },
        ];
      }
      // 3. Çok Satırlı ve Tüm Satırları Tedarik Edilemeyen Siparişler:
      else if (unsuppliedLines.length > 0 && inStockLines.length === 0) {
        targetLines = unsuppliedLines;
      }

      // Tedarik edilemeyen ürünleri haritaya ekle
      targetLines.forEach(({ line, cCount }) => {
        const barcode = (line.barcode || '').trim() || line.product?.name || line.name || 'Bilinmeyen';
        const name = line.product?.name || line.name || barcode;
        const imageUrl = line.product?.imageUrls?.[0] || line.product?.image || line.imageUrl;
        const unitPrice = line.price || 0;
        const lineLost = unitPrice * cCount;

        if (!pMap[barcode]) {
          pMap[barcode] = {
            barcode,
            name,
            imageUrl,
            orderCount: 0,
            itemCount: 0,
            lostRevenue: 0,
            branches: {},
            sampleOrders: [],
            lastCancelledDate: o.orderDate || Date.now(),
          };
        }

        const stat = pMap[barcode];
        stat.orderCount += 1;
        stat.itemCount += cCount;
        stat.lostRevenue += lineLost;
        totalLostRevenue += lineLost;
        totalLostItemCount += cCount;

        const sid = String(o.storeId || '');
        stat.branches[sid] = (stat.branches[sid] || 0) + cCount;

        const oNo = String(o.orderNumber || o.id || '');
        if (oNo && !stat.sampleOrders.includes(oNo) && stat.sampleOrders.length < 3) {
          stat.sampleOrders.push(oNo);
        }

        if (o.orderDate && o.orderDate > stat.lastCancelledDate) {
          stat.lastCancelledDate = o.orderDate;
        }
      });
    });

    let productsList = Object.values(pMap);

    // Arama Filtresi
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      productsList = productsList.filter(
        (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
      );
    }

    // Sıralama
    productsList.sort((a, b) => {
      if (sortKey === 'orderCount') return b.orderCount - a.orderCount;
      if (sortKey === 'lostRevenue') return b.lostRevenue - a.lostRevenue;
      if (sortKey === 'itemCount') return b.itemCount - a.itemCount;
      return 0;
    });

    return {
      productStats: productsList,
      generalStats: {
        unSuppliedOrdersCount,
        totalLostRevenue: Math.round(totalLostRevenue),
        totalUniqueProducts: Object.keys(pMap).length,
        totalLostItemCount,
      },
    };
  }, [filteredOrders, searchQuery, sortKey]);

  const renderProductItem = ({ item }: { item: UnsuppliedProductRecord }) => {
    const isCopied = copiedBarcode === item.barcode;
    const topBranchEntries = Object.entries(item.branches).sort((a, b) => b[1] - a[1]);

    return (
      <Card style={styles.productCard}>
        {/* Üst Satır: Görsel + Ürün Bilgisi + Kayıp Ciro */}
        <View style={styles.productCardTop}>
          {/* Ürün Görseli */}
          <TouchableOpacity
            onPress={() => item.imageUrl && setSelectedImage(item.imageUrl)}
            activeOpacity={item.imageUrl ? 0.7 : 1}
            style={styles.imageBox}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productThumb} resizeMode="contain" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialCommunityIcons name="image-outline" size={20} color="#9CA3AF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Ürün Bilgisi */}
          <View style={styles.infoCol}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>

            <View style={styles.barcodeRow}>
              {item.barcode && item.barcode !== 'Bilinmeyen' ? (
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
            <Text style={styles.lostRevVal}>
              ₺{item.lostRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* İptal Rozetleri & Aksiyon */}
        <View style={styles.statsActionRow}>
          <View style={styles.unsuppliedPillsWrap}>
            <View style={styles.orderCountPill}>
              <MaterialCommunityIcons name="close-circle" size={13} color="#DC2626" />
              <Text style={styles.orderCountPillText}>{item.orderCount} Sipariş</Text>
            </View>
            <View style={styles.itemCountPill}>
              <Text style={styles.itemCountPillText}>{item.itemCount} adet yoktu</Text>
            </View>
          </View>

          {onNavigateToStockProduct && item.barcode ? (
            <TouchableOpacity
              onPress={() => onNavigateToStockProduct(item.barcode)}
              style={styles.stockActionBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cube-scan" size={13} color="#FFFFFF" />
              <Text style={styles.stockActionText}>Stokta Düzelt</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Şube Dağılımı */}
        {topBranchEntries.length > 0 && (
          <View style={styles.branchBadgesWrap}>
            <Text style={styles.branchBadgesLabel}>Şubeler:</Text>
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

        {/* Örnek Sipariş Numaraları */}
        {item.sampleOrders && item.sampleOrders.length > 0 && (
          <View style={styles.sampleOrdersRow}>
            <Text style={styles.sampleOrdersLabel}>Örnek Siparişler:</Text>
            <View style={styles.sampleOrdersList}>
              {item.sampleOrders.map((no) => (
                <TouchableOpacity
                  key={no}
                  onPress={() => handleCopyBarcode(no)}
                  style={styles.sampleOrderPill}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sampleOrderPillText}>#{no}</Text>
                  <MaterialCommunityIcons name="content-copy" size={9} color="#2563EB" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Başlık & Arama */}
      <View style={styles.headerBar}>
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tedarik edilemeyen ürün veya barkod ara..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => fetchOrders(true)}
          style={styles.refreshIconBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 2. Zaman & Şube Filtreleri */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {TIME_FILTERS.map((tf) => {
            const isSelected = timeFilter === tf.key;
            return (
              <TouchableOpacity
                key={tf.key}
                onPress={() => setTimeFilter(tf.key as any)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.filterDivider} />

          {/* Şube Filtresi */}
          <TouchableOpacity
            onPress={() => setBranchFilter('all')}
            style={[styles.filterChip, branchFilter === 'all' && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, branchFilter === 'all' && styles.filterChipTextActive]}>
              TÜM ŞUBELER
            </Text>
          </TouchableOpacity>

          {Object.entries(BRANCHES).map(([id, name]) => {
            const isSelected = branchFilter === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setBranchFilter(id)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. KPI Özeti (Sadece Tedarik Edilemeyenlere Özel) */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={styles.kpiLabel}>TEDARİK EDİLEMEYEN SİPARİŞ</Text>
            <Text style={[styles.kpiVal, { color: '#B91C1C' }]}>
              {generalStats.unSuppliedOrdersCount}
            </Text>
            <Text style={styles.kpiSub}>Mağaza/stok problemi</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.kpiLabel}>TOPLAM KAYIP CİRO</Text>
            <Text style={[styles.kpiVal, { color: '#B45309' }]}>
              ₺{generalStats.totalLostRevenue.toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.kpiSub}>Kaçırılan net satış</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#4F46E5' }]}>
            <Text style={styles.kpiLabel}>SORUNLU ÜRÜN ÇEŞİDİ</Text>
            <Text style={[styles.kpiVal, { color: '#4338CA' }]}>
              {generalStats.totalUniqueProducts}
            </Text>
            <Text style={styles.kpiSub}>Farklı ürün kalemi</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.kpiLabel}>YOK SATAN TOPLAM ADET</Text>
            <Text style={[styles.kpiVal, { color: '#047857' }]}>
              {generalStats.totalLostItemCount}
            </Text>
            <Text style={styles.kpiSub}>Müşteriye verilemeyen</Text>
          </View>
        </View>
      </View>

      {/* 4. Sıralama Seçenekleri */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sırala:</Text>
        <TouchableOpacity
          onPress={() => setSortKey('orderCount')}
          style={[styles.sortChip, sortKey === 'orderCount' && styles.sortChipActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortChipText, sortKey === 'orderCount' && styles.sortChipTextActive]}>
            Sipariş Sayısı
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortKey('lostRevenue')}
          style={[styles.sortChip, sortKey === 'lostRevenue' && styles.sortChipActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortChipText, sortKey === 'lostRevenue' && styles.sortChipTextActive]}>
            Kayıp Ciro (₺)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortKey('itemCount')}
          style={[styles.sortChip, sortKey === 'itemCount' && styles.sortChipActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortChipText, sortKey === 'itemCount' && styles.sortChipTextActive]}>
            Yok Satan Adet
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. Ürün Listesi */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Tedarik edilemeyen ürünler analiz ediliyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchOrders()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={productStats}
          keyExtractor={(item) => item.barcode}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Tedarik Edilemeyen Ürün Yok"
              message="Seçilen kriterlerde mağaza veya stok kaynaklı iptal edilen ürün kaydı bulunmamaktadır."
            />
          }
        />
      )}

      {/* 6. Görsel Büyütme Modalı */}
      {selectedImage && (
        <Modal
          visible={!!selectedImage}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedImage(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedImage(null)}
          >
            <View style={styles.imageModalBox}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedImage(null)}
              >
                <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 4,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  filterScroll: {
    paddingHorizontal: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  kpiContainer: {
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    padding: 8,
    borderRadius: 4,
  },
  kpiLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 8.5,
    color: '#9CA3AF',
    marginTop: 1,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  sortChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sortChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  sortChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  sortChipTextActive: {
    color: '#4338CA',
    fontWeight: '800',
  },
  listContent: {
    padding: 10,
    gap: 8,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  productCard: {
    padding: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  productCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  imageBox: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  infoCol: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  barcodeText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  copyBtnText: {
    fontSize: 8.5,
    color: '#6B7280',
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#059669',
  },
  noBarcodeText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  lostRevBox: {
    alignItems: 'flex-end',
  },
  lostRevLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  lostRevVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  statsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  unsuppliedPillsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  orderCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
  },
  itemCountPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  itemCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  stockActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  stockActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  branchBadgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchBadgesLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  branchBadgesScroll: {
    flex: 1,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 4,
  },
  branchPillName: {
    fontSize: 9,
    color: '#374151',
    fontWeight: '600',
  },
  branchPillCount: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
  },
  sampleOrdersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sampleOrdersLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  sampleOrdersList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  sampleOrderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  sampleOrderPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageModalBox: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    padding: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#111827',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: 350,
  },
});
