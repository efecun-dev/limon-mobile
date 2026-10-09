import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { ordersService, reviewsService, claimsService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

const STATUS_LABELS: Record<string, string> = {
  Created: 'Yeni',
  Picking: 'Toplanıyor',
  Invoiced: 'Faturalandı',
  Shipped: 'Yolda',
  Delivered: 'Teslim Edildi',
  Cancelled: 'İptal',
  UnSupplied: 'Tedarik Edilemedi',
};

const STATUS_COLORS: Record<string, string> = {
  Created: '#3B82F6',
  Picking: '#F59E0B',
  Invoiced: '#A855F7',
  Shipped: '#F97316',
  Delivered: '#10B981',
  Cancelled: '#EF4444',
  UnSupplied: '#B91C1C',
};

export const DashboardScreen: React.FC<{
  onOpenServerSettings: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToRevenue?: () => void;
  onNavigateToStocks?: () => void;
  onNavigateToClaims?: () => void;
  onNavigateToReviews?: () => void;
  onNavigateToLevels?: () => void;
  onNavigateToCancellations?: () => void;
}> = ({
  onOpenServerSettings,
  onNavigateToOrders,
  onNavigateToRevenue,
  onNavigateToStocks,
  onNavigateToClaims,
  onNavigateToReviews,
  onNavigateToLevels,
  onNavigateToCancellations,
}) => {
  const { activeBranchId } = useAuth();
  const { serverUrl } = useServer();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthDataLoading, setMonthDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Panel Metrikleri
  const [stats, setStats] = useState({
    activeOrders: 0,
    deliveredOrders: 0,
    totalOrders: 0,
    totalReviews: 0,
    avgRating: '0.0',
    todayReviews: 0,
    unansweredReviews: 0,
    activeReturns: 0,
    resolvedReturns: 0,
    totalReturns: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayOrderCount: 0,
    avgOrderValue: 0,
    qualityScore: 0,
    deliveryScore: 0,
    cancelledRevenue: 0,
    altRate: 0,
    cancelRate: 0,
    promoCost: 0,
    promoRate: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topReturned, setTopReturned] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [sevenDaysData, setSevenDaysData] = useState<any[]>([]);
  const [allOrdersData, setAllOrdersData] = useState<any[]>([]);
  const [monthlyTableData, setMonthlyTableData] = useState<any[]>([]);

  const [selectedTrendBranch, setSelectedTrendBranch] = useState('all');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [branchSelectModalVisible, setBranchSelectModalVisible] = useState(false);

  // 30 Günlük Sütun Takvimi (periodOffset: 0 => bugün en sağda, sola doğru 30 gün)
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
    const startDaysAgo = (periodOffset + 1) * 30 - 1;
    const endDaysAgo = periodOffset * 30;

    for (let i = startDaysAgo; i >= endDaysAgo; i--) {
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
        isToday: i === 0 && periodOffset === 0,
      });
    }
    const d30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (periodOffset + 1) * 30);
    const prevKey = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
    return { days30: days, prev30CutoffKey: prevKey };
  }, [periodOffset]);

  // Ana Veri Çekme Fonksiyonu
  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const storeIds = Object.keys(BRANCHES).join(',');
      const [ordersRes, reviewsRes, returnsRes] = await Promise.all([
        ordersService.getOrders({ size: 250, fetchDays: 35 }).catch(() => null),
        reviewsService.getReviews(storeIds).catch(() => null),
        claimsService.getClaims().catch(() => null),
      ]);

      const ordersList = ordersRes?.content || [];
      const reviewsList = reviewsRes?.content || [];
      const returnsList = returnsRes?.content || [];

      setAllOrdersData(ordersList);

      // --- 1. Sipariş Metrikleri ---
      let activeO = 0;
      let deliveredO = 0;
      let totalO = 0;
      let todayRev = 0;
      let todayOrderCount = 0;
      let cancelledRev = 0;
      let totalItems = 0;
      let altItems = 0;
      let cancelledItems = 0;
      let totalPromoCost = 0;
      let promoOrders = 0;

      const statusCounts: Record<string, number> = {};
      const todayStr = new Date().toLocaleDateString('tr-TR');
      const branchStats: Record<string, { ciro: number; alt: number; totalItems: number; siparis: number; iptal: number }> = {};
      const productSales: Record<string, { name: string; qty: number }> = {};
      const dailyTrendMap: Record<string, { siparis: number; ciro: number; branches: Record<string, { siparis: number; ciro: number }> }> = {};

      Object.keys(BRANCHES).forEach((sid) => {
        branchStats[sid] = { ciro: 0, alt: 0, totalItems: 0, siparis: 0, iptal: 0 };
      });

      ordersList.forEach((o: any) => {
        totalO++;
        const status = o.packageStatus || 'Created';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (['Created', 'Picking', 'Invoiced', 'Shipped'].includes(status)) activeO++;
        if (status === 'Delivered') deliveredO++;

        const isToday = o.orderDate && new Date(o.orderDate).toLocaleDateString('tr-TR') === todayStr;
        const orderTotal = o.grossAmount || o.totalPrice || 0;
        const sid = o.storeId?.toString();

        if (isToday) {
          todayOrderCount++;
          if (!['Cancelled', 'UnSupplied'].includes(status)) {
            todayRev += orderTotal;
          } else {
            cancelledRev += orderTotal;
          }
        }

        // Satıcı Promosyonları Hesabı
        let isPromo = false;
        if (o.lines) {
          o.lines.forEach((line: any) => {
            const pName = line.product?.name || line.barcode || 'Ürün';
            const qty = line.items?.length || 1;
            if (!productSales[pName]) productSales[pName] = { name: pName, qty: 0 };
            productSales[pName].qty += qty;

            if (line.items) {
              line.items.forEach((it: any) => {
                totalItems++;
                if (sid && branchStats[sid]) branchStats[sid].totalItems++;
                if (it.isAlternative) {
                  altItems++;
                  if (sid && branchStats[sid]) branchStats[sid].alt++;
                }
                if (it.isCancelled) {
                  cancelledItems++;
                  if (sid && branchStats[sid]) branchStats[sid].iptal++;
                }
                if (it.promotions) {
                  it.promotions.forEach((p: any) => {
                    if (p.sellerPaid || p.type === 'Seller' || p.type === 'SELLER') {
                      totalPromoCost += (p.amount || 0);
                      isPromo = true;
                    }
                  });
                }
              });
            }
          });
        }
        if (isPromo) promoOrders++;

        // Günlük Trend Haritası (Son 7 Gün)
        if (o.orderDate) {
          const d = new Date(o.orderDate);
          const monthShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()];
          const dayKey = `${d.getDate()} ${monthShort}`;

          if (!dailyTrendMap[dayKey]) {
            dailyTrendMap[dayKey] = { siparis: 0, ciro: 0, branches: {} };
            Object.keys(BRANCHES).forEach((b) => {
              dailyTrendMap[dayKey].branches[b] = { siparis: 0, ciro: 0 };
            });
          }

          if (!['Cancelled', 'UnSupplied'].includes(status)) {
            dailyTrendMap[dayKey].siparis++;
            dailyTrendMap[dayKey].ciro += orderTotal;
            if (sid && dailyTrendMap[dayKey].branches[sid]) {
              dailyTrendMap[dayKey].branches[sid].siparis++;
              dailyTrendMap[dayKey].branches[sid].ciro += orderTotal;
            }
          }
        }

        if (sid && branchStats[sid] && !['Cancelled', 'UnSupplied'].includes(status)) {
          branchStats[sid].ciro += orderTotal;
          branchStats[sid].siparis++;
        }
      });

      // Son Siparişler (En güncel 10 sipariş)
      const sortedOrders = [...ordersList].sort((a: any, b: any) => (b.orderDate || 0) - (a.orderDate || 0));
      setRecentOrders(sortedOrders.slice(0, 10));

      // En Çok Satanlar (Top 5)
      const sortedProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sortedProducts);

      // Sipariş Durum Dağılımı
      const statusData = Object.entries(statusCounts)
        .map(([key, val]) => ({
          key,
          name: STATUS_LABELS[key] || key,
          value: val,
        }))
        .sort((a, b) => b.value - a.value);
      setStatusBreakdown(statusData);

      // --- 2. Yorum ve Memnuniyet Metrikleri ---
      let tReviews = 0;
      let totalRating = 0;
      let todayR = 0;
      let unanswered = 0;
      const branchReviewCounts: Record<string, { count: number; total: number }> = {};

      reviewsList.forEach((r: any) => {
        tReviews++;
        const score = r.rating?.averageScore || r.rate || 0;
        totalRating += score;
        if (r.createdDate && new Date(r.createdDate).toLocaleDateString('tr-TR') === todayStr) {
          todayR++;
        }
        if (!(r.comment?.sellerAnswer || r.sellerAnswer?.text)) unanswered++;

        const sid = r.storeId?.toString() || '?';
        if (!branchReviewCounts[sid]) branchReviewCounts[sid] = { count: 0, total: 0 };
        branchReviewCounts[sid].count++;
        branchReviewCounts[sid].total += score;
      });

      const avgR = tReviews > 0 ? (totalRating / tReviews).toFixed(1) : '0.0';

      // --- 3. İadeler ---
      let actReturns = 0;
      returnsList.forEach((c: any) => {
        const itemStatus = c.claimItems?.[0]?.claimItemStatus?.name;
        if (['Created', 'WaitingInAction', 'Unresolved'].includes(itemStatus)) actReturns++;
      });

      // Şube Operasyon Performans Listesi
      const bPerf = Object.entries(BRANCHES).map(([sid, name]) => {
        const st = branchStats[sid] || { ciro: 0, alt: 0, totalItems: 1, siparis: 0, iptal: 0 };
        const rev = branchReviewCounts[sid] || { count: 0, total: 0 };
        const altR = st.totalItems > 0 ? Math.round((st.alt / st.totalItems) * 100) : 0;
        const iptalR = st.totalItems > 0 ? Math.round((st.iptal / st.totalItems) * 100) : 0;
        return {
          id: sid,
          name,
          ciro: Math.round(st.ciro),
          siparis: st.siparis,
          altRate: altR,
          iptalRate: iptalR,
          puan: rev.count > 0 ? parseFloat((rev.total / rev.count).toFixed(1)) : 0,
          yorum: rev.count,
        };
      }).sort((a, b) => b.ciro - a.ciro);
      setBranchPerformance(bPerf);

      // En Çok İade Edilenler (Top 5)
      const returnProductsMap: Record<string, number> = {};
      returnsList.forEach((c: any) => {
        const pName = c.claimItems?.[0]?.customerClaimItemReason?.name || 'İade Edilen Ürün';
        returnProductsMap[pName] = (returnProductsMap[pName] || 0) + 1;
      });
      const topRet = Object.entries(returnProductsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopReturned(topRet);

      // Son 7 Günlük Trend Çizgisi/Barları
      const todayDate = new Date();
      const trendList: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const mShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()];
        const dayKey = `${d.getDate()} ${mShort}`;
        const entry = dailyTrendMap[dayKey] || { siparis: 0, ciro: 0, branches: {} };

        trendList.push({
          date: dayKey,
          siparis: entry.siparis,
          ciro: Math.round(entry.ciro),
          branches: entry.branches,
        });
      }
      setSevenDaysData(trendList);

      setStats({
        activeOrders: activeO,
        deliveredOrders: deliveredO,
        totalOrders: totalO,
        totalRevenue: Math.round(todayRev),
        todayRevenue: Math.round(todayRev),
        todayOrderCount,
        avgOrderValue: todayOrderCount > 0 ? Math.round(todayRev / todayOrderCount) : 0,
        cancelledRevenue: Math.round(cancelledRev),
        altRate: totalItems > 0 ? (altItems / totalItems) * 100 : 0,
        cancelRate: totalItems > 0 ? (cancelledItems / totalItems) * 100 : 0,
        totalReviews: tReviews,
        avgRating: avgR,
        todayReviews: todayR,
        unansweredReviews: unanswered,
        activeReturns: actReturns,
        resolvedReturns: returnsList.length - actReturns,
        totalReturns: returnsList.length,
        qualityScore: 9.2,
        deliveryScore: 8.8,
        promoCost: Math.round(totalPromoCost),
        promoRate: totalO > 0 ? (promoOrders / totalO) * 100 : 0,
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Dashboard veri hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Veriler sunucudan çekilemedi.');
    } finally {
      if (!isBackground) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(false);
    // Her 3 dakikada bir arka planda otomatik yenile
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 180000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // 30 Günlük Şube Ciro Matrisi Hesaplaması
  useEffect(() => {
    if (allOrdersData.length === 0) return;

    const monthlyMap: Record<string, {
      total: number;
      totalOrders: number;
      days: Record<string, number>;
      orderCounts: Record<string, number>;
      prevCutoffTotal: number;
    }> = {};

    Object.keys(BRANCHES).forEach((bId) => {
      monthlyMap[bId] = {
        total: 0,
        totalOrders: 0,
        days: {},
        orderCounts: {},
        prevCutoffTotal: 0,
      };
      days30.forEach((d) => {
        monthlyMap[bId].days[d.key] = 0;
        monthlyMap[bId].orderCounts[d.key] = 0;
      });
    });

    const validDaysKeys = new Set(days30.map((d) => d.key));

    allOrdersData.forEach((o: any) => {
      if (!o.orderDate) return;
      if (['Cancelled', 'UnSupplied'].includes(o.packageStatus)) return;

      const d = new Date(o.orderDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const orderDateKey = `${yyyy}-${mm}-${dd}`;
      const sid = o.storeId?.toString();
      const gross = o.grossAmount || o.totalPrice || 0;

      if (!sid || !monthlyMap[sid]) return;

      if (validDaysKeys.has(orderDateKey)) {
        monthlyMap[sid].days[orderDateKey] = (monthlyMap[sid].days[orderDateKey] || 0) + gross;
        monthlyMap[sid].orderCounts[orderDateKey] = (monthlyMap[sid].orderCounts[orderDateKey] || 0) + 1;
        monthlyMap[sid].total += gross;
        monthlyMap[sid].totalOrders += 1;
      } else if (orderDateKey === prev30CutoffKey) {
        monthlyMap[sid].prevCutoffTotal += gross;
      }
    });

    const mData = Object.entries(BRANCHES).map(([bId, bName]) => {
      const rowData = monthlyMap[bId] || {
        total: 0,
        totalOrders: 0,
        days: {},
        orderCounts: {},
        prevCutoffTotal: 0,
      };
      return {
        branchId: bId,
        branchName: bName,
        total: rowData.total,
        totalOrders: rowData.totalOrders,
        days: rowData.days,
        orderCounts: rowData.orderCounts,
        prevCutoffTotal: rowData.prevCutoffTotal,
      };
    }).sort((a, b) => b.total - a.total);

    setMonthlyTableData(mData);
  }, [allOrdersData, days30, prev30CutoffKey]);

  // Genel Toplam Satırı (30 Günlük)
  const totalRow = useMemo(() => {
    const res = {
      total: monthlyTableData.reduce((acc, row) => acc + (row.total || 0), 0),
      totalOrders: monthlyTableData.reduce((acc, row) => acc + (row.totalOrders || 0), 0),
      days: {} as Record<string, number>,
      orderCounts: {} as Record<string, number>,
    };
    days30.forEach((day) => {
      res.days[day.key] = monthlyTableData.reduce((acc, row) => acc + (row.days[day.key] || 0), 0);
      res.orderCounts[day.key] = monthlyTableData.reduce((acc, row) => acc + (row.orderCounts[day.key] || 0), 0);
    });
    return res;
  }, [monthlyTableData, days30]);

  // Seçili Trend Şubesi için 7 Günlük Değerler
  const trendMaxCiro = useMemo(() => {
    let max = 1;
    sevenDaysData.forEach((item) => {
      const c = selectedTrendBranch === 'all'
        ? item.ciro
        : (item.branches?.[selectedTrendBranch]?.ciro || 0);
      if (c > max) max = c;
    });
    return max;
  }, [sevenDaysData, selectedTrendBranch]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Kontrol Paneli Verileri Yükleniyor...</Text>
      </View>
    );
  }

  if (error && recentOrders.length === 0) {
    return (
      <ErrorView
        title="Sunucu Bağlantı Hatası"
        message={error}
        onRetry={() => fetchDashboardData(false)}
        onOpenServerSettings={onOpenServerSettings}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Panel Sub-Bar Strip (bg-gray-900: Kontrol Paneli • Sipariş & Performans) */}
      <View style={styles.subBarStrip}>
        <View style={styles.subBarTopRow}>
          <View style={styles.subBarTitleBox}>
            <Text style={styles.subBarTitle}>KONTROL PANELİ</Text>
            <Text style={styles.subBarSubtitle}>• SİPARİŞ & PERFORMANS</Text>
          </View>
          <Text style={styles.subBarTime}>
            Son Güncelleme: {lastUpdated ? lastUpdated.toLocaleTimeString('tr-TR') : '--:--:--'}
          </Text>
        </View>

        {/* Yatay 6'lı Hızlı Özet Şeridi */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
          <View style={styles.stripItem}>
            <Text style={styles.stripVal}>{stats.activeOrders}</Text>
            <Text style={styles.stripLabel}>SİPARİŞ (AKTİF)</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripVal}>{stats.todayRevenue.toLocaleString('tr-TR')} ₺</Text>
            <Text style={styles.stripLabel}>BUGÜN CİRO</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={[styles.stripVal, { color: '#F59E0B' }]}>%{stats.altRate.toFixed(1)}</Text>
            <Text style={styles.stripLabel}>ALTERNATİF %</Text>
          </View>
          <View style={styles.stripDivider} />
          <TouchableOpacity
            style={styles.stripItem}
            onPress={onNavigateToCancellations}
            disabled={!onNavigateToCancellations}
            activeOpacity={0.7}
          >
            <Text style={[styles.stripVal, { color: '#EF4444' }]}>%{stats.cancelRate.toFixed(1)}</Text>
            <Text style={styles.stripLabel}>İPTAL % →</Text>
          </TouchableOpacity>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={[styles.stripVal, { color: '#F97316' }]}>{stats.unansweredReviews}</Text>
            <Text style={styles.stripLabel}>YORUM (YANITSIZ)</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripVal}>{stats.avgRating} / 5</Text>
            <Text style={styles.stripLabel}>ORTALAMA PUAN</Text>
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* 2. Row 1: KPI Grid (5 Tam Panel Kartı) */}
        <View style={styles.kpiGrid}>
          {/* Kart 1: Bugünkü Ciro */}
          <Card style={styles.kpiCard}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiCardLabel}>BUGÜNKÜ CİRO</Text>
              {onNavigateToCancellations ? (
                <TouchableOpacity onPress={onNavigateToCancellations} activeOpacity={0.7}>
                  <Text style={[styles.kpiCardCancelText, { textDecorationLine: 'underline' }]}>
                    İptal: {stats.cancelledRevenue.toLocaleString('tr-TR')} ₺ →
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.kpiCardCancelText}>
                  İptal: {stats.cancelledRevenue.toLocaleString('tr-TR')} ₺
                </Text>
              )}
            </View>
            <Text style={styles.kpiCardBigValue}>
              {stats.todayRevenue.toLocaleString('tr-TR')} ₺
            </Text>
            <Text style={styles.kpiCardSubText}>
              Sipariş Ort: <Text style={styles.boldText}>{stats.avgOrderValue} ₺</Text>
            </Text>
          </Card>

          {/* Kart 2: Alternatif Gönderim */}
          <Card style={styles.kpiCard}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiCardLabel}>ALTERNATİF GÖNDERİM</Text>
              {onNavigateToCancellations ? (
                <TouchableOpacity onPress={onNavigateToCancellations} activeOpacity={0.7}>
                  <Text style={[styles.kpiCardCancelText, { textDecorationLine: 'underline' }]}>
                    İptal: %{stats.cancelRate.toFixed(1)} →
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.kpiCardCancelText}>
                  İptal: %{stats.cancelRate.toFixed(1)}
                </Text>
              )}
            </View>
            <Text style={[styles.kpiCardBigValue, { color: '#F59E0B' }]}>
              %{stats.altRate.toFixed(1)}
            </Text>
            <Text style={styles.kpiCardSubText}>Tüm Ürünler • Tedarik</Text>
          </Card>

          {/* Kart 3: Satıcı Promosyonları */}
          <Card style={styles.kpiCard}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiCardLabel}>SATICI PROMOSYONLARI</Text>
              <Text style={styles.kpiCardBlueText}>
                Kullanım: %{stats.promoRate.toFixed(1)}
              </Text>
            </View>
            <Text style={[styles.kpiCardBigValue, { color: '#2563EB' }]}>
              {stats.promoCost.toLocaleString('tr-TR')} ₺
            </Text>
            <Text style={styles.kpiCardSubText}>Harcanan Reklam & Kupon</Text>
          </Card>

          {/* Kart 4: Müşteri Puanı */}
          <Card style={styles.kpiCard}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiCardLabel}>MÜŞTERİ PUANI</Text>
              <Text style={styles.kpiCardMutedText}>Kalite: {stats.qualityScore}</Text>
            </View>
            <Text style={styles.kpiCardBigValue}>
              {stats.avgRating} <Text style={styles.kpiSmallRating}>/ 5</Text>
            </Text>
            <Text style={styles.kpiCardSubText}>
              Hız & Teslimat: <Text style={styles.boldText}>{stats.deliveryScore}</Text>
            </Text>
          </Card>

          {/* Kart 5: Sipariş Süreci */}
          <Card style={styles.kpiCard}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiCardLabel}>SİPARİŞ SÜRECİ</Text>
              <Text style={styles.kpiCardOrangeText}>Yanıtsız: {stats.unansweredReviews}</Text>
            </View>
            <Text style={styles.kpiCardBigValue}>
              {stats.activeOrders} <Text style={styles.kpiSmallRating}>Aktif</Text>
            </Text>
            <Text style={styles.kpiCardSubText}>Bekleyen Sipariş & Yorum</Text>
          </Card>
        </View>

        {/* 3. SON 30 GÜNLÜK ŞUBE CİRO MATRİSİ (Panel Matrix Table) */}
        <Card style={styles.matrixCard}>
          <View style={styles.matrixHeader}>
            <View style={styles.matrixHeaderLeft}>
              <Text style={styles.matrixTitle}>
                {periodOffset === 0
                  ? 'SON 30 GÜNLÜK ŞUBE CİRO ANALİZİ'
                  : `${periodOffset * 30}-${(periodOffset + 1) * 30} GÜN ÖNCEKİ CİRO`}
              </Text>
              {days30.length > 0 && (
                <Text style={styles.matrixDateBadge}>
                  {days30[0]?.label} – {days30[days30.length - 1]?.label}{' '}
                  {periodOffset === 0 ? '(Bugün)' : ''}
                </Text>
              )}
            </View>

            {/* Dönem Değiştirme Butonları */}
            <View style={styles.matrixPeriodControls}>
              <TouchableOpacity
                onPress={() => setPeriodOffset((p) => p + 1)}
                style={styles.periodBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-left" size={14} color={colors.textPrimary} />
                <Text style={styles.periodBtnText}>Önceki 30G</Text>
              </TouchableOpacity>

              {periodOffset > 0 && (
                <>
                  <TouchableOpacity
                    onPress={() => setPeriodOffset((p) => Math.max(0, p - 1))}
                    style={styles.periodBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.periodBtnText}>Sonraki 30G</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPeriodOffset(0)}
                    style={styles.todayResetBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.todayResetBtnText}>Bugün</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Matris Tablosu (Yatay Kaydırılabilir) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableHorizontalScroll}>
            <View>
              {/* Tablo Başlık Satırı */}
              <View style={styles.matrixHeadRow}>
                <View style={styles.colBranchStickyHead}>
                  <Text style={styles.headCellText}>ŞUBE ADI</Text>
                </View>
                <View style={styles.colTotalStickyHead}>
                  <Text style={[styles.headCellText, { textAlign: 'right' }]}>30G CİRO</Text>
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
              {monthlyTableData.map((row, rIdx) => (
                <View key={row.branchId || rIdx} style={styles.matrixRow}>
                  {/* Sabit Şube Kolonu */}
                  <View style={styles.colBranchStickyCell}>
                    <Text style={styles.cellBranchName} numberOfLines={1}>
                      {row.branchName}
                    </Text>
                  </View>

                  {/* Sabit Toplam Kolonu */}
                  <View style={styles.colTotalStickyCell}>
                    <Text style={styles.cellTotalVal}>
                      {row.total > 0 ? Math.round(row.total).toLocaleString('tr-TR') : '-'}
                    </Text>
                  </View>

                  {/* Günlük Ciro Hücreleri */}
                  {days30.map((day, dIdx) => {
                    const currentVal = row.days[day.key] || 0;
                    const prevVal =
                      dIdx === 0
                        ? row.prevCutoffTotal
                        : row.days[days30[dIdx - 1].key] || 0;

                    let bgStyle = styles.cellNormal;
                    let textStyle: any = styles.cellValText;
                    if (currentVal > 0) {
                      if (currentVal > prevVal) {
                        bgStyle = styles.cellUp;
                        textStyle = styles.cellUpText;
                      } else if (currentVal < prevVal) {
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
                          {currentVal > 0 ? Math.round(currentVal).toLocaleString('tr-TR') : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* GENEL TOPLAM Satırı */}
              {monthlyTableData.length > 0 && (
                <View style={styles.matrixTotalRow}>
                  <View style={styles.colBranchStickyTotal}>
                    <Text style={styles.totalRowTitle}>GENEL TOPLAM</Text>
                  </View>
                  <View style={styles.colTotalStickyTotal}>
                    <Text style={styles.totalRowBigVal}>
                      {Math.round(totalRow.total).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  {days30.map((day, dIdx) => {
                    const currentVal = totalRow.days[day.key] || 0;
                    const prevVal =
                      dIdx === 0
                        ? 0
                        : totalRow.days[days30[dIdx - 1].key] || 0;

                    let bgStyle = styles.cellNormal;
                    let textStyle = styles.totalDayText;
                    if (currentVal > 0) {
                      if (currentVal > prevVal) {
                        bgStyle = styles.cellUpTotal;
                      } else if (currentVal < prevVal) {
                        bgStyle = styles.cellDownTotal;
                      }
                    }

                    return (
                      <View
                        key={`total-${day.key}`}
                        style={[
                          styles.colDayCell,
                          bgStyle,
                          day.isToday && styles.cellTodayBorder,
                        ]}
                      >
                        <Text style={[styles.totalDayText, textStyle]}>
                          {currentVal > 0 ? Math.round(currentVal).toLocaleString('tr-TR') : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </Card>

        {/* 4. Row 2: Ciro ve Sipariş Eğilimi & Sipariş Durum Dağılımı */}
        <View style={styles.rowTwoContainer}>
          {/* Ciro ve Sipariş Eğilimi (Son 7 Gün) */}
          <Card style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.trendTitle}>CİRO VE SİPARİŞ EĞİLİMİ</Text>
                <Text style={styles.trendSub}>Son 7 günlük performans karşılaştırması</Text>
              </View>
              <TouchableOpacity
                onPress={() => setBranchSelectModalVisible(true)}
                style={styles.branchSelectBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.branchSelectBtnText}>
                  {selectedTrendBranch === 'all'
                    ? 'Tüm Şubeler'
                    : BRANCHES[selectedTrendBranch] || 'Şube'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 7 Günlük Trend Barları */}
            <View style={styles.barsContainer}>
              {sevenDaysData.map((d, idx) => {
                const ciroVal = selectedTrendBranch === 'all'
                  ? d.ciro
                  : d.branches?.[selectedTrendBranch]?.ciro || 0;
                const siparisVal = selectedTrendBranch === 'all'
                  ? d.siparis
                  : d.branches?.[selectedTrendBranch]?.siparis || 0;
                const barHeight = Math.max(12, Math.min(100, (ciroVal / trendMaxCiro) * 100));

                return (
                  <View key={idx} style={styles.barCol}>
                    <Text style={styles.barTopVal}>{Math.round(ciroVal / 1000)}k</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${barHeight}%` }]} />
                    </View>
                    <Text style={styles.barDateText}>{d.date.split(' ')[0]}</Text>
                    <Text style={styles.barOrderCount}>{siparisVal} sip</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Sipariş Durum Dağılımı */}
          <Card style={styles.statusBreakdownCard}>
            <Text style={styles.statusBreakdownTitle}>SİPARİŞ DURUM DAĞILIMI</Text>
            <View style={styles.statusList}>
              {statusBreakdown.map((s) => (
                <View key={s.key} style={styles.statusRow}>
                  <View style={styles.statusRowLeft}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: STATUS_COLORS[s.key] || '#9CA3AF' },
                      ]}
                    />
                    <Text style={styles.statusRowName}>{s.name}</Text>
                  </View>
                  <Text style={styles.statusRowVal}>{s.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* 5. Row 3: Product Intelligence (3'lü Kart Izgarası) */}
        <View style={styles.productIntelGrid}>
          {/* En Çok Satan Ürünler */}
          <Card style={styles.intelCard}>
            <View style={styles.intelHeader}>
              <Text style={styles.intelTitle}>EN ÇOK SATAN ÜRÜNLER</Text>
              <Text style={styles.intelSub}>Satış adetine göre</Text>
            </View>
            <View style={styles.intelList}>
              {topProducts.length > 0 ? (
                topProducts.map((p, idx) => (
                  <View key={idx} style={styles.intelItemRow}>
                    <Text style={styles.intelItemRank}>{idx + 1}.</Text>
                    <Text style={styles.intelItemName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.intelItemVal}>{p.qty} Adet</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.intelEmptyText}>Veri yok</Text>
              )}
            </View>
          </Card>

          {/* En Çok İade Edilenler */}
          <Card style={styles.intelCard}>
            <View style={styles.intelHeader}>
              <Text style={styles.intelTitle}>EN ÇOK İADE EDİLENLER</Text>
              <Text style={styles.intelSub}>Müşteri taleplerine göre</Text>
            </View>
            <View style={styles.intelList}>
              {topReturned.length > 0 ? (
                topReturned.map((r, idx) => (
                  <View key={idx} style={styles.intelItemRow}>
                    <Text style={styles.intelItemRank}>{idx + 1}.</Text>
                    <Text style={styles.intelItemName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={[styles.intelItemVal, { color: '#EF4444' }]}>
                      {r.count} İade
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.intelEmptyText}>İade kaydı yok</Text>
              )}
            </View>
          </Card>

          {/* Şube Operasyon Skoru */}
          <Card style={styles.intelCard}>
            <View style={styles.intelHeader}>
              <Text style={styles.intelTitle}>ŞUBE OPERASYON SKORU</Text>
              <Text style={styles.intelSub}>Alternatif & İptal Oranları</Text>
            </View>
            <View style={styles.intelList}>
              {branchPerformance.slice(0, 5).map((b, idx) => (
                <View key={idx} style={styles.intelItemRow}>
                  <Text style={styles.intelItemRank}>{idx + 1}.</Text>
                  <Text style={styles.intelItemName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <View style={styles.intelOpScores}>
                    <Text style={[styles.intelOpAlt, b.altRate > 10 && styles.textAlert]}>
                      %{b.altRate}
                    </Text>
                    <Text style={[styles.intelOpIptal, b.iptalRate > 5 && styles.textRedAlert]}>
                      %{b.iptalRate}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* 6. Row 4: Son Siparişler ve Alarmlar Tablosu */}
        <Card style={styles.recentOrdersCard}>
          <View style={styles.recentOrdersHeader}>
            <Text style={styles.recentOrdersTitle}>SON SİPARİŞLER VE ALARMLAR</Text>
            {onNavigateToOrders && (
              <TouchableOpacity onPress={onNavigateToOrders}>
                <Text style={styles.viewAllOrdersLink}>Tüm Siparişleri Yönet →</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.recentOrdersTable}>
            {/* Tablo Başlık */}
            <View style={styles.roHeadRow}>
              <Text style={[styles.roHeadText, { flex: 1.2 }]}>SİPARİŞ / ZAMAN</Text>
              <Text style={[styles.roHeadText, { flex: 1.5 }]}>ŞUBE</Text>
              <Text style={[styles.roHeadText, { flex: 1 }]}>DURUM</Text>
              <Text style={[styles.roHeadText, { flex: 1, textAlign: 'right' }]}>TUTAR</Text>
            </View>

            {/* Sipariş Satırları */}
            {recentOrders.map((o: any, idx) => {
              const statusColor = STATUS_COLORS[o.packageStatus] || '#6B7280';
              const altCount = o.lines?.reduce((acc: number, l: any) =>
                acc + (l.items?.filter((it: any) => it.isAlternative).length || 0), 0) || 0;
              const cancCount = o.lines?.reduce((acc: number, l: any) =>
                acc + (l.items?.filter((it: any) => it.isCancelled).length || 0), 0) || 0;
              const isPromo = o.lines?.some((l: any) =>
                l.items?.some((it: any) => it.promotions?.length > 0));

              return (
                <View key={o.id || idx} style={styles.roRow}>
                  {/* Sipariş No & Zaman */}
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.roOrderNumber}>#{o.orderNumber}</Text>
                    <Text style={styles.roTimeText}>
                      {o.orderDate
                        ? new Date(o.orderDate).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>

                  {/* Şube & Alarm Rozetleri */}
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.roBranchText} numberOfLines={1}>
                      {BRANCHES[o.storeId?.toString()] || 'Şube'}
                    </Text>
                    <View style={styles.roAlarmsRow}>
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
                  </View>

                  {/* Durum Rozeti */}
                  <View style={{ flex: 1 }}>
                    <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {STATUS_LABELS[o.packageStatus] || o.packageStatus}
                      </Text>
                    </View>
                  </View>

                  {/* Tutar */}
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.roPriceText}>
                      {(o.grossAmount || o.totalPrice || 0).toFixed(2)} ₺
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </ScrollView>

      {/* Şube Seçim Modalı (Trend Grafiği İçin) */}
      <Modal
        visible={branchSelectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchSelectModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setBranchSelectModalVisible(false)}
        >
          <View style={styles.branchSelectModalBox}>
            <Text style={styles.branchModalTitle}>Trend Şubesi Seçin</Text>
            <TouchableOpacity
              style={[
                styles.branchModalItem,
                selectedTrendBranch === 'all' && styles.branchModalItemActive,
              ]}
              onPress={() => {
                setSelectedTrendBranch('all');
                setBranchSelectModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.branchModalItemText,
                  selectedTrendBranch === 'all' && styles.branchModalItemTextActive,
                ]}
              >
                Tüm Şubeler
              </Text>
            </TouchableOpacity>

            {Object.entries(BRANCHES).map(([id, name]) => (
              <TouchableOpacity
                key={id}
                style={[
                  styles.branchModalItem,
                  selectedTrendBranch === id && styles.branchModalItemActive,
                ]}
                onPress={() => {
                  setSelectedTrendBranch(id);
                  setBranchSelectModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.branchModalItemText,
                    selectedTrendBranch === id && styles.branchModalItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  // Sub Bar Strip (Panel Top Sub-Bar: bg-gray-900)
  subBarStrip: {
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subBarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subBarTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subBarTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subBarSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  subBarTime: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#9CA3AF',
  },
  stripScroll: {
    flexGrow: 0,
  },
  stripItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stripVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stripLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  stripDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#374151',
    alignSelf: 'center',
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    padding: 8,
    gap: 8,
  },
  // KPI Grid (5 kart)
  kpiGrid: {
    gap: 6,
  },
  kpiCard: {
    padding: 10,
  },
  kpiCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiCardLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kpiCardCancelText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  kpiCardBlueText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  kpiCardOrangeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#F97316',
  },
  kpiCardMutedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  kpiCardBigValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  kpiSmallRating: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  kpiCardSubText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#111827',
  },
  // 30 Günlük Şube Ciro Matrisi
  matrixCard: {
    padding: 8,
  },
  matrixHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  matrixHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  matrixTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  matrixDateBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  matrixPeriodControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  periodBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  todayResetBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  todayResetBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1D4ED8',
  },
  tableHorizontalScroll: {
    flexGrow: 0,
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
  headCellText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colDayHead: {
    width: 52,
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
  colDayCell: {
    width: 52,
    paddingVertical: 5,
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
  totalDayText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  cellUpTotal: {
    backgroundColor: '#BBF7D0',
  },
  cellDownTotal: {
    backgroundColor: '#FECACA',
  },
  // Row 2: Charts & Breakdown
  rowTwoContainer: {
    gap: 8,
  },
  trendCard: {
    padding: 10,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
    marginBottom: 8,
  },
  trendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  trendSub: {
    fontSize: 9,
    color: '#6B7280',
  },
  branchSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  branchSelectBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  barTopVal: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#059669',
  },
  barTrack: {
    width: 14,
    height: 70,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  barDateText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  barOrderCount: {
    fontSize: 8,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  statusBreakdownCard: {
    padding: 10,
  },
  statusBreakdownTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
    marginBottom: 6,
  },
  statusList: {
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statusRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  statusRowName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  statusRowVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
  },
  // Row 3: Product Intelligence
  productIntelGrid: {
    gap: 8,
  },
  intelCard: {
    padding: 10,
  },
  intelHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
    marginBottom: 6,
  },
  intelTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  intelSub: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  intelList: {
    gap: 6,
  },
  intelItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  intelItemRank: {
    width: 18,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  intelItemName: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  intelItemVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
  },
  intelEmptyText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 6,
    textAlign: 'center',
  },
  intelOpScores: {
    flexDirection: 'row',
    gap: 8,
  },
  intelOpAlt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  intelOpIptal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  textAlert: {
    color: '#F97316',
  },
  textRedAlert: {
    color: '#EF4444',
  },
  // Row 4: Recent Orders
  recentOrdersCard: {
    padding: 10,
  },
  recentOrdersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
    marginBottom: 6,
  },
  recentOrdersTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  viewAllOrdersLink: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  recentOrdersTable: {
    gap: 4,
  },
  roHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  roHeadText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  roOrderNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  roTimeText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  roBranchText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  roAlarmsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  alarmBadgeAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 2,
  },
  alarmBadgeAmberText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  alarmBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 2,
  },
  alarmBadgeRedText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#B91C1C',
    textTransform: 'uppercase',
  },
  alarmBadgeGray: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 2,
  },
  alarmBadgeGrayText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  roPriceText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
  },
  // Modal Backdrop & Items
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  branchSelectModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    maxHeight: '70%',
    padding: 12,
  },
  branchModalTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  branchModalItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  branchModalItemActive: {
    backgroundColor: '#EFF6FF',
  },
  branchModalItemText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
  branchModalItemTextActive: {
    color: '#2563EB',
  },
});
