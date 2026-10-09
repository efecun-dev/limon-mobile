import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { LevelStoreInfo } from '../../types/api';
import { Button } from './Button';

interface Level1RecoverySimulatorModalProps {
  visible: boolean;
  onClose: () => void;
  stores: LevelStoreInfo[];
  selectedStoreId?: string;
}

export const Level1RecoverySimulatorModal: React.FC<Level1RecoverySimulatorModalProps> = ({
  visible,
  onClose,
  stores,
  selectedStoreId,
}) => {
  const [activeStoreId, setActiveStoreId] = useState<string>(selectedStoreId || stores[0]?.storeId || 'all');

  // Simülasyon Parametreleri
  const [remainingDays, setRemainingDays] = useState(14);
  const [dailyOrders, setDailyOrders] = useState(25);
  const [monthlyRevenue, setMonthlyRevenue] = useState(150000);

  // Seçili şube verileri
  const currentStore = useMemo(() => {
    return stores.find((s) => s.storeId === activeStoreId) || stores[0];
  }, [stores, activeStoreId]);

  // Metrikler (Seçili şubeden dinamik al veya varsayılan)
  const deliveredOrders = currentStore?.metrics?.deliveredOrders ?? 80;
  const currentCancelRate = currentStore?.metrics?.sellerCancelRate ?? 2.2;
  const currentMissingRate = currentStore?.metrics?.missingAltRate ?? 6.5;
  const currentReturnRate = currentStore?.metrics?.sellerReturnRate ?? 0.4;

  // Hedef Seviye 1 Barajları
  const TARGET_CANCEL = 1.5; // ≤ %1.5
  const TARGET_MISSING = 5.0; // ≤ %5.0
  const TARGET_RETURN = 1.0; // ≤ %1.0

  // Kurtarma Hesaplaması
  const simulation = useMemo(() => {
    const projectedRemaining = remainingDays * dailyOrders;
    const projectedTotal = deliveredOrders + projectedRemaining;

    // Mevcut hatalı sipariş adetleri
    const currentCancelCount = Math.round((currentCancelRate / 100) * deliveredOrders);
    const currentMissingCount = Math.round((currentMissingRate / 100) * deliveredOrders);
    const currentReturnCount = Math.round((currentReturnRate / 100) * deliveredOrders);

    // Kalan tüm siparişler SIFIR HATALI olursa dönem sonu oranları ne olur?
    const bestCaseCancelRate = projectedTotal > 0 ? (currentCancelCount / projectedTotal) * 100 : 0;
    const bestCaseMissingRate = projectedTotal > 0 ? (currentMissingCount / projectedTotal) * 100 : 0;
    const bestCaseReturnRate = projectedTotal > 0 ? (currentReturnCount / projectedTotal) * 100 : 0;

    // Hedefe ulaşmak için gereken minimum sıfır hatalı sipariş adedi
    // (currentCancelCount / (deliveredOrders + needed)) * 100 <= 1.5
    // => deliveredOrders + needed >= currentCancelCount / 0.015
    const neededForCancel = Math.max(0, Math.ceil(currentCancelCount / (TARGET_CANCEL / 100) - deliveredOrders));
    const neededForMissing = Math.max(0, Math.ceil(currentMissingCount / (TARGET_MISSING / 100) - deliveredOrders));
    const neededForReturn = Math.max(0, Math.ceil(currentReturnCount / (TARGET_RETURN / 100) - deliveredOrders));

    const totalCleanOrdersNeeded = Math.max(neededForCancel, neededForMissing, neededForReturn);

    // Başarı Durumu
    const isCancelOk = bestCaseCancelRate <= TARGET_CANCEL;
    const isMissingOk = bestCaseMissingRate <= TARGET_MISSING;
    const isReturnOk = bestCaseReturnRate <= TARGET_RETURN;
    const isAchievable = isCancelOk && isMissingOk && isReturnOk;

    // Seviye 1 vs Seviye 2 komisyon tasarrufu (~ %1.5 komisyon farkı)
    const monthlyCommissionSaving = Math.round(monthlyRevenue * 0.015);

    return {
      projectedRemaining,
      projectedTotal,
      bestCaseCancelRate,
      bestCaseMissingRate,
      bestCaseReturnRate,
      totalCleanOrdersNeeded,
      isAchievable,
      isCancelOk,
      isMissingOk,
      isReturnOk,
      monthlyCommissionSaving,
    };
  }, [deliveredOrders, currentCancelRate, currentMissingRate, currentReturnRate, remainingDays, dailyOrders, monthlyRevenue]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>SEVİYE 1 KURTARMA SİMÜLATÖRÜ</Text>
            <Text style={styles.headerSub}>Komisyon Tasarrufu & Kalite Baraj Projeksiyonu</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Şube Seçimi */}
          {stores.length > 0 && (
            <View style={styles.storePickerBox}>
              <Text style={styles.sectionLabel}>ŞUBE SEÇİMİ:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storePillScroll}>
                {stores.map((s) => {
                  const isActive = s.storeId === activeStoreId;
                  return (
                    <TouchableOpacity
                      key={s.storeId}
                      onPress={() => setActiveStoreId(s.storeId)}
                      style={[styles.storePill, isActive && styles.storePillActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.storePillText, isActive && styles.storePillTextActive]}>
                        {s.storeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 1. Özet Sonuç Kartı (Hero) */}
          <View
            style={[
              styles.heroResultCard,
              simulation.isAchievable ? styles.heroCardSuccess : styles.heroCardWarning,
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons
                  name={simulation.isAchievable ? 'check-decagram' : 'alert-rhombus'}
                  size={16}
                  color={simulation.isAchievable ? '#059669' : '#D97706'}
                />
                <Text
                  style={[
                    styles.heroBadgeText,
                    { color: simulation.isAchievable ? '#059669' : '#D97706' },
                  ]}
                >
                  {simulation.isAchievable ? 'SEVİYE 1 KURTARILABİLİR' : 'YÜKSEK EFOR / RİSKLİ'}
                </Text>
              </View>

              <Text style={styles.savingTag}>
                +{simulation.monthlyCommissionSaving.toLocaleString('tr-TR')} ₺/ay Tasarruf
              </Text>
            </View>

            <Text style={styles.heroResultDesc}>
              {simulation.isAchievable
                ? `Kalan ${remainingDays} günde minimum ${simulation.totalCleanOrdersNeeded} adet sıfır hatalı teslimat yapılırsa Seviye 1 barajı aşılır!`
                : `Mevcut sipariş hızıyla Seviye 1'e ulaşmak için ek ${simulation.totalCleanOrdersNeeded - simulation.projectedRemaining} siparişe ihtiyaç var.`}
            </Text>

            {/* Hedef Kriterler Karşılaştırması */}
            <View style={styles.criteriaGrid}>
              <View style={styles.criteriaCol}>
                <Text style={styles.critLabel}>Tedarik İptal</Text>
                <Text style={[styles.critVal, { color: simulation.isCancelOk ? '#059669' : '#DC2626' }]}>
                  %{simulation.bestCaseCancelRate.toFixed(1)}
                </Text>
                <Text style={styles.critTarget}>Hedef ≤ %1.5</Text>
              </View>

              <View style={styles.critDivider} />

              <View style={styles.criteriaCol}>
                <Text style={styles.critLabel}>Eksik / Alternatif</Text>
                <Text style={[styles.critVal, { color: simulation.isMissingOk ? '#059669' : '#DC2626' }]}>
                  %{simulation.bestCaseMissingRate.toFixed(1)}
                </Text>
                <Text style={styles.critTarget}>Hedef ≤ %5.0</Text>
              </View>

              <View style={styles.critDivider} />

              <View style={styles.criteriaCol}>
                <Text style={styles.critLabel}>Müşteri İade</Text>
                <Text style={[styles.critVal, { color: simulation.isReturnOk ? '#059669' : '#DC2626' }]}>
                  %{simulation.bestCaseReturnRate.toFixed(1)}
                </Text>
                <Text style={styles.critTarget}>Hedef ≤ %1.0</Text>
              </View>
            </View>
          </View>

          {/* 2. Simülasyon Parametreleri & Sürgüler */}
          <View style={styles.paramsCard}>
            <Text style={styles.cardHeaderTitle}>PROJEKSİYON PARAMETRELERİ</Text>

            {/* Kalan Gün Sayısı */}
            <View style={styles.paramRow}>
              <View>
                <Text style={styles.paramTitle}>Dönem Sonuna Kalan Gün</Text>
                <Text style={styles.paramSub}>Ay sonuna kadar kalan süre</Text>
              </View>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  onPress={() => setRemainingDays((d) => Math.max(1, d - 1))}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="minus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{remainingDays} Gün</Text>
                <TouchableOpacity
                  onPress={() => setRemainingDays((d) => Math.min(30, d + 1))}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="plus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Günlük Sipariş Ortalaması */}
            <View style={styles.paramRow}>
              <View>
                <Text style={styles.paramTitle}>Günlük Tahmini Sipariş</Text>
                <Text style={styles.paramSub}>Şubenin günlük ortalama hacmi</Text>
              </View>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  onPress={() => setDailyOrders((o) => Math.max(5, o - 5))}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="minus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{dailyOrders} Adet</Text>
                <TouchableOpacity
                  onPress={() => setDailyOrders((o) => Math.min(100, o + 5))}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="plus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tahmini Aylık Ciro */}
            <View style={styles.paramRow}>
              <View>
                <Text style={styles.paramTitle}>Aylık Tahmini Ciro (₺)</Text>
                <Text style={styles.paramSub}>Komisyon kazancı hesabı için</Text>
              </View>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  onPress={() => setMonthlyRevenue((c) => Math.max(50000, c - 25000))}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="minus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{(monthlyRevenue / 1000).toFixed(0)}k ₺</Text>
                <TouchableOpacity
                  onPress={() => setMonthlyRevenue((c) => c + 25000)}
                  style={styles.stepBtn}
                >
                  <MaterialCommunityIcons name="plus" size={14} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 3. Operasyonel Eylem Planı */}
          <View style={styles.actionPlanCard}>
            <View style={styles.actionPlanHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#D97706" />
              <Text style={styles.actionPlanTitle}>SEVİYE 1 OPERASYON TAVSİYELERİ</Text>
            </View>

            <View style={styles.tipRow}>
              <Text style={styles.tipDot}>•</Text>
              <Text style={styles.tipText}>
                <Text style={{ fontWeight: '700' }}>Tedarik İptali Sıfırlama:</Text> Rafta bulunmayan veya tükenen ürünleri Trendyol panelinden derhal pasife alın.
              </Text>
            </View>

            <View style={styles.tipRow}>
              <Text style={styles.tipDot}>•</Text>
              <Text style={styles.tipText}>
                <Text style={{ fontWeight: '700' }}>Alternatif Ürün Onayı:</Text> Müşteri ile iletişime geçerek birebir muadil ürün önerisinde bulunun; onay alarak siparişi kurtarın.
              </Text>
            </View>

            <View style={styles.tipRow}>
              <Text style={styles.tipDot}>•</Text>
              <Text style={styles.tipText}>
                <Text style={{ fontWeight: '700' }}>Komisyon Avantajı:</Text> Seviye 1'e ulaşıldığında Trendyol Go komisyon oranı %1-%2 oranında düşer ve mağaza sıralamada üstlere çıkar.
              </Text>
            </View>
          </View>

          {/* Kapat Butonu */}
          <Button title="Simülatörü Kapat" variant="primary" size="md" onPress={onClose} style={{ marginTop: 8 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  storePickerBox: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  storePillScroll: {
    flexDirection: 'row',
  },
  storePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  storePillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  storePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  storePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroResultCard: {
    padding: 14,
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    marginBottom: 12,
  },
  heroCardSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  heroCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  savingTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  heroResultDesc: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '500',
  },
  criteriaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  criteriaCol: {
    flex: 1,
    alignItems: 'center',
  },
  critDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  critLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  critVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  critTarget: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  paramsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  paramTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  paramSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 2,
  },
  stepBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  stepVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 54,
    textAlign: 'center',
  },
  actionPlanCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 10,
  },
  actionPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  actionPlanTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  tipDot: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '800',
  },
  tipText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
    flex: 1,
  },
});
