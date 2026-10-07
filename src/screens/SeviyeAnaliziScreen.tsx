import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { levelsService } from '../api/services';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

export const QUALITY_THRESHOLDS = {
  LEVEL_1: {
    maxMissingAltRate: 8.0,
    maxSellerCancelRate: 0.5,
    maxSellerReturnRate: 1.0,
    minDeliveredOrders: 20,
  },
  LEVEL_2: {
    maxMissingAltRate: 11.0,
    maxSellerCancelRate: 1.2,
    maxSellerReturnRate: 1.4,
    minDeliveredOrders: 20,
  },
};

export const COMMISSION_MATRIX: Record<string, Record<string, number>> = {
  'Market - Seviye 1': {
    'Kalite - Seviye 1': 14.5,
    'Kalite - Seviye 2': 17.25,
    'Kalite - Seviye 3': 20.25,
  },
  'Market - Seviye 2': {
    'Kalite - Seviye 1': 16.25,
    'Kalite - Seviye 2': 19.0,
    'Kalite - Seviye 3': 22.0,
  },
  'Market - Seviye 3': {
    'Kalite - Seviye 1': 18.0,
    'Kalite - Seviye 2': 20.75,
    'Kalite - Seviye 3': 23.75,
  },
};

export const SeviyeAnaliziScreen: React.FC<{ onOpenServerSettings: () => void }> = ({
  onOpenServerSettings,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [marketPeriods, setMarketPeriods] = useState<any[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Kasım 2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'Seviye 1' | 'Seviye 2' | 'Seviye 3'>('ALL');
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<any | null>(null);
  const [showThresholdsModal, setShowThresholdsModal] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await levelsService.getLevels(undefined, isRefresh);
      if (data) {
        if (Array.isArray(data.marketPeriods)) {
          setMarketPeriods(data.marketPeriods);
          if (data.marketPeriods.length > 0 && !selectedPeriod) {
            const lastP: any = data.marketPeriods[data.marketPeriods.length - 1];
            setSelectedPeriod(typeof lastP === 'string' ? lastP : (lastP?.periodName || 'Kasım 2026'));
          }
        }
        if (Array.isArray(data.stores)) {
          setAllStores(data.stores);
        }
        if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
        setIsLive(!!data.isLive);
      }
    } catch (err: any) {
      console.error('Seviye analizi hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Seviye verileri sunucudan çekilemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seçili dönemin market metriği
  const currentMarketMetric = useMemo(() => {
    if (!marketPeriods.length) {
      return {
        periodName: 'Kasım',
        marketLevel: 'Seviye 2',
        statusTag: 'Tahmini',
        averageCommissionRate: 19.9,
        nationalOrderShare: "%0.50'den düşük",
        cityOrderShare: "%35'ten düşük",
        activeStoresCount: 11,
      };
    }
    const found = marketPeriods.find(
      (m: any) =>
        selectedPeriod.includes(m.periodName) ||
        m.periodKey === selectedPeriod ||
        m.periodName === selectedPeriod
    );
    return found || marketPeriods[marketPeriods.length - 1];
  }, [marketPeriods, selectedPeriod]);

  // Seçili dönemin şubeleri
  const periodStores = useMemo(() => {
    let stores = allStores.filter((s) => {
      if (!selectedPeriod) return true;
      const sPeriod = s.commissionPeriod || '';
      return sPeriod.toLowerCase().includes(selectedPeriod.toLowerCase().split(' ')[0]);
    });

    if (levelFilter !== 'ALL') {
      stores = stores.filter((s) => s.qualityLevel === levelFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      stores = stores.filter(
        (s) =>
          (s.storeName && s.storeName.toLowerCase().includes(q)) ||
          (s.storeId && s.storeId.toString().includes(q))
      );
    }

    return stores;
  }, [allStores, selectedPeriod, levelFilter, searchQuery]);

  // İstatistik sayaçları
  const stats = useMemo(() => {
    const total = periodStores.length;
    const l1 = periodStores.filter((s) => s.qualityLevel === 'Seviye 1').length;
    const l2 = periodStores.filter((s) => s.qualityLevel === 'Seviye 2').length;
    const l3 = periodStores.filter((s) => s.qualityLevel === 'Seviye 3' || s.qualityLevel === 'n/a').length;
    return { total, l1, l2, l3 };
  }, [periodStores]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Seviye ve Komisyon Verileri Yükleniyor...</Text>
      </View>
    );
  }

  if (error && allStores.length === 0) {
    return (
      <ErrorView
        title="Seviye Analizi Hatası"
        message={error}
        onRetry={() => loadData(true)}
        onOpenServerSettings={onOpenServerSettings}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header */}
      <View style={styles.subHeader}>
        <View>
          <Text style={styles.subHeaderTitle}>TRENDYOL GO SEVİYE & KOMİSYON</Text>
          <Text style={styles.subHeaderSub}>
            Resmi Kalite Seviyesi Barajları ve Komisyon Tablosu
          </Text>
        </View>
        <View style={styles.subHeaderRight}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => loadData(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={14} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* 2. Dönem Seçici Çubuğu */}
        <View style={styles.periodRow}>
          <Text style={styles.periodLabel}>Dönem Seçimi:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
            {marketPeriods.map((p: any) => {
              const label = `${p.periodName} 2026`;
              const isSelected = selectedPeriod.includes(p.periodName);
              return (
                <TouchableOpacity
                  key={p.periodKey || p.periodName}
                  onPress={() => setSelectedPeriod(label)}
                  style={[styles.periodChip, isSelected && styles.periodChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodChipText, isSelected && styles.periodChipTextActive]}>
                    {label}
                  </Text>
                  {p.statusTag && (
                    <Text
                      style={[
                        styles.periodTag,
                        p.statusTag === 'Tahmini' ? styles.tagTahmini : styles.tagGecerli,
                      ]}
                    >
                      {p.statusTag}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Market Seviyesi KPI Kartı */}
        <Card style={styles.marketCard}>
          <View style={styles.marketCardHeader}>
            <View>
              <Text style={styles.marketCardSubTitle}>TRENDYOL GO MARKET SEVİYESİ</Text>
              <Text style={styles.marketCardTitle}>
                {currentMarketMetric?.periodName} 2026 Dönemi
              </Text>
            </View>
            <View style={styles.levelBadgeBox}>
              <Text style={styles.levelBadgeText}>
                {currentMarketMetric?.marketLevel || 'Seviye 2'}
              </Text>
            </View>
          </View>

          <View style={styles.marketMetricsGrid}>
            <View style={styles.marketMetricItem}>
              <Text style={styles.marketMetricLabel}>ORT. KOMİSYON</Text>
              <Text style={styles.marketMetricVal}>
                %{currentMarketMetric?.averageCommissionRate || '19.90'}
              </Text>
            </View>
            <View style={styles.marketMetricItem}>
              <Text style={styles.marketMetricLabel}>ULUSAL PAY</Text>
              <Text style={styles.marketMetricVal}>
                {currentMarketMetric?.nationalOrderShare || "%0.50'den düşük"}
              </Text>
            </View>
            <View style={styles.marketMetricItem}>
              <Text style={styles.marketMetricLabel}>İL İÇİ PAY</Text>
              <Text style={styles.marketMetricVal}>
                {currentMarketMetric?.cityOrderShare || "%35'ten düşük"}
              </Text>
            </View>
            <View style={styles.marketMetricItem}>
              <Text style={styles.marketMetricLabel}>AKTİF ŞUBE</Text>
              <Text style={styles.marketMetricVal}>
                {currentMarketMetric?.activeStoresCount || 11} Şube
              </Text>
            </View>
          </View>
        </Card>

        {/* 4. Arama ve Filtreleme */}
        <View style={styles.filterSection}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şube adı ile ara..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Seviye Filtreleri */}
          <View style={styles.levelTabsRow}>
            {(['ALL', 'Seviye 1', 'Seviye 2', 'Seviye 3'] as const).map((lvl) => {
              const active = levelFilter === lvl;
              const count =
                lvl === 'ALL'
                  ? stats.total
                  : lvl === 'Seviye 1'
                  ? stats.l1
                  : lvl === 'Seviye 2'
                  ? stats.l2
                  : stats.l3;
              return (
                <TouchableOpacity
                  key={lvl}
                  onPress={() => setLevelFilter(lvl)}
                  style={[styles.levelTabBtn, active && styles.levelTabBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.levelTabText, active && styles.levelTabTextActive]}>
                    {lvl === 'ALL' ? 'Tümü' : lvl} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. Şube Seviye & Kalite Tablosu */}
        <Card style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>ŞUBE KALİTE SEVİYELERİ VE HEDEFLERİ</Text>
            <TouchableOpacity
              onPress={() => setShowThresholdsModal(true)}
              style={styles.matrixInfoBtn}
            >
              <MaterialCommunityIcons name="information-outline" size={12} color={colors.primary} />
              <Text style={styles.matrixInfoBtnText}>Komisyon Matrisi</Text>
            </TouchableOpacity>
          </View>

          {periodStores.length === 0 ? (
            <EmptyState
              title="Kayıt Bulunamadı"
              message="Seçili filtre veya dönem için şube metriği bulunamadı."
            />
          ) : (
            periodStores.map((s, idx) => {
              const lvl = s.qualityLevel || 'Seviye 3';
              const lvlColor =
                lvl === 'Seviye 1' ? '#10B981' : lvl === 'Seviye 2' ? '#3B82F6' : '#F59E0B';
              const isQualified = s.analysis?.isQualifiedForTarget;

              return (
                <TouchableOpacity
                  key={s.storeId || idx}
                  style={styles.storeRow}
                  activeOpacity={0.7}
                  onPress={() => setSelectedStoreDetail(s)}
                >
                  <View style={styles.storeRowTop}>
                    <View style={styles.storeNameCol}>
                      <Text style={styles.storeNameText} numberOfLines={1}>
                        {s.storeName || `Şube ${s.storeId}`}
                      </Text>
                      <Text style={styles.storeSubText}>
                        Teslim Edilen: <Text style={styles.boldText}>{s.deliveredOrders || 0}</Text>{' '}
                        sipariş
                      </Text>
                    </View>

                    <View style={styles.storeBadgeCol}>
                      <View style={[styles.qualityBadge, { borderColor: lvlColor }]}>
                        <Text style={[styles.qualityBadgeText, { color: lvlColor }]}>{lvl}</Text>
                      </View>
                      <Text style={styles.commissionText}>
                        Komisyon: <Text style={styles.boldText}>%{s.commissionRate || 22}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Metrik Çubukları */}
                  <View style={styles.metricsBar}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>Eksik / Alt</Text>
                      <Text
                        style={[
                          styles.metricItemVal,
                          (s.missingAltRate || 0) > 11 ? styles.valRed : styles.valGreen,
                        ]}
                      >
                        %{s.missingAltRate !== null ? s.missingAltRate.toFixed(1) : '-'}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>Satıcı İptal</Text>
                      <Text
                        style={[
                          styles.metricItemVal,
                          (s.sellerCancelRate || 0) > 1.2 ? styles.valRed : styles.valGreen,
                        ]}
                      >
                        %{s.sellerCancelRate !== null ? s.sellerCancelRate.toFixed(2) : '-'}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>Satıcı İade</Text>
                      <Text
                        style={[
                          styles.metricItemVal,
                          (s.sellerReturnRate || 0) > 1.4 ? styles.valRed : styles.valGreen,
                        ]}
                      >
                        %{s.sellerReturnRate !== null ? s.sellerReturnRate.toFixed(2) : '-'}
                      </Text>
                    </View>

                    <View style={styles.analysisActionCol}>
                      <Text style={styles.analysisDetailLink}>
                        Hedef Analizi →
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Card>
      </ScrollView>

      {/* 6. Şube Seviye Atlama Analiz Modalı */}
      <Modal
        visible={!!selectedStoreDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStoreDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>ŞUBE KALİTE VE SEVİYE HEDEFİ</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedStoreDetail?.storeName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedStoreDetail(null)}
                style={styles.closeBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedStoreDetail && (
                <>
                  {/* Mevcut Durum */}
                  <View style={styles.statusBox}>
                    <View style={styles.statusBoxRow}>
                      <Text style={styles.statusBoxLabel}>Mevcut Seviye:</Text>
                      <Text style={styles.statusBoxVal}>
                        {selectedStoreDetail.qualityLevel || 'Seviye 3'}
                      </Text>
                    </View>
                    <View style={styles.statusBoxRow}>
                      <Text style={styles.statusBoxLabel}>Komisyon Oranı:</Text>
                      <Text style={styles.statusBoxVal}>
                        %{selectedStoreDetail.commissionRate || 22}
                      </Text>
                    </View>
                    <View style={styles.statusBoxRow}>
                      <Text style={styles.statusBoxLabel}>Teslim Edilen Sipariş:</Text>
                      <Text style={styles.statusBoxVal}>
                        {selectedStoreDetail.deliveredOrders || 0} Adet (Baraj: min 20)
                      </Text>
                    </View>
                  </View>

                  {/* Hedefe Geçiş Analizi */}
                  <Text style={styles.sectionHeaderTitle}>HEDEF SEVİYE 2 / 1 GEREKSİNİMLERİ</Text>

                  <View style={styles.reqCard}>
                    <View style={styles.reqItem}>
                      <MaterialCommunityIcons
                        name={
                          (selectedStoreDetail.deliveredOrders || 0) >= 20
                            ? 'checkbox-marked-circle'
                            : 'alert-circle'
                        }
                        size={18}
                        color={
                          (selectedStoreDetail.deliveredOrders || 0) >= 20 ? '#10B981' : '#EF4444'
                        }
                      />
                      <View style={styles.reqTexts}>
                        <Text style={styles.reqTitle}>Sipariş Hacmi</Text>
                        <Text style={styles.reqDesc}>
                          En az 20 teslim edilen sipariş gerekir. (Mevcut:{' '}
                          {selectedStoreDetail.deliveredOrders || 0})
                          {(selectedStoreDetail.deliveredOrders || 0) < 20 && (
                            <Text style={styles.textDeficit}>
                              {' '}
                              • {20 - (selectedStoreDetail.deliveredOrders || 0)} sipariş eksik!
                            </Text>
                          )}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqItem}>
                      <MaterialCommunityIcons
                        name={
                          (selectedStoreDetail.missingAltRate || 0) <= 11.0
                            ? 'checkbox-marked-circle'
                            : 'alert-circle'
                        }
                        size={18}
                        color={
                          (selectedStoreDetail.missingAltRate || 0) <= 11.0 ? '#10B981' : '#EF4444'
                        }
                      />
                      <View style={styles.reqTexts}>
                        <Text style={styles.reqTitle}>Eksik / Alternatif Ürün Oranı</Text>
                        <Text style={styles.reqDesc}>
                          Hedef: ≤ %11.0 (Mevcut: %{(selectedStoreDetail.missingAltRate || 0).toFixed(1)})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqItem}>
                      <MaterialCommunityIcons
                        name={
                          (selectedStoreDetail.sellerCancelRate || 0) <= 1.2
                            ? 'checkbox-marked-circle'
                            : 'alert-circle'
                        }
                        size={18}
                        color={
                          (selectedStoreDetail.sellerCancelRate || 0) <= 1.2 ? '#10B981' : '#EF4444'
                        }
                      />
                      <View style={styles.reqTexts}>
                        <Text style={styles.reqTitle}>Satıcı İptal Oranı</Text>
                        <Text style={styles.reqDesc}>
                          Hedef: ≤ %1.2 (Mevcut: %{(selectedStoreDetail.sellerCancelRate || 0).toFixed(2)})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqItem}>
                      <MaterialCommunityIcons
                        name={
                          (selectedStoreDetail.sellerReturnRate || 0) <= 1.4
                            ? 'checkbox-marked-circle'
                            : 'alert-circle'
                        }
                        size={18}
                        color={
                          (selectedStoreDetail.sellerReturnRate || 0) <= 1.4 ? '#10B981' : '#EF4444'
                        }
                      />
                      <View style={styles.reqTexts}>
                        <Text style={styles.reqTitle}>Satıcı İade Oranı</Text>
                        <Text style={styles.reqDesc}>
                          Hedef: ≤ %1.4 (Mevcut: %{(selectedStoreDetail.sellerReturnRate || 0).toFixed(2)})
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Komisyon Kazancı */}
                  <View style={styles.gainBox}>
                    <Text style={styles.gainTitle}>TAHMİNİ KOMİSYON AVANTAJI</Text>
                    <Text style={styles.gainDesc}>
                      Bu şube Seviye 2'ye geçtiğinde komisyon oranı %22.0 yerine %19.0'a düşerek her siparişte{' '}
                      <Text style={styles.gainBold}>%3.0 net marj kazancı</Text> sağlayacaktır.
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 7. Baraj ve Komisyon Matrisi Modalı */}
      <Modal
        visible={showThresholdsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThresholdsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>RESMİ BARAJLAR VE KOMİSYON MATRİSİ</Text>
              <TouchableOpacity onPress={() => setShowThresholdsModal(false)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.matrixSectionHeader}>KALİTE SEVİYESİ BARAJLARI</Text>
              <View style={styles.tableBox}>
                <View style={styles.tableBoxRowHeader}>
                  <Text style={styles.tableBoxColHeader}>Kriter</Text>
                  <Text style={styles.tableBoxColHeader}>Seviye 1</Text>
                  <Text style={styles.tableBoxColHeader}>Seviye 2</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Eksik / Alternatif</Text>
                  <Text style={styles.tableBoxCell}>≤ %8.0</Text>
                  <Text style={styles.tableBoxCell}>≤ %11.0</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Satıcı İptal</Text>
                  <Text style={styles.tableBoxCell}>≤ %0.5</Text>
                  <Text style={styles.tableBoxCell}>≤ %1.2</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Satıcı İade</Text>
                  <Text style={styles.tableBoxCell}>≤ %1.0</Text>
                  <Text style={styles.tableBoxCell}>≤ %1.4</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Min Sipariş</Text>
                  <Text style={styles.tableBoxCell}>≥ 20</Text>
                  <Text style={styles.tableBoxCell}>≥ 20</Text>
                </View>
              </View>

              <Text style={[styles.matrixSectionHeader, { marginTop: 14 }]}>
                KOMİSYON MATRİSİ (% ORANLAR)
              </Text>
              <View style={styles.tableBox}>
                <View style={styles.tableBoxRowHeader}>
                  <Text style={styles.tableBoxColHeader}>Market \ Kalite</Text>
                  <Text style={styles.tableBoxColHeader}>Kalite 1</Text>
                  <Text style={styles.tableBoxColHeader}>Kalite 2</Text>
                  <Text style={styles.tableBoxColHeader}>Kalite 3</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Market Seviye 1</Text>
                  <Text style={styles.tableBoxCell}>%14.50</Text>
                  <Text style={styles.tableBoxCell}>%17.25</Text>
                  <Text style={styles.tableBoxCell}>%20.25</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Market Seviye 2</Text>
                  <Text style={styles.tableBoxCell}>%16.25</Text>
                  <Text style={styles.tableBoxCell}>%19.00</Text>
                  <Text style={styles.tableBoxCell}>%22.00</Text>
                </View>
                <View style={styles.tableBoxRow}>
                  <Text style={styles.tableBoxCell}>Market Seviye 3</Text>
                  <Text style={styles.tableBoxCell}>%18.00</Text>
                  <Text style={styles.tableBoxCell}>%20.75</Text>
                  <Text style={styles.tableBoxCell}>%23.75</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
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
  subHeaderTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subHeaderSub: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  subHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    padding: 10,
    gap: 10,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  periodScroll: {
    flexGrow: 0,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    borderRadius: 3,
  },
  periodChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  periodChipTextActive: {
    color: colors.primary,
  },
  periodTag: {
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    textTransform: 'uppercase',
  },
  tagTahmini: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  tagGecerli: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  marketCard: {
    padding: 12,
  },
  marketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  marketCardSubTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  marketCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  levelBadgeBox: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#A5B4FC',
    textTransform: 'uppercase',
  },
  marketMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  marketMetricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 3,
  },
  marketMetricLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  marketMetricVal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  filterSection: {
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 3,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  levelTabsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  levelTabBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 3,
  },
  levelTabBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  levelTabText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  levelTabTextActive: {
    color: '#FFFFFF',
  },
  tableCard: {
    padding: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  matrixInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  matrixInfoBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  storeRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 9,
  },
  storeRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  storeNameCol: {
    flex: 1,
    marginRight: 8,
  },
  storeNameText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  storeSubText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  storeBadgeCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  qualityBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  qualityBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  commissionText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    borderRadius: 2,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricItemLabel: {
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  metricItemVal: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
  },
  valGreen: {
    color: '#059669',
  },
  valRed: {
    color: '#DC2626',
  },
  analysisActionCol: {
    justifyContent: 'center',
  },
  analysisDetailLink: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '85%',
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    marginTop: 10,
  },
  statusBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    borderRadius: 3,
    gap: 4,
  },
  statusBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusBoxLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBoxVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  reqCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    borderRadius: 3,
    gap: 10,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reqTexts: {
    flex: 1,
  },
  reqTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  reqDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  textDeficit: {
    fontWeight: 'bold',
    color: '#DC2626',
  },
  gainBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 3,
    marginTop: 12,
  },
  gainTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  gainDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 3,
    lineHeight: 15,
  },
  gainBold: {
    fontWeight: 'bold',
    color: '#064E3B',
  },
  matrixSectionHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tableBoxRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableBoxColHeader: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  tableBoxRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableBoxCell: {
    flex: 1,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
