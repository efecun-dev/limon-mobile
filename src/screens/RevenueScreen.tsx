import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useServer } from '../context/ServerContext';
import { ordersService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

export const RevenueScreen: React.FC<{ onOpenServerSettings: () => void }> = ({
  onOpenServerSettings,
}) => {
  const { serverUrl } = useServer();

  const [allOrdersData, setAllOrdersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchBranch, setSearchBranch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Son 30 günlük takvim sütunlarını oluştur (En sağda bugün, sola doğru son 30 gün)
  const { days30, prev30CutoffKey } = useMemo(() => {
    const days: Array<{
      key: string;
      dayOfMonth: number;
      monthLabel: string;
      label: string;
      fullLabel: string;
      isToday: boolean;
    }> = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const dayOfMonth = d.getDate();
      const monthLabel = d.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '');
      const monthLong = d.toLocaleDateString('tr-TR', { month: 'long' });
      days.push({
        key,
        dayOfMonth,
        monthLabel,
        label: `${dayOfMonth} ${monthLabel}`,
        fullLabel: `${dayOfMonth} ${monthLong} ${yyyy}`,
        isToday: i === 0,
      });
    }
    const d30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const prevKey = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
    return { days30: days, prev30CutoffKey: prevKey };
  }, []);

  // Son 35 günün sipariş verilerini çek
  const fetch30DaysData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await ordersService.getOrders({ size: 300, fetchDays: 35 });
      setAllOrdersData(res?.content || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Son 30 günlük ciro analizi verisi çekilemedi:', err.message);
      setError(err.response?.data?.error || err.message || 'Ciro analizi verileri alınamadı.');
      setAllOrdersData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch30DaysData();
  }, [fetch30DaysData]);

  // Şube ve gün bazlı ciro & sipariş hesaplaması
  const tableData = useMemo(() => {
    const branchMap: Record<
      string,
      {
        branchId: string;
        branchName: string;
        totalCiro: number;
        totalOrders: number;
        daysCiro: Record<string, number>;
        daysOrders: Record<string, number>;
        prevCutoffCiro: number;
      }
    > = {};

    Object.entries(BRANCHES).forEach(([bId, bName]) => {
      branchMap[bId] = {
        branchId: bId,
        branchName: bName,
        totalCiro: 0,
        totalOrders: 0,
        daysCiro: {},
        daysOrders: {},
        prevCutoffCiro: 0,
      };
      days30.forEach((day) => {
        branchMap[bId].daysCiro[day.key] = 0;
        branchMap[bId].daysOrders[day.key] = 0;
      });
    });

    const validDaysKeys = new Set(days30.map((d) => d.key));

    allOrdersData.forEach((order) => {
      if (!order.orderDate) return;
      if (['Cancelled', 'UnSupplied'].includes(order.packageStatus)) return;

      const d = new Date(order.orderDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const orderDateKey = `${yyyy}-${mm}-${dd}`;

      const bId = String(order.storeId);
      const row = branchMap[bId];
      if (!row) return;

      const orderTotal = order.grossAmount || order.totalPrice || 0;

      if (validDaysKeys.has(orderDateKey)) {
        row.daysCiro[orderDateKey] = (row.daysCiro[orderDateKey] || 0) + orderTotal;
        row.daysOrders[orderDateKey] = (row.daysOrders[orderDateKey] || 0) + 1;
        row.totalCiro += orderTotal;
        row.totalOrders += 1;
      } else if (orderDateKey === prev30CutoffKey) {
        row.prevCutoffCiro += orderTotal;
      }
    });

    return Object.values(branchMap).sort((a, b) => b.totalCiro - a.totalCiro);
  }, [allOrdersData, days30, prev30CutoffKey]);

  // Arama filtrelemesi
  const filteredData = useMemo(() => {
    if (!searchBranch.trim()) return tableData;
    const q = searchBranch.toLowerCase().trim();
    return tableData.filter((r) => r.branchName.toLowerCase().includes(q));
  }, [tableData, searchBranch]);

  // Genel Toplam Satırı
  const totalSummary = useMemo(() => {
    const summary = {
      totalCiro: 0,
      totalOrders: 0,
      daysCiro: {} as Record<string, number>,
      daysOrders: {} as Record<string, number>,
    };

    days30.forEach((day) => {
      summary.daysCiro[day.key] = 0;
      summary.daysOrders[day.key] = 0;
    });

    tableData.forEach((row) => {
      summary.totalCiro += row.totalCiro;
      summary.totalOrders += row.totalOrders;
      days30.forEach((day) => {
        summary.daysCiro[day.key] += row.daysCiro[day.key] || 0;
        summary.daysOrders[day.key] += row.daysOrders[day.key] || 0;
      });
    });

    return summary;
  }, [tableData, days30]);

  // KPI Hesaplamaları
  const topBranchByCiro = useMemo(() => {
    if (tableData.length === 0) return null;
    return [...tableData].sort((a, b) => b.totalCiro - a.totalCiro)[0];
  }, [tableData]);

  const topBranchByOrders = useMemo(() => {
    if (tableData.length === 0) return null;
    return [...tableData].sort((a, b) => b.totalOrders - a.totalOrders)[0];
  }, [tableData]);

  const activeDaysCount = useMemo(() => {
    let count = 0;
    days30.forEach((day) => {
      if ((totalSummary.daysOrders[day.key] || 0) > 0) count++;
    });
    return count || 1;
  }, [totalSummary, days30]);

  const avgDailyCiro = Math.round(totalSummary.totalCiro / activeDaysCount);
  const avgDailyOrders = Math.round(totalSummary.totalOrders / activeDaysCount);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Son 30 Günlük Veriler Hesaplanıyor...</Text>
      </View>
    );
  }

  if (error && allOrdersData.length === 0) {
    return (
      <ErrorView
        title="Ciro Analizi Hatası"
        message={error}
        onRetry={() => fetch30DaysData(true)}
        onOpenServerSettings={onOpenServerSettings}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <Text style={styles.subHeaderTitle}>SON 30 GÜNLÜK ŞUBE CİRO & SİPARİŞ ANALİZİ</Text>
          <Text style={styles.subHeaderSubtitle}>
            Her gün için sol sütunda ciro tutarı, sağ sütunda sipariş adedi gösterilir
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetch30DaysData(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="refresh" size={14} color="#FFFFFF" />
          <Text style={styles.refreshBtnText}>Yenile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetch30DaysData(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* 2. 4'lü KPI Kartları */}
        <View style={styles.kpiGrid}>
          {/* Kart 1: Toplam Ciro */}
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiCardLabel}>SON 30 GÜN TOPLAM CİRO</Text>
            <Text style={styles.kpiCardValue}>
              {Math.floor(totalSummary.totalCiro).toLocaleString('tr-TR')} ₺
            </Text>
            <Text style={styles.kpiCardSub}>
              Günlük Ort: <Text style={styles.boldText}>{avgDailyCiro.toLocaleString('tr-TR')} ₺</Text>
            </Text>
          </Card>

          {/* Kart 2: Toplam Sipariş */}
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiCardLabel}>SON 30 GÜN TOPLAM SİPARİŞ</Text>
            <Text style={[styles.kpiCardValue, { color: '#2563EB' }]}>
              {totalSummary.totalOrders.toLocaleString('tr-TR')}{' '}
              <Text style={styles.kpiCardSubAdet}>Adet</Text>
            </Text>
            <Text style={styles.kpiCardSub}>
              Günlük Ort: <Text style={styles.boldText}>{avgDailyOrders} Sipariş</Text>
            </Text>
          </Card>

          {/* Kart 3: En Yüksek Cirolu Şube */}
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiCardLabel}>EN YÜKSEK CİROLU ŞUBE</Text>
            <Text style={styles.kpiBranchName} numberOfLines={1}>
              {topBranchByCiro?.branchName || '-'}
            </Text>
            <Text style={styles.kpiBranchCiroVal}>
              {Math.floor(topBranchByCiro?.totalCiro || 0).toLocaleString('tr-TR')} ₺
            </Text>
          </Card>

          {/* Kart 4: En Çok Sipariş Alan Şube */}
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiCardLabel}>EN ÇOK SİPARİŞ ALAN ŞUBE</Text>
            <Text style={styles.kpiBranchName} numberOfLines={1}>
              {topBranchByOrders?.branchName || '-'}
            </Text>
            <Text style={styles.kpiBranchOrderVal}>
              {(topBranchByOrders?.totalOrders || 0).toLocaleString('tr-TR')} Sipariş
            </Text>
          </Card>
        </View>

        {/* 3. Arama Çubuğu */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şube adı ile filtrele..."
              placeholderTextColor={colors.textMuted}
              value={searchBranch}
              onChangeText={setSearchBranch}
            />
            {searchBranch ? (
              <TouchableOpacity onPress={() => setSearchBranch('')}>
                <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.searchCountText}>
            {filteredData.length} Şube • 30 Gün
          </Text>
        </View>

        {/* 4. Ana 30 Günlük Şube Ciro & Sipariş Matrisi */}
        <Card style={styles.matrixCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Tablo Başlık Satırı */}
              <View style={styles.matrixHeadRow}>
                <View style={styles.colBranchStickyHead}>
                  <Text style={styles.headCellText}>ŞUBE ADI</Text>
                </View>
                <View style={styles.colTotalStickyHead}>
                  <Text style={[styles.headCellText, { textAlign: 'right' }]}>30G CİRO</Text>
                </View>
                <View style={styles.colOrdersStickyHead}>
                  <Text style={[styles.headCellText, { textAlign: 'right' }]}>SİPARİŞ</Text>
                </View>
                {days30.map((d) => (
                  <View
                    key={d.key}
                    style={[
                      styles.colDayHead,
                      d.isToday && styles.colDayHeadToday,
                    ]}
                  >
                    <Text style={[styles.dayHeadMonth, d.isToday && styles.textToday]}>
                      {d.monthLabel}
                    </Text>
                    <Text style={[styles.dayHeadNum, d.isToday && styles.textToday]}>
                      {d.dayOfMonth}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Şube Satırları */}
              {filteredData.map((row, rIdx) => (
                <View key={row.branchId || rIdx} style={styles.matrixRow}>
                  {/* Sabit Şube Kolonu */}
                  <View style={styles.colBranchStickyCell}>
                    <Text style={styles.cellBranchName} numberOfLines={1}>
                      {row.branchName}
                    </Text>
                  </View>

                  {/* Sabit 30G Ciro Kolonu */}
                  <View style={styles.colTotalStickyCell}>
                    <Text style={styles.cellTotalVal}>
                      {row.totalCiro > 0 ? Math.round(row.totalCiro).toLocaleString('tr-TR') : '-'}
                    </Text>
                  </View>

                  {/* Sabit 30G Sipariş Kolonu */}
                  <View style={styles.colOrdersStickyCell}>
                    <Text style={styles.cellOrdersVal}>
                      {row.totalOrders > 0 ? row.totalOrders : '-'}
                    </Text>
                  </View>

                  {/* Günlük Hücreler (Ciro + Sipariş) */}
                  {days30.map((day, dIdx) => {
                    const currentCiro = row.daysCiro[day.key] || 0;
                    const prevCiro =
                      dIdx === 0
                        ? row.prevCutoffCiro
                        : row.daysCiro[days30[dIdx - 1].key] || 0;
                    const orderCount = row.daysOrders[day.key] || 0;

                    let bgStyle = styles.cellNormal;
                    let textStyle: any = styles.cellValText;
                    if (currentCiro > 0) {
                      if (currentCiro > prevCiro) {
                        bgStyle = styles.cellUp;
                        textStyle = styles.cellUpText;
                      } else if (currentCiro < prevCiro) {
                        bgStyle = styles.cellDown;
                        textStyle = styles.cellDownText;
                      }
                    }

                    return (
                      <View
                        key={day.key}
                        style={[
                          styles.colDayCell,
                          bgStyle,
                          day.isToday && styles.cellTodayBorder,
                        ]}
                      >
                        <Text style={[styles.cellValText, textStyle]}>
                          {currentCiro > 0 ? Math.round(currentCiro).toLocaleString('tr-TR') : '-'}
                        </Text>
                        {orderCount > 0 && (
                          <Text style={styles.cellOrderSub}>
                            {orderCount} sip
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* GENEL TOPLAM Satırı */}
              {filteredData.length > 0 && (
                <View style={styles.matrixTotalRow}>
                  <View style={styles.colBranchStickyTotal}>
                    <Text style={styles.totalRowTitle}>GENEL TOPLAM</Text>
                  </View>
                  <View style={styles.colTotalStickyTotal}>
                    <Text style={styles.totalRowBigVal}>
                      {Math.round(totalSummary.totalCiro).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  <View style={styles.colOrdersStickyTotal}>
                    <Text style={styles.totalRowOrderVal}>
                      {totalSummary.totalOrders.toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  {days30.map((day) => {
                    const currentCiro = totalSummary.daysCiro[day.key] || 0;
                    const currentOrders = totalSummary.daysOrders[day.key] || 0;

                    return (
                      <View
                        key={`total-${day.key}`}
                        style={[
                          styles.colDayCell,
                          styles.totalCellBg,
                          day.isToday && styles.cellTodayBorder,
                        ]}
                      >
                        <Text style={styles.totalDayText}>
                          {currentCiro > 0 ? Math.round(currentCiro).toLocaleString('tr-TR') : '-'}
                        </Text>
                        {currentOrders > 0 && (
                          <Text style={styles.totalDayOrderSub}>
                            {currentOrders} sip
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  subHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  subHeaderTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subHeaderSubtitle: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  refreshBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
    gap: 8,
  },
  kpiGrid: {
    gap: 6,
  },
  kpiCard: {
    padding: 10,
  },
  kpiCardLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kpiCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  kpiCardSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  kpiCardSubAdet: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: 'normal',
  },
  kpiBranchName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 2,
  },
  kpiBranchCiroVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
    marginTop: 1,
  },
  kpiBranchOrderVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1D4ED8',
    marginTop: 1,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#111827',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  searchCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  matrixCard: {
    padding: 8,
  },
  matrixHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  colBranchStickyHead: {
    width: 125,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  colTotalStickyHead: {
    width: 75,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  colOrdersStickyHead: {
    width: 55,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  headCellText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colDayHead: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  colDayHeadToday: {
    backgroundColor: '#064E3B',
    borderRightColor: '#059669',
  },
  dayHeadMonth: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  dayHeadNum: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  textToday: {
    color: '#34D399',
  },
  matrixRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  colBranchStickyCell: {
    width: 125,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
  },
  cellBranchName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  colTotalStickyCell: {
    width: 75,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cellTotalVal: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
    fontVariant: ['tabular-nums'],
  },
  colOrdersStickyCell: {
    width: 55,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cellOrdersVal: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1D4ED8',
    fontVariant: ['tabular-nums'],
  },
  colDayCell: {
    width: 58,
    paddingVertical: 4,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'flex-end',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  cellNormal: {
    backgroundColor: '#FFFFFF',
  },
  cellUp: {
    backgroundColor: '#DCFCE7',
  },
  cellDown: {
    backgroundColor: '#FEE2E2',
  },
  cellValText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  cellOrderSub: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: 1,
  },
  cellUpText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#14532D',
    fontVariant: ['tabular-nums'],
  },
  cellDownText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#7F1D1D',
    fontVariant: ['tabular-nums'],
  },
  cellTodayBorder: {
    borderRightWidth: 2,
    borderRightColor: '#10B981',
  },
  matrixTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderTopWidth: 2,
    borderTopColor: '#9CA3AF',
  },
  colBranchStickyTotal: {
    width: 125,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#9CA3AF',
    justifyContent: 'center',
  },
  totalRowTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
  },
  colTotalStickyTotal: {
    width: 75,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  totalRowBigVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  colOrdersStickyTotal: {
    width: 55,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  totalRowOrderVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1D4ED8',
    fontVariant: ['tabular-nums'],
  },
  totalCellBg: {
    backgroundColor: '#E5E7EB',
  },
  totalDayText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  totalDayOrderSub: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 1,
  },
});
