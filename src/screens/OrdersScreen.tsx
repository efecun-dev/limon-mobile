import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Clipboard,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { ordersService } from '../api/services';
import { OrderPackage } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';
import { OrderDetailModal, getLineImage, getLinePreviousStock } from './OrderDetailModal';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';

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

const STATUS_FILTERS = [
  { key: 'all', label: 'TÜMÜ' },
  { key: 'Created', label: 'YENİ' },
  { key: 'Picking', label: 'TOPLANIYOR' },
  { key: 'Invoiced', label: 'FATURALANDI' },
  { key: 'Shipped', label: 'YOLDA' },
  { key: 'Delivered', label: 'TESLİM' },
  { key: 'Cancelled', label: 'İPTAL' },
  { key: 'UnSupplied', label: 'TEDARİK EDİLEMEDİ' },
];

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  Created: { label: 'Yeni', dot: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF' },
  Picking: { label: 'Toplanıyor', dot: '#F59E0B', text: '#B45309', bg: '#FFFBEB' },
  Invoiced: { label: 'Faturalandı', dot: '#A855F7', text: '#7E22CE', bg: '#FAF5FF' },
  Shipped: { label: 'Yolda', dot: '#F97316', text: '#C2410C', bg: '#FFF7ED' },
  Delivered: { label: 'Teslim Edildi', dot: '#10B981', text: '#047857', bg: '#ECFDF5' },
  Cancelled: { label: 'İptal', dot: '#EF4444', text: '#B91C1C', bg: '#FEF2F2' },
  UnSupplied: { label: 'Tedarik Edilemedi', dot: '#B91C1C', text: '#991B1B', bg: '#FEF2F2' },
};

export const OrdersScreen: React.FC<{
  onOpenServerSettings: () => void;
  onOpenBranchPicker: () => void;
}> = ({ onOpenServerSettings, onOpenBranchPicker }) => {
  const { activeBranchId } = useAuth();
  const { serverUrl } = useServer();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleScannedBarcode = (scannedCode: string) => {
    setSearchQuery(scannedCode);
  };

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params: any = {
        size: 150,
        fetchDays: 30,
      };

      if (activeBranchId && activeBranchId !== 'all') {
        params.storeId = activeBranchId;
      }
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await ordersService.getOrders(params);

      if (response && Array.isArray(response.content)) {
        setOrders(response.content);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error('Sipariş çekme hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Siparişler sunucudan çekilemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Durum sayaçları
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      const s = o.packageStatus || 'Created';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const statusCfg = STATUS_MAP[item.packageStatus] || {
      label: item.packageStatus,
      dot: '#6B7280',
      text: '#374151',
      bg: '#F3F4F6',
    };

    const formattedDate = item.orderDate
      ? new Date(item.orderDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : '';

    const altCount = item.lines?.reduce((acc: number, l: any) =>
      acc + (l.items?.filter((it: any) => it.isAlternative).length || 0), 0) || 0;
    const cancCount = item.lines?.reduce((acc: number, l: any) =>
      acc + (l.items?.filter((it: any) => it.isCancelled).length || 0), 0) || 0;
    const isPromo = item.lines?.some((l: any) =>
      l.items?.some((it: any) => it.promotions?.length > 0));

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedOrder(item)}>
        <Card style={styles.orderCard}>
          {/* Üst Satır: Sipariş No & Zaman & Kopyala */}
          <View style={styles.cardHeader}>
            <View style={styles.orderNumberRow}>
              <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
              <Text style={styles.orderTime}>{formattedDate}</Text>
            </View>

            <View style={styles.badgeGroup}>
              {item.isCourierNearby &&
                !['Shipped', 'Delivered', 'Cancelled', 'UnSupplied'].includes(item.packageStatus) && (
                <View style={styles.courierTag}>
                  <MaterialCommunityIcons name="moped" size={12} color="#C2410C" />
                  <Text style={styles.courierTagText}>Kurye Yaklaştı</Text>
                </View>
              )}

              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.dot }]}>
                <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
                <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
                  {statusCfg.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Orta Satır: Şube & Müşteri */}
          <View style={styles.branchCustomerRow}>
            <Text style={styles.branchNameText} numberOfLines={1}>
              {BRANCHES[item.storeId?.toString()] || `Şube ${item.storeId}`}
            </Text>
            <Text style={styles.customerNameText} numberOfLines={1}>
              {item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : 'Müşteri'}
            </Text>
          </View>

          {/* Müşteri Notu Varsa */}
          {item.customer?.note ? (
            <View style={styles.customerNoteBox}>
              <Text style={styles.customerNoteText} numberOfLines={1}>
                "{item.customer.note}"
              </Text>
            </View>
          ) : null}

          {/* Sipariş Ürünleri Önizlemesi (Fotoğraf & Önceki Stok) */}
          {item.lines && item.lines.length > 0 && (
            <View style={styles.cardLinesBox}>
              {item.lines.slice(0, 3).map((line: any, idx: number) => {
                const img = getLineImage(line);
                const prevStock = getLinePreviousStock(line);
                const qty = line.items?.length || line.amount || 1;
                const pName = line.product?.name || line.product?.productSaleName || line.name || 'Ürün';

                return (
                  <View key={idx} style={styles.cardLineRow}>
                    <View style={styles.cardLineThumbWrap}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.cardLineThumb} resizeMode="contain" />
                      ) : (
                        <MaterialCommunityIcons name="package-variant-closed" size={13} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.cardLineInfo}>
                      <Text style={styles.cardLineName} numberOfLines={1}>
                        <Text style={styles.cardLineQty}>{qty}× </Text>
                        {pName}
                      </Text>
                    </View>
                    {prevStock !== null ? (
                      <View style={styles.cardLinePrevStock}>
                        <MaterialCommunityIcons name="history" size={10} color="#4B5563" />
                        <Text style={styles.cardLinePrevStockText}>Önceki: {prevStock}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {item.lines.length > 3 && (
                <Text style={styles.cardMoreLinesText}>
                  +{item.lines.length - 3} ürün daha...
                </Text>
              )}
            </View>
          )}

          {/* Alt Satır: Alarmlar & Tutar */}
          <View style={styles.cardFooter}>
            <View style={styles.alarmsRow}>
              {altCount > 0 && (
                <View style={styles.alarmBadgeAmber}>
                  <Text style={styles.alarmBadgeAmberText}>{altCount} Alt</Text>
                </View>
              )}
              {cancCount > 0 && (
                <View style={styles.alarmBadgeRed}>
                  <Text style={styles.alarmBadgeRedText}>{cancCount} İptal</Text>
                </View>
              )}
              {isPromo && (
                <View style={styles.alarmBadgeGray}>
                  <Text style={styles.alarmBadgeGrayText}>Promo</Text>
                </View>
              )}
            </View>

            <Text style={styles.priceSummary}>
              {(item.grossAmount || item.totalPrice || 0).toFixed(2)} ₺
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header & Arama */}
      <View style={styles.subHeader}>
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sipariş No, Müşteri veya Barkod Ara..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => fetchOrders()}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={styles.searchCameraBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={15} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onOpenBranchPicker} style={styles.branchPickerBtn}>
          <MaterialCommunityIcons name="store-outline" size={14} color="#FFFFFF" />
          <Text style={styles.branchPickerBtnText}>
            {activeBranchId && activeBranchId !== 'all'
              ? BRANCHES[activeBranchId] || 'Şube'
              : 'Tüm Şubeler'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Durum Filtre Barı (Panel Status Tabs) */}
      <View style={styles.filterScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = selectedStatus === item.key;
            const count = statusCounts[item.key] || 0;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedStatus(item.key)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {item.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isSelected && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isSelected && styles.filterBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 3. Liste / Yükleniyor / Hata Durumu */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Siparişler sunucudan çekiliyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchOrders()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item, idx) => item.id?.toString() || item.orderNumber || idx.toString()}
          renderItem={renderOrderItem}
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
              title="Kayıtlı Sipariş Bulunamadı"
              message="Seçilen filtre ve şube kriterlerine uyan sipariş bulunmamaktadır."
            />
          }
        />
      )}

      {/* 4. Sipariş Detay Modalı */}
      <OrderDetailModal
        order={selectedOrder}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {/* 5. Kamera Barkod Tarayıcı Modalı */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedBarcode}
        title="SİPARİŞTE BARKOD TARA"
        subtitle="Barkodu hizalayarak ürünü içeren siparişi anında bulun"
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 3,
    paddingHorizontal: 8,
    height: 32,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  searchCameraBtn: {
    padding: 3,
    backgroundColor: '#374151',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 3,
  },
  branchPickerBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    maxWidth: 90,
  },
  filterScrollWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
  },
  filterList: {
    paddingHorizontal: 8,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  filterBadgeActive: {
    backgroundColor: '#374151',
  },
  filterBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#111827',
  },
  filterBadgeTextActive: {
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
  orderCard: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  orderTime: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courierTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  courierTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#C2410C',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  branchCustomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  branchNameText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  customerNameText: {
    fontSize: 10,
    color: '#6B7280',
    maxWidth: 120,
    textAlign: 'right',
  },
  customerNoteBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    marginTop: 4,
  },
  customerNoteText: {
    fontSize: 9,
    color: '#92400E',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  alarmsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  alarmBadgeAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  alarmBadgeAmberText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B45309',
  },
  alarmBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  alarmBadgeRedText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B91C1C',
  },
  alarmBadgeGray: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  alarmBadgeGrayText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  priceSummary: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
  },
  cardLinesBox: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginVertical: 4,
    borderRadius: 2,
    gap: 4,
  },
  cardLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardLineThumbWrap: {
    width: 26,
    height: 26,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardLineThumb: {
    width: '100%',
    height: '100%',
  },
  cardLineInfo: {
    flex: 1,
  },
  cardLineName: {
    fontSize: 10,
    color: '#1F2937',
    fontWeight: '500',
  },
  cardLineQty: {
    fontWeight: 'bold',
    color: '#111827',
  },
  cardLinePrevStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  cardLinePrevStockText: {
    fontSize: 8,
    color: '#374151',
    fontWeight: '600',
  },
  cardMoreLinesText: {
    fontSize: 9,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
